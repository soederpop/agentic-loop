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

export async function post(_params: any, ctx: any) {
  const { docs, serializeProject } = ctx.request.app.locals
  const { title, goal, status } = ctx.request.body || {}

  if (!title || typeof title !== 'string') {
    ctx.response.status(400)
    return { error: 'Title is required' }
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const docPath = ctx.container.paths.resolve('docs', 'projects', `${slug}.md`)

  const fs = ctx.container.feature('fs')
  if (await fs.exists(docPath)) {
    ctx.response.status(409)
    return { error: `Project "${slug}" already exists` }
  }

  const yaml = ctx.container.feature('yaml')
  const meta = {
    status: status || 'draft',
    goal: goal || '',
  }
  const frontmatter = yaml.stringify(meta).trim()
  const body = `# ${title}\n\n## Overview\n\n\n\n## Execution\n\n- `

  await fs.writeFile(docPath, `---\n${frontmatter}\n---\n\n${body}`)
  await docs.load()

  const project = (await docs.query(docs.models.Project).fetchAll())
    .find((p: any) => p.id === `projects/${slug}`)

  if (!project) {
    return { ok: true, slug }
  }

  const plans = await project.relationships.plans.fetchAll()
  return { ok: true, project: serializeProject(project, plans) }
}
