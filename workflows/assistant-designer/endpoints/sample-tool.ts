export const path = '/api/sample-tool'
export const description = 'Test a single tool by asking the deployed assistant to use it'

export async function post(_params: any, ctx: any) {
  const { getAssistant } = ctx.request.app.locals
  const { toolName, userMessage } = ctx.request.body || {}

  const assistant = getAssistant()

  if (!assistant) {
    ctx.response.status(400)
    return { error: 'No assistant deployed. Click Deploy first.' }
  }

  if (!toolName || !userMessage) {
    ctx.response.status(400)
    return { error: 'Missing toolName or userMessage' }
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
  const onToolCall = (name: string, args: any) => {
    if (name === toolName) send('tool_start', { name, args })
  }
  const onToolResult = (name: string, result: any) => {
    if (name === toolName) send('tool_complete', { name, result })
  }
  const onToolError = (name: string, error: any) => {
    send('tool_error', { name, error: error?.message || String(error) })
  }

  assistant.on('chunk', onChunk)
  assistant.on('toolCall', onToolCall)
  assistant.on('toolResult', onToolResult)
  assistant.on('toolError', onToolError)

  try {
    await assistant.ask(`You MUST use the "${toolName}" tool to respond. ${userMessage}`)
    send('done', {})
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
