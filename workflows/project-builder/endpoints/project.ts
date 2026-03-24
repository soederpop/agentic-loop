export const path = '/api/project/:slug'
export const description = 'Get a single project with its plans'
export const tags = ['project-builder']

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

export async function put(_params: any, ctx: any) {
  const { docs, serializeProject } = ctx.request.app.locals
  const { slug } = ctx.params
  const { content, meta } = ctx.request.body || {}

  const projects = await docs.query(docs.models.Project).fetchAll()
  const project = projects.find(
    (p: any) => p.id === `projects/${slug}` || p.id === slug
  )
  if (!project) {
    ctx.response.status(404)
    return { error: 'Project not found' }
  }

  const doc = project.document

  if (meta) {
    if (meta.status !== undefined) doc.meta.status = meta.status
    if (meta.goal !== undefined) doc.meta.goal = meta.goal
  }

  if (content !== undefined) {
    const yaml = ctx.container.feature('yaml')
    const frontmatter = yaml.stringify(doc.meta).trim()
    const fs = ctx.container.feature('fs')
    await fs.writeFile(doc.path, `---\n${frontmatter}\n---\n\n${content}`)
    await docs.load()
  } else {
    await doc.save({ normalize: false })
    await docs.load()
  }

  const updated = (await docs.query(docs.models.Project).fetchAll())
    .find((p: any) => p.id === `projects/${slug}` || p.id === slug)
  if (!updated) return { ok: true }

  const plans = await updated.relationships.plans.fetchAll()
  return { ok: true, project: serializeProject(updated, plans) }
}
