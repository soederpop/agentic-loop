import type { Assistant } from '@soederpop/luca/agi'

declare global {
	var assistant: Assistant
}

export function created(assistant: Assistant) {
	assistant
		.use(assistant.container.docs)
		.use(assistant.container.feature('workflowLibrary'))
}

export async function formatSystemPrompt(prompt: string) {
	const docs = await assistant.contentDb.readMultiple(['memories/SELF', 'memories/USER', 'memories/TODO', 'README','assistant-README'])
	return [ prompt, docs ].join('\n\n<-- BEGIN INTERNAL MEMORY DOCUMENTATION -->')
}
