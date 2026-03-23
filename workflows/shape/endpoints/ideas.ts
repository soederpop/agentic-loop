export const path = '/api/ideas'
export const description = 'List ideas with spark/exploring status for shaping'
export const tags = ['shape']

export async function get(_params: any, ctx: any) {
  const { docs } = ctx.request.app.locals
  const allIdeas = await docs.query(docs.models.Idea).fetchAll()
  const shapeable = allIdeas.filter(
    (i: any) => i.meta.status === 'spark' || i.meta.status === 'exploring'
  )

  return {
    ideas: shapeable.map((i: any) => ({
      slug: i.id.replace(/^ideas\//, ''),
      title: i.title,
      status: i.meta.status,
      goal: i.meta.goal || null,
      tags: i.meta.tags || [],
      contentLength: i.size || 0,
    })),
  }
}
