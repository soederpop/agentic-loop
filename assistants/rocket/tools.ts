import { z } from 'zod'

export const schemas = {
  README: z.object({}).describe("CALL THIS README FUNCTION AS EARLY AS POSSIBLE, It will explain your role in the system, which is primarily to launch workflow applications and organize the windows for the user."),
  listAvailableAssistants: z.object({}).describe("List the available assistants Rocket can launch a web chat with."),
  launchChatWithAssistant: z.object({
    assistant: z.string().describe("The assistant name to launch with luca web-chat --assistant <name>. Call listAvailableAssistants first if you are unsure which names are available."),
  }).describe("Launch a web chat with any available assistant by name."),
}

export async function README(options: z.infer<typeof schemas.README>) {
  const content = await container.fs.readFile(
    assistant.paths.resolve('assistant-README.md')
  )

  const savedLayouts = await container.fs.readFile(
	  assistant.paths.resolve('layouts.md')
  )
  
  return `
    ${content}

    ${savedLayouts}
  `
}

export async function listAvailableAssistants(options: z.infer<typeof schemas.listAvailableAssistants>) {
  const assistantsManager = container.feature('assistantsManager')
  await assistantsManager.discover()
  const available = assistantsManager.available || []

  return JSON.stringify({ assistants: available }, null, 2)
}

export async function launchChatWithAssistant(options: z.infer<typeof schemas.launchChatWithAssistant>) {
	const assistantsManager = container.feature('assistantsManager')
	await assistantsManager.discover()

	const available = assistantsManager.available || []
	const assistantName = options.assistant

	if (!available.includes(assistantName)) {
		return JSON.stringify({
			ok: false,
			error: `Assistant "${assistantName}" is not available.`,
			assistants: available,
		}, null, 2)
	}

	let pid = 'unknown'

	container.proc.spawnAndCapture('luca', ['web-chat', '--assistant', assistantName], {
		onStart(c) {
			if (c?.pid) {
				pid = `${c.pid}`
			}
		}
	})
	await container.sleep(4000)

	return JSON.stringify({
		ok: true,
		assistant: assistantName,
		pid,
		message: `Launched chat with ${assistantName}.`,
	}, null, 2)
}

