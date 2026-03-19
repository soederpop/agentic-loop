import { z } from 'zod'

import type { VoiceRouter } from '../../features/voice-router'

const router = container.feature('voiceRouter' as any) as VoiceRouter

export const schemas = {
	runCommand: z.object({
		text: z.string().describe('The voice command text to dispatch, e.g. "go to luca" or "open console"'),
	}).describe('Use this command ONLY AFTER you have run listCommands.'),

	listCommands: z.object({}).describe('List all available commands and their descriptions.  Your goal is to find a way to translate what your partner is saying into a string which will match one of these handlers.  In general, there just needs to be one of the keywords in your text because the command handlers are all currently very simple triggers, but try and be faithful to their original phrase in a way that still makes it match.'),
}

export async function runCommand({ text }: { text: string } = { text: '' }) {
	console.log(`Voice Assistant running command: ${text}`)

	const inspection = await router.inspect(text)
	const matched = inspection.firstMatched

	if (!matched) {
		return {
			success: false,
			error: `No handler matched for "${text}"`,
			availableHandlers: inspection.matches.map((m: any) => m.name),
		}
	}

	// Create a command handle that captures the result
	let result: any = null
	let finished = false
	const cmd = {
		id: `assistant-${Date.now()}`,
		source: 'assistant',
		text,
		payload: { text, source: 'assistant' },
		isFinished: false,
		ack: (speech?: string) => {
			if (speech) result = { ...result, speech }
			return true
		},
		progress: () => true,
		finish: (opts?: any) => {
			finished = true
			cmd.isFinished = true
			if (opts?.result) result = { ...result, ...opts.result }
			if (opts?.speech) result = { ...result, speech: opts.speech }
			return true
		},
		fail: (opts?: any) => {
			finished = true
			cmd.isFinished = true
			result = { ...result, error: opts?.error, speech: opts?.speech }
			return true
		},
	}

	try {
		await router.route(cmd)
		return {
			success: !result?.error,
			handler: matched,
			result: result || { action: 'completed' },
		}
	} catch (err: any) {
		return { success: false, error: err.message, handler: matched }
	}
}

export async function listCommands(_args: any) {
	console.log('Assistant is listing commands')
	return {
		handlers: router.manifest.map((h: any) => ({
			name: h.name,
			description: h.description,
			keywords: h.keywords,
		})),
	}
}
