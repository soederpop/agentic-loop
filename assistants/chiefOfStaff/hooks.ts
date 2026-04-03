import type { Assistant } from '@soederpop/luca/agi'

declare global {
	var assistant: Assistant
}

export function started() {
	const { schemas, handlers } = (assistant.container as any).selectors.toTools(assistant.container)
	assistant.use({ schemas, handlers })
}

export async function formatSystemPrompt(prompt: string) {
	// in theory here we could inject context
	//
	const docs = await assistant.contentDb.readMultiple(['memories/SELF', 'memories/USER', 'memories/TODO', 'README','assistant-README'])

	return [ prompt, docs ].join('\n\n<-- BEGIN INTERNAL MEMORY DOCUMENTATION -->')
}
