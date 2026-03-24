export const path = '/api/plays/:slug/history'
export const description = 'Get execution history for a play from logs/prompt-outputs/'
export const tags = ['playbook-designer']

/**
 * GET /api/plays/:slug/history
 * Scans logs/prompt-outputs/ for entries matching the play slug.
 * Returns array of { timestamp, durationMs, outputTokens, status, logPath, filename }
 */
export async function get(_params: any, ctx: any) {
  const { container } = ctx.request.app.locals
  const fs = container.feature('fs')
  const slug = ctx.request.params.slug
  const limit = parseInt(ctx.request.query?.limit) || 20

  const logsDir = container.paths.resolve('logs/prompt-outputs')
  const prefix = `plays--${slug}-`

  let files: string[] = []
  try {
    const all = await fs.readdir(logsDir)
    files = all.filter((f: string) => f.startsWith(prefix) && f.endsWith('.md'))
  } catch {
    return { history: [] }
  }

  // Parse timestamp from filename: plays--slug-YYYYMMDD-HHMM.md
  const entries = files.map((filename: string) => {
    const tsMatch = filename.match(/(\d{8})-(\d{4})\.md$/)
    let timestamp: number | null = null
    if (tsMatch) {
      const [, date, time] = tsMatch
      const y = date.slice(0, 4)
      const mo = date.slice(4, 6)
      const d = date.slice(6, 8)
      const h = time.slice(0, 2)
      const m = time.slice(2, 4)
      timestamp = new Date(`${y}-${mo}-${d}T${h}:${m}:00`).getTime()
    }

    return { filename, timestamp }
  })

  // Sort most recent first
  entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))

  // Take only the requested limit
  const limited = entries.slice(0, limit)

  // Read first few lines of each to extract any metadata
  const history = await Promise.all(limited.map(async (entry) => {
    const filePath = `${logsDir}/${entry.filename}`
    let lineCount = 0
    let sizeBytes = 0

    try {
      const content = await fs.readFile(filePath)
      lineCount = content.split('\n').length
      sizeBytes = new TextEncoder().encode(content).length
    } catch {}

    return {
      filename: entry.filename,
      timestamp: entry.timestamp,
      lineCount,
      sizeBytes,
      logPath: `logs/prompt-outputs/${entry.filename}`,
    }
  }))

  return { history, slug, total: files.length }
}
