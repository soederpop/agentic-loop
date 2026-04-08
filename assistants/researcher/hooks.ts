export function started() {
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
}
