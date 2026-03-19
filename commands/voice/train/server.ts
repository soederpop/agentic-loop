import { promises as fs } from 'fs'
import { extname, join, resolve, sep } from 'path'
import type { VoiceRouter } from '../../../features/voice-router'
import type { AGIContainer, NodeContainer } from '../types'

interface StartVoiceTrainingStudioOptions {
	container: AGIContainer & NodeContainer
	router: VoiceRouter
	port: number
	open: boolean
}

const handlersDir = resolve(import.meta.dir, '..', 'handlers')
const publicDir = resolve(import.meta.dir, 'public')
const dictionaryPath = resolve(import.meta.dir, '..', 'dictionary.yml')

function ensureSafeHandlerPath(file: string): string {
	const normalized = String(file || '').replace(/^\/+/, '')
	const absolute = resolve(handlersDir, normalized)
	const expectedPrefix = `${handlersDir}${sep}`

	if (!absolute.startsWith(expectedPrefix)) {
		throw new Error('Invalid handler path')
	}

	if (extname(absolute) !== '.ts') {
		throw new Error('Only .ts handler files can be edited')
	}

	return absolute
}

async function readIfExists(path: string): Promise<string | null> {
	try {
		return await fs.readFile(path, 'utf8')
	} catch {
		return null
	}
}

export async function startVoiceTrainingStudio(options: StartVoiceTrainingStudioOptions): Promise<void> {
	const { container, port, open } = options
	let router = options.router

	const refreshRouter = async () => {
		await router.reloadHandlers()
		return router
	}

	const expressServer = container.server('express', {
		port,
		cors: true,
		static: publicDir,
	})

	const app = expressServer.app

	app.get('/api/health', (_req: any, res: any) => {
		res.json({ ok: true, port, handlersDir, publicDir, dictionaryPath })
	})

	app.get('/api/handlers', async (_req: any, res: any) => {
		const activeRouter = await refreshRouter()
		const files = activeRouter.handlerFiles

		res.json({
			handlers: activeRouter.manifest.map((handler, index) => ({
				...handler,
				file: files[index]?.file || null,
			})),
		})
	})

	app.get('/api/handlers/source', async (req: any, res: any) => {
		try {
			const file = String(req.query.file || '')
			const absolute = ensureSafeHandlerPath(file)
			const source = await fs.readFile(absolute, 'utf8')
			res.json({ file, source })
		} catch (error: any) {
			res.status(400).json({ error: error.message })
		}
	})

	app.put('/api/handlers/source', async (req: any, res: any) => {
		try {
			const file = String(req.body?.file || '')
			const source = String(req.body?.source || '')
			const absolute = ensureSafeHandlerPath(file)
			await fs.writeFile(absolute, source, 'utf8')
			await refreshRouter()
			res.json({ ok: true, file })
		} catch (error: any) {
			res.status(400).json({ error: error.message })
		}
	})

	app.get('/api/dictionary', async (_req: any, res: any) => {
		try {
			const source = await fs.readFile(dictionaryPath, 'utf8')
			res.json({ path: dictionaryPath, source })
		} catch (error: any) {
			res.status(500).json({ error: error.message })
		}
	})

	app.put('/api/dictionary', async (req: any, res: any) => {
		try {
			const source = String(req.body?.source || '')
			await fs.writeFile(dictionaryPath, source, 'utf8')
			res.json({ ok: true, path: dictionaryPath })
		} catch (error: any) {
			res.status(400).json({ error: error.message })
		}
	})

	app.post('/api/test', async (req: any, res: any) => {
		try {
			const phrase = String(req.body?.phrase || '')
			if (!phrase.trim()) {
				res.status(400).json({ error: 'phrase is required' })
				return
			}

			const activeRouter = await refreshRouter()
			const nlp = container.feature('nlp')

			const parse = nlp.parse(phrase)
			const analyze = nlp.analyze(phrase)
			const understand = nlp.understand(phrase)
			const routing = await activeRouter.inspect(phrase)

			res.json({
				phrase,
				parse,
				analyze,
				understand,
				routing,
			})
		} catch (error: any) {
			res.status(500).json({ error: error.message })
		}
	})

	app.get('/api/types', async (_req: any, res: any) => {
		const voiceTypes = await readIfExists(resolve(import.meta.dir, '..', 'types.ts'))
		const lucaTypes = await readIfExists(resolve(import.meta.dir, '../../../luca/src/node/container.ts'))
		const contentbaseTypes = await readIfExists(resolve(import.meta.dir, '../../../contentbase/src/index.ts'))

		const stubs = {
			'luca-stub.d.ts': [
				"declare module '@soederpop/luca' {",
				'  export interface ContainerContext { container: any }',
				'  export interface NodeContainer {',
				'    feature(name: string, options?: any): any',
				'    server(name: string, options?: any): any',
				'  }',
				'}',
			].join('\n'),
			'contentbase-stub.d.ts': [
				"declare module 'contentbase' {",
				'  export interface ContentModel { [key: string]: any }',
				'  export interface Collection<T = ContentModel> { all(): T[] }',
				'}',
			].join('\n'),
		}

		res.json({
			files: [
				{ path: 'voice/types.ts', content: voiceTypes || '' },
				{ path: 'luca/node-container.ts', content: lucaTypes || '' },
				{ path: 'contentbase/index.ts', content: contentbaseTypes || '' },
				...Object.entries(stubs).map(([path, content]) => ({ path, content })),
			],
		})
	})

	await expressServer.start({ port })

	const url = `http://localhost:${port}`
	console.log(`Voice training studio listening on ${url}`)
	console.log(`Handler sources from ${handlersDir}`)

	if (open) {
		try {
			await container.feature('opener').open(url)
		} catch (error: any) {
			console.warn(`Could not open browser automatically: ${error.message}`)
		}
	}
}
