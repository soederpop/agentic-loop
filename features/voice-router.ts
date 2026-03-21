import { resolve, join } from 'path'
import { watch as fsWatch } from 'fs'
import type { FSWatcher } from 'fs'
import { z } from 'zod'
import { Feature, features } from '@soederpop/luca'
import { FeatureOptionsSchema, FeatureStateSchema } from '@soederpop/luca/schemas'
import type { VoiceChat } from './voice-chat'

type PhraseManifestEntry = {
	id: string
	text: string
	tag: string
	voice: string
	provider: string
	format: string
	file: string
}
import type {
	VoiceHandler,
	HandlerContext,
	CommandHandle,
	ParsedUtterance,
	VoiceDictionary,
	VoiceDictionaryEntry,
	DictionaryMatch,
	VoiceDictionaryRuntime,
	VoiceWorkspaceContext,
	AGIContainer,
	NodeContainer,
} from '../commands/voice/types'

type LoadedHandler = {
	handler: VoiceHandler
	file: string
}

export const VoiceRouterOptionsSchema = FeatureOptionsSchema.extend({})
export const VoiceRouterStateSchema = FeatureStateSchema.extend({
	handlersLoaded: z.boolean().default(false),
	handlerCount: z.number().default(0),
	routing: z.boolean().default(false),
	activeWorkspace: z.object({
		key: z.string(),
		path: z.string(),
		source: z.string().optional(),
	}),
})

export type VoiceRouterOptions = z.infer<typeof VoiceRouterOptionsSchema>
export type VoiceRouterState = z.infer<typeof VoiceRouterStateSchema>

type WorkspaceEntry = {
	name: string
	path: string
	aliases: string[]
}

/**
 * Routes spoken voice commands to the appropriate handler or conversational assistant.
 * Manages handler loading, phrase playback, workspace resolution, and conversation mode.
 */
export class VoiceRouter extends Feature<VoiceRouterState, VoiceRouterOptions> {
	static override shortcut = 'features.voiceRouter' as const
	static override optionsSchema = VoiceRouterOptionsSchema
	static override stateSchema = VoiceRouterStateSchema

	private handlers: LoadedHandler[] = []
	private loaded = false
	private _watcher: FSWatcher | null = null
	private _reloadDebounce: ReturnType<typeof setTimeout> | null = null
	private _pollInterval: ReturnType<typeof setInterval> | null = null
	private dictionaryPath = resolve(import.meta.dir, '../commands/voice/dictionary.yml')
	private handlersDir = resolve(import.meta.dir, '../commands/voice/handlers')
	private fallbackWorkspaceRoot = resolve(import.meta.dir, '..')
	private _chat: VoiceChat | null = null
	private _phraseManifest: PhraseManifestEntry[] = []
	private _phrasesByTag: Map<string, PhraseManifestEntry[]> = new Map()
	private _assistantPhrasesByTag: Map<string, PhraseManifestEntry[]> = new Map()
	private _workspaceMap: WorkspaceEntry[] = []
	private _workspaceMapLoaded = false

	/** Returns the container typed as AGIContainer & NodeContainer. */
	override get container(): AGIContainer & NodeContainer {
		return super.container as AGIContainer & NodeContainer
	}

	/** Inject a VoiceChat instance so handlers can use speakPhrase for arbitrary TTS. */
	set chat(chat: VoiceChat | null) {
		this._chat = chat
	}

	/** Returns the default state including handler count, conversation flag, and active workspace. */
	override get initialState(): VoiceRouterState {
		const workspaceRoot = this.workspaceRoot
		return {
			...super.initialState,
			handlersLoaded: false,
			handlerCount: 0,
			activeWorkspace: {
				key: 'workspace',
				path: workspaceRoot,
				source: 'default',
			},
		}
	}

	get isRouting() : boolean {
		return !!this.state.get('routing')
	}

	private get workspaceRoot(): string {
		return String(this.container?.cwd || this.fallbackWorkspaceRoot)
	}

	private get activeWorkspace(): VoiceWorkspaceContext {
		const current = this.state.get('activeWorkspace')
		if (current?.path) return current
		return {
			key: 'workspace',
			path: this.workspaceRoot,
			source: 'default',
		}
	}
	
	async start() {
		await this.loadHandlers()
		this.watchHandlers()
		return this
	}

	/** Scans the voice handlers directory, imports each handler module, and sorts by priority. */
	async loadHandlers(): Promise<void> {
		if (this.loaded) return

		const handlersDir = resolve(import.meta.dir, '../commands/voice/handlers')
		const glob = new Bun.Glob('**/*.ts')
		const loaded: LoadedHandler[] = []

		for await (const file of glob.scan({ cwd: handlersDir })) {
			try {
				const mod = await import(`${join(handlersDir, file)}?t=${Date.now()}`)
				const handler: VoiceHandler = mod.default || mod

				if (handler && typeof handler.match === 'function' && typeof handler.execute === 'function') {
					loaded.push({ handler, file })
				}
			} catch (err: any) {
				console.error(`[voice] failed to load handler ${file}:`, err.message)
			}
		}

		loaded.sort((a, b) => (a.handler.priority ?? 100) - (b.handler.priority ?? 100))

		this.handlers = loaded
		this.loaded = true
		this.state.setState({ handlersLoaded: true, handlerCount: loaded.length })

		this.loadPhraseManifest()
		this.loadAssistantPhrases(resolve(import.meta.dir, '../assistants/voice-assistant'))
		await this.loadWorkspaceMap()
	}

	/** Loads phrase manifest from the voice-assistant and indexes entries by tag. */
	loadPhraseManifest(): void {
		const manifestPath = resolve(import.meta.dir, '../assistants/voice-assistant', 'generated', 'manifest.json')
		const fs = this.container.feature('fs')

		if (!fs.exists(manifestPath)) {
			console.log('[voice] no phrase manifest found — run: luca voice --generateSounds')
			return
		}
		this._loadManifestFromPath(manifestPath, false)
	}

	private _loadManifestFromPath(manifestPath: string, merge = false): void {
		const fs = this.container.feature('fs')

		try {
			const raw = JSON.parse(fs.readFile(manifestPath)) as PhraseManifestEntry[]
			const valid = raw.filter((entry: PhraseManifestEntry) => fs.exists(entry.file))

			if (!merge) {
				this._phraseManifest = []
				this._phrasesByTag = new Map()
			}

			this._phraseManifest.push(...valid)

			for (const entry of valid) {
				const tag = entry.tag || 'default'
				if (!this._phrasesByTag.has(tag)) this._phrasesByTag.set(tag, [])
				this._phrasesByTag.get(tag)!.push(entry)
			}

		} catch (err: any) {
			console.error('[voice] failed to load phrase manifest:', err.message)
		}
	}

	private _lastPhraseByTag: Map<string, string> = new Map()

	/** Returns a random phrase file path for the given tag, avoiding repeats. */
	randomPhrase(tag: string): string | null {
		if (!this._phraseManifest.length) return null

		const pool = this._phrasesByTag.get(tag)
		if (!pool || pool.length === 0) {
			const fallback = this._phrasesByTag.get('generic-ack')
			if (!fallback || fallback.length === 0) return null
			return fallback[Math.floor(Math.random() * fallback.length)].file
		}

		const lastPlayed = this._lastPhraseByTag.get(tag)
		const candidates = pool.length > 1 ? pool.filter((p) => p.file !== lastPlayed) : pool
		const chosen = candidates[Math.floor(Math.random() * candidates.length)].file
		this._lastPhraseByTag.set(tag, chosen)

		return chosen
	}

	/** Plays a random audio phrase for the given tag using afplay. */
	playPhrase(tag: string): void {
		const file = this.randomPhrase(tag)
		if (!file) return
		this.container.proc.exec(`afplay "${file}"`)
	}

	/** Loads phrase manifest from an assistant folder and indexes entries by tag. */
	loadAssistantPhrases(folder: string): void {
		this._assistantPhrasesByTag = new Map()
		const manifestPath = this.container.paths.resolve(folder, 'generated', 'manifest.json')
		const fs = this.container.feature('fs')

		if (!fs.exists(manifestPath)) {
			console.log(`[voice] no assistant phrase manifest at ${manifestPath}`)
			return
		}

		try {
			const raw = JSON.parse(fs.readFile(manifestPath)) as PhraseManifestEntry[]
			const valid = raw.filter((entry: PhraseManifestEntry) => fs.exists(entry.file))

			for (const entry of valid) {
				const tag = entry.tag || 'default'
				if (!this._assistantPhrasesByTag.has(tag)) this._assistantPhrasesByTag.set(tag, [])
				this._assistantPhrasesByTag.get(tag)!.push(entry)
			}

		} catch (err: any) {
			console.error('[voice] failed to load assistant phrase manifest:', err.message)
		}
	}

	/** Plays a random phrase from the loaded assistant manifest for the given tag. */
	playAssistantPhrase(tag: string): void {
		const pool = this._assistantPhrasesByTag.get(tag)
		if (!pool || pool.length === 0) return
		const entry = pool[Math.floor(Math.random() * pool.length)]
		this.container.proc.exec(`afplay "${entry.file}"`)
	}

	/**
	 * Build a map of all local packages and their voice-friendly aliases
	 * from the `luca.aliases` field in each package.json.
	 */
	async loadWorkspaceMap(): Promise<WorkspaceEntry[]> {
		if (this._workspaceMapLoaded) return this._workspaceMap

		const fs = this.container.feature('fs')
		const pf = this.container.feature('packageFinder' as any) as any
		const folders: string[] = await pf.findLocalPackageFolders()

		const entries: WorkspaceEntry[] = []

		for (const folder of folders) {
			const pkgPath = this.container.paths.resolve(folder, 'package.json')
			if (!fs.exists(pkgPath)) continue

			try {
				const pkg = JSON.parse(fs.readFile(pkgPath))
				const luca = pkg.luca
				if (!luca?.aliases || !Array.isArray(luca.aliases)) continue

				entries.push({
					name: pkg.name || this.container.paths.basename(folder),
					path: this.container.paths.resolve(folder),
					aliases: luca.aliases.map((a: string) => a.toLowerCase().trim()),
				})
			} catch {}
		}

		this._workspaceMap = entries
		this._workspaceMapLoaded = true
		return entries
	}

	/**
	 * Resolve a spoken term to a workspace entry by matching against aliases.
	 * Returns null if no alias matches.
	 */
	resolveWorkspace(term: string): WorkspaceEntry | null {
		const normalized = term.toLowerCase().trim()
		if (!normalized) return null

		for (const entry of this._workspaceMap) {
			if (entry.aliases.includes(normalized)) return entry
			if (entry.name.toLowerCase() === normalized) return entry
		}

		// Partial match: check if spoken term is contained in any alias or vice versa
		for (const entry of this._workspaceMap) {
			for (const alias of entry.aliases) {
				if (alias.includes(normalized) || normalized.includes(alias)) return entry
			}
		}

		return null
	}

	/** Returns the loaded workspace entries with their voice-friendly aliases. */
	get workspaceMap(): WorkspaceEntry[] {
		return this._workspaceMap
	}

	/** Clears all loaded handlers and reloads them from disk. */
	async reloadHandlers(): Promise<void> {
		this.loaded = false
		this.handlers = []
		this.state.setState({ handlersLoaded: false, handlerCount: 0 })
		await this.loadHandlers()
	}

	/** Watches the handlers directory for changes and auto-reloads when files are added, changed, or deleted. */
	watchHandlers(): void {
		if (this._watcher) return

		this._watcher = fsWatch(this.handlersDir, { recursive: true }, (_event, filename) => {
			if (!filename || !String(filename).endsWith('.ts')) return

			// Debounce rapid successive changes (e.g. editor save + format)
			if (this._reloadDebounce) clearTimeout(this._reloadDebounce)
			this._reloadDebounce = setTimeout(async () => {
				console.log(`[voice] handler changed: ${filename} — reloading`)
				await this.reloadHandlers()
			}, 300)
		})
	}

	/** Stops watching the handlers directory. */
	stopWatchingHandlers(): void {
		if (this._reloadDebounce) clearTimeout(this._reloadDebounce)
		if (!this._watcher) return
		this._watcher.close()
		this._watcher = null
	}

	/** Polls for handler changes every 30 seconds so iterating during demos picks up new code. */
	startPollingReload(intervalMs = 30_000): void {
		this.stopPollingReload()
		this._pollInterval = setInterval(async () => {
			console.log('[voice] polling reload — refreshing handlers')
			await this.reloadHandlers()
		}, intervalMs)
	}

	/** Stops the polling reload interval. */
	stopPollingReload(): void {
		if (!this._pollInterval) return
		clearInterval(this._pollInterval)
		this._pollInterval = null
	}

	private async parseUtterance(text: string): Promise<ParsedUtterance | null> {
		try {
			const nlp = this.container.feature('nlp')
			const parsed = nlp.understand(text)
			return {
				intent: parsed.intent,
				target: parsed.target,
				subject: parsed.subject,
				modifiers: parsed.modifiers || [],
				tokens: parsed.tokens || [],
				entities: parsed.entities || [],
				raw: parsed.raw,
			}
		} catch (err: any) {
			console.error('[voice] NLP parse failed:', err.message)
			return null
		}
	}

	private normalizeNoun(value: string): string {
		return value.toLowerCase().replace(/[^a-z0-9/._-]+/g, ' ').trim()
	}

	private coerceDictionaryEntry(input: string | VoiceDictionaryEntry): VoiceDictionaryEntry {
		if (typeof input === 'string') {
			return { value: input, path: input, aliases: [] }
		}

		return {
			...input,
			aliases: Array.isArray(input.aliases) ? input.aliases : [],
		}
	}

	private escapeRegExp(value: string): string {
		return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	}

	private async loadDictionary(): Promise<VoiceDictionary> {
		try {
			const fs = this.container.feature('fs')
			if (!fs.exists(this.dictionaryPath)) return { aliases: {} }
			const raw = fs.readFile(this.dictionaryPath)
			const yaml = this.container.feature('yaml')
			const parsed = yaml.parse(raw)
			return parsed && typeof parsed === 'object' ? parsed : { aliases: {} }
		} catch (err: any) {
			console.error('[voice] failed to load dictionary:', err.message)
			return { aliases: {} }
		}
	}

	private buildDictionaryRuntime(dictionary: VoiceDictionary): VoiceDictionaryRuntime {
		const aliasTable = dictionary.aliases && typeof dictionary.aliases === 'object' ? dictionary.aliases : {}
		const entries: Array<{ section: string; key: string; entry: VoiceDictionaryEntry }> = []

		for (const [section, value] of Object.entries(dictionary)) {
			if (section === 'aliases') continue
			if (!value || typeof value !== 'object') continue

			const sectionEntries = value as Record<string, string | VoiceDictionaryEntry>
			for (const [key, rawEntry] of Object.entries(sectionEntries)) {
				entries.push({
					section,
					key,
					entry: this.coerceDictionaryEntry(rawEntry),
				})
			}
		}

		if (!entries.length && dictionary.nouns && typeof dictionary.nouns === 'object') {
			for (const [key, rawEntry] of Object.entries(dictionary.nouns as Record<string, string | VoiceDictionaryEntry>)) {
				entries.push({
					section: 'nouns',
					key,
					entry: this.coerceDictionaryEntry(rawEntry),
				})
			}
		}

		const resolveNoun = (term?: string | null): DictionaryMatch | null => {
			const normalizedTerm = this.normalizeNoun(String(term || ''))
			if (!normalizedTerm) return null

			for (const { section, key, entry } of entries) {
				const mappedAlias = Object.entries(aliasTable)
					.find(([alias]) => this.normalizeNoun(alias) === normalizedTerm)
					?.[1]
				const canonicalFromAlias = mappedAlias ? String(mappedAlias) : ''
				const canonicalMatches = canonicalFromAlias
					? [key, `${section}.${key}`].includes(canonicalFromAlias)
					: false

				const searchTerms = [key, ...(entry.aliases || [])]
				for (const candidate of searchTerms) {
					const normalizedCandidate = this.normalizeNoun(candidate)
					if (!normalizedCandidate) continue
					if (normalizedCandidate === normalizedTerm || canonicalMatches) {
						return {
							section,
							key,
							matchedText: canonicalMatches ? canonicalFromAlias : candidate,
							value: entry.path || entry.value || null,
							entry,
						}
					}
				}
			}

			return null
		}

		const extractFromText = (text: string): DictionaryMatch[] => {
			const haystack = String(text || '').toLowerCase()
			const found: DictionaryMatch[] = []
			const aliasMatches = Object.entries(aliasTable)
				.filter(([alias]) => {
					const trimmed = alias.trim()
					if (!trimmed) return false
					const pattern = new RegExp(`\\b${this.escapeRegExp(trimmed.toLowerCase())}\\b`, 'i')
					return pattern.test(haystack)
				})
				.map(([alias, canonical]) => ({ alias, canonical: String(canonical) }))

			for (const { section, key, entry } of entries) {
				const searchTerms = [key, ...(entry.aliases || [])]
				for (const candidate of searchTerms) {
					const trimmed = candidate.trim()
					if (!trimmed) continue
					const pattern = new RegExp(`\\b${this.escapeRegExp(trimmed.toLowerCase())}\\b`, 'i')
					const aliasHit = aliasMatches.find((hit) => [key, `${section}.${key}`].includes(hit.canonical))
					if (pattern.test(haystack) || aliasHit) {
						found.push({
							section,
							key,
							matchedText: aliasHit ? aliasHit.alias : candidate,
							value: entry.path || entry.value || null,
							entry,
						})
						break
					}
				}
			}

			return found
		}

		return {
			raw: dictionary,
			resolveNoun,
			extractFromText,
		}
	}

	private async buildContext(
		cmd: CommandHandle,
		parsed: ParsedUtterance | null,
		inputText?: string
	): Promise<HandlerContext> {
		const dictionary = await this.loadDictionary()
		const dictionaryRuntime = this.buildDictionaryRuntime(dictionary)
		const rawText = String(cmd.text || '')
		const effectiveInputText = String(inputText || rawText)

		return {
			container: this.container,
			windowManager: this.container.feature('windowManager'),
			rawText,
			inputText: effectiveInputText,
			normalizedText: effectiveInputText.toLowerCase(),
			parsed,
			dictionary: dictionaryRuntime,
			workspaceRoot: this.workspaceRoot,
			activeWorkspace: { ...this.activeWorkspace },
			setActiveWorkspace: (workspace) => this.setActiveWorkspace(workspace),
			playPhrase: (tag: string) => this.playPhrase(tag),
			playAssistantPhrase: (tag: string) => this.playAssistantPhrase(tag),
			speakPhrase: (text: string) => this._chat ? this._chat.speakPhrase(text) : Promise.resolve(),
			cmd,
		}
	}

	private setActiveWorkspace(workspace: VoiceWorkspaceContext): VoiceWorkspaceContext {
		const next: VoiceWorkspaceContext = {
			key: String(workspace.key || '').trim() || 'workspace',
			path: String(workspace.path || '').trim() || this.workspaceRoot,
			source: workspace.source,
		}
		this.state.set('activeWorkspace', next)
		console.log(`[voice] active workspace => ${next.key} (${next.path})`)
		return { ...next }
	}

	private async transformInputText(handler: VoiceHandler, text: string): Promise<string> {
		if (typeof handler.transformInput !== 'function') return text
		try {
			const transformed = await handler.transformInput(text)
			const normalized = String(transformed || '').trim()
			return normalized || text
		} catch (error: any) {
			console.error(`[voice] transformInput failed for ${handler.name}:`, error?.message || error)
			return text
		}
	}

	private async firstDirectMatch(cmd: CommandHandle): Promise<{ loaded: LoadedHandler; ctx: HandlerContext } | null> {
		for (const loaded of this.handlers) {
			const transformedText = await this.transformInputText(loaded.handler, cmd.text)
			const parsed = await this.parseUtterance(transformedText)
			const ctx = await this.buildContext(cmd, parsed, transformedText)
			const matched = await loaded.handler.match(ctx)
			if (matched) return { loaded, ctx }
		}

		return null
	}

	/** Routes a voice command to the first matching handler, or to the conversational assistant if in conversation mode. */
	async route(cmd: CommandHandle): Promise<{ matched: boolean; ctx: HandlerContext; cmd: CommandHandle }> {
		if (this.isRouting) {
			await this.waitFor('routeFinished')
		}

		const directMatch = await this.firstDirectMatch(cmd)

		if (directMatch) {
			const { loaded, ctx } = directMatch
			try {
				this.state.set('routing', true)
				await loaded.handler.execute(ctx)
				this.emit('handlerFinished', cmd, directMatch)
			} catch (err: any) {
				console.error(`[voice] handler ${loaded.handler.name} threw:`, err.message)
				this.emit('handlerError', err)
				if (!ctx.cmd.isFinished) {
					ctx.cmd.fail({ error: err.message })
				}
			} finally {
				this.state.set('routing', false)
				this.emit('routeFinished', cmd, directMatch)
			}

			return { cmd, matched: true, ctx }
		}

		const parsed = await this.parseUtterance(cmd.text)
		const ctx = await this.buildContext(cmd, parsed, cmd.text)

		return { matched: false, ctx, cmd } 
	}

	/** Dry-runs a voice command against all handlers and returns match diagnostics including parsed utterance and dictionary hits. */
	async inspect(text: string) {
		const parsed = await this.parseUtterance(text)
		const cmd = this.createDryRunCommand(text)
		const baseCtx = await this.buildContext(cmd, parsed, text)
		const matches: Array<{ name: string; file: string; matched: boolean; inputText: string; error?: string }> = []
		for (const loaded of this.handlers) {
			try {
				const transformedText = await this.transformInputText(loaded.handler, text)
				const parsedForHandler = await this.parseUtterance(transformedText)
				const ctx = await this.buildContext(cmd, parsedForHandler, transformedText)
				const matched = await loaded.handler.match(ctx)
				matches.push({
					name: loaded.handler.name,
					file: loaded.file,
					matched: !!matched,
					inputText: transformedText,
				})
			} catch (err: any) {
				matches.push({
					name: loaded.handler.name,
					file: loaded.file,
					matched: false,
					inputText: text,
					error: err.message,
				})
			}
		}

		return {
			text,
			normalizedText: baseCtx.normalizedText,
			parsed,
			activeWorkspace: { ...this.activeWorkspace },
			dictionary: {
				subjectMatch: baseCtx.dictionary.resolveNoun(parsed?.subject || parsed?.target || ''),
				textMatches: baseCtx.dictionary.extractFromText(text),
			},
			matches,
			firstMatched: matches.find((m) => m.matched)?.name || null,
		}
	}

	private createDryRunCommand(text: string): CommandHandle {
		return {
			id: `dry-run-${Date.now()}`,
			source: 'train',
			text,
			payload: { text, source: 'train' },
			isFinished: false,
			ack: () => true,
			progress: () => true,
			finish: () => true,
			fail: () => true,
		}
	}

	/** Returns the list of loaded handler names and their source file paths. */
	get handlerFiles(): Array<{ name: string; file: string }> {
		return this.handlers.map((h) => ({
			name: h.handler.name,
			file: h.file,
		}))
	}

	/** Returns a manifest of all loaded handlers with their name, description, keywords, and priority. */
	get manifest(): Array<{ name: string; description: string; keywords: string[]; priority: number }> {
		return this.handlers.map((h) => ({
			name: h.handler.name,
			description: h.handler.description,
			keywords: h.handler.keywords,
			priority: h.handler.priority ?? 100,
		}))
	}

	get phraseTags() : string[] {
		if(this._phrasesByTag) {
			return Array.from(this._phrasesByTag.keys())
		}

		return []
	}
}

export default features.register('voiceRouter', VoiceRouter)
