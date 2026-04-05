import { z } from 'zod'

export const schemas = {
  README: z.object({}).describe("CALL THIS README FUNCTION AS EARLY AS POSSIBLE, It will explain your role in the system, which is primarily to launch workflow applications and organize the windows for the user."),
  launchChatWithChief: z.object({}).describe("Call this if the user wants to chat with the chief, the chief of staff, the adult in the room, etc."),
  launchChatWithCoder: z.object({}).describe("Call this if the user wants to chat with a coder, developer,nerd, dork, somebody who knows what the they are doing, somebody who can actually get shit done, etc."),
}

export async function README(options: z.infer<typeof schemas.README>) {
  const content = await container.fs.readFile(
    assistant.paths.resolve('assistant-README.md')
  )
  
  return `
    ${content}
  `
}

export async function launchChatWithChief(options: z.infer<typeof schemas.launchChatWithChief>) {
	let pid = 'unknown'

	container.proc.spawnAndCapture('luca', ['web-chat','--assistant','chiefOfStaff'], {
		onStart(c) {
			if(c?.pid) {
				pid = `${c.pid}`
			}
		}
	})
	await container.sleep(4000)
	return `Launched the Chat with the Chief. PID: ${pid}`

}
export async function launchChatWithCoder(options: z.infer<typeof schemas.launchChatWithCoder>) {
	let pid = 'unknown'

	container.proc.spawnAndCapture('luca', ['web-chat','--assistant','lucaCoder'], {
		onStart(c) {
			if(c?.pid) {
				pid = `${c.pid}`
			}
		}
	})
	await container.sleep(4000)
	return `Launched the Chat with the Luca Coder. PID: ${pid}`
}

