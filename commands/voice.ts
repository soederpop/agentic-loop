import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'

export const argsSchema = CommandOptionsSchema.extend({
	check: z.boolean().default(false).describe('Check voice capability status without starting the service'),
	generateSounds: z.union([z.boolean(), z.string()]).default(false)
		.describe('Generate TTS audio for voice assistants. Pass true for all, or an assistant name.'),
	resetCache: z.boolean().default(false).describe('Clear the TTS disk cache before generating sounds'),
	voice: z.string().optional().describe('Override the voiceId from voice.yaml'),
	provider: z.enum(['elevenlabs', 'chatterbox', 'voicebox']).optional().describe('TTS provider (default: elevenlabs)'),
	format: z.enum(['wav', 'flac', 'ogg', 'mp3']).optional().describe('Output format for generated sounds'),
	outputDir: z.string().optional().describe('Output directory override'),
})

type VoiceCommandOptions = z.infer<typeof argsSchema>
type PhraseListConfig = { phrases: (string | { id?: string; text: string })[] }

type TaggedPhrase = { id: string; text: string; tag: string }

function slugify(value: string): string {
	return value
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
}

function normalizePhraseEntry(entry: PhraseListConfig['phrases'][number], index: number) {
	if (typeof entry === 'string') {
		return {
			id: `phrase-${String(index + 1).padStart(2, '0')}`,
			text: entry.trim(),
		}
	}

	return {
		id: (entry.id || `phrase-${String(index + 1).padStart(2, '0')}`).trim(),
		text: entry.text.trim(),
	}
}

function flattenGroups(groups: Record<string, PhraseListConfig['phrases']>): TaggedPhrase[] {
	const result: TaggedPhrase[] = []
	for (const [tag, entries] of Object.entries(groups)) {
		if (!entries) continue
		for (let i = 0; i < entries.length; i++) {
			const norm = normalizePhraseEntry(entries[i], i)
			result.push({ id: `${tag}-${norm.id}`, text: norm.text, tag })
		}
	}
	return result
}

type VoiceSettings = {
	stability?: number
	similarityBoost?: number
	style?: number
	speed?: number
	useSpeakerBoost?: boolean
}

type AssistantConfigResult = { voice: string; groups: Record<string, string[]>; outputDir: string; voiceSettings?: VoiceSettings }

function buildResult(assistant: any, cfg: Record<string, any>): AssistantConfigResult {
	const outputDir = assistant.paths.resolve('generated')
	console.log(`  [path:L60] buildResult outputDir=${outputDir} (folder=${assistant.folder || assistant.resolvedFolder})`)
	return {
		voice: cfg.voiceId || cfg.customVoiceId || '',
		groups: cfg.phrases || {},
		outputDir,
		voiceSettings: cfg.voiceSettings || undefined,
	}
}

function discoverAllVoiceAssistants(container: any): Array<{ name: string; folder: string; aliases: string[]; voiceConfig: Record<string, any>; assistant: any }> {
	const results: Array<{ name: string; folder: string; aliases: string[]; voiceConfig: Record<string, any>; assistant: any }> = []

	const manager = container.feature('assistantsManager') as any
	manager.discover()

	for (const entry of manager.list()) {
		if (!entry.hasVoice) continue
		const inst = container.feature('assistant', { folder: entry.folder })
		if (inst.voiceConfig) {
			results.push({
				name: entry.name,
				folder: entry.folder,
				aliases: inst.voiceConfig.aliases || [],
				voiceConfig: inst.voiceConfig,
				assistant: inst,
			})
		}
	}

	return results
}

type ManifestEntry = { id: string; text: string; tag: string; voice: string; provider: string; format: string; file: string }

async function generateForAssistant(
	container: any,
	assistantName: string,
	cfg: AssistantConfigResult,
	options: VoiceCommandOptions,
): Promise<void> {
	const fs = container.feature('fs')
	const diskCache = container.feature('diskCache', { path: container.paths.resolve('tmp', 'luca-voice-tts-cache') })

	const voice = options.voice || cfg.voice
	if (!voice) throw new Error(`No voiceId configured for ${assistantName}`)

	const provider = options.provider || 'elevenlabs'
	const format = options.format || (provider === 'elevenlabs' ? 'mp3' : 'wav')
	const outputDir = options.outputDir ? container.paths.resolve(options.outputDir) : cfg.outputDir
	console.log(`  [path:L105] outputDir=${outputDir} (from cfg.outputDir=${cfg.outputDir})`)

	const groups: Record<string, PhraseListConfig['phrases']> = {}
	for (const [tag, items] of Object.entries(cfg.groups)) {
		if (Array.isArray(items)) {
			groups[tag] = items as string[]
		} else if (typeof items === 'string') {
			groups[tag] = [items]
		}
	}

	if (!Object.keys(groups).length) {
		console.log(`[generate-sounds] ${assistantName}: no phrases, skipping`)
		return
	}

	const phrases = flattenGroups(groups)
	fs.ensureFolder(outputDir)

	const manifest: ManifestEntry[] = []
	console.log(`\n[generate-sounds] ${assistantName}: ${phrases.length} phrases, provider=${provider}, voice=${voice}, format=${format}`)

	const synthesize = async (text: string): Promise<Buffer | Uint8Array> => {
		if (provider === 'chatterbox') {
			const tts = container.feature('tts', { enable: true, voice, format, outputDir })
			const generatedPath = await tts.synthesize(text, { voice, format: format as any })
			return fs.readFile(generatedPath, { encoding: null })
		}
		if (provider === 'voicebox') {
			const vb = container.client('voicebox') as any
			if (!vb.state.get('connected')) await vb.connect()
			return vb.synthesize(text, {
				profileId: voice,
				engine: cfg.engine || 'qwen',
				modelSize: cfg.modelSize || '1.7B',
				language: cfg.language || 'en',
			})
		}
		const el = container.client('elevenlabs')
		if (!el.state.get('connected')) await el.connect()
		return el.synthesize(text, {
			voiceId: voice,
			...(cfg.voiceSettings ? { voiceSettings: cfg.voiceSettings } : {}),
		})
	}

	for (let i = 0; i < phrases.length; i++) {
		const phrase = phrases[i]
		const cacheKey = `voice-tts:${container.utils.hashObject({ text: phrase.text, voice, provider, format })}`
		const textPart = slugify(phrase.text).slice(0, 48)
		const fileName = `${String(i + 1).padStart(2, '0')}-${slugify(phrase.id)}${textPart ? `-${textPart}` : ''}.${format}`
		const finalPath = `${outputDir}/${fileName}`
		console.log(`  [path:L145] finalPath=${finalPath}`)

		if (await diskCache.has(cacheKey)) {
			console.log(`  ${i + 1}/${phrases.length}: cached → ${finalPath}`)
			const audio = await diskCache.get(cacheKey)
			await fs.writeFileAsync(finalPath, audio)
		} else {
			const audio = await synthesize(phrase.text)
			await fs.writeFileAsync(finalPath, audio)
			await diskCache.set(cacheKey, audio)
		}


		try {
			await container.proc.exec(`afplay "${finalPath}"`)
			console.log(`  ${i + 1}/${phrases.length}: ${finalPath}`)
			manifest.push({ id: phrase.id, text: phrase.text, tag: phrase.tag, voice, provider, format, file: finalPath })
		} catch(error) {
			console.error('Error playing', finalPath, error)
		}

	}

	const manifestPath = `${outputDir}/manifest.json`
	await fs.writeFileAsync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
	console.log(`[generate-sounds] ${assistantName}: done. ${manifest.length} files → ${manifestPath}`)
}

async function generateSounds(options: VoiceCommandOptions, context: ContainerContext): Promise<void> {
	const { container } = context
	const pathFromFlag = typeof options.generateSounds === 'string' ? options.generateSounds : null
	const pathFromPositional = options._?.[1]
	const targetName = pathFromFlag || pathFromPositional || null

	if (options.resetCache) {
		const ttsCache = container.feature('diskCache', { path: container.paths.resolve('tmp', 'luca-voice-tts-cache') })
		console.log('[generate-sounds] clearing TTS disk cache...')
		await ttsCache.clearAll(true)
		console.log('[generate-sounds] cache cleared.')
	}

	const all = discoverAllVoiceAssistants(container)

	if (!all.length) {
		throw new Error('No voice assistants found. Each assistant needs a voice.yaml with phrases.')
	}

	// Filter to a specific assistant if named, otherwise generate for all
	const targets = targetName
		? all.filter(a => {
			const normalized = targetName.toLowerCase().trim()
			const basename = a.name.split('/').pop()!.toLowerCase()
			const aliases: string[] = a.voiceConfig.aliases || []
			return a.name.toLowerCase() === normalized
				|| basename === normalized
				|| aliases.some((al: string) => al.toLowerCase() === normalized)
		})
		: all

	if (targetName && !targets.length) {
		const available = all.map(a => a.name).join(', ')
		throw new Error(`No voice assistant matches "${targetName}". Available: ${available}`)
	}

	console.log(`[generate-sounds] generating for ${targets.length} assistant(s): ${targets.map(a => a.name).join(', ')}`)

	for (const entry of targets) {
		const cfg = buildResult(entry.assistant, entry.voiceConfig)
		console.log('config', cfg)
		await generateForAssistant(container, entry.name, cfg, options)
	}

	console.log(`\n[generate-sounds] all done.`)
}

async function voice(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	if (options.generateSounds) {
		await generateSounds(options, context)
		return
	}

	const { container } = context
	const proc = container.feature('proc')

	if (options.check) {
		const listener = container.feature('voiceListener' as any) as any
		const chat = container.feature('voiceChat', { assistant: 'chiefOfStaff' }) as any

		const [listenerCaps, chatCaps] = await Promise.all([
			listener.checkCapabilities(),
			chat.checkCapabilities(),
		])

		const mark = (ok: boolean) => ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'

		console.log('')
		console.log('  Voice Capability Check')
		console.log('  ──────────────────────')
		console.log(`  ${mark(listener.state.get('wakeWordAvailable'))} Wake word   rustpotter + .rpw models`)
		console.log(`  ${mark(listener.state.get('sttAvailable'))}  STT         sox + mlx_whisper`)
		console.log(`  ${mark(chatCaps.available)}  TTS/LLM     ELEVENLABS_API_KEY + voice.yaml`)
		console.log('')

		const allMissing = [...listenerCaps.missing, ...chatCaps.missing]
		if (allMissing.length) {
			console.log('  Missing:')
			for (const m of allMissing) {
				console.log(`    - ${m}`)
			}
			console.log('')
		} else {
			console.log('  All capabilities available.')
			console.log('')
		}

		return
	}

	const lock = proc.establishLock('tmp/luca-voice.pid')

	const voiceService = container.feature('voiceService')

	voiceService.on('client:connected', () => {
		console.log('[voice] native app connected')
	})
	voiceService.on('client:disconnected', () => {
		console.log('[voice] native app disconnected')
	})
	voiceService.on('command', (d: any) => {
		console.log(`[voice] command: "${d.text}" (source: ${d.source})`)
	})
	voiceService.on('command:error', (d: any) => {
		console.log(`[voice] command error: ${d.error}`)
	})

	await voiceService.start()

	const st = voiceService.state
	const modes: string[] = []
	if (st.get('wakeWordAvailable')) modes.push('wake-word')
	if (st.get('sttAvailable')) modes.push('STT')
	if (st.get('ttsAvailable')) modes.push('TTS/LLM')

	if (modes.length === 0) {
		console.log('[voice] started in degraded mode — no voice capabilities available')
		const missing = (st.get('capabilityMissing') as string[]) ?? []
		if (missing.length) console.log(`[voice] missing: ${missing.join(', ')}`)
	} else {
		console.log(`[voice] listening — active: ${modes.join(', ')} | ${voiceService.voiceAssistants.length} assistants`)
	}

	// Keep process alive, but let Ctrl+C kill it cleanly
	const shutdown = async () => {
		console.log('\n[voice] shutting down...')
		await voiceService.stop()
		lock.release()
		process.exit(0)
	}
	process.on('SIGINT', shutdown)
	process.on('SIGTERM', shutdown)
	await new Promise(() => {})
}

export default {
	description: 'Voice service and TTS sound generator for voice-enabled assistants',
	argsSchema,
	handler: voice,
}
