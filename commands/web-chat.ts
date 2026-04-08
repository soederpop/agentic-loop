import { z } from 'zod'
import { networkInterfaces } from 'os'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'
import type { AssistantsManager } from '@soederpop/luca/agi'
import type { ChatService } from '../features/chat-service'
import type { VoiceChat } from '../features/voice-chat'
import type { VoiceListener } from '../features/voice-listener'

export const argsSchema = CommandOptionsSchema.extend({
	port: z.number().optional().describe('Port to listen on (default: any available port)'),
	host: z.string().default('0.0.0.0').describe('Host to bind to (0.0.0.0 for LAN)'),
	assistant: z.string().default('chiefOfStaff').describe('Default assistant to use'),
	'open-browser': z.boolean().default(false).describe('Open in browser instead of window manager'),
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
	const { host } = options

	// Find an available port
	const port = options.port ?? (await container.networking.findOpenPort(3100))

	await container.helpers.discover('features')

	const assistantsManager = container.feature('assistantsManager') as AssistantsManager
	await assistantsManager.discover()

	const baseAssistant = assistantsManager.create(options.assistant)

	// Set up the ChatService feature
	const chatService = container.feature('chatService', {
		defaultAssistant: options.assistant,
		threadPrefix: 'web-chat',
		historyMode: 'session',
	}) as unknown as ChatService

	// Wire up VoiceChat for TTS playback when voice mode is active
	const voiceChat = container.feature('voiceChat', {
		assistant: `${options.assistant}:${baseAssistant.uuid}`,
		historyMode: 'session',
	}) as unknown as VoiceChat

	await voiceChat.start()

	if (voiceChat.isStarted) {
		chatService.setVoiceChat(voiceChat)
		console.log(`[web-chat] VoiceChat attached for TTS playback`)
	} else {
		console.log(`[web-chat] VoiceChat not available — voice mode will be text-only`)
	}

	const publicDir = container.paths.resolve('public', 'web-chat')

	const expressServer = container.server('express', {
		port,
		cors: true,
		static: publicDir,
	})

	const app = expressServer.app

	// Find voice WS port (separate server to avoid upgrade handler conflict with ChatService)
	const voicePort = await container.networking.findOpenPort(port + 1)

	app.get('/api/config', (_req: any, res: any) => {
		res.json({ voiceWsPort: voicePort })
	})

	app.get('/api/health', (_req: any, res: any) => {
		res.json({ ok: true, assistant: options.assistant })
	})

	app.get('/api/assistants', (_req: any, res: any) => {
		const assistants = chatService.listAssistants()
		res.json({ assistants, default: options.assistant })
	})

	await expressServer.start({ port, host })

	// Attach the ChatService WebSocket server to the HTTP server
	const httpServer = (expressServer as any)._listener
	chatService.attach(httpServer)

	// Voice WebSocket — separate port to avoid upgrade handler conflict with ChatService
	const voiceWss = container.server('websocket', { json: true })
	await voiceWss.start({ port: voicePort })

	voiceWss.on('message', async (msg: any, voiceWs: any) => {
		if (msg?.type !== 'start_voice') return

		const listener = container.feature('voiceListener') as VoiceListener
		const send = (data: object) => voiceWss.send(voiceWs, data)

		const onVu = (level: number) => send({ type: 'voice_vu', level })
		const onStart = () => send({ type: 'voice_recording' })
		const onStop = () => send({ type: 'voice_transcribing' })
		const onPreview = (text: string) => send({ type: 'voice_preview', text })

		listener.on('vu', onVu)
		listener.on('recording:start', onStart)
		listener.on('recording:stop', onStop)
		listener.on('preview', onPreview)

		send({ type: 'voice_listening' })

		try {
			const transcript = await listener.listen({ silenceTimeout: msg.silenceTimeout ?? 3 })
			send({ type: 'voice_complete', text: transcript })
		} catch (err: any) {
			send({ type: 'voice_error', message: String(err?.message ?? err) })
		} finally {
			listener.off('vu', onVu)
			listener.off('recording:start', onStart)
			listener.off('recording:stop', onStop)
			listener.off('preview', onPreview)
		}
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

	const pageUrl = `http://localhost:${port}`
	const openInBrowser = () => container.feature('opener').open(pageUrl)

	if (options['open-browser']) {
		await openInBrowser()
	} else {
		const wm = container.feature('windowManager')
		try {
			const launchedWindow = await Promise.race([
				wm.spawn({ url: pageUrl }),
				new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 6500)),
			])

			const launchedWindowId = String(launchedWindow?.result?.windowId || launchedWindow?.windowId || '').toLowerCase()

			if (launchedWindowId) {
				console.log(`[web-chat] tracking window ${launchedWindowId} for auto-cleanup`)
				wm.on('windowClosed', (msg: any) => {
					const closedId = String(msg?.windowId || '').toLowerCase()
					if (closedId === launchedWindowId) {
						console.log(`[web-chat] window closed, shutting down server`)
						process.exit(0)
					}
				})
			}
		} catch {
			console.log('[web-chat] window manager failed or timed out, falling back to browser')
			await openInBrowser()
		}
	}

	process.on('SIGINT', () => process.exit(0))
	process.on('SIGTERM', () => process.exit(0))

	// Keep the process alive
	await new Promise(() => {})
}

export default {
	description: 'Start a browser-based streaming chat with an assistant',
	argsSchema,
	handler,
}
