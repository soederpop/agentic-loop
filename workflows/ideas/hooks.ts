/**
 * Ideas Browser — WorkflowService hooks
 *
 * Registers the SSE chat endpoint for the ideas workflow.
 * The bulk of the ideas API (GET/POST /api/ideas, /api/status, /api/assistants)
 * is served by the shared WorkflowService API layer.
 *
 * Chat is at /api/workflows/ideas/chat to avoid conflicting with other workflows.
 */
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

export async function onSetup({ app, container }: WorkflowHooksSetupContext) {
  const assistantsManager = container.feature('assistantsManager') as any

  // Per-session assistant instance cache
  const assistantInstances: Record<string, any> = {}

  // ── SSE Chat ──────────────────────────────────────────────────────────────

  app.post('/api/workflows/ideas/chat', async (req: any, res: any) => {
    const { message, assistant: assistantName = 'chiefOfStaff' } = req.body || {}

    if (!message) {
      return res.status(400).json({ error: 'Missing message' })
    }

    let assistant = assistantInstances[assistantName]
    if (!assistant) {
      if (!assistantsManager.get?.(assistantName)) {
        return res.status(404).json({ error: `Assistant "${assistantName}" not found` })
      }
      assistant = await assistantsManager.create(assistantName)
      assistantInstances[assistantName] = assistant
    }

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    const send = (event: string, data: any) => {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    }

    const onChunk = (text: string) => send('chunk', { text })
    const onToolCall = (name: string, args: any) => send('tool_start', { name, args })
    const onToolResult = (name: string, result: any) => send('tool_result', { name, result })
    const onToolError = (name: string, error: any) =>
      send('tool_error', { name, error: error?.message || String(error) })

    assistant.on('chunk', onChunk)
    assistant.on('toolCall', onToolCall)
    assistant.on('toolResult', onToolResult)
    assistant.on('toolError', onToolError)

    try {
      const response = await assistant.ask(message)
      send('done', { response, messageCount: assistant.messages?.length || 0 })
    } catch (err: any) {
      send('error', { message: err.message || String(err) })
    } finally {
      assistant.off('chunk', onChunk)
      assistant.off('toolCall', onToolCall)
      assistant.off('toolResult', onToolResult)
      assistant.off('toolError', onToolError)
    }

    res.end()
  })

  app.delete('/api/workflows/ideas/chat', (req: any, res: any) => {
    const { assistant: assistantName = 'chiefOfStaff' } = req.body || {}
    if (assistantInstances[assistantName]) {
      delete assistantInstances[assistantName]
    }
    res.json({ ok: true, cleared: assistantName })
  })

  console.log('[ideas] hooks loaded — chat at /api/workflows/ideas/chat')
}
