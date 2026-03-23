export const path = '/api/prompt/:slug'
export const description = 'Get or update a single prompt document'
export const tags = ['prompt-studio']

export async function get(_params: any, ctx: any) {
  const { docs, container } = ctx.request.app.locals
  const slug = ctx.request.params.slug

  const prompts = await docs.query(docs.models.Prompt).fetchAll()
  const prompt = prompts.find(
    (p: any) => p.id === `prompts/${slug}` || p.id === slug
  )

  if (!prompt) {
    ctx.response.status(404)
    return { error: `Prompt not found: ${slug}` }
  }

  // Read the raw file content
  const filePath = container.paths.resolve('docs', 'prompts', `${slug}.md`)
  const fs = container.feature('fs')
  const rawContent = await fs.readFile(filePath)

  return {
    id: prompt.id,
    slug,
    title: prompt.title,
    tags: prompt.meta.tags || [],
    inputs: prompt.meta.inputs || {},
    repeatable: prompt.meta.repeatable,
    lastRanAt: prompt.meta.lastRanAt,
    rawContent,
    content: prompt.document?.content || '',
    meta: prompt.meta,
  }
}

export async function post(_params: any, ctx: any) {
  const { container, docs } = ctx.request.app.locals
  const slug = ctx.request.params.slug
  const { content } = ctx.request.body

  if (!content) {
    ctx.response.status(400)
    return { error: 'Missing content' }
  }

  const filePath = container.paths.resolve('docs', 'prompts', `${slug}.md`)
  const fs = container.feature('fs')
  await fs.writeFile(filePath, content)

  // Reload docs so queries reflect the updated content
  await docs.reload()

  return { ok: true, slug }
}
