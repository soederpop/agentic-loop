import type { Assistant, AGIContainer } from '@soederpop/luca/agi'

declare global {
	var assistant: Assistant
	var container: AGIContainer
}

export function started() {
	// Shell primitives: rg, ls, cat, sed, awk
	assistant.use(container.feature('codingTools' as any))

	// Write operations only -- shell tools cover read/search/list
	const fileTools = container.feature('fileTools')
	assistant.use(fileTools.toTools({ only: ['editFile', 'writeFile', 'deleteFile'] }))
	fileTools.setupToolsConsumer(assistant as any)

	// Process management: runCommand, spawnProcess, listProcesses, etc.
	assistant.use(container.feature('processManager'))

	// Skill discovery and loading
	assistant.use(container.feature('skillsLibrary'))

	assistant.intercept('beforeAsk', async function runOnceBeforeChat(ctx, next) {
		const claudeMd = await container.fs.readFileAsync('CLAUDE.md').then(r => String(r))
		
		assistant.state.set('loadedClaudeMd', true)
		
		assistant.addSystemPromptExtension('code-context', claudeMd)

		assistant.interceptors.beforeAsk.remove(runOnceBeforeChat)

		await next()
	})

}
