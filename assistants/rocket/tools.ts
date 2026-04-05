import { z } from 'zod'

export const schemas = {
  README: z.object({}).describe("CALL THIS README FUNCTION AS EARLY AS POSSIBLE, It will explain your role in the system, which is primarily to launch workflow applications and organize the windows for the user."),
}

export async function README(options: z.infer<typeof schemas.README>) {
  const content = await container.fs.readFile(
    assistant.paths.resolve('assistant-README.md')
  )
  
  return `
    ${content}
  `
}
