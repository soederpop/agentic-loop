/**
 * Assistant Designer — WorkflowService hooks
 *
 * Registers all assistant design, deploy, chat, and eval endpoints.
 * Chat is at /api/workflows/assistant-designer/chat
 * Eval is at /api/workflows/assistant-designer/eval
 * (both namespaced to avoid conflict with other workflows)
 */
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

interface ToolField {
  name: string
  type: 'string' | 'number' | 'boolean' | 'enum'
  description: string
  required: boolean
  min?: number
  max?: number
  integer?: boolean
  enumValues?: string[]
}

interface ToolDef {
  name: string
  description: string
  fields: ToolField[]
  handler: string
  rawSchema?: string // fallback for schemas too complex for the visual builder
}

interface DesignerState {
  assistantName: string
  systemPrompt: string
  tools: ToolDef[]
  toolsImports: string[] // extra import lines from loaded tools.ts
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

function fieldToZod(f: ToolField): string {
  let chain: string
  if (f.type === 'enum' && f.enumValues?.length) {
    chain = `z.enum([${f.enumValues.map(v => JSON.stringify(v)).join(', ')}])`
  } else {
    chain = `z.${f.type}()`
  }
  if (f.type === 'number' && f.integer) chain += '.int()'
  if (f.min != null) chain += `.min(${f.min})`
  if (f.max != null) chain += `.max(${f.max})`
  if (!f.required) chain += '.optional()'
  if (f.description) chain += `.describe(${JSON.stringify(f.description)})`
  return chain
}

function fieldsToZodObject(fields: ToolField[]): string {
  if (!fields.length) return 'z.object({})'
  const lines = fields.map(f => `    ${f.name}: ${fieldToZod(f)},`)
  return `z.object({\n${lines.join('\n')}\n  })`
}

function generateToolsSource(tools: ToolDef[], extraImports?: string[]): string {
  if (tools.length === 0) return `import { z } from 'zod'\n\nexport const schemas = {}\n`

  const lines: string[] = [`import { z } from 'zod'`]
  if (extraImports?.length) {
    for (const imp of extraImports) lines.push(imp)
  }
  lines.push('')
  lines.push('export const schemas = {')
  for (const tool of tools) {
    const zodStr = tool.rawSchema || fieldsToZodObject(tool.fields)
    const desc = tool.description ? `.describe(${JSON.stringify(tool.description)})` : ''
    lines.push(`  ${tool.name}: ${zodStr}${desc},`)
  }
  lines.push('}', '')
  for (const tool of tools) {
    lines.push(`export async function ${tool.name}(options: z.infer<typeof schemas.${tool.name}>) {`)
    const body = tool.handler.trim() || `return { result: 'not implemented' }`
    for (const line of body.split('\n')) lines.push(`  ${line}`)
    lines.push('}', '')
  }
  return lines.join('\n')
}

/** Extract balanced brace content starting at the opening brace */
function extractBraced(src: string, startIdx: number): string {
  let depth = 0
  let i = startIdx
  while (i < src.length) {
    if (src[i] === '{') depth++
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(startIdx, i + 1) }
    else if (src[i] === "'" || src[i] === '"' || src[i] === '`') {
      const q = src[i]!; i++
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++ }
    }
    i++
  }
  return src.slice(startIdx)
}

/** Parse z.object({...}) fields into ToolField[] */
function parseZodObjectFields(zodStr: string): ToolField[] | null {
  const objMatch = zodStr.match(/z\.object\(\{/)
  if (!objMatch) return null

  const innerStart = zodStr.indexOf('{', zodStr.indexOf('z.object('))
  const inner = extractBraced(zodStr, innerStart)
  // Strip outer braces
  const body = inner.slice(1, -1).trim()
  if (!body) return []

  const fields: ToolField[] = []
  // Match field entries: name: z.type()...
  const fieldRegex = /(\w+)\s*:\s*(z\.\w+)/g
  let match
  while ((match = fieldRegex.exec(body)) !== null) {
    const name = match[1] as string
    const typeStart = match.index! + match[0].length - match[2]!.length
    // Find the full chain for this field (everything up to the next field or end)
    let chainEnd = body.length
    // Look for the next top-level field declaration
    const nextField = /,\s*\n\s*(\w+)\s*:\s*z\./g
    nextField.lastIndex = match.index! + match[0].length
    const nextMatch = nextField.exec(body)
    if (nextMatch) chainEnd = nextMatch.index! + 1 // include the comma

    let chain = body.slice(typeStart, chainEnd).replace(/,\s*$/, '').trim()

    const field: ToolField = { name, type: 'string', description: '', required: true }

    // Detect type
    if (chain.startsWith('z.string')) field.type = 'string'
    else if (chain.startsWith('z.number')) field.type = 'number'
    else if (chain.startsWith('z.boolean')) field.type = 'boolean'
    else if (chain.startsWith('z.enum')) {
      field.type = 'enum'
      const enumMatch = chain.match(/z\.enum\(\[([^\]]*)\]\)/)
      if (enumMatch) {
        field.enumValues = [...enumMatch[1]!.matchAll(/['"]([^'"]*)['"]/g)].map(m => m[1] as string)
      }
    }

    // Parse chained methods
    if (chain.includes('.optional()')) field.required = false
    if (chain.includes('.int()')) field.integer = true
    const minMatch = chain.match(/\.min\((\d+)\)/)
    if (minMatch) field.min = Number(minMatch[1])
    const maxMatch = chain.match(/\.max\((\d+)\)/)
    if (maxMatch) field.max = Number(maxMatch[1])
    const descMatch = chain.match(/\.describe\((['"`])([\s\S]*?)\1\)/)
    if (descMatch) field.description = descMatch[2] as string

    fields.push(field)
  }
  return fields
}

function parseToolsSource(source: string): { tools: ToolDef[], imports: string[] } {
  const tools: ToolDef[] = []

  // Extract import lines (all non-zod imports)
  const imports: string[] = []
  for (const line of source.split('\n')) {
    if (/^import\s/.test(line) && !line.includes("from 'zod'") && !line.includes('from "zod"')) {
      imports.push(line)
    }
  }

  // Find the schemas object using brace balancing
  const schemasIdx = source.search(/export\s+const\s+schemas\s*=\s*\{/)
  if (schemasIdx === -1) return { tools, imports }

  const braceStart = source.indexOf('{', schemasIdx)
  const schemasBlock = extractBraced(source, braceStart)
  const schemasInner = schemasBlock.slice(1, -1) // strip outer braces

  // Find top-level schema entries by scanning character-by-character
  // Only match "name:" patterns that are at brace depth 0 within the schemas object
  const entries: Array<{ name: string; valueStart: number }> = []
  let depth = 0
  let lineStart = 0
  for (let i = 0; i < schemasInner.length; i++) {
    const ch = schemasInner[i]!
    if (ch === '{' || ch === '(' || ch === '[') depth++
    else if (ch === '}' || ch === ')' || ch === ']') depth--
    else if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch; i++
      while (i < schemasInner.length && schemasInner[i] !== q) { if (schemasInner[i] === '\\') i++; i++ }
    } else if (ch === '\n') {
      lineStart = i + 1
    }

    // At depth 0, look for "word:" pattern at start of line (with optional whitespace)
    if (depth === 0 && ch === ':' && i > lineStart) {
      const beforeColon = schemasInner.slice(lineStart, i).trim()
      if (/^\w+$/.test(beforeColon)) {
        entries.push({ name: beforeColon, valueStart: i + 1 })
      }
    }
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!
    const nextStart = i + 1 < entries.length
      ? schemasInner.lastIndexOf('\n', entries[i + 1]!.valueStart - 1) + 1 || entries[i + 1]!.valueStart
      : schemasInner.length
    let zodExpr = schemasInner.slice(entry.valueStart, nextStart).trim().replace(/,\s*$/, '')

    // Extract tool-level .describe() — find the outermost one by scanning
    let description = ''
    // Match .describe('...') or .describe("...") at the end of the expression
    const describeMatch = zodExpr.match(/\.describe\((['"`])([\s\S]*?)\1\)\s*$/)
    if (describeMatch) {
      description = describeMatch[2] as string
      zodExpr = zodExpr.slice(0, zodExpr.lastIndexOf('.describe(')).trim()
    }

    // Try to parse into fields
    const fields = parseZodObjectFields(zodExpr)

    // Extract function body
    const fnRegex = new RegExp(
      `export\\s+(?:async\\s+)?function\\s+${entry.name}\\s*\\([^)]*\\)(?:\\s*:\\s*[^{]*)?\\s*\\{`,
    )
    const fnMatch = source.match(fnRegex)
    let handler = ''
    if (fnMatch) {
      const fnBraceStart = source.indexOf('{', fnMatch.index! + fnMatch[0].length - 1)
      const fnBody = extractBraced(source, fnBraceStart)
      // Dedent: find the common leading whitespace and strip it
      const bodyLines = fnBody.slice(1, -1).split('\n')
      // Remove leading empty line
      if (bodyLines.length && bodyLines[0]!.trim() === '') bodyLines.shift()
      // Remove trailing empty lines
      while (bodyLines.length && bodyLines[bodyLines.length - 1]!.trim() === '') bodyLines.pop()
      // Find minimum indentation (tabs or spaces)
      let minIndent = Infinity
      for (const line of bodyLines) {
        if (line.trim() === '') continue
        const leadingMatch = line.match(/^(\s+)/)
        if (leadingMatch) minIndent = Math.min(minIndent, leadingMatch[1]!.length)
        else { minIndent = 0; break }
      }
      if (minIndent === Infinity) minIndent = 0
      handler = bodyLines.map(l => l.slice(minIndent)).join('\n')
    }

    tools.push({
      name: entry.name,
      description,
      fields: fields || [],
      handler,
      rawSchema: fields === null ? zodExpr : undefined,
    })
  }

  return { tools, imports }
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
    toolsImports: [],
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
      toolsImports: designerState.toolsImports,
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
    if (body.toolsImports !== undefined && Array.isArray(body.toolsImports)) designerState.toolsImports = body.toolsImports
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
      let toolsImports: string[] = []
      let rawToolsSource = ''
      try {
        rawToolsSource = ((await fs.readFileAsync(container.paths.join(folder, 'tools.ts'), 'utf8')) as any).toString('utf-8')
        const parsed = parseToolsSource(rawToolsSource)
        tools = parsed.tools
        toolsImports = parsed.imports
      } catch {}
      let hooksSource = ''
      try { hooksSource = ((await fs.readFileAsync(container.paths.join(folder, 'hooks.ts'), 'utf8')) as any).toString('utf-8') } catch {}
      Object.assign(designerState, { assistantName: name, systemPrompt, tools, toolsImports, hooksSource })

      // Auto-instantiate the assistant so it's available in the REPL and chat immediately
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
      } catch {}

      res.json({ ok: true, assistantName: name, systemPrompt, tools, toolsImports, hooksSource, rawToolsSource })
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
      await fs.writeFileAsync(container.paths.join(folder, 'tools.ts'), generateToolsSource(designerState.tools, designerState.toolsImports))
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
        'tools.ts': generateToolsSource(designerState.tools, designerState.toolsImports),
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

  // ── Eval Tool Body ─────────────────────────────────────────────────────────

  app.post('/api/eval-tool', async (req: any, res: any) => {
    const { handler, testArgs } = req.body || {}
    if (!handler) return res.status(400).json({ error: 'Missing handler body' })
    const code = `(async function(options) {\n${handler}\n})(${JSON.stringify(testArgs || {})})`
    try {
      const result = await vm.run(code, replContext)
      res.json({ ok: true, output: result === undefined ? 'undefined' : typeof result === 'string' ? result : JSON.stringify(result, null, 2) })
    } catch (err: any) {
      res.json({ ok: false, error: err.message || String(err) })
    }
  })

  // ── Eval (namespaced) ──────────────────────────────────────────────────────

  app.post('/api/workflows/assistant-designer/eval', async (req: any, res: any) => {
    try {
      const { code } = req.body || {}
      if (!code) return res.status(400).json({ error: 'Missing code' })
      replContext.state = designerState
      replContext.assistant = assistant
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
