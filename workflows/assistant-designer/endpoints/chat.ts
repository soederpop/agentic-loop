export const path = '/api/chat'
export const description = 'Send a message and stream the response via SSE'

export async function post(_params: any, ctx: any) {
  const { designerState, apiKey } = ctx.request.app.locals
  const { message } = ctx.request.body || {}

  if (!message) {
    ctx.response.status(400)
    return { error: 'Missing message' }
  }

  if (!apiKey) {
    ctx.response.status(500)
    return { error: 'ANTHROPIC_API_KEY not set' }
  }

  // Add user message to history
  designerState.messages.push({ role: 'user', content: message })

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
    // Build the API request
    const tools = designerState.tools.map((t: any) => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema,
    }))

    let continueLoop = true

    while (continueLoop) {
      continueLoop = false

      const body: any = {
        model: designerState.model,
        max_tokens: designerState.maxTokens,
        system: designerState.systemPrompt,
        messages: designerState.messages,
        stream: true,
      }

      if (tools.length > 0) {
        body.tools = tools
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
      let fullText = ''
      let toolUseBlocks: any[] = []
      let currentToolUse: any = null
      let currentToolJson = ''
      let stopReason = ''

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

            if (event.type === 'content_block_start') {
              if (event.content_block?.type === 'tool_use') {
                currentToolUse = {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  input: {},
                }
                currentToolJson = ''
                send('tool_start', { id: currentToolUse.id, name: currentToolUse.name })
              }
            }

            if (event.type === 'content_block_delta') {
              if (event.delta?.type === 'text_delta') {
                fullText += event.delta.text
                send('chunk', { text: event.delta.text })
              }
              if (event.delta?.type === 'input_json_delta') {
                currentToolJson += event.delta.partial_json
              }
            }

            if (event.type === 'content_block_stop' && currentToolUse) {
              try {
                currentToolUse.input = JSON.parse(currentToolJson || '{}')
              } catch {
                currentToolUse.input = {}
              }
              toolUseBlocks.push(currentToolUse)
              send('tool_end', {
                id: currentToolUse.id,
                name: currentToolUse.name,
                input: currentToolUse.input,
              })
              currentToolUse = null
              currentToolJson = ''
            }

            if (event.type === 'message_delta') {
              stopReason = event.delta?.stop_reason || ''
            }
          } catch {
            // skip malformed events
          }
        }
      }

      // Build the assistant message content blocks
      const contentBlocks: any[] = []
      if (fullText) {
        contentBlocks.push({ type: 'text', text: fullText })
      }
      for (const tu of toolUseBlocks) {
        contentBlocks.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input })
      }

      if (contentBlocks.length > 0) {
        designerState.messages.push({ role: 'assistant', content: contentBlocks })
      }

      // If the model wants to use tools, provide mock results and continue
      if (stopReason === 'tool_use' && toolUseBlocks.length > 0) {
        const toolResults = toolUseBlocks.map((tu: any) => {
          const toolDef = designerState.tools.find((t: any) => t.name === tu.name)
          const mockResult = toolDef?.mock_result || JSON.stringify({ result: `Mock result for ${tu.name}`, input: tu.input })
          send('tool_result', { id: tu.id, name: tu.name, result: mockResult })
          return {
            type: 'tool_result' as const,
            tool_use_id: tu.id,
            content: mockResult,
          }
        })
        designerState.messages.push({ role: 'user', content: toolResults })
        continueLoop = true
        toolUseBlocks = []
        fullText = ''
      }
    }

    send('done', { messageCount: designerState.messages.length })
  } catch (err: any) {
    send('error', { message: err.message || String(err) })
  }

  ctx.response.end()
  return new Promise(() => {})
}
