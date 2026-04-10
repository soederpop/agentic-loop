import { z } from 'zod'
import { Feature } from '@soederpop/luca'
import { FeatureOptionsSchema, FeatureStateSchema } from '@soederpop/luca/schemas'
import { WebSocketServer, WebSocket } from 'ws'
import type { Assistant, AssistantsManager } from '@soederpop/luca/agi'
import type { Server as HttpServer } from 'http'
import type VoiceMode from './voice-mode'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    chatService: typeof ChatService
  }
}


// ── Voice mode ──

export type VoiceModeState = 'off' | 'always'

// ── Protocol types ──

export type ChatMessageOut =
	| { type: 'init_ok'; sessionId: string; assistantId: string; historyLength: number }
	| { type: 'init_error'; message: string }
	| { type: 'assistant_message_start'; messageId: string }
	| { type: 'chunk'; messageId: string; textDelta: string }
	| { type: 'tool_start'; id: string; name: string; startedAt: number }
	| { type: 'tool_end'; id: string; name: string; ok: boolean; endedAt: number; durationMs: number; summary?: string; error?: string }
	| { type: 'assistant_message_complete'; messageId: string; text: string }
	| { type: 'voice_mode_changed'; mode: VoiceModeState }
	| { type: 'error'; message: string }

export type ChatMessageIn =
	| { type: 'init'; sessionId: string; assistantId?: string }
	| { type: 'user_message'; text: string; voice?: boolean }
	| { type: 'set_voice_mode'; mode: VoiceModeState }

// ── Session ──

export interface ChatSession {
	assistant: Assistant
	assistantId: string
	sessionKey: string
}

// ── Feature schemas ──

export const ChatServiceOptionsSchema = FeatureOptionsSchema.extend({
	defaultAssistant: z.string().default('chiefOfStaff').describe('Default assistant short name'),
	threadPrefix: z.string().default('chat').describe('Prefix for thread IDs, e.g. "web-chat" or "workflow-foo"'),
	historyMode: z.string().default('session').describe('History mode passed to assistant creation'),
})

export const ChatServiceStateSchema = FeatureStateSchema.extend({
	sessionCount: z.number().default(0),
	connectionCount: z.number().default(0),
})

export type ChatServiceOptions = z.infer<typeof ChatServiceOptionsSchema>
export type ChatServiceState = z.infer<typeof ChatServiceStateSchema>

/**
 * Context passed to custom message handlers.
 */
export interface MessageHandlerContext {
	ws: WebSocket
	session: ChatSession | null
	isProcessing: boolean
	/** Mark the connection as processing (prevents concurrent messages). */
	setProcessing: (v: boolean) => void
	/** Send a JSON message to this client. */
	send: (data: any) => void
	/** Stream an assistant response with the standard protocol events. */
	streamToSocket: (session: ChatSession, text: string) => Promise<string>
}

/**
 * A handler for custom message types beyond init/user_message.
 * Return true if the message was handled, false to ignore.
 */
export type CustomMessageHandler = (parsed: any, ctx: MessageHandlerContext) => Promise<boolean> | boolean

/**
 * Reusable real-time chat service.
 *
 * Manages WebSocket connections, assistant sessions, and the streaming
 * protocol (init → user_message → chunks/tool events → complete).
 *
 * Voice is handled via the assistant-native voiceMode feature.
 * When a voiceMode-attached assistant is set, voice toggling uses
 * the assistant's ext methods directly.
 */
export class ChatService extends Feature<ChatServiceState, ChatServiceOptions> {
	static override shortcut = 'features.chatService' as const
	static override optionsSchema = ChatServiceOptionsSchema
	static override stateSchema = ChatServiceStateSchema

	static {
		Feature.register(this as any, 'chatService')
	}

	private sessions = new Map<string, ChatSession>()
	private wss: WebSocketServer | null = null
	private customHandler: CustomMessageHandler | null = null

	/** The voice-enabled assistant (has voiceMode attached via assistant.use()) */
	private _voiceAssistant: Assistant | null = null
	private _voiceMode: VoiceMode | null = null
	private _voiceModeState: VoiceModeState = 'off'

	// ── Voice ──

	/**
	 * Set a voice-capable assistant (one that already has voiceMode attached).
	 * The chatService will use this assistant's voiceMode for voice toggling.
	 */
	setVoiceAssistant(assistant: Assistant, voiceMode: VoiceMode) {
		this._voiceAssistant = assistant
		this._voiceMode = voiceMode
		return this
	}

	get voiceAssistant(): Assistant | null {
		return this._voiceAssistant
	}

	get voiceMode(): VoiceMode | null {
		return this._voiceMode
	}

	get voiceModeState(): VoiceModeState {
		return this._voiceModeState
	}

	setVoiceModeState(mode: VoiceModeState) {
		this._voiceModeState = mode

		if (this._voiceMode) {
			if (mode === 'always') {
				this._voiceMode.enableVoiceMode()
			} else {
				this._voiceMode.disableVoiceMode()
			}
		}

		this.emit('voiceModeChanged', { mode })
		return this
	}

	/**
	 * Register a handler for custom message types (e.g. 'start_review').
	 * Called for any message that isn't 'init' or 'user_message'.
	 */
	onMessage(handler: CustomMessageHandler) {
		this.customHandler = handler
		return this
	}

	get assistantsManager(): AssistantsManager {
		return this.container.feature('assistantsManager') as AssistantsManager
	}

	override get initialState(): ChatServiceState {
		return {
			...super.initialState,
			sessionCount: 0,
			connectionCount: 0,
		}
	}

	// ── Public API ──

	/**
	 * Attach a WebSocket server to an existing HTTP server.
	 * Call this after your express/HTTP server is listening.
	 */
	attach(httpServer: HttpServer): WebSocketServer {
		if (this.wss) return this.wss

		this.wss = new WebSocketServer({ server: httpServer })

		this.wss.on('connection', (ws: WebSocket) => {
			this.handleConnection(ws)
		})

		this.emit('attached')
		return this.wss
	}

	/**
	 * Create a standalone WebSocket server on a given port.
	 */
	listen(port: number, host = '0.0.0.0'): WebSocketServer {
		if (this.wss) return this.wss

		this.wss = new WebSocketServer({ port, host })

		this.wss.on('connection', (ws: WebSocket) => {
			this.handleConnection(ws)
		})

		this.emit('listening', { port, host })
		return this.wss
	}

	/**
	 * Resolve a short assistant name to its full registered name.
	 */
	resolveAssistantName(shortName: string): string | null {
		const entries = this.assistantsManager.list()
		const match = entries.find(
			(e) => e.name === shortName || e.name === `assistants/${shortName}`,
		)
		return match ? match.name : null
	}

	/**
	 * List available assistants as { id, name } pairs.
	 */
	listAssistants(): Array<{ id: string; name: string }> {
		return this.assistantsManager.list().map((e) => {
			const shortName = e.name.replace(/^assistants\//, '')
			return { id: shortName, name: shortName }
		})
	}

	/**
	 * Get or create a session for the given sessionId + assistantId combo.
	 * When a voice assistant is set, its assistant is used as the session assistant.
	 */
	async getOrCreateSession(sessionId: string, assistantId: string): Promise<ChatSession | null> {
		const fullName = this.resolveAssistantName(assistantId)
		if (!fullName) return null

		const shortName = fullName.replace(/^assistants\//, '')
		const sessionKey = `${sessionId}:${shortName}`

		if (this.sessions.has(sessionKey)) {
			return this.sessions.get(sessionKey)!
		}

		let assistant: Assistant

		if (this._voiceAssistant) {
			// Reuse the voice-capable assistant so voiceMode event wiring stays intact
			assistant = this._voiceAssistant
		} else {
			assistant = this.assistantsManager.create(fullName, {
				historyMode: this.options.historyMode,
			}) as Assistant

			assistant.resumeThread(`${this.options.threadPrefix}:${sessionKey}`)
			await assistant.start()
		}

		const session: ChatSession = { assistant, assistantId: shortName, sessionKey }
		this.sessions.set(sessionKey, session)
		this.state.set('sessionCount', this.sessions.size)

		this.emit('sessionCreated', { sessionKey, assistantId: shortName })
		return session
	}

	/**
	 * Send a message to an assistant and stream the response over a WebSocket.
	 * Can be used directly without WebSocket by passing event callbacks instead.
	 */
	async streamResponse(
		session: ChatSession,
		text: string,
		callbacks: {
			onStart: (messageId: string) => void
			onChunk: (messageId: string, textDelta: string) => void
			onToolStart: (id: string, name: string, startedAt: number) => void
			onToolEnd: (id: string, name: string, ok: boolean, endedAt: number, durationMs: number, detail?: string) => void
			onComplete: (messageId: string, text: string) => void
			onError: (message: string) => void
		},
	): Promise<string> {
		const messageId = crypto.randomUUID()
		callbacks.onStart(messageId)

		const toolTimers = new Map<string, number>()
		const toolCallIds = new Map<string, string>()
		let toolCallCounter = 0

		const onChunk = (chunk: string) => {
			callbacks.onChunk(messageId, chunk)
		}

		const onToolCall = (toolName: string, _args: any) => {
			const callId = `${messageId}:tool:${toolCallCounter++}`
			toolTimers.set(callId, Date.now())
			toolCallIds.set(toolName, callId)
			callbacks.onToolStart(callId, toolName, Date.now())
		}

		const onToolResult = (toolName: string, result: string) => {
			const callId = toolCallIds.get(toolName) || toolName
			const startedAt = toolTimers.get(callId) || Date.now()
			const endedAt = Date.now()
			toolTimers.delete(callId)
			toolCallIds.delete(toolName)
			const summary = typeof result === 'string' && result.length > 120
				? result.slice(0, 120) + '…'
				: result
			callbacks.onToolEnd(callId, toolName, true, endedAt, endedAt - startedAt, summary)
		}

		const onToolError = (toolName: string, error: any) => {
			const callId = toolCallIds.get(toolName) || toolName
			const startedAt = toolTimers.get(callId) || Date.now()
			const endedAt = Date.now()
			toolTimers.delete(callId)
			toolCallIds.delete(toolName)
			console.error(`[chat-service] tool error: ${toolName}`, error)
			callbacks.onToolEnd(callId, toolName, false, endedAt, endedAt - startedAt, error?.message || String(error))
		}

		// Use the voice assistant when voice mode is 'always', otherwise session assistant
		const activeAssistant = this._voiceAssistant && this._voiceModeState === 'always'
			? this._voiceAssistant
			: session.assistant

		activeAssistant.on('chunk', onChunk)
		activeAssistant.on('toolCall', onToolCall)
		activeAssistant.on('toolResult', onToolResult)
		activeAssistant.on('toolError', onToolError)

		try {
			const response = await activeAssistant.ask(text)

			// If voice mode is active, wait for speech to finish
			if (this._voiceMode && this._voiceModeState === 'always') {
				await this._voiceMode.waitForSpeechDone()
			}

			callbacks.onComplete(messageId, response)
			return response
		} catch (err: any) {
			callbacks.onError(err.message || 'Assistant error')
			return ''
		} finally {
			activeAssistant.off('chunk', onChunk)
			activeAssistant.off('toolCall', onToolCall)
			activeAssistant.off('toolResult', onToolResult)
			activeAssistant.off('toolError', onToolError)
		}
	}

	/**
	 * Close all sessions and the WebSocket server.
	 */
	async shutdown() {
		if (this.wss) {
			this.wss.close()
			this.wss = null
		}
		this.sessions.clear()
		this.state.set('sessionCount', 0)
		this.state.set('connectionCount', 0)
		this.emit('shutdown')
	}

	// ── Private ──

	/**
	 * Build the standard streaming callbacks that send protocol messages over a WebSocket.
	 */
	private wsCallbacks(ws: WebSocket) {
		return {
			onStart: (messageId: string) => this.send(ws, { type: 'assistant_message_start', messageId }),
			onChunk: (messageId: string, textDelta: string) => this.send(ws, { type: 'chunk', messageId, textDelta }),
			onToolStart: (id: string, name: string, startedAt: number) => this.send(ws, { type: 'tool_start', id, name, startedAt }),
			onToolEnd: (id: string, name: string, ok: boolean, endedAt: number, durationMs: number, detail?: string) => {
				const msg: any = { type: 'tool_end', id, name, ok, endedAt, durationMs }
				if (ok) msg.summary = detail
				else msg.error = detail
				this.send(ws, msg)
			},
			onComplete: (messageId: string, text: string) => this.send(ws, { type: 'assistant_message_complete', messageId, text }),
			onError: (message: string) => this.send(ws, { type: 'error', message }),
		}
	}

	private handleConnection(ws: WebSocket) {
		this.state.set('connectionCount', (this.state.get('connectionCount') ?? 0) + 1)
		this.emit('connection')

		let session: ChatSession | null = null
		let isProcessing = false

		const ctx: MessageHandlerContext = {
			ws,
			get session() { return session },
			get isProcessing() { return isProcessing },
			setProcessing: (v: boolean) => { isProcessing = v },
			send: (data: any) => this.send(ws, data),
			streamToSocket: (s: ChatSession, text: string) => this.streamResponse(s, text, this.wsCallbacks(ws)),
		}

		ws.on('message', async (raw: Buffer) => {
			let parsed: any
			try {
				parsed = JSON.parse(raw.toString())
			} catch {
				this.send(ws, { type: 'error', message: 'Invalid JSON' })
				return
			}

			// ── Init ──
			if (parsed.type === 'init') {
				const sessionId = parsed.sessionId
				if (!sessionId || typeof sessionId !== 'string') {
					this.send(ws, { type: 'init_error', message: 'Missing sessionId' })
					return
				}

				const requestedAssistant = parsed.assistantId || this.options.defaultAssistant
				session = await this.getOrCreateSession(sessionId, requestedAssistant)

				if (!session) {
					this.send(ws, { type: 'init_error', message: `Unknown assistant: ${requestedAssistant}` })
					return
				}

				this.send(ws, {
					type: 'init_ok',
					sessionId,
					assistantId: session.assistantId,
					historyLength: session.assistant.messages?.length || 0,
				})
				return
			}

			// ── Voice mode toggle ──
			if (parsed.type === 'set_voice_mode') {
				const mode = parsed.mode
				if (mode !== 'off' && mode !== 'always') {
					this.send(ws, { type: 'error', message: `Invalid voice mode: ${mode}. Use "off" or "always".` })
					return
				}
				this.setVoiceModeState(mode)
				this.send(ws, { type: 'voice_mode_changed', mode })
				return
			}

			// ── User message ──
			if (parsed.type === 'user_message') {
				if (!session) {
					this.send(ws, { type: 'error', message: 'Send init first' })
					return
				}

				if (isProcessing) {
					this.send(ws, { type: 'error', message: 'Already processing a message' })
					return
				}

				const text = parsed.text?.trim()
				if (!text) return

				isProcessing = true

				// When voiceMode is available, toggle mute based on whether voice is requested
				const wantVoice = this._voiceMode && (this._voiceModeState === 'always' || parsed.voice === true)

				if (this._voiceMode && !wantVoice) this._voiceMode.mute()
				if (this._voiceMode && wantVoice) this._voiceMode.unmute()

				await this.streamResponse(session, text, this.wsCallbacks(ws))

				// Restore unmuted state after text-only response
				if (this._voiceMode && !wantVoice) this._voiceMode.unmute()

				isProcessing = false
				return
			}

			// ── Custom message handler ──
			if (this.customHandler) {
				await this.customHandler(parsed, ctx)
			}
		})

		ws.on('close', () => {
			this.state.set('connectionCount', Math.max(0, (this.state.get('connectionCount') ?? 1) - 1))
			this.emit('disconnection')
		})
	}

	private send(ws: WebSocket, data: any) {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(data))
		}
	}
}

export default ChatService
