import { z } from 'zod'
import { Feature, } from '@soederpop/luca'
import { FeatureOptionsSchema, FeatureStateSchema } from '@soederpop/luca/schemas'
import type { AGIContainer, NodeContainer, Assistant, AssistantsManager } from '@soederpop/luca/agi'
import { SpeechStreamer } from '../voice/speech-streamer'

type PhraseManifestEntry = {
	id: string
	text: string
	tag: string
	voice: string
	provider: string
	format: string
	file: string
}

const EXIT_PHRASES = /\b(peace\s*out|later|bye|goodbye|see\s*ya|i'm\s*out|deuces|aight\s*bet|that's\s*all|shut\s*up)\b/i

type VoiceConfig = {
	voiceId: string
	modelId?: string
	voiceSettings?: any
	conversationModePrefix?: string
	maxChunkLength?: number
}

export const VoiceChatOptionsSchema = FeatureOptionsSchema.extend({
	voiceId: z.string().optional(),
	assistant: z.string(),
	historyMode: z.string().default('lifecycle').describe('how to persist history across chats, defaults to no persistence.'),
	playPhrases: z.boolean().default(false),
	toolPhraseWindowSeconds: z.number().default(15).describe('Minimum seconds between tool call/result/error phrases'),
	appendPrompt: z.string().optional(),
	prependPrompt: z.string().optional(),
})

export type CapabilityResult = {
	available: boolean
	missing: string[]
}

export const VoiceChatStateSchema = FeatureStateSchema.extend({
	conversing: z.boolean().default(false),
	started: z.boolean().default(false),
	turnCount: z.number().default(0),
	capabilitiesChecked: z.boolean().default(false),
	ttsAvailable: z.boolean().default(false),
	capabilityMissing: z.array(z.string()).default([]),
})

export type VoiceChatOptions = z.infer<typeof VoiceChatOptionsSchema>
export type VoiceChatState = z.infer<typeof VoiceChatStateSchema>

/**
 * Standalone conversational voice chat feature.
 * Wraps an Assistant + SpeechStreamer pair for streaming TTS conversations.
 * Can be instantiated with any assistant folder, voice, and settings.
 */
export class VoiceChat extends Feature<VoiceChatState, VoiceChatOptions> {
	static override shortcut = 'features.voiceChat' as const
	static override optionsSchema = VoiceChatOptionsSchema
	static override stateSchema = VoiceChatStateSchema
	
	static {
		Feature.register(this as any, 'voiceChat')
	}

	// Capability resolution (memoized per instance)
	private _capabilitiesChecked = false
	private _ttsAvailable = false

	override get initialState(): VoiceChatState {
		return {
			...super.initialState,
			conversing: false,
			turnCount: 0,
		}
	}
	
	get assistantsManager() : AssistantsManager {
		return this.container.feature('assistantsManager') as AssistantsManager
	}

	get assistant() : Assistant {
		if (!this.assistantsManager) {
			throw new Error('AssistantsManager not found')
		}

		return this.assistantsManager.create(this.options.assistant, {
			...(this.options.prependPrompt ? { prependPrompt: this.options.prependPrompt } : {}),
			...(this.options.appendPrompt ? { appendPrompt: this.options.appendPrompt } : {}),
			...(this.options.historyMode ? { historyMode: this.options.historyMode } : {}),
		})
	}

	async start() {
		if(this.isStarted) {
			return this
		}

		const caps = await this.checkCapabilities()
		if (!caps.available) {
			this.emit('info', `[voice-chat] cannot start — missing: ${caps.missing.join(', ')}`)
			return this
		}

		await this.assistantsManager.discover()

		await this.assistant.start()
		this.state.set('started', true)

		this.loadPhraseManifest()
		this.wireUpResponseEvents()

		this.emit('started')
		return this
	}

	private speechStreamer?: SpeechStreamer
	private _phraseManifest: PhraseManifestEntry[] = []
	private _phrasesByTag: Map<string, PhraseManifestEntry[]> = new Map()
	private _lastPhraseByTag: Map<string, string> = new Map()
	private _lastToolPhraseAt: number = 0

	get isMuted() : boolean {
		return this.state.get('muted') === true
	}

	mute() {
		this.state.set('muted', true)
		return this
	}
	
	unmute() {
		this.state.set('muted', false)
		return this
	}

	// This sets up the event bindings on the assistant so that
	// when we get response chunks, they get pushed to the speech streamer
	// and when a turn is finished, we reset the speech streamer
	wireUpResponseEvents() {
		this.speechStreamer = this.createSpeechStreamer()

		this.assistant.on('chunk', (chunk: string) => {
			this.emit('debug', `assistant: ${chunk}`)
			if (this.isMuted) return
			this.speechStreamer!.push(chunk)
		})

		this.assistant.on('response', async () => {
			console.log('assistant response finished')
			await this.speechStreamer!.finish()
			// Reset for next exchange
			this.speechStreamer = this.createSpeechStreamer()
			this.state.set('turnCount', (this.state.get('turnCount') ?? 0) + 1)
		})

		this.assistant.on('toolCall', (name: string, args: any) => {
			this.emit('toolCall', { name, args })
			this.emit('info', `Tool call: ${name} ${JSON.stringify(args || {})}`)
			this.playToolcallPhrase()
		})

		this.assistant.on('toolResult', (name: string, result: any) => {
			this.emit('toolResult', { name, result })
			this.emit('info', `Tool result: ${name}`)
			this.playToolResultPhrase()
		})

		this.assistant.on('toolError', (name: string, error: any) => {
			this.emit('toolError', { name, error })
			this.emit('info', `Tool error: ${name} ${error}`)
			this.playToolErrorPhrase()
		})
	}

	get isStarted() : boolean {
		return !!this.state.get('started')
	}

	/** Whether the chat is currently in conversation mode. */
	get isConversing(): boolean {
		return !!this.state.get('conversing')
	}
	
	get voiceConfig() : VoiceConfig {
		return this.state.get('voiceConfig') || this.readVoiceConfig()
	}
	
	readVoiceConfig() {
		const yaml = this.container.feature('yaml')
		const fs = this.container.feature('fs')

		const voiceConfigPath = this.assistant.paths.join('voice.yaml')

		if (!fs.exists(voiceConfigPath)) {
			throw new Error(`[voice-chat] voice.yaml not found at ${voiceConfigPath}`)
		}

		const voiceConfig = yaml.parse(fs.readFile(voiceConfigPath))

		this.state.set('voiceConfig', voiceConfig)

		return voiceConfig
	}
	
	async checkCapabilities(): Promise<CapabilityResult> {
		if (this._capabilitiesChecked) {
			return {
				available: this._ttsAvailable,
				missing: (this.state.get('capabilityMissing') as string[]) ?? [],
			}
		}

		const missing: string[] = []

		// ElevenLabs API key
		if (!process.env.ELEVENLABS_API_KEY) {
			missing.push('ELEVENLABS_API_KEY env var')
		}

		// voice.yaml with a voiceId for this assistant
		let hasVoiceConfig = false
		try {
			const fs = this.container.feature('fs')
			const voiceConfigPath = this.assistant.paths.join('voice.yaml')
			if (fs.exists(voiceConfigPath)) {
				const yaml = this.container.feature('yaml')
				const cfg = yaml.parse(fs.readFile(voiceConfigPath))
				hasVoiceConfig = !!cfg?.voiceId
			}
		} catch {}
		if (!hasVoiceConfig) missing.push(`voice.yaml for ${this.options.assistant}`)

		this._ttsAvailable = missing.length === 0
		this._capabilitiesChecked = true

		this.state.setState({
			capabilitiesChecked: true,
			ttsAvailable: this._ttsAvailable,
			capabilityMissing: missing,
		})

		return { available: this._ttsAvailable, missing }
	}

	async speakPhrase(phrase: string) {
		if (!this._ttsAvailable) {
			this.emit('info', `[voice-chat] TTS unavailable, skipping speakPhrase`)
			return this
		}
		const streamer = this.createSpeechStreamer()
		await streamer.push(phrase)
		await streamer.finish()
		return this
	}
	
	createSpeechStreamer() {
		const config = this.voiceConfig
		
		const options: any = {
			container: this.container as AGIContainer & NodeContainer,
			voiceId: config.voiceId,
			modelId: config.modelId || "eleven_v3",
			voiceSettings: config.voiceSettings,
			conversationModePrefix: config.conversationModePrefix,
			maxChunkLength: config.maxChunkLength || 250,
			debug: false //true
		}
		
		const speechStreamer = new SpeechStreamer(options)

		return speechStreamer
	}

	/** Loads the phrase manifest JSON from the assistant's generated folder and indexes by tag. */
	loadPhraseManifest(): void {
		const fs = this.container.feature('fs')
		const manifestPath = this.assistant.paths.join('generated', 'manifest.json')

		if (!fs.exists(manifestPath)) {
			console.log('[voice-chat] no phrase manifest found — run: luca voice --generateSounds')
			return
		}

		try {
			const raw = JSON.parse(fs.readFile(manifestPath)) as PhraseManifestEntry[]
			const valid = raw.filter((entry) => fs.exists(entry.file))

			this._phraseManifest = valid
			this._phrasesByTag = new Map()

			for (const entry of valid) {
				const tag = entry.tag || 'default'
				if (!this._phrasesByTag.has(tag)) this._phrasesByTag.set(tag, [])
				this._phrasesByTag.get(tag)!.push(entry)
			}
		} catch (err: any) {
			console.error('[voice-chat] failed to load phrase manifest:', err.message)
		}
	}

	/** Returns a random phrase file path for the given tag, avoiding repeats. */
	randomPhrase(tag: string): string | null {
		if (!this._phraseManifest.length) return null

		const pool = this._phrasesByTag.get(tag)
		if (!pool || pool.length === 0) {
			const fallback = this._phrasesByTag.get('generic-ack') || []
			if (fallback.length === 0) return null
			const idx = Math.floor(Math.random() * fallback.length)
			const chosenFallback = fallback[idx]
			if (!chosenFallback) return null
			return chosenFallback.file
		}

		const lastPlayed = this._lastPhraseByTag.get(tag)
		const candidates = pool.length > 1 ? pool.filter((p) => p.file !== lastPlayed) : pool
		const idx = Math.floor(Math.random() * candidates.length)
		const chosen = candidates[idx]
		if (!chosen) return null
		const chosenFile = chosen.file
		if (!chosenFile) return null
		this._lastPhraseByTag.set(tag, chosenFile)

		return chosenFile
	}

	/** Plays a random audio phrase for the given tag using afplay. */
	playPhrase(tag: string): void {
		const file = this.randomPhrase(tag)
		if (!file) return
		this.container.proc.exec(`afplay "${file}"`)
	}

	private get toolPhraseWindowMs(): number {
		const seconds = this.options.toolPhraseWindowSeconds ?? 15
		return seconds * 1000
	}

	private canPlayToolPhrase(): boolean {
		if (this.isMuted) return false

		const now = Date.now()

		if (!this._lastToolPhraseAt) {
			this._lastToolPhraseAt = now
			return true
		}

		if (now - this._lastToolPhraseAt >= this.toolPhraseWindowMs) {
			this._lastToolPhraseAt = now
			return true
		}

		return false
	}

	/**
	 * Send a message to the assistant and stream the response as speech.
	 * Returns the full text response.
	 */
	async say(text: string): Promise<string> {
		if (!this.isStarted) {
			await this.start()
		}
		if (!this.isStarted) {
			this.emit('info', `[voice-chat] skipping say() — TTS not available`)
			return ''
		}

		if (this.isConversing) {
			this.emit('info', 'Waiting for conversation to finish')
			await this.waitFor('finished')
		}

		this.state.set('conversing', true)
		const response = await this.assistant.ask(text)
		this.state.set('conversing', false)
		this.emit('finished')
		
		// Block until all afplay processes are finished
		while(this.container.proc.isProcessRunning('afplay')) {
			this.emit('info', 'Waiting for afplay to finish')
			await this.container.sleep(20)
		}

		return response
	}

	/**
	 * Ask the assistant a question. Alias for say().
	 */
	async ask(text: string): Promise<string> {
		return this.say(text)
	}
	
	playToolcallPhrase() {
		if(this.isMuted) return
		if (!this.options.playPhrases) return
		if (!this.canPlayToolPhrase()) return
	}

	playToolResultPhrase() {
		if(this.isMuted) return
		if (!this.options.playPhrases) return
		if (!this.canPlayToolPhrase()) return
	}
	
	playToolErrorPhrase() {
		if(this.isMuted) return
		if (!this.options.playPhrases) return
		if (!this.canPlayToolPhrase()) return
	}
}

export default VoiceChat

