import { logger } from './logger'

export async function started() {
	await logger.info('lifecycle', 'Researcher assistant started', {
		isFork: assistant.isFork,
		logFile: logger.logFile,
	})

	assistant.addSystemPromptExtension('file-scope', [
		'## File Tools Scope',
		'You have file tools (listDirectory, writeFile, editFile, deleteFile).',
		'You are ONLY allowed to use these tools within the docs/reports/ directory.',
		'Do NOT create, edit, or delete files outside of docs/reports/.',
		'',
		'## Incremental Saving',
		'ALWAYS save your work incrementally to disk as you go. Do NOT wait until you are finished.',
		'Create your output file early — as soon as you have a structure or first finding — then use editFile to append new sections after each meaningful discovery.',
		'This ensures partial results survive if the session is interrupted or aborted.',
		'A half-written file with real findings is far more valuable than nothing.',
	].join('\n'))

	assistant.state.set('sources', [])

	// Log all tool calls and results
	assistant.on('toolCall', async (name: string, args: unknown) => {
		await logger.tool('tool-call', `${name} called`, { name, args })
	})

	assistant.on('toolResult', async (name: string, result: unknown) => {
		await logger.tool('tool-result', `${name} completed`, { name, result })
	})

	assistant.on('toolError', async (name: string, error: unknown) => {
		await logger.error('tool-error', `${name} failed`, {
			name,
			error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
		})
	})

	assistant.on('error', async (error: unknown) => {
		await logger.error('session-error', 'Session-level error', {
			error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
		})
	})

	await logger.info('lifecycle', 'Event listeners registered, assistant ready')
}
