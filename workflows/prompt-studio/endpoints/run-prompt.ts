export const path = '/api/run-prompt/:slug'
export const description = 'Execute a prompt via luca prompt and stream output via SSE'
export const tags = ['prompt-studio']

export async function post(_params: any, ctx: any) {
  const { container } = ctx.request.app.locals
  const slug = ctx.request.params.slug
  const { agent = 'claude', inputs = {} } = ctx.request.body || {}

  console.log(`[run-prompt] slug=${slug} agent=${agent} inputs=${JSON.stringify(inputs)}`)

  // Set up SSE headers
  ctx.response.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  })

  const send = (event: string, data: any) => {
    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
    console.log(`[run-prompt] SSE -> ${event}:`, typeof data === 'object' ? JSON.stringify(data).slice(0, 120) : data)
    ctx.response.write(frame)
  }

  send('status', { message: `Starting prompt: ${slug}`, agent })

  const proc = container.feature('proc')
  const promptId = `prompts/${slug}`

  try {
    // Build the luca prompt command
    const args = ['prompt', agent, promptId, '--permission-mode', 'bypassPermissions']

    // Pass inputs as --input key=value pairs
    for (const [key, value] of Object.entries(inputs)) {
      if (value !== undefined && value !== '') {
        args.push('--input', `${key}=${value}`)
      }
    }

    console.log(`[run-prompt] spawning: luca ${args.join(' ')}`)
    send('status', { message: `Running: luca ${args.join(' ')}` })

    // Use proc.spawn for streaming
    const child = proc.spawn('luca', args, {
      cwd: container.paths.cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    console.log(`[run-prompt] child pid=${child.pid}`)

    let output = ''

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      output += text
      console.log(`[run-prompt] stdout (${text.length} chars): ${text.slice(0, 80)}`)
      send('chunk', { text })
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString()
      console.log(`[run-prompt] stderr: ${text.slice(0, 200)}`)
      send('stderr', { text })
    })

    // Handle client disconnect
    ctx.request.on('close', () => {
      console.log(`[run-prompt] client disconnected, killing child`)
      try {
        child.kill('SIGTERM')
      } catch (_e) {
        // ignore
      }
    })

    await new Promise<void>((resolve, reject) => {
      child.on('close', (code: number) => {
        console.log(`[run-prompt] child exited code=${code}`)
        if (code === 0) {
          send('complete', { message: 'Prompt completed successfully' })
          resolve()
        } else {
          send('error', { message: `Process exited with code ${code}` })
          resolve()
        }
      })
      child.on('error', (err: Error) => {
        console.error(`[run-prompt] child error:`, err)
        send('error', { message: err.message })
        reject(err)
      })
    })
  } catch (err: any) {
    console.error(`[run-prompt] catch error:`, err)
    send('error', { message: err.message || String(err) })
  }

  console.log(`[run-prompt] ending response`)
  ctx.response.end()
  return new Promise(() => {})
}
