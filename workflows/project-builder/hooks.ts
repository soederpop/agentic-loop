/**
 * Project Builder — WorkflowService hooks
 *
 * Registers the project-builder-specific API routes and wires up
 * ChatService WebSocket message handlers for build control and project chat.
 */
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

let _builders: Map<string, any> | null = null
let _watcherClient: any = null

export async function onSetup({ app, chatService, docs, container, broadcast, wss }: WorkflowHooksSetupContext) {
  const assistantsManager = container.feature('assistantsManager') as any

  // ── Builder instances keyed by project slug ──────────────────────────────

  const builders = new Map<string, any>()
  _builders = builders

  function getBuilder(projectSlug: string) {
    if (builders.has(projectSlug)) return builders.get(projectSlug)
    const builder = container.feature('projectBuilder' as any, {
      projectSlug,
      docsPath: './docs',
    })
    builders.set(projectSlug, builder)
    return builder
  }

  function wireBuilderEvents(builder: any, projectSlug: string) {
    if (builder._eventsWired) return
    builder._eventsWired = true
    const events = [
      'build:start', 'build:complete', 'build:error',
      'build:aborting', 'build:aborted', 'build:loaded',
      'plan:start', 'plan:delta', 'plan:complete',
      'plan:error', 'plan:skipped', 'plan:queued',
    ]
    for (const event of events) {
      builder.on(event, (data: any) => broadcast(event, { ...data, projectSlug }))
    }
  }

  // ── Watcher client: tap into ongoing builds from luca main ─────────────
  // Creates a single IPC client that connects to the main process's builder
  // server (if running) and bridges watcher events to the browser via broadcast.

  try {
    const watcherClient = container.feature('projectBuilder' as any, { docsPath: './docs' })
    if (watcherClient._ready) await watcherClient._ready

    if (watcherClient.state.get('mode') === 'client') {
      _watcherClient = watcherClient
      const watcherEvents = [
        'build:start', 'build:complete', 'build:error',
        'build:aborting', 'build:aborted', 'build:loaded',
        'plan:start', 'plan:delta', 'plan:complete',
        'plan:error', 'plan:skipped', 'plan:queued',
      ]
      for (const event of watcherEvents) {
        watcherClient.on(`watcher:${event}`, (data: any) => {
          broadcast(event, { ...data, projectSlug: data.slug })
        })
      }
    }
  } catch {
    // IPC server not running — no ongoing builds to tap into, that's fine
  }

  // Expose to shared serializers used by GET /api/projects, GET /api/project/:slug
  app.locals.getBuilder = getBuilder
  app.locals.wireBuilderEvents = wireBuilderEvents

  // ── Watcher status API (must be before :slug param route) ───────────────

  app.get('/api/build/watcher/status', async (_req: any, res: any) => {
    try {
      if (!_watcherClient || _watcherClient.state.get('mode') !== 'client') {
        return res.json({ connected: false })
      }
      const state = await _watcherClient.sendRequest('getState').catch(() => null)
      if (!state) return res.json({ connected: true, state: null })
      res.json({
        connected: true,
        buildStatus: state.buildStatus,
        projectSlug: state.projectSlug,
        currentPlanId: state.currentPlanId,
        watching: state.watching,
        loaded: state.loaded,
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Assistants API ───────────────────────────────────────────────────────

  app.get('/api/assistants', async (_req: any, res: any) => {
    try {
      await assistantsManager.discover()
      const discovered = (assistantsManager.list?.() || []).map((entry: any) => ({
        id: entry.name,
        name: entry.name,
      }))

      const builtins = [
        { id: 'claude', name: 'claude' },
        { id: 'codex', name: 'codex' },
      ]

      const assistants = [...builtins, ...discovered]
        .filter((item, index, arr) => arr.findIndex((x) => x.id === item.id) === index)
        .sort((a, b) => {
          const order = { claude: 0, codex: 1 } as Record<string, number>
          const ao = order[a.id] ?? 999
          const bo = order[b.id] ?? 999
          return ao === bo ? a.name.localeCompare(b.name) : ao - bo
        })

      res.json({ assistants, default: assistants[0]?.id || 'claude' })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Build status API ────────────────────────────────────────────────────

  app.get('/api/build/:slug', async (req: any, res: any) => {
    try {
      const { slug } = req.params
      const builder = getBuilder(slug)
      wireBuilderEvents(builder, slug)
      if (!builder.state.loaded) {
        try { await builder.load() } catch (err: any) {
          return res.json({ status: 'error', error: err.message })
        }
      }
      res.json({
        status: builder.buildStatus,
        currentPlanId: builder.state.currentPlanId,
        plans: builder.plans.map((p: any) => ({
          id: p.id,
          title: p.title,
          status: p.status,
        })),
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── ChatService custom message handlers ─────────────────────────────────

  if (chatService) {
    chatService.onMessage(async (parsed: any, ctx: any) => {
      // start_build_chat: brief the assistant on the project context
      if (parsed.type === 'start_build_chat') {
        if (!ctx.session) {
          ctx.send({ type: 'error', message: 'Send init first' })
          return true
        }
        if (ctx.isProcessing) {
          ctx.send({ type: 'error', message: 'Already processing a message' })
          return true
        }
        const { projectSlug } = parsed
        if (!projectSlug) {
          ctx.send({ type: 'error', message: 'Missing projectSlug' })
          return true
        }
        const projects = await docs.query(docs.models.Project).fetchAll()
        const project = projects.find(
          (p: any) => p.id === `projects/${projectSlug}` || p.id === projectSlug,
        )
        if (!project) {
          ctx.send({ type: 'error', message: `Project not found: ${projectSlug}` })
          return true
        }
        const plans = await project.relationships.plans.fetchAll()
        const planSummaries = plans
          .map((p: any, i: number) => {
            const statusLabel = p.meta.status || 'unknown'
            return `### Plan ${i + 1}: ${p.title} [${statusLabel}]\n${p.document?.content || ''}`
          })
          .join('\n\n---\n\n')
        const briefing = [
          `You are assisting with the project "${project.title}".`,
          `The user is using the Project Builder to execute this project's plans.`,
          `Project status: ${project.meta.status}`,
          project.meta.goal ? `Goal: ${project.meta.goal}` : '',
          '',
          '## Project Document',
          project.document?.content || '',
          '',
          '## Plans',
          planSummaries,
          '',
          'Introduce yourself briefly, summarize the project state, and let the user know you are ready to help.',
          'Be concise, direct, and helpful.',
        ]
          .filter(Boolean)
          .join('\n')
        ctx.send({ type: 'build_chat_started', projectSlug })
        ctx.setProcessing(true)
        try {
          await ctx.streamToSocket(ctx.session, briefing)
        } finally {
          ctx.setProcessing(false)
        }
        return true
      }

      // build_action: start or abort a build
      if (parsed.type === 'build_action') {
        const { projectSlug, action } = parsed
        if (!projectSlug || !action) {
          ctx.send({ type: 'error', message: 'Missing projectSlug or action' })
          return true
        }
        const builder = getBuilder(projectSlug)
        wireBuilderEvents(builder, projectSlug)
        if (!builder.state.loaded) {
          try { await builder.load() } catch (err: any) {
            ctx.send({ type: 'build_event', event: 'build:error', error: err.message, projectSlug })
            return true
          }
        }
        if (action === 'start') {
          if (builder.buildStatus === 'running') {
            ctx.send({ type: 'error', message: 'Build already running' })
            return true
          }
          builder.run().catch((err: any) => {
            broadcast('build:error', { error: err?.message || String(err), projectSlug })
          })
          ctx.send({ type: 'build_action_ok', action: 'start', projectSlug })
        } else if (action === 'abort') {
          if (builder.buildStatus !== 'running') {
            ctx.send({ type: 'error', message: 'No build running' })
            return true
          }
          await builder.abort()
          ctx.send({ type: 'build_action_ok', action: 'abort', projectSlug })
        } else {
          ctx.send({ type: 'error', message: `Unknown action: ${action}` })
        }
        return true
      }

      return false
    })
  }
}

export async function onTeardown() {
  if (_builders) {
    for (const [, builder] of _builders) {
      try {
        if (builder.buildStatus === 'running') await builder.abort()
      } catch {}
    }
    _builders = null
  }
  _watcherClient = null
}
