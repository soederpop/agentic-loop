/**
 * Project Builder Workflow — setup hook for luca serve
 *
 * Serves project data, build controls, and real-time build events via WebSocket.
 * Chat is powered by the ChatService feature with assistant selection.
 * Build events are broadcast to all connected WebSocket clients.
 *
 * Usage:
 *   luca workflow project-builder
 */
import type { ChatService } from '../../features/chat-service'
import type { WebSocketServer, WebSocket } from 'ws'

let wss: WebSocketServer | null = null

export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  const docs = container.feature('contentDb', {
    rootPath: container.paths.resolve('docs'),
  })
  await docs.load()

  // ── Discover assistants ──
  await container.helpers.discover('features')
  const assistantsManager = container.feature('assistantsManager')
  await assistantsManager.discover()

  // ── Builder instances keyed by project slug ──
  const builders = new Map<string, any>()

  function getBuilder(projectSlug: string) {
    if (builders.has(projectSlug)) return builders.get(projectSlug)
    const builder = container.feature('projectBuilder', {
      projectSlug,
      docsPath: './docs',
    })
    builders.set(projectSlug, builder)
    return builder
  }

  // ── Broadcast build events to all WS clients ──
  function broadcast(event: string, data: any) {
    if (!wss) return
    const payload = JSON.stringify({ type: 'build_event', event, ...data })
    for (const client of wss.clients) {
      if (client.readyState === 1 /* WebSocket.OPEN */) {
        try { client.send(payload) } catch {}
      }
    }
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
      builder.on(event, (data: any) => {
        broadcast(event, { ...data, projectSlug })
      })
    }
  }

  // ── Serializers ──
  function serializePlan(p: any) {
    return {
      id: p.id,
      slug: p.id.split('/').pop(),
      title: p.title,
      status: p.meta.status,
      project: p.meta.project,
      costUsd: p.meta.costUsd,
      turns: p.meta.turns,
      toolCalls: p.meta.toolCalls,
      completedAt: p.meta.completedAt,
      content: p.document?.content || '',
    }
  }

  function extractMarkdownSection(content: string, heading: string): string {
    const pattern = new RegExp(`^## ${heading}\\s*\\n`, 'mi')
    const match = content.match(pattern)
    if (!match || match.index === undefined) return ''
    const start = match.index + match[0].length
    const rest = content.slice(start)
    const nextHeading = rest.match(/^## /m)
    const section = nextHeading && nextHeading.index !== undefined
      ? rest.slice(0, nextHeading.index)
      : rest
    return section.trim()
  }

  function serializeProject(project: any, plans: any[]) {
    const rawContent = project.document?.content || ''
    return {
      id: project.id,
      slug: project.id.replace(/^projects\//, ''),
      title: project.title,
      status: project.meta.status,
      goal: project.meta.goal,
      content: rawContent,
      sections: {
        overview: extractMarkdownSection(rawContent, 'Overview'),
        execution: project.sections?.execution || '',
      },
      plans: plans.map(serializePlan),
    }
  }

  // ── Share state with endpoints ──
  app.locals.docs = docs
  app.locals.serializePlan = serializePlan
  app.locals.serializeProject = serializeProject
  app.locals.getBuilder = getBuilder
  app.locals.wireBuilderEvents = wireBuilderEvents

  // ── ChatService ──
  const chatService = container.feature('chatService', {
    defaultAssistant: 'chiefOfStaff',
    threadPrefix: 'project-builder',
    historyMode: 'session',
  }) as unknown as ChatService

  // Handle custom message types
  chatService.onMessage(async (parsed, ctx) => {
    // ── start_build_chat: brief the assistant on the project ──
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
        (p: any) => p.id === `projects/${projectSlug}` || p.id === projectSlug
      )

      if (!project) {
        ctx.send({ type: 'error', message: `Project not found: ${projectSlug}` })
        return true
      }

      const plans = await project.relationships.plans.fetchAll()

      const planSummaries = plans.map((p: any, i: number) => {
        const statusLabel = p.meta.status || 'unknown'
        return `### Plan ${i + 1}: ${p.title} [${statusLabel}]\n${p.document?.content || ''}`
      }).join('\n\n---\n\n')

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
        'Be concise, direct, and helpful. The user may ask questions, request changes to plans, or want guidance on the build.',
      ].filter(Boolean).join('\n')

      ctx.send({ type: 'build_chat_started', projectSlug })

      ctx.setProcessing(true)
      try {
        await ctx.streamToSocket(ctx.session, briefing)
      } finally {
        ctx.setProcessing(false)
      }
      return true
    }

    // ── build_action: start or abort a build ──
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
        builder.run().catch(() => {})
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

  // Expose assistants list
  app.get('/api/assistants', (_req: any, res: any) => {
    const assistants = chatService.listAssistants()
    res.json({ assistants, default: 'chiefOfStaff' })
  })

  // ── Hook into server.start() to attach WebSocket ──
  const originalStart = server.start.bind(server)
  server.start = async (...args: any[]) => {
    const result = await originalStart(...args)

    const httpServer = (server as any)._listener
    if (httpServer) {
      wss = chatService.attach(httpServer)
      console.log('[project-builder] ChatService attached to HTTP server')
    } else {
      console.error('[project-builder] _listener unavailable — WebSocket will not work')
    }

    return result
  }

  console.log('[project-builder] workflow API + chat ready')
}
