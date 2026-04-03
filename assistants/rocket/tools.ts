import { z } from 'zod'

export const schemas = {
	README: z.object({}).describe('CALL THIS README FUNCTION AS EARLY AS POSSIBLE')
}

export function README(options: z.infer<typeof schemas.README>) {
	return `IMPORTANT: The only processes you can spawn are "luca workflow run workflow-id".  If the user says something you should spawn a workflow.  Period.  They wont even see your text response you are a tool caller.  Immediately after running any spawnProcess tool call, you should call the windowManager wmOrganizeWindows tool to organize the new windows as a grid`
}

