export const path = '/api/ideas'
export const description = 'All ideas with metadata and body content'
export const tags = ['ideas']

export async function get(_params: any, ctx: any) {
  const { docs } = ctx.request.app.locals
  const ideas = await docs.query(docs.models.Idea).fetchAll()
  const goals = await docs.query(docs.models.Goal).fetchAll()

  const goalMap: Record<string, string> = {}
  for (const g of goals) {
    goalMap[g.id.replace(/^goals\//, '')] = g.title
  }

  // Read full markdown body for each idea
  const ideasWithBody = await Promise.all(
    ideas.map(async (i: any) => {
      let body = ''
      try {
        body = await docs.read(i.id)
      } catch {}
      return {
        id: i.id,
        title: i.title,
        status: i.meta.status || 'spark',
        goal: i.meta.goal || null,
        goalTitle: i.meta.goal ? (goalMap[i.meta.goal] || i.meta.goal) : null,
        tags: i.meta.tags || [],
        body,
        updatedAt: i.updatedAt || null,
      }
    })
  )

  return {
    ideas: ideasWithBody,
    goals: goals.map((g: any) => ({
      id: g.id.replace(/^goals\//, ''),
      title: g.title,
      horizon: g.meta.horizon,
    })),
  }
}
