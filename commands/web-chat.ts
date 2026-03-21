import { z } from 'zod'
import { networkInterfaces } from 'os'
import { WebSocketServer, WebSocket } from 'ws'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'
import type { Assistant, AssistantsManager } from '@soederpop/luca/agi'

export const argsSchema = CommandOptionsSchema.extend({
	port: z.number().default(3100).describe('Port to listen on'),
	host: z.string().default('0.0.0.0').describe('Host to bind to (0.0.0.0 for LAN)'),
	assistant: z.string().default('chiefOfStaff').describe('Which assistant to use'),
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

async function handler(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const { container } = context
	const { port, host } = options

	await container.helpers.discover('features')

	// Set up the assistant
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

	await expressServer.start({ port, host })

	// Attach WebSocket server to the underlying HTTP server
	const httpServer = (expressServer as any)._listener
	const wss = new WebSocketServer({ server: httpServer })

	wss.on('connection', (ws: WebSocket) => {
		console.log('[web-chat] client connected')

		// Create a fresh assistant instance per connection
		const assistant: Assistant = assistantsManager.create(options.assistant) as Assistant

		let isProcessing = false

		ws.on('message', async (raw: Buffer) => {
			let parsed: any
			try {
				parsed = JSON.parse(raw.toString())
			} catch {
				ws.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }))
				return
			}

			if (parsed.type === 'user_message') {
				if (isProcessing) {
					ws.send(JSON.stringify({ type: 'error', message: 'Already processing a message' }))
					return
				}

				const text = parsed.text?.trim()
				if (!text) return

				isProcessing = true
				const messageId = crypto.randomUUID()

				// Send start marker
				send(ws, { type: 'assistant_message_start', messageId })

				// Wire up chunk streaming for this turn
				const onChunk = (chunk: string) => {
					send(ws, { type: 'chunk', messageId, textDelta: chunk })
				}
				assistant.on('chunk', onChunk)

				try {
					const response = await assistant.ask(text)
					send(ws, { type: 'assistant_message_complete', messageId, text: response })
				} catch (err: any) {
					send(ws, { type: 'error', message: err.message || 'Assistant error' })
				} finally {
					assistant.off('chunk', onChunk)
					isProcessing = false
				}
			}
		})

		ws.on('close', () => {
			console.log('[web-chat] client disconnected')
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
	console.log(`    Assistant: ${options.assistant}`)
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
