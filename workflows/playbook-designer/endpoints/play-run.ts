export const path = '/api/plays/:slug/run'
export const description = 'Manually trigger a play execution'
export const tags = ['playbook-designer']

/**
 * POST /api/plays/:slug/run
 * Spawns the play execution using `luca prompt <agent> <taskId>`.
 * Returns immediately with a job reference.
 */
export async function post(_params: any, ctx: any) {
  const { docs, container } = ctx.request.app.locals
  const fs = container.feature('fs')
  const yaml = container.feature('yaml')
  const proc = container.feature('proc')
  const slug = ctx.request.params.slug

  await docs.load()

  const plays = await docs.query(docs.models.Play).fetchAll()
  const play = plays.find((p: any) => p.id === `plays/${slug}`)

  if (!play) {
    ctx.status = 404
    return { error: 'Play not found', slug }
  }

  // Check if already running
  if (play.meta.running) {
    ctx.status = 409
    return { error: 'Play is already running', slug }
  }

  const agent = play.meta.agent || 'claude'
  const taskId = `plays/${slug}`

  // Build output file path
  const outDir = container.paths.resolve('logs/prompt-outputs')
  fs.ensureFolder(outDir)
  const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13)
  const outFile = `${outDir}/${taskId.replace(/\//g, '--')}-${ts}.md`

  // Mark as running in the play file
  const filePath = container.paths.resolve('docs', 'plays', `${slug}.md`)
  try {
    const raw = await fs.readFile(filePath)
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
    if (fmMatch) {
      const fm = yaml.parse(fmMatch[1]) || {}
      fm.running = true
      const body = raw.replace(/^---\n[\s\S]*?\n---\n*/, '')
      const newContent = `---\n${yaml.stringify(fm).trim()}\n---\n\n${body}`
      await fs.writeFile(filePath, newContent)
    }
  } catch {}

  // Spawn the prompt command in background
  const args = [
    'prompt', agent, taskId,
    '--out-file', outFile,
    '--permission-mode', 'bypassPermissions',
    '--exclude-sections', 'Only When,Only If,Run Condition,Conditions',
    '--chrome',
  ]

  // Fire and forget — spawn detached
  try {
    proc.exec(`luca ${args.join(' ')}`, {
      background: true,
      onExit: async () => {
        // Mark as no longer running and update lastRanAt
        try {
          const raw = await fs.readFile(filePath)
          const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
          if (fmMatch) {
            const fm = yaml.parse(fmMatch[1]) || {}
            fm.running = false
            fm.lastRanAt = Date.now()
            const body = raw.replace(/^---\n[\s\S]*?\n---\n*/, '')
            const newContent = `---\n${yaml.stringify(fm).trim()}\n---\n\n${body}`
            await fs.writeFile(filePath, newContent)
          }
        } catch {}
      }
    })
  } catch (err: any) {
    // If proc.exec doesn't support background/onExit, use child_process
    const { spawn } = await import('child_process')
    const child = spawn('luca', args, {
      detached: true,
      stdio: 'ignore',
      cwd: container.paths.resolve('.'),
    })
    child.unref()

    // Set up a watcher to mark completion
    child.on('exit', async () => {
      try {
        const raw = await fs.readFile(filePath)
        const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
        if (fmMatch) {
          const fm = yaml.parse(fmMatch[1]) || {}
          fm.running = false
          fm.lastRanAt = Date.now()
          const body = raw.replace(/^---\n[\s\S]*?\n---\n*/, '')
          const newContent = `---\n${yaml.stringify(fm).trim()}\n---\n\n${body}`
          await fs.writeFile(filePath, newContent)
        }
      } catch {}
    })
  }

  return {
    ok: true,
    slug,
    agent,
    outFile: `logs/prompt-outputs/${taskId.replace(/\//g, '--')}-${ts}.md`,
    message: `Manually triggered play "${play.title}"`,
  }
}
