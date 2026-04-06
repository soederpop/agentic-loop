import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '@soederpop/luca'
import { Feature, features } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    voiceListener: typeof VoiceListener
  }
}

export type CapabilityResult = {
  available: boolean
  missing: string[]
}

export const VoiceListenerStateSchema = FeatureStateSchema.extend({
  waitingForTriggerWord: z.boolean().default(false),
  triggerProcessPids: z.array(z.number()).default([]),
  receivedTriggerError: z.boolean().default(false),
  recording: z.boolean().default(false),
  locked: z.boolean().default(false),
  lockedAt: z.number().optional(),
  capabilitiesChecked: z.boolean().default(false),
  wakeWordAvailable: z.boolean().default(false),
  sttAvailable: z.boolean().default(false),
  capabilityMissing: z.array(z.string()).default([]),
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
  private static IMMEDIATE_THRESHOLD = 0.45
  private static CONFIRM_THRESHOLD = 0.35
  private static CONFIRM_COUNT = 2

  // Capability resolution (memoized per instance, like gws._resolved)
  private _capabilitiesChecked = false
  private _wakeWordAvailable = false
  private _sttAvailable = false
  private _rustpotterBin: string | null = null

  static {
	  Feature.register(this, 'voiceListener')
  }

  get isLocked() {
    return this.state.get('locked') === true
  }
	
	/**
	 * Lock the listener, preventing it from reacting to wakewords until it is unlocked
	 * @returns {VoiceListener}
	 */
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

	/**
	 * Unlock the listener, allowing it to react to wakewords
	 * @returns {VoiceListener}
	 */
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
	/**
	 * Get the current input volume
	* @returns {number}
	*/
	get currentInputVolume() : number {
		try {
			const cmd = `osascript -e "input volume of (get volume settings)"`  
			const value = this.container.proc.exec(cmd).trim()
			return parseInt(value, 10)
		} catch (error) {
			console.error('Error getting input volume', error)
			return 0
		}
	}
	
	set currentInputVolume(val: number) {
		const cmd = `osascript -e "set volume input volume ${val}"`

		try {
			this.container.proc.exec(cmd)
		} catch (error) {
			console.error('Error setting input volume', error)
		}
	}

  async checkCapabilities(): Promise<CapabilityResult> {
    if (this._capabilitiesChecked) {
      return {
        available: this._wakeWordAvailable || this._sttAvailable,
        missing: (this.state.get('capabilityMissing') as string[]) ?? [],
      }
    }

    const proc = this.container.feature('proc')
    const fs = this.container.feature('fs')
    const missing: string[] = []

    // Wake word: rustpotter binary
    try {
      const result = proc.exec('which rustpotter').trim()
      if (result) this._rustpotterBin = result
    } catch {}
    if (!this._rustpotterBin) missing.push('rustpotter binary')

    // Wake word: .rpw model files
    let modelCount = 0
    try {
      const entries = await fs.readdir(this.modelsDir)
      modelCount = entries.filter((e: string) => e.endsWith('.rpw')).length
    } catch {}
    if (modelCount === 0) missing.push('.rpw wake word model files')

    this._wakeWordAvailable = !!this._rustpotterBin && modelCount > 0

    // STT: sox binary
    let hasSox = false
    try {
      const result = proc.exec('which sox').trim()
      if (result) hasSox = true
    } catch {}
    if (!hasSox) missing.push('sox binary')

    // STT: mlx_whisper binary
    let hasWhisper = false
    try {
      const result = proc.exec('which mlx_whisper').trim()
      if (result) hasWhisper = true
    } catch {}
    if (!hasWhisper) missing.push('mlx_whisper binary')

    this._sttAvailable = hasSox && hasWhisper
    this._capabilitiesChecked = true

    this.state.setState({
      capabilitiesChecked: true,
      wakeWordAvailable: this._wakeWordAvailable,
      sttAvailable: this._sttAvailable,
      capabilityMissing: missing,
    })

    return {
      available: this._wakeWordAvailable || this._sttAvailable,
      missing,
    }
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

  /**
   * Scan voice-enabled assistants' voice.yaml for wakeWordModel + wakeWordThreshold.
   * Returns a Map of model filename → threshold.
   */
  loadModelThresholds(): Map<string, number> {
    const thresholds = new Map<string, number>()
    try {
      const manager = this.container.feature('assistantsManager' as any) as any
      const fs = this.container.feature('fs')
      const yaml = this.container.feature('yaml')

      for (const entry of (manager.list?.() || [])) {
        if (!entry.hasVoice) continue
        try {
          const voicePath = this.container.paths.resolve(entry.folder, 'voice.yaml')
          if (!fs.exists(voicePath)) continue
          const config = yaml.parse(fs.readFile(voicePath))
          if (config?.wakeWordModel && config?.wakeWordThreshold != null) {
            thresholds.set(config.wakeWordModel, config.wakeWordThreshold)
          }
        } catch {}
      }
    } catch {}
    return thresholds
  }

  async waitForTriggerWord() {
	  console.log('Waiting for trigger word')

	// Use cached capability check instead of bare `which` call
	const caps = await this.checkCapabilities()
	if (!this._wakeWordAvailable) {
		this.emit('triggerWordErrorOutput', `Wake word unavailable: ${caps.missing.join(', ')}`)
		return this
	}

	const bin = this._rustpotterBin!

	if (this.state.get('waitingForTriggerWord')) {
		return this
	}

	this.state.set('waitingForTriggerWord', true)

	const fs = this.container.feature('fs')
	const entries = await fs.readdir(this.modelsDir)
	const modelFiles = entries.filter((e: string) => e.endsWith('.rpw'))

	// Build a map of model filename → threshold from assistant voice.yaml configs
	const modelThresholds = this.loadModelThresholds()

	const modelPaths = modelFiles.map((e: string) => `${this.modelsDir}/${e}`)

	const listener = this
	const pids: number[] = []
	let exited = 0

	for (const modelPath of modelPaths) {
		const modelFilename = modelPath.split('/').pop()!
		const threshold = modelThresholds.get(modelFilename) || 0.35
		const args = ['spot', '-t', String(threshold), '-m', '5', '-e', '-d', '-g', '--band-pass', modelPath]

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
