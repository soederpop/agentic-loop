export const path = '/api/sample-tool'
export const description = 'Sample a tool call — ask the model to call a specific tool given a prompt'

export async function post(_params: any, ctx: any) {
  const { designerState, apiKey } = ctx.request.app.locals
  const { toolName, userMessage } = ctx.request.body || {}

  if (!toolName || !userMessage) {
    ctx.response.status(400)
    return { error: 'Missing toolName or userMessage' }
  }

  const toolDef = designerState.tools.find((t: any) => t.name === toolName)
  if (!toolDef) {
    ctx.response.status(404)
    return { error: `Tool "${toolName}" not found` }
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

  try {
    const body = {
      model: designerState.model,
      max_tokens: designerState.maxTokens,
      system: designerState.systemPrompt + `\n\nIMPORTANT: You MUST use the "${toolName}" tool to respond to this request.`,
      messages: [{ role: 'user', content: userMessage }],
      tools: [{
        name: toolDef.name,
        description: toolDef.description,
        input_schema: toolDef.input_schema,
      }],
      tool_choice: { type: 'tool', name: toolName },
      stream: true,
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.text()
      send('error', { message: `API error ${response.status}: ${err}` })
      ctx.response.end()
      return new Promise(() => {})
    }

    const reader = response.body?.getReader()
    if (!reader) {
      send('error', { message: 'No response body' })
      ctx.response.end()
      return new Promise(() => {})
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let toolJson = ''
    let toolId = ''
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '' || data === '[DONE]') continue

        try {
          const event = JSON.parse(data)

          if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
            toolId = event.content_block.id
            send('tool_start', { id: toolId, name: event.content_block.name })
          }

          if (event.type === 'content_block_delta') {
            if (event.delta?.type === 'input_json_delta') {
              toolJson += event.delta.partial_json
              send('tool_json_delta', { partial: event.delta.partial_json })
            }
            if (event.delta?.type === 'text_delta') {
              fullText += event.delta.text
              send('chunk', { text: event.delta.text })
            }
          }

          if (event.type === 'content_block_stop' && toolJson) {
            try {
              const input = JSON.parse(toolJson)
              send('tool_complete', { id: toolId, name: toolName, input })
            } catch {
              send('tool_complete', { id: toolId, name: toolName, input: {}, raw: toolJson })
            }
          }
        } catch {
          // skip
        }
      }
    }

    send('done', {})
  } catch (err: any) {
    send('error', { message: err.message || String(err) })
  }

  ctx.response.end()
  return new Promise(() => {})
}
