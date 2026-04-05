import type { Assistant, AGIContainer } from '@soederpop/luca/agi'

declare global {
	var assistant: Assistant
	var container: AGIContainer
}

export function started() {
	// Shell primitives: rg, ls, cat, sed, awk
	assistant.use(container.feature('codingTools'))

	// Write operations only -- shell tools cover read/search/list
	const fileTools = container.feature('fileTools')
	assistant.use(fileTools.toTools({ only: ['editFile', 'writeFile', 'deleteFile'] }))
	fileTools.setupToolsConsumer(assistant)

	// Process management: runCommand, spawnProcess, listProcesses, etc.
	assistant.use(container.feature('processManager'))

	// Skill discovery and loading
	assistant.use(container.feature('skillsLibrary'))
}
