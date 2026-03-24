export const path = '/api/plans'
export const description = 'Create a new plan'
export const tags = ['project-builder']

export async function post(_params: any, ctx: any) {
  const { docs, serializePlan } = ctx.request.app.locals
  const { title, project: projectSlug, status } = ctx.request.body || {}

  if (!title || typeof title !== 'string') {
    ctx.response.status(400)
    return { error: 'Title is required' }
  }

  if (projectSlug && !/^[a-z0-9-]+$/.test(projectSlug)) {
    ctx.response.status(400)
    return { error: 'Invalid project slug' }
  }

  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const fs = ctx.container.feature('fs')

  let dirPath: string
  let planId: string

  if (projectSlug) {
    dirPath = ctx.container.paths.resolve('docs', 'plans', projectSlug)
    planId = `plans/${projectSlug}/${slug}`
  } else {
    dirPath = ctx.container.paths.resolve('docs', 'plans')
    planId = `plans/${slug}`
  }

  if (!(await fs.exists(dirPath))) {
    await fs.mkdir(dirPath, { recursive: true })
  }

  const filePath = ctx.container.paths.resolve(dirPath, `${slug}.md`)

  if (await fs.exists(filePath)) {
    ctx.response.status(409)
    return { error: `Plan "${slug}" already exists` }
  }

  const yaml = ctx.container.feature('yaml')
  const meta: Record<string, any> = {
    status: status || 'pending',
  }
  if (projectSlug) meta.project = projectSlug

  const frontmatter = yaml.stringify(meta).trim()
  const body = `# ${title}\n\n## References\n\n- \n\n## Test plan\n\n- `

  await fs.writeFile(filePath, `---\n${frontmatter}\n---\n\n${body}`)
  await docs.load()

  const plan = (await docs.query(docs.models.Plan).fetchAll())
    .find((p: any) => p.id === planId)

  return { ok: true, plan: plan ? serializePlan(plan) : null, planId }
}
