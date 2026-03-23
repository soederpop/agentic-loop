export const path = '/api/prompts'
export const description = 'List all prompt documents'
export const tags = ['prompt-studio']

export async function get(_params: any, ctx: any) {
  const { docs } = ctx.request.app.locals
  const prompts = await docs.query(docs.models.Prompt).fetchAll()

  return {
    prompts: prompts.map((p: any) => ({
      id: p.id,
      slug: p.id.replace(/^prompts\//, ''),
      title: p.title,
      tags: p.meta.tags || [],
      inputs: p.meta.inputs || {},
      repeatable: p.meta.repeatable,
      lastRanAt: p.meta.lastRanAt,
    })),
  }
}
