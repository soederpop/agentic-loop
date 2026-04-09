/**
 * Playbook Designer — WorkflowService hooks
 *
 * Registers play CRUD, scheduling, execution, history, and condition eval endpoints.
 */
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

const scheduleMap: Record<string, number> = {
  'every-five-minutes': 5 * 60 * 1000,
  'every-ten-minutes': 10 * 60 * 1000,
  'every-half-hour': 30 * 60 * 1000,
  'hourly': 60 * 60 * 1000,
  'daily': 24 * 60 * 60 * 1000,
  'beginning-of-day': 24 * 60 * 60 * 1000,
  'end-of-day': 24 * 60 * 60 * 1000,
  'weekly': 7 * 24 * 60 * 60 * 1000,
}

function formatScheduleLabel(name: string): string {
  const labels: Record<string, string> = {
    'every-five-minutes': 'Every 5 Minutes',
    'every-ten-minutes': 'Every 10 Minutes',
    'every-half-hour': 'Every 30 Minutes',
    'hourly': 'Hourly',
    'daily': 'Daily',
    'beginning-of-day': 'Beginning of Day',
    'end-of-day': 'End of Day',
    'weekly': 'Weekly',
  }
  return labels[name] || name
}

export async function onSetup({ app, docs, container, broadcast }: WorkflowHooksSetupContext) {
  const fs = container.feature('fs')
  const readFileStr = async (p: string): Promise<string> => ((await fs.readFile(p)) as any).toString('utf-8')
  const yaml = container.feature('yaml')
  const proc = container.feature('proc')
  const assistantsManager = container.feature('assistantsManager') as any

  // ── Schedules ──────────────────────────────────────────────────────────────

  app.get('/api/schedules', (_req: any, res: any) => {
    res.json({
      schedules: Object.entries(scheduleMap).map(([name, ms]) => ({
        name,
        intervalMs: ms,
        label: formatScheduleLabel(name),
      })),
    })
  })

  app.get('/api/assistants', async (_req: any, res: any) => {
    try {
      await assistantsManager.discover()
      const assistants = (assistantsManager.list?.() || [])
        .map((entry: any) => ({
          id: entry.name,
          name: entry.name,
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name))
      res.json({ assistants })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Plays list ─────────────────────────────────────────────────────────────

  app.get('/api/plays', async (_req: any, res: any) => {
    try {
      await docs.load()
      const plays = await docs.query(docs.models.Play).fetchAll()
      const results = await Promise.all(
        plays.map(async (p: any) => {
          const slug = p.id.replace(/^plays\//, '')
          const filePath = container.paths.resolve('docs', 'plays', `${slug}.md`)
          let durationMs = null
          let outputTokens = null
          try {
            const raw = await readFileStr(filePath)
            const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
            if (fmMatch) {
              const fm = yaml.parse(fmMatch[1] as string)
              durationMs = fm.durationMs || null
              outputTokens = fm.outputTokens || null
            }
          } catch {}
          return {
            id: p.id, slug, title: p.title,
            agent: p.meta.agent || 'claude',
            schedule: p.meta.schedule || 'every-half-hour',
            tags: p.meta.tags || [],
            lastRanAt: p.meta.lastRanAt || null,
            running: p.meta.running || false,
            durationMs, outputTokens,
            bodyExcerpt: (p.document?.content || '').slice(0, 200),
            hasConditions: !!(p.sections?.conditions?.length),
          }
        }),
      )
      res.json({ plays: results })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/plays', async (req: any, res: any) => {
    try {
      const { title, body, schedule, agent, tags } = req.body || {}
      if (!title?.trim()) return res.status(400).json({ error: 'Title is required' })
      const sched = schedule || 'every-half-hour'
      if (!scheduleMap[sched]) {
        return res.status(400).json({ error: `Invalid schedule: ${sched}`, validSchedules: Object.keys(scheduleMap) })
      }
      const slug = container.utils.stringUtils.kebabCase(title.trim())
      if (!slug) return res.status(400).json({ error: 'Could not generate slug from title' })
      const filePath = container.paths.resolve('docs', 'plays', `${slug}.md`)
      if (await fs.exists(filePath)) {
        return res.status(409).json({ error: `A play with slug "${slug}" already exists`, slug })
      }
      const meta: Record<string, any> = { agent: agent || 'claude', schedule: sched }
      if (tags?.length) meta.tags = tags
      const frontmatter = yaml.stringify(meta).trim()
      await fs.writeFile(filePath, `---\n${frontmatter}\n---\n\n# ${title.trim()}\n\n${body || ''}`)
      await docs.reload()
      res.json({ ok: true, slug, id: `plays/${slug}`, title: title.trim() })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Single play ────────────────────────────────────────────────────────────

  app.get('/api/plays/:slug', async (req: any, res: any) => {
    try {
      await docs.load()
      const { slug } = req.params
      const plays = await docs.query(docs.models.Play).fetchAll()
      const play = plays.find((p: any) => p.id === `plays/${slug}`)
      if (!play) return res.status(404).json({ error: 'Play not found', slug })
      const filePath = container.paths.resolve('docs', 'plays', `${slug}.md`)
      let rawContent = ''
      let durationMs = null, outputTokens = null
      try {
        rawContent = await readFileStr(filePath)
        const fmMatch = rawContent.match(/^---\n([\s\S]*?)\n---/)
        if (fmMatch) {
          const fm = yaml.parse(fmMatch[1] as string)
          durationMs = fm.durationMs || null
          outputTokens = fm.outputTokens || null
        }
      } catch {
        return res.status(500).json({ error: 'Failed to read play file' })
      }
      const body = rawContent.replace(/^---\n[\s\S]*?\n---\n*/, '')
      res.json({
        id: play.id, slug, title: play.title,
        agent: play.meta.agent || 'claude',
        schedule: play.meta.schedule || 'every-half-hour',
        tags: play.meta.tags || [],
        lastRanAt: play.meta.lastRanAt || null,
        running: play.meta.running || false,
        durationMs, outputTokens, rawContent, body,
        hasConditions: !!(play.sections?.conditions?.length),
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.put('/api/plays/:slug', async (req: any, res: any) => {
    try {
      await docs.load()
      const { slug } = req.params
      const { body, schedule, agent, tags } = req.body || {}
      const plays = await docs.query(docs.models.Play).fetchAll()
      const play = plays.find((p: any) => p.id === `plays/${slug}`)
      if (!play) return res.status(404).json({ error: 'Play not found', slug })
      if (schedule && !scheduleMap[schedule]) {
        return res.status(400).json({ error: `Invalid schedule: ${schedule}`, validSchedules: Object.keys(scheduleMap) })
      }
      const filePath = container.paths.resolve('docs', 'plays', `${slug}.md`)
      let existingMeta: Record<string, any> = {}
      try {
        const raw = await readFileStr(filePath)
        const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
        if (fmMatch) existingMeta = yaml.parse(fmMatch[1] as string) || {}
      } catch {}
      const newMeta: Record<string, any> = {
        agent: agent ?? existingMeta.agent ?? 'claude',
        schedule: schedule ?? existingMeta.schedule ?? 'every-half-hour',
      }
      if (tags !== undefined) {
        if (tags.length > 0) newMeta.tags = tags
      } else if (existingMeta.tags?.length) {
        newMeta.tags = existingMeta.tags
      }
      if (existingMeta.lastRanAt) newMeta.lastRanAt = existingMeta.lastRanAt
      if (existingMeta.durationMs) newMeta.durationMs = existingMeta.durationMs
      if (existingMeta.outputTokens) newMeta.outputTokens = existingMeta.outputTokens
      if (existingMeta.running) newMeta.running = existingMeta.running
      const frontmatter = yaml.stringify(newMeta).trim()
      await fs.writeFile(filePath, `---\n${frontmatter}\n---\n\n${body ?? ''}`)
      await docs.reload()
      res.json({ ok: true, slug })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Play run ───────────────────────────────────────────────────────────────

  app.post('/api/plays/:slug/run', async (req: any, res: any) => {
    try {
      await docs.load()
      const { slug } = req.params
      const plays = await docs.query(docs.models.Play).fetchAll()
      const play = plays.find((p: any) => p.id === `plays/${slug}`)
      if (!play) return res.status(404).json({ error: 'Play not found', slug })
      if (play.meta.running) return res.status(409).json({ error: 'Play is already running', slug })

      const agent = play.meta.agent || 'claude'
      const taskId = `plays/${slug}`
      const outDir = container.paths.resolve('logs/prompt-outputs')
      fs.ensureFolder(outDir)
      const ts = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13)
      const outFile = `${outDir}/${taskId.replace(/\//g, '--')}-${ts}.md`
      const filePath = container.paths.resolve('docs', 'plays', `${slug}.md`)

      // Mark as running
      try {
        const raw = await readFileStr(filePath)
        const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
        if (fmMatch) {
          const fm = yaml.parse(fmMatch[1] as string) || {}
          fm.running = true
          const body = raw.replace(/^---\n[\s\S]*?\n---\n*/, '')
          await fs.writeFile(filePath, `---\n${yaml.stringify(fm).trim()}\n---\n\n${body}`)
        }
      } catch {}

      const args = [
        'prompt', agent, taskId,
        '--out-file', outFile,
        '--permission-mode', 'bypassPermissions',
        '--exclude-sections', 'Only When,Only If,Run Condition,Conditions',
        '--chrome',
      ]

      const markComplete = async () => {
        try {
          const raw = await readFileStr(filePath)
          const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/)
          if (fmMatch) {
            const fm = yaml.parse(fmMatch[1] as string) || {}
            fm.running = false
            fm.lastRanAt = Date.now()
            const body = raw.replace(/^---\n[\s\S]*?\n---\n*/, '')
            await fs.writeFile(filePath, `---\n${yaml.stringify(fm).trim()}\n---\n\n${body}`)
            broadcast('play:completed', { slug, lastRanAt: fm.lastRanAt })
          }
        } catch {}
      }

      try {
        proc.exec(`luca ${args.join(' ')}`, { background: true, onExit: markComplete })
      } catch {
        const { spawn } = await import('child_process')
        const child = spawn('luca', args, {
          detached: true,
          stdio: 'ignore',
          cwd: container.paths.resolve('.'),
        })
        child.unref()
        child.on('exit', markComplete)
      }

      broadcast('play:started', { slug, title: play.title })

      res.json({
        ok: true, slug, agent, outFile: `logs/prompt-outputs/${taskId.replace(/\//g, '--')}-${ts}.md`,
        message: `Manually triggered play "${play.title}"`,
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Play history ───────────────────────────────────────────────────────────

  app.get('/api/plays/:slug/history', async (req: any, res: any) => {
    try {
      const { slug } = req.params
      const limit = parseInt(req.query?.limit) || 20
      const logsDir = container.paths.resolve('logs/prompt-outputs')
      const prefix = `plays--${slug}-`
      let files: string[] = []
      try {
        const all = await fs.readdir(logsDir)
        files = all.filter((f: string) => f.startsWith(prefix) && f.endsWith('.md'))
      } catch {
        return res.json({ history: [] })
      }
      const entries = files.map((filename: string) => {
        const tsMatch = filename.match(/(\d{8})-(\d{4})\.md$/)
        let timestamp: number | null = null
        if (tsMatch) {
          const [, date, time] = tsMatch as [string, string, string]
          timestamp = new Date(
            `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:00`,
          ).getTime()
        }
        return { filename, timestamp }
      })
      entries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      const history = await Promise.all(
        entries.slice(0, limit).map(async (entry) => {
          let lineCount = 0, sizeBytes = 0
          try {
            const content = await readFileStr(`${logsDir}/${entry.filename}`)
            lineCount = content.split('\n').length
            sizeBytes = new TextEncoder().encode(content).length
          } catch {}
          return {
            filename: entry.filename,
            timestamp: entry.timestamp,
            lineCount, sizeBytes,
            logPath: `logs/prompt-outputs/${entry.filename}`,
          }
        }),
      )
      res.json({ history, slug, total: files.length })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.get('/api/plays/:slug/logs/:filename', async (req: any, res: any) => {
    try {
      const { slug, filename } = req.params
      const expectedPrefix = `plays--${slug}-`
      if (!filename.startsWith(expectedPrefix) || !filename.endsWith('.md')) {
        return res.status(400).json({ error: 'Invalid log filename for this play' })
      }
      if (filename.includes('/') || filename.includes('..')) {
        return res.status(400).json({ error: 'Invalid filename' })
      }
      const logsDir = container.paths.resolve('logs/prompt-outputs')
      try {
        const content = await readFileStr(`${logsDir}/${filename}`)
        res.json({ content, filename, slug })
      } catch {
        res.status(404).json({ error: 'Log file not found', filename })
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Condition eval ─────────────────────────────────────────────────────────

  app.post('/api/plays/:slug/eval-condition', async (req: any, res: any) => {
    try {
      const { code } = req.body || {}
      if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ error: 'Missing or empty code field' })
      }
      const vm = container.feature('vm')
      const ui = container.feature('ui')
      const logs: string[] = []
      const captureConsole = {
        log: (...args: any[]) => logs.push(args.map(String).join(' ')),
        warn: (...args: any[]) => logs.push('[warn] ' + args.map(String).join(' ')),
        error: (...args: any[]) => logs.push('[error] ' + args.map(String).join(' ')),
        info: (...args: any[]) => logs.push(args.map(String).join(' ')),
      }
      const startTime = Date.now()
      let timer: any
      try {
        const hasAwait = /\bawait\b/.test(code)
        const wrapped = hasAwait ? `(async function() { ${code} })()` : code
        const result = await Promise.race([
          vm.run(wrapped, { container, ui, console: captureConsole, Date, Promise, setTimeout, clearTimeout }),
          new Promise((_, reject) => {
            timer = setTimeout(() => reject(new Error('Condition timed out after 5 seconds')), 5000)
          }),
        ])
        clearTimeout(timer)
        res.json({ passed: result !== false, returnValue: result !== undefined ? String(result) : undefined, logs, durationMs: Date.now() - startTime })
      } catch (err: any) {
        clearTimeout(timer)
        res.json({ passed: false, error: err.message || String(err), logs, durationMs: Date.now() - startTime })
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })
}
