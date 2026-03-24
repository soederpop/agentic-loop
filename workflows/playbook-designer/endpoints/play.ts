export const path = '/api/plays/:slug'
export const description = 'Get or update a single play document'
export const tags = ['playbook-designer']

/**
 * GET /api/plays/:slug — fetch a single play with full raw content for editing
 */
export async function get(_params: any, ctx: any) {
  const { docs, container } = ctx.request.app.locals
  const fs = container.feature('fs')
  const yaml = container.feature('yaml')
  const slug = ctx.request.params.slug

  await docs.load()

  const plays = await docs.query(docs.models.Play).fetchAll()
  const play = plays.find((p: any) => p.id === `plays/${slug}`)

  if (!play) {
    ctx.status = 404
    return { error: 'Play not found', slug }
  }

  const filePath = container.paths.resolve('docs', 'plays', `${slug}.md`)
  let rawContent = ''
  let durationMs = null
  let outputTokens = null

  try {
    rawContent = await fs.readFile(filePath)
    const fmMatch = rawContent.match(/^---\n([\s\S]*?)\n---/)
    if (fmMatch) {
      const fm = yaml.parse(fmMatch[1])
      durationMs = fm.durationMs || null
      outputTokens = fm.outputTokens || null
    }
  } catch {
    ctx.status = 500
    return { error: 'Failed to read play file' }
  }

  // Extract body (everything after frontmatter)
  const body = rawContent.replace(/^---\n[\s\S]*?\n---\n*/, '')

  return {
    id: play.id,
    slug,
    title: play.title,
    agent: play.meta.agent || 'claude',
    schedule: play.meta.schedule || 'every-half-hour',
    tags: play.meta.tags || [],
    lastRanAt: play.meta.lastRanAt || null,
    running: play.meta.running || false,
    durationMs,
    outputTokens,
    rawContent,
    body,
    hasConditions: !!(play.sections?.conditions?.length),
  }
}

/**
 * PUT /api/plays/:slug — update an existing play
 * Accepts { body, schedule, agent, tags } and reconstructs the markdown file
 */
export async function put(_params: any, ctx: any) {
  const { docs, container, scheduleMap } = ctx.request.app.locals
  const fs = container.feature('fs')
  const yaml = container.feature('yaml')
  const slug = ctx.request.params.slug

  await docs.load()

  const plays = await docs.query(docs.models.Play).fetchAll()
  const play = plays.find((p: any) => p.id === `plays/${slug}`)

  if (!play) {
    ctx.status = 404
    return { error: 'Play not found', slug }
  }

  const { body, schedule, agent, tags } = ctx.request.body

  // Validate schedule if provided
  if (schedule && !scheduleMap[schedule]) {
    ctx.status = 400
    return { error: `Invalid schedule: ${schedule}`, validSchedules: Object.keys(scheduleMap) }
  }

  // Read existing file to preserve runtime fields (lastRanAt, running, durationMs, outputTokens)
  const filePath = container.paths.resolve('docs', 'plays', `${slug}.md`)
  let existingMeta: Record<string, any> = {}

  try {
    const raw = await fs.readFile(filePath)
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
    if (fmMatch) {
      existingMeta = yaml.parse(fmMatch[1]) || {}
    }
  } catch {}

  // Merge: user-editable fields override, runtime fields preserved
  const newMeta: Record<string, any> = {
    agent: agent ?? existingMeta.agent ?? 'claude',
    schedule: schedule ?? existingMeta.schedule ?? 'every-half-hour',
  }

  // Preserve tags (allow clearing to empty array)
  if (tags !== undefined) {
    if (tags.length > 0) newMeta.tags = tags
  } else if (existingMeta.tags?.length) {
    newMeta.tags = existingMeta.tags
  }

  // Preserve runtime fields
  if (existingMeta.lastRanAt) newMeta.lastRanAt = existingMeta.lastRanAt
  if (existingMeta.durationMs) newMeta.durationMs = existingMeta.durationMs
  if (existingMeta.outputTokens) newMeta.outputTokens = existingMeta.outputTokens
  if (existingMeta.running) newMeta.running = existingMeta.running

  const frontmatter = yaml.stringify(newMeta).trim()
  const content = `---\n${frontmatter}\n---\n\n${body ?? ''}`

  await fs.writeFile(filePath, content)
  await docs.reload()

  return { ok: true, slug }
}
