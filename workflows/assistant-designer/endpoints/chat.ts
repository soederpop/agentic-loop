export const path = '/api/chat'
export const description = 'Send a message to the deployed assistant and stream the response via SSE'

export async function post(_params: any, ctx: any) {
  const { getAssistant } = ctx.request.app.locals
  const { message } = ctx.request.body || {}

  const assistant = getAssistant()

  if (!assistant) {
    ctx.response.status(400)
    return { error: 'No assistant deployed. Click Deploy first.' }
  }

  if (!message) {
    ctx.response.status(400)
    return { error: 'Missing message' }
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

  // Wire up assistant events for this request
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
