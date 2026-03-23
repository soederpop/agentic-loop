/**
 * Project Reviewer Workflow — setup hook for luca serve
 *
 * Serves project and plan data so the UI can present them interactively.
 * Chat is powered by the ChatService feature — no hand-rolled WebSocket code.
 *
 * Usage:
 *   luca serve --setup workflows/project-reviewer/luca.serve.ts --staticDir workflows/project-reviewer/public --endpoints-dir workflows/project-reviewer/endpoints --port 9310
 */
import type { ChatService } from '../../features/chat-service'

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
      sections: {
        references: p.sections?.references || '',
        verification: p.sections?.verification || '',
      },
      content: p.document?.content || '',
    }
  }

  function serializeProject(project: any, plans: any[]) {
    return {
      id: project.id,
      slug: project.id.replace(/^projects\//, ''),
      title: project.title,
      status: project.meta.status,
      goal: project.meta.goal,
      content: project.document?.content || '',
      sections: {
        overview: project.sections?.overview || '',
        execution: project.sections?.execution || '',
      },
      plans: plans.map(serializePlan),
    }
  }

  // Share state with endpoint files
  app.locals.docs = docs
  app.locals.serializeProject = serializeProject

  // ── ChatService ──
  const chatService = container.feature('chatService', {
    defaultAssistant: 'chiefOfStaff',
    threadPrefix: 'project-reviewer',
    historyMode: 'session',
  }) as unknown as ChatService

  // Handle the custom 'start_review' message type
  chatService.onMessage(async (parsed, ctx) => {
    if (parsed.type !== 'start_review') return false

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
      const content = p.document?.content || ''
      return `### Plan ${i + 1}: ${p.title} [${statusLabel}]\n${content}`
    }).join('\n\n---\n\n')

    const briefing = [
      `You are reviewing the project "${project.title}" with the user.`,
      `Project status: ${project.meta.status}`,
      project.meta.goal ? `Goal: ${project.meta.goal}` : '',
      '',
      '## Project Document',
      project.document?.content || '',
      '',
      '## Plans',
      planSummaries,
      '',
      'Take a moment to read through this project and its plans.',
      'Then give the user a concise briefing: what this project is about, the state of each plan, any concerns or suggestions, and what you think should happen next.',
      'Be direct and opinionated. This is a review session.',
    ].filter(Boolean).join('\n')

    ctx.send({ type: 'review_started', projectSlug })

    ctx.setProcessing(true)
    try {
      await ctx.streamToSocket(ctx.session, briefing)
    } finally {
      ctx.setProcessing(false)
    }
    return true
  })

  // ── Hook into server.start() to attach WebSocket after HTTP listener exists ──
  const originalStart = server.start.bind(server)
  server.start = async (...args: any[]) => {
    const result = await originalStart(...args)

    const httpServer = (server as any)._listener
    if (httpServer) {
      chatService.attach(httpServer)
      console.log('[project-reviewer] ChatService attached to HTTP server')
    } else {
      console.error('[project-reviewer] _listener unavailable after start() — WebSocket will not work')
    }

    return result
  }

  console.log('[project-reviewer] workflow API + chat ready')
}
