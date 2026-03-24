export const path = '/api/prompt-runner'
export const description = 'Save a prompt file and run it with luca prompt'

/**
 * POST /api/prompt-runner — save prompt content and run `luca prompt`
 * Streams output back via SSE.
 */
export async function post(_params: any, ctx: any) {
  const { container } = ctx.request.app.locals
  const { content, filename } = ctx.request.body || {}

  if (!content) {
    ctx.response.status(400)
    return { error: 'Missing prompt content' }
  }

  const fs = container.feature('fs')
  const proc = container.feature('proc')

  // Write prompt to tmp dir
  const tmpDir = '/tmp/assistant-designer-prompts'
  await fs.mkdirp(tmpDir)

  const name = (filename || `prompt-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '')
  const filePath = `${tmpDir}/${name}.md`
  await fs.writeFile(filePath, content)

  // Set up SSE
  const res = ctx.response
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const send = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  send('status', { message: `Saved to ${filePath}`, filePath })

  try {
    // Spawn luca prompt as a child process and stream output
    const child = require('child_process').spawn(
      'luca',
      ['prompt', filePath, '--permission-mode', 'acceptEdits'],
      {
        cwd: container.paths.cwd,
        env: { ...process.env, FORCE_COLOR: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    )

    child.stdout.on('data', (chunk: Buffer) => {
      send('output', { text: chunk.toString() })
    })

    child.stderr.on('data', (chunk: Buffer) => {
      send('output', { text: chunk.toString() })
    })

    child.on('close', (code: number) => {
      send('done', { exitCode: code, filePath })
      res.end()
    })

    child.on('error', (err: any) => {
      send('error', { message: err.message })
      res.end()
    })

    // If client disconnects, kill the process
    ctx.request.on('close', () => {
      try { child.kill('SIGTERM') } catch {}
    })
  } catch (err: any) {
    send('error', { message: err.message || String(err) })
    res.end()
  }

  return ctx.response.__handled
}

/**
 * GET /api/prompt-runner — list saved prompts
 */
export async function get(_params: any, ctx: any) {
  const { container } = ctx.request.app.locals
  const fs = container.feature('fs')
  const tmpDir = '/tmp/assistant-designer-prompts'

  try {
    const files = await fs.readdir(tmpDir)
    const prompts = files
      .filter((f: string) => f.endsWith('.md'))
      .map((f: string) => ({
        name: f.replace('.md', ''),
        path: `${tmpDir}/${f}`,
      }))
    return { prompts }
  } catch {
    return { prompts: [] }
  }
}
