import type { Assistant, AGIContainer } from '@soederpop/luca/agi'

export function created(a: Assistant) {
	const { container } = a as { container: AGIContainer }
	
	const workflowLibrary = container.feature('workflowLibrary')
	const processManager = container.feature('processManager')
	
	a.use(workflowLibrary).use(processManager)
}
