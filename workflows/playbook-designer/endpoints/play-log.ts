export const path = '/api/plays/:slug/logs/:filename'
export const description = 'Get the full content of a specific execution log'
export const tags = ['playbook-designer']

/**
 * GET /api/plays/:slug/logs/:filename
 * Returns the full text content of a specific execution log file.
 */
export async function get(_params: any, ctx: any) {
  const { container } = ctx.request.app.locals
  const fs = container.feature('fs')
  const { slug, filename } = ctx.request.params

  // Validate filename matches the expected pattern for this slug
  const expectedPrefix = `plays--${slug}-`
  if (!filename.startsWith(expectedPrefix) || !filename.endsWith('.md')) {
    ctx.status = 400
    return { error: 'Invalid log filename for this play' }
  }

  // Prevent path traversal
  if (filename.includes('/') || filename.includes('..')) {
    ctx.status = 400
    return { error: 'Invalid filename' }
  }

  const logsDir = container.paths.resolve('logs/prompt-outputs')
  const filePath = `${logsDir}/${filename}`

  try {
    const content = await fs.readFile(filePath)
    return { content, filename, slug }
  } catch {
    ctx.status = 404
    return { error: 'Log file not found', filename }
  }
}
