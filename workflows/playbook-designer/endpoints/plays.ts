export const path = '/api/plays'
export const description = 'List all play documents with full metadata'
export const tags = ['playbook-designer']

export async function get(_params: any, ctx: any) {
  const { docs } = ctx.request.app.locals
  const container = ctx.request.app.locals.container || docs.container

  // Reload to pick up any changes since last request
  await docs.load()

  const yaml = container.feature('yaml')
  const fs = container.feature('fs')
  const plays = await docs.query(docs.models.Play).fetchAll()

  const results = await Promise.all(plays.map(async (p: any) => {
    // Read raw frontmatter to get fields not in the Zod schema (durationMs, outputTokens)
    const slug = p.id.replace(/^plays\//, '')
    const filePath = container.paths.resolve('docs', 'plays', `${slug}.md`)
    let durationMs = null
    let outputTokens = null

    try {
      const raw = await fs.readFile(filePath)
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
      if (fmMatch) {
        const fm = yaml.parse(fmMatch[1])
        durationMs = fm.durationMs || null
        outputTokens = fm.outputTokens || null
      }
    } catch {}

    return {
      id: p.id,
      slug,
      title: p.title,
      agent: p.meta.agent || 'claude',
      schedule: p.meta.schedule || 'every-half-hour',
      tags: p.meta.tags || [],
      lastRanAt: p.meta.lastRanAt || null,
      running: p.meta.running || false,
      durationMs,
      outputTokens,
      bodyExcerpt: (p.document?.content || '').slice(0, 200),
      hasConditions: !!(p.sections?.conditions?.length),
    }
  }))

  return { plays: results }
}
