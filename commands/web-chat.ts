import { z } from 'zod'
import { networkInterfaces } from 'os'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'
import type { AssistantsManager } from '@soederpop/luca/agi'
import type { ChatService } from '../features/chat-service'

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

async function handler(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const { container } = context
	const { port, host } = options

	const isPortTaken = await container.networking.isPortOpen(port).then(r => !r)

	if (isPortTaken) {
		const pids = container.proc.findPidsByPort(port)
		if (pids.length) {
			container.proc.kill(pids[0])
		}
	}

	await container.helpers.discover('features')

	const assistantsManager = container.feature('assistantsManager') as AssistantsManager
	await assistantsManager.discover()

	// Set up the ChatService feature
	const chatService = container.feature('chatService', {
		defaultAssistant: options.assistant,
		threadPrefix: 'web-chat',
		historyMode: 'session',
	}) as unknown as ChatService

	const publicDir = container.paths.resolve('public', 'web-chat')

	const expressServer = container.server('express', {
		port,
		cors: true,
		static: publicDir,
	})

	const app = expressServer.app

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

export default {
	description: 'Start a browser-based streaming chat with an assistant',
	argsSchema,
	handler,
}
