export const path = '/api/projects'
export const description = 'Projects with their plans'
export const tags = ['review']

export async function get(_params: any, ctx: any) {
  const { docs } = ctx.request.app.locals
  const projects = await docs.query(docs.models.Project).fetchAll()
  const plans = await docs.query(docs.models.Plan).fetchAll()

  const result = await Promise.all(projects.map(async (p: any) => {
    let projectPlans: any[] = []
    try {
      projectPlans = await p.relationships.plans.fetchAll()
    } catch {
      const projectSlug = p.id.replace(/^projects\//, '')
      projectPlans = plans.filter((pl: any) => pl.meta.project === projectSlug)
    }

    return {
      id: p.id,
      title: p.title,
      status: p.meta.status,
      goal: p.meta.goal || null,
      plans: projectPlans.map((pl: any) => ({
        id: pl.id,
        title: pl.title,
        status: pl.meta.status,
        costUsd: pl.meta.costUsd || null,
        completedAt: pl.meta.completedAt || null,
      })),
    }
  }))

  return { projects: result }
}
