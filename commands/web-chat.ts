import { z } from 'zod'
import { networkInterfaces } from 'os'
import { WebSocketServer, WebSocket } from 'ws'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'
import type { Assistant, AssistantsManager } from '@soederpop/luca/agi'

export const argsSchema = CommandOptionsSchema.extend({
	port: z.number().default(3100).describe('Port to listen on'),
	host: z.string().default('0.0.0.0').describe('Host to bind to (0.0.0.0 for LAN)'),
	assistant: z.string().default('chiefOfStaff').describe('Default assistant to use'),
	open: z.boolean().default(false).describe('Open browser on start'),
})

function getLanAddress(): string | null {
	const nets = networkInterfaces()
	for (const name of Object.keys(nets)) {
		for (const net of nets[name] || []) {
			if (net.family === 'IPv4' && !net.internal) {
				return net.address
			}
		}
	}
	return null
}

// Session state: maps sessionId → { assistant instance, assistantId }
interface Session {
	assistant: Assistant
	assistantId: string
}

const sessions = new Map<string, Session>()

function resolveAssistantName(assistantsManager: AssistantsManager, shortName: string): string | null {
	// Try exact match first, then prefixed with "assistants/"
	const entries = assistantsManager.list()
	const match = entries.find(
		(e) => e.name === shortName || e.name === `assistants/${shortName}`,
	)
	return match ? match.name : null
}

async function handler(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const { container } = context
	const { port, host } = options

	await container.helpers.discover('features')

	const assistantsManager = container.feature('assistantsManager') as AssistantsManager
	await assistantsManager.discover()

	const publicDir = container.paths.resolve(import.meta.dir, '..', 'public', 'web-chat')

	const expressServer = container.server('express', {
		port,
		cors: true,
		static: publicDir,
	})

	const app = expressServer.app

	app.get('/api/health', (_req: any, res: any) => {
		res.json({ ok: true, assistant: options.assistant })
	})

	// List available assistants for the picker
	app.get('/api/assistants', (_req: any, res: any) => {
		const entries = assistantsManager.list()
		const assistants = entries.map((e) => {
			const shortName = e.name.replace(/^assistants\//, '')
			return { id: shortName, name: shortName }
		})
		res.json({ assistants, default: options.assistant })
	})

	await expressServer.start({ port, host })

	// Attach WebSocket server to the underlying HTTP server
	const httpServer = (expressServer as any)._listener
	const wss = new WebSocketServer({ server: httpServer })

	wss.on('connection', (ws: WebSocket) => {
		console.log('[web-chat] client connected')

		let session: Session | null = null
		let isProcessing = false

		ws.on('message', async (raw: Buffer) => {
			let parsed: any
			try {
				parsed = JSON.parse(raw.toString())
			} catch {
				send(ws, { type: 'error', message: 'Invalid JSON' })
				return
			}

			// ── Init: bind this connection to a session ──
			if (parsed.type === 'init') {
				const sessionId = parsed.sessionId
				if (!sessionId || typeof sessionId !== 'string') {
					send(ws, { type: 'init_error', message: 'Missing sessionId' })
					return
				}

				const requestedAssistant = parsed.assistantId || options.assistant
				const fullName = resolveAssistantName(assistantsManager, requestedAssistant)

				if (!fullName) {
					send(ws, { type: 'init_error', message: `Unknown assistant: ${requestedAssistant}` })
					return
				}

				const shortName = fullName.replace(/^assistants\//, '')
				const sessionKey = `${sessionId}:${shortName}`

				// Reuse existing session or create a new one
				if (sessions.has(sessionKey)) {
					session = sessions.get(sessionKey)!
					console.log(`[web-chat] resumed session ${sessionKey}`)
				} else {
					const assistant: Assistant = assistantsManager.create(fullName, {
						historyMode: 'session',
					}) as Assistant
					// Use sessionKey as the thread ID for persistence
					assistant.resumeThread(`web-chat:${sessionKey}`)
					await assistant.start()

					session = { assistant, assistantId: shortName }
					sessions.set(sessionKey, session)
					console.log(`[web-chat] new session ${sessionKey} (${session.assistant.messages?.length || 0} messages in history)`)
				}

				send(ws, {
					type: 'init_ok',
					sessionId,
					assistantId: session.assistantId,
					historyLength: session.assistant.messages?.length || 0,
				})
				return
			}

			// ── User message ──
			if (parsed.type === 'user_message') {
				if (!session) {
					send(ws, { type: 'error', message: 'Send init first' })
					return
				}

				if (isProcessing) {
					send(ws, { type: 'error', message: 'Already processing a message' })
					return
				}

				const text = parsed.text?.trim()
				if (!text) return

				isProcessing = true
				const messageId = crypto.randomUUID()

				send(ws, { type: 'assistant_message_start', messageId })

				const onChunk = (chunk: string) => {
					send(ws, { type: 'chunk', messageId, textDelta: chunk })
				}
				session.assistant.on('chunk', onChunk)

				try {
					const response = await session.assistant.ask(text)
					send(ws, { type: 'assistant_message_complete', messageId, text: response })
				} catch (err: any) {
					send(ws, { type: 'error', message: err.message || 'Assistant error' })
				} finally {
					session.assistant.off('chunk', onChunk)
					isProcessing = false
				}
			}
		})

		ws.on('close', () => {
			console.log('[web-chat] client disconnected')
			// Session stays in the map for reconnection
		})
	})

	// Print URLs
	const lanIp = getLanAddress()
	console.log('')
	console.log(`  Web Chat running:`)
	console.log(`    Local:   http://localhost:${port}`)
	if (lanIp) {
		console.log(`    LAN:     http://${lanIp}:${port}`)
	}
	console.log(`    Default assistant: ${options.assistant}`)
	console.log('')

	if (options.open) {
		try {
			await container.feature('opener').open(`http://localhost:${port}`)
		} catch {}
	}

	// Keep the process alive
	await new Promise(() => {})
}

function send(ws: WebSocket, data: any) {
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify(data))
	}
}

export default {
	description: 'Start a browser-based streaming chat with an assistant',
	argsSchema,
	handler,
}
