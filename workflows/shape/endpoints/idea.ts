export const path = '/api/idea/:slug'
export const description = 'Get or update a single idea document'
export const tags = ['shape']

export async function get(_params: any, ctx: any) {
  const { docs, fs } = ctx.request.app.locals
  const container = ctx.container
  const { slug } = ctx.params

  const allIdeas = await docs.query(docs.models.Idea).fetchAll()
  const idea = allIdeas.find(
    (i: any) => i.id === `ideas/${slug}` || i.id === slug
  )

  if (!idea) {
    ctx.response.status(404)
    return { error: `Idea "${slug}" not found` }
  }

  const filePath = container.paths.resolve('docs', 'ideas', `${slug}.md`)
  let rawContent = ''
  if (fs.existsSync(filePath)) {
    rawContent = fs.readFileSync(filePath, 'utf-8')
  }

  const bodyMatch = rawContent.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
  const body = bodyMatch ? bodyMatch[1].trim() : rawContent

  return {
    slug: idea.id.replace(/^ideas\//, ''),
    title: idea.title,
    status: idea.meta.status,
    goal: idea.meta.goal || null,
    tags: idea.meta.tags || [],
    content: body,
    rawContent,
  }
}

export async function post(_params: any, ctx: any) {
  const { docs, fs } = ctx.request.app.locals
  const container = ctx.container
  const { slug } = ctx.params
  const { status, tags, appendSections } = ctx.body

  const filePath = container.paths.resolve('docs', 'ideas', `${slug}.md`)

  if (!fs.existsSync(filePath)) {
    ctx.response.status(404)
    return { error: `Idea file "${slug}.md" not found` }
  }

  const raw = fs.readFileSync(filePath, 'utf-8')

  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n/)
  if (!fmMatch) {
    ctx.response.status(400)
    return { error: 'Could not parse frontmatter' }
  }

  const fmBlock = fmMatch[1]
  const bodyAfterFm = raw.slice(fmMatch[0].length)

  const fmLines = fmBlock.split('\n')
  const newFmLines: string[] = []

  for (const line of fmLines) {
    if (status && line.startsWith('status:')) {
      newFmLines.push(`status: ${status}`)
    } else if (tags && line.startsWith('tags:')) {
      const tagList = Array.isArray(tags) ? tags : [tags]
      newFmLines.push(`tags:\n${tagList.map((t: string) => `  - ${t}`).join('\n')}`)
    } else if (tags && line.match(/^\s+-\s/)) {
      continue
    } else {
      newFmLines.push(line)
    }
  }

  const newFrontmatter = `---\n${newFmLines.join('\n')}\n---\n`

  let newBody = bodyAfterFm
  if (appendSections && typeof appendSections === 'object') {
    for (const [heading, content] of Object.entries(appendSections)) {
      if (content && typeof content === 'string' && content.trim()) {
        newBody += `\n## ${heading}\n\n${(content as string).trim()}\n`
      }
    }
  }

  const newContent = newFrontmatter + newBody
  fs.writeFile(filePath, newContent)
  await docs.reload()

  const oldStatusMatch = fmBlock.match(/status:\s*(\w+)/)
  const oldStatus = oldStatusMatch ? oldStatusMatch[1] : 'unknown'

  return {
    ok: true,
    slug,
    oldStatus,
    newStatus: status || oldStatus,
  }
}
