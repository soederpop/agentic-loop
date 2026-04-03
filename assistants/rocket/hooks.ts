import type { Assistant, AGIContainer } from '@soederpop/luca/agi'

declare global {
	var assistant: Assistant
	var container: AGIContainer
}

export function created() {
	const workflowLibrary = container.feature('workflowLibrary')
	const windowManager = container.feature('windowManager')
	const processManager = container.feature('processManager')

	assistant
		.use(workflowLibrary)
		.use(processManager)
		.use(windowManager)
}

export function started() {
	assistant.intercept('afterToolCall', async function autoOrganizeWindows(ctx, next) {
		console.log('got a tool call', ctx)
		await next()
	})
}
