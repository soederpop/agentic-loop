export const path = '/api/chat'
export const description = 'Send a message to an assistant and stream the response via SSE'
export const tags = ['chat']

export async function post(_params: any, ctx: any) {
  const { assistantsManager, assistantInstances } = ctx.request.app.locals
  const { message, assistant: assistantName = 'chiefOfStaff' } = ctx.request.body || {}

  if (!message) {
    ctx.response.status(400)
    return { error: 'Missing message' }
  }

  // Get or create the assistant instance
  let assistant = assistantInstances[assistantName]
  if (!assistant) {
    const entry = assistantsManager.get(assistantName)
    if (!entry) {
      ctx.response.status(404)
      return { error: `Assistant "${assistantName}" not found. Available: ${assistantsManager.available.join(', ')}` }
    }
    assistant = await assistantsManager.create(assistantName)
    assistantInstances[assistantName] = assistant
  }

  // Set up SSE
  ctx.response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })

  const send = (event: string, data: any) => {
    ctx.response.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  const onChunk = (text: string) => send('chunk', { text })
  const onToolCall = (name: string, args: any) => send('tool_start', { name, args })
  const onToolResult = (name: string, result: any) => send('tool_result', { name, result })
  const onToolError = (name: string, error: any) => send('tool_error', { name, error: error?.message || String(error) })

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

  ctx.response.end()
  return new Promise(() => {})
}

/** Clear conversation history for an assistant */
export async function del(_params: any, ctx: any) {
  const { assistantInstances } = ctx.request.app.locals
  const { assistant: assistantName = 'chiefOfStaff' } = ctx.request.body || {}

  if (assistantInstances[assistantName]) {
    delete assistantInstances[assistantName]
  }

  return { ok: true, cleared: assistantName }
}

export { del as delete }
