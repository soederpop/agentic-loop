import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '@soederpop/luca'
import { Feature, features } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    voiceListener: typeof VoiceListener
  }
}

export const VoiceListenerStateSchema = FeatureStateSchema.extend({
  waitingForTriggerWord: z.boolean().default(false),
  triggerProcessPids: z.array(z.number()).default([]),
  receivedTriggerError: z.boolean().default(false),
  recording: z.boolean().default(false),
  locked: z.boolean().default(false),
  lockedAt: z.number().optional(),
})
export type VoiceListenerState = z.infer<typeof VoiceListenerStateSchema>

export const VoiceListenerEventsSchema = FeatureEventsSchema.extend({
  triggerWord: z.tuple([z.string()]),
  triggerWordErrorOutput: z.tuple([z.string()]),
  output: z.tuple([z.string()]),
  'recording:start': z.tuple([]),
  'recording:stop': z.tuple([]),
  preview: z.tuple([z.string()]),
  vu: z.tuple([z.number()]),
  locked: z.tuple([]),
  unlocked: z.tuple([]),
})

export const VoiceListenerOptionsSchema = FeatureOptionsSchema.extend({
	verbose: z.boolean().default(false).describe('Whether to display debug log output from rustpotter'),
	debug: z.boolean().default(false).describe('Whether to display debug log output from the feature'),
})

export type VoiceListenerOptions = z.infer<typeof VoiceListenerOptionsSchema>

/**
 * WhisperMLX server side based listener
 *
 * @example
 * ```typescript
 * const voiceListener = container.feature('voiceListener')
 * ```
 *
 * @extends Feature
 */
export class VoiceListener extends Feature<VoiceListenerState, VoiceListenerOptions> {
  static override shortcut = 'features.voiceListener' as const
  static override stateSchema = VoiceListenerStateSchema
  static override optionsSchema = VoiceListenerOptionsSchema
  static override eventsSchema = VoiceListenerEventsSchema

  private lockTimeout: ReturnType<typeof setTimeout> | null = null
  private static LOCK_TIMEOUT_MS = 2 * 60 * 1000

  // Sliding window for soft detection confirmation
  private detectionWindow: Map<string, { score: number; time: number }[]> = new Map()
  private static WINDOW_MS = 5000
  private static IMMEDIATE_THRESHOLD = 0.5
  private static CONFIRM_THRESHOLD = 0.35
  private static CONFIRM_COUNT = 2

  static {
	  Feature.register(this, 'voiceListener')
  }

  constructor(options: VoiceListenerOptions, context: ContainerContext) {
    super(options, context)
  }

  get isLocked() {
    return this.state.get('locked') === true
  }

  lock() {
    this.state.set('locked', true)
    this.state.set('lockedAt', Date.now())
    this.emit('locked')

    if (this.lockTimeout) clearTimeout(this.lockTimeout)

    this.lockTimeout = setTimeout(() => {
      this.unlock()
    }, VoiceListener.LOCK_TIMEOUT_MS)

    return this
  }

  unlock() {
    if (this.lockTimeout) {
      clearTimeout(this.lockTimeout)
      this.lockTimeout = null
    }

    this.state.set('locked', false)
    this.state.set('lockedAt', undefined)
    this.emit('unlocked')

    return this
  }

  async stopWaitingForTriggerWord() {
	if (!this.state.get('waitingForTriggerWord')) {
		return this
	}

	const pids = this.state.get('triggerProcessPids') || []

	for (const pid of pids) {
		this.container.proc.kill(pid)
	}

	this.state.set('triggerProcessPids', [])

	console.log('stopped listener wakeword')

	return this
  }

  private parseDetectionScore(str: string): { name: string; score: number } | null {
	const nameMatch = str.match(/name:\s*"([^"]+)"/)
	const scoreMatch = str.match(/(?<![a-z_])score:\s*([\d.]+)/)
	if (!nameMatch || !scoreMatch) return null
	return { name: nameMatch[1].replace(/\s+/g, '_'), score: parseFloat(scoreMatch[1]) }
  }

  private pruneWindow(wakeword: string) {
	const now = Date.now()
	const entries = this.detectionWindow.get(wakeword) || []
	const pruned = entries.filter(e => now - e.time < VoiceListener.WINDOW_MS)
	this.detectionWindow.set(wakeword, pruned)
	return pruned
  }

  private shouldWake(wakeword: string, score: number): boolean {
	// Immediate wake on high confidence
	if (score >= VoiceListener.IMMEDIATE_THRESHOLD) return true

	// Track in sliding window for confirmation
	if (score >= VoiceListener.CONFIRM_THRESHOLD) {
		const entries = this.pruneWindow(wakeword)
		entries.push({ score, time: Date.now() })
		this.detectionWindow.set(wakeword, entries)

		if (entries.length >= VoiceListener.CONFIRM_COUNT) {
			// Clear the window after confirming so we don't re-trigger
			this.detectionWindow.set(wakeword, [])
			return true
		}
	}

	return false
  }

  react(wakeword: string) {
	  if (!this.isLocked) {
		  this.emit('triggerWord', wakeword)
	  }
  }

  get modelsDir() {
	return this.container.paths.resolve('voice', 'wakeword', 'models')
  }

  async waitForTriggerWord() {
	  console.log('Waiting for trigger word')

	const bin = this.container.proc.exec(`which rustpotter`).trim() 

	if (this.state.get('waitingForTriggerWord')) {
		return this
	}

	this.state.set('waitingForTriggerWord', true)

	const fs = this.container.feature('fs')
	const entries = await fs.readdir(this.modelsDir)
	const modelPaths = entries
		.filter((e: string) => e.endsWith('.rpw'))
		.map((e: string) => `${this.modelsDir}/${e}`)

	if (modelPaths.length === 0) {
		this.emit('triggerWordErrorOutput', 'No .rpw model files found in models directory')
		this.state.set('waitingForTriggerWord', false)
		return this
	}

	const listener = this
	const pids: number[] = []
	let exited = 0

	for (const modelPath of modelPaths) {
		const args = ['spot', '-t', '0.35', '-m', '5', '-e', '-d', '-g', '--band-pass', modelPath]

		this.container.proc.spawnAndCapture(
			bin,
			args,
			{
				onOutput: (str: any) => {
					if(this.options.verbose || this.options.debug) {
						console.log('output', str)
					}

					// Only act on full detections (not partials)
					if(str.startsWith('Wakeword detection')) {
						const detection = this.parseDetectionScore(str)
						if (!detection) return

						if(this.options.verbose || this.options.debug) {
							console.log(`detection: ${detection.name} score=${detection.score.toFixed(3)}`)
						}

						if (!this.shouldWake(detection.name, detection.score)) return

						const isAfPLayRunning = this.container.proc.isProcessRunning('afplay')

						if (!isAfPLayRunning) {
							listener.react(detection.name)
						} else {
							this.emit('info', 'Skipping trigger word because afplay is running')
							this.emit('skippedTriggerWord', detection.name)
						}
					}
				},
				onError: (str) => {
					this.emit('triggerWordErrorOutput', str)
					this.state.set('receivedTriggerError', true)
				},
				onExit: () => {
					exited++
					if (exited >= modelPaths.length) {
						listener.state.set('waitingForTriggerWord', false)
					}
				},
				onStart: (childProcess: any) => {
					if (typeof childProcess.pid !== 'number') return
					
					if (this.options.debug || this.options.verbose) {
						console.log('rustpotter started', childProcess.pid)
					}

					pids.push(childProcess.pid)
					listener.state.set('triggerProcessPids', [...pids])
				}
			}
		)
	}

	return this
  }

  async listen(options?: { silenceTimeout?: number }) : Promise<string> {
        const { container } = this
	const proc = container.feature('proc')

	const transcriptLines : string[] = []
	let viewingTranscription = false

	const scriptPath = container.paths.resolve('scripts', 'dictate')
	const args = options?.silenceTimeout
		? ['-c', `WAIT_TIMEOUT=${options.silenceTimeout} ${scriptPath}`]
		: [scriptPath]

	await proc.spawnAndCapture('sh', args, {
		onOutput: (output: string) => {
			output = String(output).trim()

			// Parse VU meter readings from the speech detection phase
			if (output.startsWith('VU:')) {
				const level = parseFloat(output.slice(3))
				if (!isNaN(level)) this.emit('vu', level)
				return
			}

			// No speech detected within the timeout
			if (output === '---NO_SPEECH_DETECTED---') {
				return
			}

			this.emit('output', output)

			if (!viewingTranscription && output.startsWith('Recording...')) {
				this.state.set('recording', true)
				this.emit('recording:start')
			}

			if (!viewingTranscription && output.startsWith('Transcribing with mlx-whisper')) {
				this.state.set('recording', false)
				this.emit('recording:stop')
			}

			if (viewingTranscription && output.match(/END_TRANSCRIPT/)) {
				this.state.set('recording', false)
				viewingTranscription = false
			}

			if (viewingTranscription) {
				transcriptLines.push(output.trim())
				this.emit('preview', transcriptLines.join("\n"))
			}

			if (output.match(/START_TRANSCRIPT/)) {
				viewingTranscription = true
			}
		}
	})

	return transcriptLines.join("\n")
  }
}

export default VoiceListener 
