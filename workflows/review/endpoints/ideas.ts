export const path = '/api/ideas'
export const description = 'All ideas with full metadata'
export const tags = ['review']

export async function get(_params: any, ctx: any) {
  const { docs } = ctx.request.app.locals
  const ideas = await docs.query(docs.models.Idea).fetchAll()
  return {
    ideas: ideas.map((i: any) => ({
      id: i.id,
      title: i.title,
      status: i.meta.status,
      goal: i.meta.goal || null,
      tags: i.meta.tags || [],
      updatedAt: i.updatedAt || null,
    })),
  }
}
