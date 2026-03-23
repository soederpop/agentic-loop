export const path = '/api/assistants'
export const description = 'List available assistants'
export const tags = ['prompt-studio']

export async function get(_params: any, ctx: any) {
  const { assistantsManager } = ctx.request.app.locals

  const assistants = assistantsManager.list().map((a: any) => ({
    name: a.name,
    description: a.description || '',
  }))

  return { assistants }
}
