export const path = '/api/assistants'
export const description = 'List available assistants'
export const tags = ['chat']

export async function get(_params: any, ctx: any) {
  const { assistantsManager } = ctx.request.app.locals

  const entries = assistantsManager.list()

  return {
    assistants: entries.map((e: any) => ({
      name: e.name,
      folder: e.folder,
    })),
    default: entries.find((e: any) => e.name === 'chiefOfStaff')
      ? 'chiefOfStaff'
      : entries[0]?.name || null,
  }
}
