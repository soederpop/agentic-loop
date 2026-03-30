import type { Assistant, AGIContainer } from '@soederpop/luca/agi'

declare global {
	var assistant: Assistant
	var container: AGIContainer
}

export function created() {
	const workflowLibrary = container.feature('workflowLibrary')
	const processManager = container.feature('processManager')

	assistant.use(workflowLibrary).use(processManager)
}
