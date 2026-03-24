export const path = '/api/plays'
export const description = 'Create a new play document'
export const tags = ['playbook-designer']

/**
 * POST /api/plays — create a new play
 * Accepts { title, body, schedule, agent, tags }
 * Generates slug from title, creates docs/plays/:slug.md
 */
export async function post(_params: any, ctx: any) {
  const { docs, container, scheduleMap } = ctx.request.app.locals
  const fs = container.feature('fs')
  const yaml = container.feature('yaml')
  const { stringUtils } = container.utils

  const { title, body, schedule, agent, tags } = ctx.request.body

  if (!title || !title.trim()) {
    ctx.status = 400
    return { error: 'Title is required' }
  }

  // Validate schedule
  const sched = schedule || 'every-half-hour'
  if (!scheduleMap[sched]) {
    ctx.status = 400
    return { error: `Invalid schedule: ${sched}`, validSchedules: Object.keys(scheduleMap) }
  }

  // Generate slug from title
  const slug = stringUtils.kebabCase(title.trim())

  if (!slug) {
    ctx.status = 400
    return { error: 'Could not generate a valid slug from the title' }
  }

  // Check for conflicts
  const filePath = container.paths.resolve('docs', 'plays', `${slug}.md`)
  const exists = await fs.exists(filePath)

  if (exists) {
    ctx.status = 409
    return { error: `A play with slug "${slug}" already exists`, slug }
  }

  // Build frontmatter
  const meta: Record<string, any> = {
    agent: agent || 'claude',
    schedule: sched,
  }

  if (tags && tags.length > 0) {
    meta.tags = tags
  }

  const frontmatter = yaml.stringify(meta).trim()
  const content = `---\n${frontmatter}\n---\n\n# ${title.trim()}\n\n${body || ''}`

  await fs.writeFile(filePath, content)
  await docs.reload()

  return { ok: true, slug, id: `plays/${slug}`, title: title.trim() }
}
