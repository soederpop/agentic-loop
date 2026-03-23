export const path = '/api/goals'
export const description = 'List or create goal documents'
export const tags = ['blank-slate']

export async function get(_params: any, ctx: any) {
  const { docs } = ctx.request.app.locals
  const goals = await docs.query(docs.models.Goal).fetchAll()
  return {
    goals: goals.map((g: any) => ({
      id: g.id.replace(/^goals\//, ''),
      title: g.title,
      horizon: g.meta.horizon,
    })),
  }
}

export async function post(_params: any, ctx: any) {
  const { docs, fs } = ctx.request.app.locals
  const container = ctx.container
  const { title, horizon, successCriteria, motivation } = ctx.body

  if (!title || typeof title !== 'string' || !title.trim()) {
    ctx.response.status(400)
    return { error: 'Title is required' }
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const h = horizon || 'medium'

  const frontmatter = [
    '---',
    `horizon: ${h}`,
    '---',
  ].join('\n')

  const motivationText = motivation?.trim() || 'Why this goal is worth pursuing.'
  const criteriaText = successCriteria?.trim() || '- Criteria that define when this goal is achieved'

  const content = `${frontmatter}\n\n# ${title.trim()}\n\nWhat this goal is about and why it matters.\n\n## Motivation\n\n${motivationText}\n\n## Success Criteria\n\n${criteriaText}\n`

  const filePath = container.paths.resolve('docs', 'goals', `${slug}.md`)

  if (fs.existsSync(filePath)) {
    ctx.response.status(409)
    return { error: `A goal with slug "${slug}" already exists` }
  }

  fs.writeFile(filePath, content)
  await docs.reload()

  return {
    ok: true,
    id: slug,
    title: title.trim(),
    slug,
    horizon: h,
  }
}
