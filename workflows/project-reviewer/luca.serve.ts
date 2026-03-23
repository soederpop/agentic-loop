/**
 * Project Reviewer Workflow — setup hook for luca serve
 *
 * Serves project and plan data so the UI can present them interactively.
 * WebSocket chat is co-located on the main HTTP server (no sidecar port).
 *
 * Usage:
 *   luca serve --setup workflows/project-reviewer/luca.serve.ts --staticDir workflows/project-reviewer/public --endpoints-dir workflows/project-reviewer/endpoints --port 9310
 */
import { WebSocketServer, WebSocket } from 'ws'

export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  const docs = container.feature('contentDb', {
    rootPath: container.paths.resolve('docs'),
  })
  await docs.load()

  // ── Discover assistants (lazy creation per session) ──
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

  // ── WebSocket helpers ──
  function send(ws: WebSocket, data: any) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data))
    } else {
      console.warn(`[project-reviewer] send skipped, ws state=${ws.readyState}`)
    }
  }

  // ── Session state: assistant instance per session ID ──
  interface Session {
    assistant: any
  }

  const sessions = new Map<string, Session>()

  function resolveAssistantName(shortName: string): string | null {
    const entries = assistantsManager.list()
    const match = entries.find(
      (e: any) => e.name === shortName || e.name === `assistants/${shortName}`,
    )
    return match ? match.name : null
  }

  async function getOrCreateSession(sessionId: string): Promise<Session> {
    if (sessions.has(sessionId)) {
      console.log(`[project-reviewer] resumed session ${sessionId}`)
      return sessions.get(sessionId)!
    }

    const fullName = resolveAssistantName('chiefOfStaff')
    if (!fullName) {
      throw new Error('Assistant "chiefOfStaff" not found. Available: ' +
        assistantsManager.list().map((e: any) => e.name).join(', '))
    }

    console.log(`[project-reviewer] creating assistant ${fullName} for session ${sessionId}`)
    const assistant = assistantsManager.create(fullName, {
      historyMode: 'session',
    })
    assistant.resumeThread(`project-reviewer:${sessionId}`)
    await assistant.start()

    const session: Session = { assistant }
    sessions.set(sessionId, session)
    console.log(`[project-reviewer] new session ${sessionId} (${session.assistant.messages?.length || 0} messages)`)
    return session
  }

  /**
   * Stream an assistant ask() over the WebSocket.
   */
  async function streamAsk(ws: WebSocket, session: Session, text: string): Promise<void> {
    const messageId = crypto.randomUUID()
    send(ws, { type: 'assistant_message_start', messageId })
    console.log(`[project-reviewer] stream start messageId=${messageId}`)

    const onChunk = (chunk: string) => {
      send(ws, { type: 'chunk', messageId, textDelta: chunk })
    }

    const pendingCalls = new Map<string, { toolName: string; startedAt: number }>()
    let toolCallCounter = 0

    const onToolCall = (toolName: string, _args: any) => {
      const callId = `${messageId}:tool:${toolCallCounter++}`
      const startedAt = Date.now()
      pendingCalls.set(callId, { toolName, startedAt })
      send(ws, { type: 'tool_start', id: callId, name: toolName, startedAt })
      console.log(`[project-reviewer] tool_start ${toolName} id=${callId}`)
    }

    function resolveCallId(toolName: string): string | null {
      const entries = Array.from(pendingCalls.entries())
      for (let i = 0; i < entries.length; i++) {
        if (entries[i][1].toolName === toolName) return entries[i][0]
      }
      return null
    }

    const onToolResult = (toolName: string, result: string) => {
      const callId = resolveCallId(toolName)
      const entry = callId ? pendingCalls.get(callId) : null
      const startedAt = entry?.startedAt || Date.now()
      const endedAt = Date.now()
      if (callId) pendingCalls.delete(callId)
      send(ws, {
        type: 'tool_end',
        id: callId || `${messageId}:tool:orphan:${toolName}`,
        name: toolName,
        ok: true,
        endedAt,
        durationMs: endedAt - startedAt,
        summary: typeof result === 'string' && result.length > 120 ? result.slice(0, 120) + '...' : result,
      })
      console.log(`[project-reviewer] tool_end ${toolName} id=${callId} ${endedAt - startedAt}ms`)
    }

    const onToolError = (toolName: string, error: any) => {
      const callId = resolveCallId(toolName)
      const entry = callId ? pendingCalls.get(callId) : null
      const startedAt = entry?.startedAt || Date.now()
      const endedAt = Date.now()
      if (callId) pendingCalls.delete(callId)
      send(ws, {
        type: 'tool_end',
        id: callId || `${messageId}:tool:orphan:${toolName}`,
        name: toolName,
        ok: false,
        endedAt,
        durationMs: endedAt - startedAt,
        error: error?.message || String(error),
      })
      console.log(`[project-reviewer] tool_error ${toolName} id=${callId}`)
    }

    session.assistant.on('chunk', onChunk)
    session.assistant.on('toolCall', onToolCall)
    session.assistant.on('toolResult', onToolResult)
    session.assistant.on('toolError', onToolError)

    try {
      const response = await session.assistant.ask(text)
      send(ws, { type: 'assistant_message_complete', messageId, text: response })
      console.log(`[project-reviewer] stream complete messageId=${messageId}`)
    } catch (err: any) {
      console.error('[project-reviewer] ask() error:', err)
      send(ws, { type: 'error', message: err.message || 'Assistant error' })
    } finally {
      session.assistant.off('chunk', onChunk)
      session.assistant.off('toolCall', onToolCall)
      session.assistant.off('toolResult', onToolResult)
      session.assistant.off('toolError', onToolError)
    }
  }

  // ── Create WSS in noServer mode so it works before the HTTP listener exists ──
  const wss = new WebSocketServer({ noServer: true })
  console.log('[project-reviewer] WebSocket server created (noServer mode)')

  wss.on('connection', (ws: WebSocket) => {
    console.log('[project-reviewer] chat client connected')

    let session: Session | null = null
    let isProcessing = false

    ws.on('message', async (raw: Buffer) => {
      let parsed: any
      try {
        parsed = JSON.parse(raw.toString())
      } catch {
        send(ws, { type: 'error', message: 'Invalid JSON' })
        return
      }

      console.log(`[project-reviewer] recv: ${parsed.type}`)

      if (parsed.type === 'init') {
        const sessionId = parsed.sessionId
        if (!sessionId || typeof sessionId !== 'string') {
          send(ws, { type: 'init_error', message: 'Missing sessionId' })
          return
        }

        try {
          session = await getOrCreateSession(sessionId)
          send(ws, {
            type: 'init_ok',
            sessionId,
            historyLength: session.assistant.messages?.length || 0,
          })
          console.log(`[project-reviewer] init_ok session=${sessionId}`)
        } catch (err: any) {
          console.error('[project-reviewer] init error:', err)
          send(ws, { type: 'init_error', message: err.message || 'Failed to create session' })
        }
        return
      }

      if (parsed.type === 'start_review') {
        if (!session) {
          send(ws, { type: 'error', message: 'Send init first' })
          return
        }

        if (isProcessing) {
          send(ws, { type: 'error', message: 'Already processing a message' })
          return
        }

        const { projectSlug } = parsed
        if (!projectSlug) {
          send(ws, { type: 'error', message: 'Missing projectSlug' })
          return
        }

        const projects = await docs.query(docs.models.Project).fetchAll()
        const project = projects.find(
          (p: any) => p.id === `projects/${projectSlug}` || p.id === projectSlug
        )

        if (!project) {
          send(ws, { type: 'error', message: `Project not found: ${projectSlug}` })
          return
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

        send(ws, { type: 'review_started', projectSlug })

        isProcessing = true
        try {
          await streamAsk(ws, session, briefing)
        } finally {
          isProcessing = false
        }
        return
      }

      if (parsed.type === 'user_message') {
        if (!session) {
          send(ws, { type: 'error', message: 'Send init first' })
          return
        }

        if (isProcessing) {
          send(ws, { type: 'error', message: 'Already processing a message' })
          return
        }

        const text = parsed.text?.trim()
        if (!text) return

        isProcessing = true
        try {
          await streamAsk(ws, session, text)
        } finally {
          isProcessing = false
        }
      }
    })

    ws.on('close', () => {
      console.log('[project-reviewer] chat client disconnected')
    })
  })

  // ── Hook into server.start() to attach the WS upgrade handler ──
  const originalStart = server.start.bind(server)
  server.start = async (...args: any[]) => {
    const result = await originalStart(...args)

    const httpServer = (server as any)._listener
    if (httpServer) {
      httpServer.on('upgrade', (request: any, socket: any, head: any) => {
        wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
          wss.emit('connection', ws, request)
        })
      })
      console.log('[project-reviewer] WebSocket upgrade handler attached to HTTP server')
    } else {
      console.error('[project-reviewer] _listener unavailable after start() — WebSocket will not work')
      console.error('[project-reviewer] Available server keys:', Object.keys(server))
    }

    return result
  }

  console.log('[project-reviewer] workflow API + chat ready')
}
