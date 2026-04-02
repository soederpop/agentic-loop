/**
 * Prompt Studio — WorkflowService hooks
 *
 * Registers prompt CRUD, execution (via luca prompt subprocess), and eval endpoints.
 * Eval is at /api/workflows/prompt-studio/eval to avoid conflict with assistant-designer.
 */
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

export async function onSetup({ app, docs, container }: WorkflowHooksSetupContext) {
  const vm = container.feature('vm')
  const proc = container.feature('proc')
  const fs = container.feature('fs')

  // Shared VM context for eval
  const replContext = vm.createContext({
    container,
    console,
    Date,
    Promise,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    JSON,
    Math,
    Array,
    Object,
    String,
    Number,
    Boolean,
    RegExp,
    Map,
    Set,
    Error,
    Buffer,
    process,
    fetch: globalThis.fetch,
  })

  // ── Prompts list ───────────────────────────────────────────────────────────

  app.get('/api/prompts', async (_req: any, res: any) => {
    try {
      const prompts = await docs.query(docs.models.Prompt).fetchAll()
      res.json({
        prompts: prompts.map((p: any) => ({
          id: p.id,
          slug: p.id.replace(/^prompts\//, ''),
          title: p.title,
          tags: p.meta.tags || [],
          inputs: p.meta.inputs || {},
          repeatable: p.meta.repeatable,
          lastRanAt: p.meta.lastRanAt,
        })),
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/prompts/create', async (req: any, res: any) => {
    try {
      const { title, slug, content: userContent } = req.body || {}
      if (!title || !slug) return res.status(400).json({ error: 'Missing title or slug' })
      const sanitized = slug.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      const filePath = container.paths.resolve('docs', 'prompts', `${sanitized}.md`)
      if (await fs.exists(filePath)) return res.status(409).json({ error: `Prompt already exists: ${sanitized}` })
      const content = userContent || `---\ntags: []\ninputs: {}\n---\n\n# ${title}\n\nWrite your prompt instructions here.\n`
      await fs.writeFile(filePath, content)
      await docs.reload()
      res.json({ ok: true, slug: sanitized })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Single prompt ──────────────────────────────────────────────────────────

  app.get('/api/prompt/:slug', async (req: any, res: any) => {
    try {
      const { slug } = req.params
      const prompts = await docs.query(docs.models.Prompt).fetchAll()
      const prompt = prompts.find((p: any) => p.id === `prompts/${slug}` || p.id === slug)
      if (!prompt) return res.status(404).json({ error: `Prompt not found: ${slug}` })
      const filePath = container.paths.resolve('docs', 'prompts', `${slug}.md`)
      const rawContent = await fs.readFile(filePath)
      res.json({
        id: prompt.id, slug, title: prompt.title,
        tags: prompt.meta.tags || [],
        inputs: prompt.meta.inputs || {},
        repeatable: prompt.meta.repeatable,
        lastRanAt: prompt.meta.lastRanAt,
        rawContent,
        content: prompt.document?.content || '',
        meta: prompt.meta,
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  app.post('/api/prompt/:slug', async (req: any, res: any) => {
    try {
      const { slug } = req.params
      const { content } = req.body || {}
      if (!content) return res.status(400).json({ error: 'Missing content' })
      const filePath = container.paths.resolve('docs', 'prompts', `${slug}.md`)
      await fs.writeFile(filePath, content)
      await docs.reload()
      res.json({ ok: true, slug })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Run prompt (SSE) ───────────────────────────────────────────────────────

  app.post('/api/run-prompt/:slug', async (req: any, res: any) => {
    const { slug } = req.params
    const { agent = 'claude', inputs = {}, options = {} } = req.body || {}

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    const send = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    send('status', { message: `Starting prompt: ${slug}`, agent })

    const promptId = `prompts/${slug}`
    let inputsFile: string | null = null

    try {
      const args = ['prompt', agent, promptId, '--permission-mode', 'bypassPermissions']
      const hasInputs = Object.keys(inputs).length > 0
      if (hasInputs) {
        inputsFile = container.paths.resolve(`/tmp/prompt-studio-inputs-${Date.now()}.json`)
        await fs.writeFile(inputsFile, JSON.stringify(inputs, null, 2))
        args.push('--inputs-file', inputsFile)
      }
      if (options.model) args.push('--model', options.model)
      if (options.permissionMode) {
        const idx = args.indexOf('--permission-mode')
        if (idx !== -1) args.splice(idx, 2, '--permission-mode', options.permissionMode)
      }
      if (options.inFolder) args.push('--in-folder', options.inFolder)
      if (options.outFile) args.push('--out-file', options.outFile)
      if (options.excludeSections) args.push('--exclude-sections', options.excludeSections)
      if (options.skipEval) args.push('--skip-eval')
      if (options.includeOutput) args.push('--include-output')
      if (options.chrome) args.push('--chrome')
      if (options.dryRun) args.push('--dry-run')
      if (options.local) args.push('--local')

      send('status', { message: `Running: luca ${args.join(' ')}` })

      const result = await proc.spawnAndCapture('luca', args, {
        cwd: container.paths.resolve('.'),
        onOutput: (data: string) => send('chunk', { text: data }),
        onError: (data: string) => send('stderr', { text: data }),
      })

      if (result.exitCode === 0) {
        send('complete', { message: 'Prompt completed successfully' })
      } else {
        send('error', { message: `Process exited with code ${result.exitCode}` })
      }
    } catch (err: any) {
      send('error', { message: err.message || String(err) })
    }

    if (inputsFile) {
      try { (fs as any).unlink?.(inputsFile) } catch {}
    }

    res.end()
  })

  // ── Eval (namespaced to avoid conflict with assistant-designer) ────────────

  app.post('/api/workflows/prompt-studio/eval', async (req: any, res: any) => {
    try {
      const { code } = req.body || {}
      if (!code) return res.status(400).json({ error: 'Missing code' })
      const logs: string[] = []
      const captureConsole = {
        log: (...args: any[]) => logs.push(args.map(String).join(' ')),
        error: (...args: any[]) => logs.push('[error] ' + args.map(String).join(' ')),
        warn: (...args: any[]) => logs.push('[warn] ' + args.map(String).join(' ')),
        info: (...args: any[]) => logs.push(args.map(String).join(' ')),
      }
      replContext.console = captureConsole
      try {
        const result = await vm.run(code, replContext)
        replContext.console = console
        res.json({ ok: true, output: logs.join('\n'), result: result !== undefined ? String(result) : undefined })
      } catch (err: any) {
        replContext.console = console
        res.json({ ok: false, output: logs.join('\n'), error: err.message || String(err) })
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  console.log('[prompt-studio] hooks loaded — prompts, run-prompt, eval ready')
}
