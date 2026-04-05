import type { Assistant, AGIContainer } from '@soederpop/luca/agi'

declare global {
	var assistant: Assistant
	var container: AGIContainer
}

export function started() {
	const workflowLibrary = container.feature('workflowLibrary')
	const windowManager = container.feature('windowManager')
	const processManager = container.feature('processManager')

	assistant
		.use(workflowLibrary)
		.use(processManager)
		.use(windowManager)
		.use(container.feature('memory', { namespace: 'rocket' }))
	
	assistant.intercept('beforeAsk', beforeInitialAsk)
		
	async function beforeInitialAsk(ctx: any, next: any) {
		// We could even inject a summarization of the available workflows and their likely trigger phrases here
		ctx.question = `Do not forget to call listAvailableWorkflows so that you know which workflow will likely best be able to handle the users request.\n\n ${ctx.question}`
		assistant.interceptors.beforeAsk.remove(beforeInitialAsk)
		await next()
	}
}

