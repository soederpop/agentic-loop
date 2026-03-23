export const path = '/api/prompts/create'
export const description = 'Create a new prompt document'
export const tags = ['prompt-studio']

export async function post(_params: any, ctx: any) {
  const { container, docs } = ctx.request.app.locals
  const { title, slug, content: userContent } = ctx.request.body

  if (!title || !slug) {
    ctx.response.status(400)
    return { error: 'Missing title or slug' }
  }

  const sanitized = slug.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  const filePath = container.paths.resolve('docs', 'prompts', `${sanitized}.md`)
  const fs = container.feature('fs')

  // Check if file already exists
  if (await fs.exists(filePath)) {
    ctx.response.status(409)
    return { error: `Prompt already exists: ${sanitized}` }
  }

  const content = userContent || `---
tags: []
inputs: {}
---

# ${title}

Write your prompt instructions here.
`

  await fs.writeFile(filePath, content)

  // Reload docs to pick up new file
  await docs.reload()

  return { ok: true, slug: sanitized }
}
