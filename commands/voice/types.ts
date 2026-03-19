import type { NodeContainer } from '@soederpop/luca'
import type { AGIContainer } from '@soederpop/luca/agi'
import type { WindowManager } from '@soederpop/luca/node/container.js'

export type { NodeContainer, AGIContainer, WindowManager }

export interface CommandHandle {
	text: string
	source: string
	id: string
	payload: any
	ack(speech?: string): boolean
	progress(progress: number, message?: string): boolean
	finish(opts?: { result?: Record<string, any>; speech?: string }): boolean
	fail(opts?: { error?: string; speech?: string }): boolean
	isFinished: boolean
}

export interface ParsedToken {
	value: string
	pos: string
}

export interface ParsedEntity {
	value: string
	type: string
}

export interface ParsedUtterance {
	intent: string | null
	target: string | null
	subject: string | null
	modifiers: string[]
	tokens: ParsedToken[]
	entities: ParsedEntity[]
	raw: string
}

export interface VoiceDictionaryEntry {
	value?: string
	path?: string
	aliases?: string[]
	ref?: string
	[key: string]: any
}

export interface VoiceDictionary {
	aliases?: Record<string, string>
	[key: string]: any
}

export interface DictionaryMatch {
	section: string
	key: string
	matchedText: string
	value: string | null
	entry: VoiceDictionaryEntry
}

export interface VoiceDictionaryRuntime {
	raw: VoiceDictionary
	resolveNoun(term?: string | null): DictionaryMatch | null
	extractFromText(text: string): DictionaryMatch[]
}

export interface VoiceWorkspaceContext {
	key: string
	path: string
	source?: string
}

export interface HandlerContext {
	container: AGIContainer & NodeContainer
	windowManager: WindowManager
	rawText: string
	inputText: string
	normalizedText: string
	parsed: ParsedUtterance | null
	dictionary: VoiceDictionaryRuntime
	workspaceRoot: string
	activeWorkspace: VoiceWorkspaceContext
	setActiveWorkspace(workspace: VoiceWorkspaceContext): VoiceWorkspaceContext
	playPhrase(tag: string): void
	playAssistantPhrase(tag: string): void
	speakPhrase(text: string): Promise<void>
	cmd: CommandHandle
}

export interface VoiceHandler {
	name: string
	description: string
	keywords: string[]
	priority?: number
	transformInput?(text: string): string | Promise<string>
	match(ctx: HandlerContext): boolean | Promise<boolean>
	execute(ctx: HandlerContext): Promise<void>
}
