/**
 * Assistant Designer — WorkflowService hooks
 *
 * Registers all assistant design, deploy, chat, and eval endpoints.
 * Chat is at /api/workflows/assistant-designer/chat
 * Eval is at /api/workflows/assistant-designer/eval
 * (both namespaced to avoid conflict with other workflows)
 */
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

interface ToolDef {
  name: string
  description: string
  schema: string
  handler: string
}

interface DesignerState {
  assistantName: string
  systemPrompt: string
  tools: ToolDef[]
  hooksSource: string
  model: string
  provider: 'openai' | 'lm-studio'
  maxTokens: number
  temperature: number
}

const OPENAI_CHAT_PREFIXES = ['gpt-3.5-turbo', 'gpt-4', 'gpt-5', 'o1', 'o3', 'o4']
function isChatModel(id: string): boolean {
  if (/^(dall-e|tts-|whisper|text-embedding|omni-moderation|sora|chatgpt-image|gpt-image|ft:)/.test(id)) return false
  if (/(transcribe|tts|realtime|audio|search|deep-research|codex|computer-use)/.test(id)) return false
  return OPENAI_CHAT_PREFIXES.some((p) => id.startsWith(p))
}

function generateToolsSource(tools: ToolDef[]): string {
  if (tools.length === 0) return `import { z } from 'zod'\n\nexport const schemas = {}\n`
  const lines: string[] = [`import { z } from 'zod'`, '']
  lines.push('export const schemas = {')
  for (const tool of tools) {
    const desc = tool.description ? `.describe(${JSON.stringify(tool.description)})` : ''
    lines.push(`  ${tool.name}: ${tool.schema}${desc},`)
  }
  lines.push('}', '')
  for (const tool of tools) {
    lines.push(`export async function ${tool.name}(args: any) {`)
    const body = tool.handler.trim() || `return { result: 'not implemented' }`
    for (const line of body.split('\n')) lines.push(`  ${line}`)
    lines.push('}', '')
  }
  return lines.join('\n')
}

function parseToolsSource(source: string): ToolDef[] {
  const tools: ToolDef[] = []
  const schemasMatch = source.match(/export\s+const\s+schemas\s*=\s*\{([\s\S]*?)\n\}/)
  if (!schemasMatch) return tools
  const schemaEntries = (schemasMatch[1] as string).match(
    /(\w+)\s*:\s*(z\.\w+\([\s\S]*?\))(?:\.describe\((['"`])([\s\S]*?)\3\))?\s*,/g,
  )
  if (!schemaEntries) return tools
  for (const entry of schemaEntries) {
    const nameMatch = entry.match(/^(\w+)\s*:/)
    if (!nameMatch) continue
    const name = nameMatch[1] as string
    const schemaMatch = entry.match(/:\s*(z\.[\s\S]*?)(?:\.describe\(|,\s*$)/)
    const schema = schemaMatch ? (schemaMatch[1] as string).trim() : 'z.object({})'
    const descMatch = entry.match(/\.describe\((['"`])([\s\S]*?)\1\)/)
    const description = descMatch ? (descMatch[2] as string) : ''
    const fnRegex = new RegExp(
      `export\\s+(?:async\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`,
    )
    const fnMatch = source.match(fnRegex)
    const handler = fnMatch ? (fnMatch[1] as string).replace(/^\n/, '').replace(/^  /gm, '').trimEnd() : ''
    tools.push({ name, description, schema, handler })
  }
  return tools
}

export async function onSetup({ app, container }: WorkflowHooksSetupContext) {
  const fs = container.feature('fs')
  const vm = container.feature('vm')
  const assistantsManager = container.feature('assistantsManager') as any
  try {
    if (!assistantsManager.isLoaded) await assistantsManager.discover()
  } catch {}

  const designerState: DesignerState = {
    assistantName: 'my-assistant',
    systemPrompt: '# My Assistant\n\nYou are a helpful assistant.',
    tools: [],
    hooksSource: '',
    model: 'gpt-4o',
    provider: 'openai',
    maxTokens: 4096,
    temperature: 1,
  }

  let assistant: any = null

  const replContext = vm.createContext({
    container, console,
    get assistant() { return assistant },
    get state() { return designerState },
    Date, Promise, setTimeout, clearTimeout, JSON, Math,
    Array, Object, String, Number, Boolean, RegExp, Map, Set, Error, Buffer,
    process, require, fetch: globalThis.fetch,
  })

  // ── State ──────────────────────────────────────────────────────────────────

  app.get('/api/state', (_req: any, res: any) => {
    res.json({
      assistantName: designerState.assistantName,
      systemPrompt: designerState.systemPrompt,
      tools: designerState.tools,
      hooksSource: designerState.hooksSource,
      model: designerState.model,
      provider: designerState.provider,
      maxTokens: designerState.maxTokens,
      temperature: designerState.temperature,
      deployed: !!assistant,
      messageCount: assistant?.messages?.length || 0,
    })
  })

  const VALID_PROVIDERS = ['openai', 'lm-studio']

  app.put('/api/state', (req: any, res: any) => {
    const body = req.body || {}
    if (body.assistantName !== undefined) {
      const name = String(body.assistantName).trim()
      if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
        return res.status(400).json({ error: 'assistantName must be alphanumeric with dashes/underscores' })
      }
      designerState.assistantName = name
    }
    if (body.provider !== undefined) {
      if (!VALID_PROVIDERS.includes(body.provider)) {
        return res.status(400).json({ error: `Invalid provider "${body.provider}"` })
      }
      designerState.provider = body.provider
    }
    if (body.model !== undefined) {
      if (typeof body.model !== 'string' || !body.model.trim()) {
        return res.status(400).json({ error: 'model must be a non-empty string' })
      }
      designerState.model = body.model
    }
    if (body.maxTokens !== undefined) {
      const mt = Number(body.maxTokens)
      if (!Number.isInteger(mt) || mt < 1 || mt > 128000) {
        return res.status(400).json({ error: 'maxTokens must be an integer between 1 and 128000' })
      }
      designerState.maxTokens = mt
    }
    if (body.temperature !== undefined) {
      const t = Number(body.temperature)
      if (isNaN(t) || t < 0 || t > 2) {
        return res.status(400).json({ error: 'temperature must be a number between 0 and 2' })
      }
      designerState.temperature = t
    }
    if (body.systemPrompt !== undefined) designerState.systemPrompt = body.systemPrompt
    if (body.hooksSource !== undefined) designerState.hooksSource = body.hooksSource
    if (body.tools !== undefined && Array.isArray(body.tools)) designerState.tools = body.tools
    res.json({ ok: true })
  })

  // ── Models ─────────────────────────────────────────────────────────────────

  app.get('/api/models', async (_req: any, res: any) => {
    const results: Array<{ id: string; name: string; provider: string }> = []
    try {
      const openai = container.client('openai' as any) as any
      const modelsPage = await openai.listModels()
      const models = modelsPage?.data || modelsPage || []
      for (const m of models) {
        if (m.id && isChatModel(m.id)) results.push({ id: m.id, name: m.id, provider: 'openai' })
      }
    } catch {}
    try {
      const lmStudio = container.client('openai' as any, { baseURL: 'http://localhost:1234/v1', apiKey: 'lm-studio' }) as any
      const modelsPage = await lmStudio.listModels()
      const models = modelsPage?.data || modelsPage || []
      for (const m of models) {
        if (m.id && !m.id.startsWith('text-embedding')) {
          results.push({ id: m.id, name: m.id, provider: 'lm-studio' })
        }
      }
    } catch {}
    res.json({ models: results })
  })

  // ── Load ───────────────────────────────────────────────────────────────────

  app.get('/api/load', (_req: any, res: any) => {
    res.json({ assistants: assistantsManager.list?.().map((a: any) => ({ name: a.name, folder: a.folder })) || [] })
  })

  app.post('/api/load', async (req: any, res: any) => {
    try {
      const { name } = req.body || {}
      if (!name) return res.status(400).json({ error: 'Missing assistant name' })
      const folder = container.paths.resolve('assistants', name)
      let systemPrompt = `# ${name}\n\nYou are a helpful assistant.`
      try { systemPrompt = ((await fs.readFileAsync(container.paths.join(folder, 'CORE.md'), 'utf8')) as any).toString('utf-8') } catch {}
      let tools: ToolDef[] = []
      let rawToolsSource = ''
      try {
        rawToolsSource = ((await fs.readFileAsync(container.paths.join(folder, 'tools.ts'), 'utf8')) as any).toString('utf-8')
        tools = parseToolsSource(rawToolsSource)
      } catch {}
      let hooksSource = ''
      try { hooksSource = ((await fs.readFileAsync(container.paths.join(folder, 'hooks.ts'), 'utf8')) as any).toString('utf-8') } catch {}
      Object.assign(designerState, { assistantName: name, systemPrompt, tools, hooksSource })
      res.json({ ok: true, assistantName: name, systemPrompt, tools, hooksSource, rawToolsSource })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Deploy ─────────────────────────────────────────────────────────────────

  app.post('/api/deploy', async (_req: any, res: any) => {
    try {
      const name = designerState.assistantName
      if (!name?.trim()) return res.status(400).json({ error: 'assistantName is required' })
      const folder = container.paths.resolve('assistants', name)
      await fs.mkdirp(folder)
      await fs.writeFileAsync(container.paths.join(folder, 'CORE.md'), designerState.systemPrompt)
      await fs.writeFileAsync(container.paths.join(folder, 'tools.ts'), generateToolsSource(designerState.tools))
      if (designerState.hooksSource.trim()) {
        await fs.writeFileAsync(container.paths.join(folder, 'hooks.ts'), designerState.hooksSource)
      }
      if (assistant) { try { assistant.removeAllListeners() } catch {} }
      await assistantsManager.discover()
      try {
        const inst = container.feature('assistant', {
          folder,
          model: designerState.model,
          maxTokens: designerState.maxTokens,
          local: designerState.provider === 'lm-studio',
        } as any)
        await inst.start()
        assistant = inst
        res.json({ ok: true, folder, name, tools: inst.availableTools })
      } catch (err: any) {
        res.json({ ok: false, error: err.message || String(err), folder })
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Export ─────────────────────────────────────────────────────────────────

  app.get('/api/export', (_req: any, res: any) => {
    res.json({
      assistantName: designerState.assistantName,
      files: {
        'CORE.md': designerState.systemPrompt,
        'tools.ts': generateToolsSource(designerState.tools),
        'hooks.ts': designerState.hooksSource || '// No hooks defined',
      },
      config: {
        model: designerState.model,
        provider: designerState.provider,
        maxTokens: designerState.maxTokens,
        temperature: designerState.temperature,
      },
    })
  })

  // ── Messages ───────────────────────────────────────────────────────────────

  app.get('/api/messages', (_req: any, res: any) => {
    res.json({ messages: assistant?.messages || [] })
  })

  app.delete('/api/messages', async (_req: any, res: any) => {
    try {
      if (assistant) {
        try { assistant.removeAllListeners() } catch {}
        const folder = container.paths.resolve('assistants', designerState.assistantName)
        const fresh = container.feature('assistant', {
          folder,
          model: designerState.model,
          maxTokens: designerState.maxTokens,
          local: designerState.provider === 'lm-studio',
        } as any)
        await fresh.start()
        assistant = fresh
      }
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── Chat (SSE, namespaced) ─────────────────────────────────────────────────

  app.post('/api/workflows/assistant-designer/chat', async (req: any, res: any) => {
    if (!assistant) return res.status(400).json({ error: 'No assistant deployed. Click Deploy first.' })
    const { message } = req.body || {}
    if (!message) return res.status(400).json({ error: 'Missing message' })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.flushHeaders()

    const send = (event: string, data: any) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
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

    res.end()
  })

  // ── Sample tool (SSE) ──────────────────────────────────────────────────────

  app.post('/api/sample-tool', async (req: any, res: any) => {
    if (!assistant) return res.status(400).json({ error: 'No assistant deployed.' })
    const { toolName, userMessage } = req.body || {}
    if (!toolName || !userMessage) return res.status(400).json({ error: 'Missing toolName or userMessage' })

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    const send = (event: string, data: any) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    const onChunk = (text: string) => send('chunk', { text })
    const onToolCall = (name: string, args: any) => { if (name === toolName) send('tool_start', { name, args }) }
    const onToolResult = (name: string, result: any) => { if (name === toolName) send('tool_complete', { name, result }) }
    const onToolError = (name: string, error: any) => send('tool_error', { name, error: error?.message || String(error) })

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

    res.end()
  })

  // ── Prompt runner (SSE) ────────────────────────────────────────────────────

  app.get('/api/prompt-runner', async (_req: any, res: any) => {
    const tmpDir = '/tmp/assistant-designer-prompts'
    try {
      const files = await fs.readdir(tmpDir)
      const prompts = files
        .filter((f: string) => f.endsWith('.md'))
        .map((f: string) => ({ name: f.replace('.md', ''), path: `${tmpDir}/${f}` }))
      res.json({ prompts })
    } catch {
      res.json({ prompts: [] })
    }
  })

  app.post('/api/prompt-runner', async (req: any, res: any) => {
    const { content, filename } = req.body || {}
    if (!content) return res.status(400).json({ error: 'Missing prompt content' })

    const tmpDir = '/tmp/assistant-designer-prompts'
    await fs.mkdirp(tmpDir)
    const name = (filename || `prompt-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '')
    const filePath = `${tmpDir}/${name}.md`
    await fs.writeFile(filePath, content)

    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    res.flushHeaders()

    const send = (event: string, data: any) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
    send('status', { message: `Saved to ${filePath}`, filePath })

    try {
      const { spawn } = await import('child_process')
      const child = spawn('luca', ['prompt', filePath, '--permission-mode', 'acceptEdits'], {
        cwd: container.paths.resolve('.'),
        env: { ...process.env, FORCE_COLOR: '0' },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      child.stdout.on('data', (chunk: Buffer) => send('output', { text: chunk.toString() }))
      child.stderr.on('data', (chunk: Buffer) => send('output', { text: chunk.toString() }))
      child.on('close', (code: number) => { send('done', { exitCode: code, filePath }); res.end() })
      child.on('error', (err: any) => { send('error', { message: err.message }); res.end() })
      req.on('close', () => { try { child.kill('SIGTERM') } catch {} })
    } catch (err: any) {
      send('error', { message: err.message || String(err) })
      res.end()
    }
  })

  // ── Eval (namespaced) ──────────────────────────────────────────────────────

  app.post('/api/workflows/assistant-designer/eval', async (req: any, res: any) => {
    try {
      const { code } = req.body || {}
      if (!code) return res.status(400).json({ error: 'Missing code' })
      replContext.state = designerState
      try {
        const result = await vm.run(code, replContext)
        res.json({ ok: true, output: result === undefined ? 'undefined' : JSON.stringify(result, null, 2) })
      } catch (err: any) {
        res.json({ ok: false, error: err.message || String(err) })
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  console.log('[assistant-designer] hooks loaded — designer, deploy, chat, eval ready')
}
