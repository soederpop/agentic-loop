export const path = '/api/project/:slug'
export const description = 'Get a single project with its plans'
export const tags = ['project-reviewer']

export async function get(_params: any, ctx: any) {
  const { docs, serializeProject } = ctx.request.app.locals
  const { slug } = ctx.params

  const projects = await docs.query(docs.models.Project).fetchAll()
  const project = projects.find(
    (p: any) => p.id === `projects/${slug}` || p.id === slug
  )
  if (!project) {
    ctx.response.status(404)
    return { error: 'Project not found' }
  }
  const plans = await project.relationships.plans.fetchAll()
  return serializeProject(project, plans)
}
