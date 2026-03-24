export const path = '/api/goals'
export const description = 'List all goals for dropdowns'
export const tags = ['project-builder']

export async function get(_params: any, ctx: any) {
  const { docs } = ctx.request.app.locals
  const goals = await docs.query(docs.models.Goal).fetchAll()
  return {
    goals: goals.map((g: any) => ({
      id: g.id,
      slug: g.id.replace(/^goals\//, ''),
      title: g.title,
      horizon: g.meta.horizon,
    })),
  }
}
