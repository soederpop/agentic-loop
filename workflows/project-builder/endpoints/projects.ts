export const path = '/api/projects'
export const description = 'List all projects with their plans'
export const tags = ['project-builder']

export async function get(_params: any, ctx: any) {
  const { docs, serializeProject } = ctx.request.app.locals
  const projects = await docs.query(docs.models.Project).fetchAll()
  const result = []
  for (const project of projects) {
    const plans = await project.relationships.plans.fetchAll()
    result.push(serializeProject(project, plans))
  }
  return { projects: result }
}
