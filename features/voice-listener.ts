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
  receivedTriggerError: z.boolean().default(false),
  recording: z.boolean().default(false),
  locked: z.boolean().default(false),
  lockedAt: z.number().optional(),
  capabilitiesChecked: z.boolean().default(false),
  sttAvailable: z.boolean().default(false),
  capabilityMissing: z.array(z.string()).default([]),
  inputMode: z.enum(['continuous', 'off']).default('off'),
  continuousListening: z.boolean().default(false),
  initialCommandText: z.string().default(''),
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
	debug: z.boolean().default(false).describe('Whether to display debug log output from the feature'),
	triggerPhrases: z.array(z.string()).default([
	  'hey chief',
	  'yo chief',
	  'hi chief',
	  'ok chief',
	  'okay chief',
	  'hey friday',
	  'yo friday',
	  'hi friday',
	  'ok friday',
	  'okay friday',
	]),
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

  // Capability resolution (memoized per instance)
  private _capabilitiesChecked = false
  private _sttAvailable = false
  private _continuousProcessPid: number | null = null

  static {
	  Feature.register(this, 'voiceListener')
  }

  get isLocked() {
    return this.state.get('locked') === true
  }

  get inputMode() {
    return this.state.get('inputMode') as 'continuous' | 'off'
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
        available: this._sttAvailable,
        missing: (this.state.get('capabilityMissing') as string[]) ?? [],
      }
    }

    const proc = this.container.feature('proc')
    const missing: string[] = []

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
      sttAvailable: this._sttAvailable,
      capabilityMissing: missing,
      inputMode: 'off',
    })

    return {
      available: this._sttAvailable,
      missing,
    }
  }

  async stopContinuousListening() {
    if (this._continuousProcessPid) {
      this.container.proc.kill(this._continuousProcessPid)
      this._continuousProcessPid = null
    }

    this.state.set('continuousListening', false)
    return this
  }

  react(wakeword: string) {
	  if (this.container.feature('fs').exists(this.container.paths.resolve('MUTE'))) {
		  return
	  }

	  if (!this.isLocked) {
      this.state.set('initialCommandText', '')
		  this.emit('triggerWord', wakeword)
	  }
  }

  private normalizeTranscript(text: string) {
    return text
      .toLowerCase()
      .replace(/[“”"'`]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  private matchTriggerPhrase(transcript: string): { wakeword: string; commandText: string } | null {
    const normalized = this.normalizeTranscript(transcript)

    for (const phrase of this.options.triggerPhrases) {
      const normalizedPhrase = this.normalizeTranscript(phrase)
      if (!normalizedPhrase) continue
      if (normalized === normalizedPhrase || normalized.startsWith(`${normalizedPhrase} `)) {
        return {
          wakeword: normalizedPhrase.replace(/\s+/g, '_'),
          commandText: normalized.slice(normalizedPhrase.length).trim(),
        }
      }
    }

    return null
  }

  async startContinuousListening() {
    const caps = await this.checkCapabilities()
    if (!this._sttAvailable) {
      this.emit('triggerWordErrorOutput', `Continuous listening unavailable: ${caps.missing.join(', ')}`)
      return this
    }

    if (this.state.get('continuousListening')) {
      return this
    }

    this.state.set('continuousListening', true)
    this.state.set('initialCommandText', '')

    const scriptPath = this.container.paths.resolve('scripts', 'dictate-loop')
    const transcriptLines: string[] = []
    let viewingTranscript = false

    this.container.proc.spawnAndCapture('bash', [scriptPath, this.container.paths.resolve('tmp')], {
      onOutput: (output: string) => {
        const line = String(output).trim()
        if (!line) return

        this.emit('output', line)

        if (line === '---START_TRANSCRIPT---') {
          transcriptLines.length = 0
          viewingTranscript = true
          return
        }

        if (line === '---END_TRANSCRIPT---') {
          viewingTranscript = false
          const transcript = transcriptLines.join(' ').trim()
          const matched = this.matchTriggerPhrase(transcript)
          if (matched && !this.isLocked) {
            this.state.set('initialCommandText', matched.commandText)
            this.emit('triggerWord', matched.wakeword)
          }
          return
        }

        if (viewingTranscript) {
          transcriptLines.push(line)
          this.emit('preview', transcriptLines.join("\n"))
        }
      },
      onError: (str: string) => {
        this.emit('triggerWordErrorOutput', str)
      },
      onExit: () => {
        this._continuousProcessPid = null
        this.state.set('continuousListening', false)
      },
      onStart: (childProcess: any) => {
        if (typeof childProcess.pid === 'number') {
          this._continuousProcessPid = childProcess.pid
        }
      }
    })

    return this
  }

  private _listenPid: number | null = null

  /** Cancel an in-progress listen() call by killing the dictation process. */
  cancelListen() {
    if (this._listenPid) {
      this.container.proc.kill(this._listenPid)
      this._listenPid = null
      this.state.set('recording', false)
    }
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
		onStart: (child: any) => {
			this._listenPid = child.pid ?? null
		},
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

	this._listenPid = null
	return transcriptLines.join("\n")
  }
}

export default VoiceListener
