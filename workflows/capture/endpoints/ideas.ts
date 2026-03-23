export const path = '/api/ideas'
export const description = 'List existing ideas or create a new idea document'
export const tags = ['capture']

export async function get(_params: any, ctx: any) {
  const docs = ctx.request.app.locals.docs
  const ideas = await docs.query(docs.models.Idea).fetchAll()
  return {
    ideas: ideas.map((i: any) => ({
      id: i.id,
      title: i.title,
      status: i.meta.status,
      goal: i.meta.goal,
      tags: i.meta.tags || [],
    })),
  }
}

export async function post(_params: any, ctx: any) {
  const docs = ctx.request.app.locals.docs
  const container = ctx.container
  const { title, goal, tags, description } = ctx.body

  if (!title || typeof title !== 'string' || !title.trim()) {
    ctx.response.status(400)
    return { error: 'Title is required' }
  }

  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  const tagList = Array.isArray(tags) ? tags : (tags || '').split(',').map((t: string) => t.trim()).filter(Boolean)

  const frontmatter = [
    '---',
    goal ? `goal: ${goal}` : 'goal:',
    `tags: [${tagList.map((t: string) => `"${t}"`).join(', ')}]`,
    'status: spark',
    '---',
  ].join('\n')

  const body = description?.trim() || 'Description of the idea and what it could become.'
  const content = `${frontmatter}\n\n# ${title.trim()}\n\n${body}\n`

  const filePath = container.paths.resolve('docs', 'ideas', `${slug}.md`)

  const fs = container.feature('fs')
  if (fs.existsSync(filePath)) {
    ctx.response.status(409)
    return { error: `An idea with slug "${slug}" already exists` }
  }

  fs.writeFile(filePath, content)
  await docs.reload()

  return {
    ok: true,
    id: `ideas/${slug}`,
    title: title.trim(),
    slug,
    path: filePath,
  }
}
