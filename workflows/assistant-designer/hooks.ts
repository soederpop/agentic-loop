/**
 * Assistant Designer — Disk-First WorkflowService hooks
 *
 * All assistant definition files live on disk in assistants/.
 * The API exposes file read/write, reload, chat, eval, and history.
 * No in-memory "designer state" — disk is the source of truth.
 */
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

// ── Known assistant file types ────────────────────────────────────────────────

const KNOWN_FILES = ['CORE.md', 'ABOUT.md', 'tools.ts', 'hooks.ts', 'voice.yaml']

const OPENAI_CHAT_PREFIXES = ['gpt-3.5-turbo', 'gpt-4', 'gpt-5', 'o1', 'o3', 'o4']
function isChatModel(id: string): boolean {
  if (/^(dall-e|tts-|whisper|text-embedding|omni-moderation|sora|chatgpt-image|gpt-image|ft:)/.test(id)) return false
  if (/(transcribe|tts|realtime|audio|search|deep-research|codex|computer-use)/.test(id)) return false
  return OPENAI_CHAT_PREFIXES.some((p) => id.startsWith(p))
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface FileWatcher {
  close(): void
}

export async function onSetup({ app, container, wss, broadcast }: WorkflowHooksSetupContext) {
  const fs = container.feature('fs')
  const vm = container.feature('vm')
  const yaml = container.feature('yaml')
  const assistantsManager = container.feature('assistantsManager') as any
  try {
    if (!assistantsManager.isLoaded) await assistantsManager.discover()
  } catch {}

  // Runtime state: which assistant is loaded and its live instance
  let activeAssistantId: string | null = null
  let assistant: any = null
  const fileWatchers: FileWatcher[] = []

  // Helper: get assistant folder path
  const getFolder = (id: string) => container.paths.resolve('assistants', id)

  // Helper: list files in an assistant folder
  async function listAssistantFiles(folder: string): Promise<string[]> {
    try {
      const entries = await fs.readdir(folder)
      return entries.filter((f: string) => !f.startsWith('.') && f !== 'generated' && f !== 'docs' && f !== 'node_modules')
    } catch {
      return []
    }
  }

  // Helper: read assistant metadata from CORE.md frontmatter
  async function readMeta(folder: string): Promise<Record<string, any>> {
    try {
      const content = ((await fs.readFileAsync(container.paths.join(folder, 'CORE.md'), 'utf8')) as any).toString('utf-8')
      const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
      if (fmMatch) return yaml.parse(fmMatch[1]) || {}
    } catch {}
    return {}
  }

  // Helper: read ABOUT.md
  async function readAbout(folder: string): Promise<string> {
    try {
      return ((await fs.readFileAsync(container.paths.join(folder, 'ABOUT.md'), 'utf8')) as any).toString('utf-8')
    } catch {
      return ''
    }
  }

  // Helper: instantiate an assistant runtime
  async function loadAssistant(id: string): Promise<any> {
    const folder = getFolder(id)
    if (assistant) { try { assistant.removeAllListeners() } catch {} }
    await assistantsManager.discover()
    const fullName = `assistants/${id}`
    const inst = assistantsManager.create(fullName, { historyMode: 'session' })
    inst.resumeThread(`designer:${id}`)
    await inst.start()
    assistant = inst
    activeAssistantId = id
    return inst
  }

  // REPL context
  const replContext = vm.createContext({
    container, console,
    get assistant() { return assistant },
    Date, Promise, setTimeout, clearTimeout, JSON, Math,
    Array, Object, String, Number, Boolean, RegExp, Map, Set, Error, Buffer,
    process, require, fetch: globalThis.fetch,
  })

  // ── GET /api/workflows/assistant-designer/assistants ────────────────────────
  // List all discovered assistants with metadata

  app.get('/api/workflows/assistant-designer/assistants', async (_req: any, res: any) => {
    try {
      const list = assistantsManager.list?.() || []
      const assistants = await Promise.all(
        list.map(async (e: any) => {
          const id = (e.name || '').replace(/^assistants\//, '')
          const folder = e.folder || getFolder(id)
          const files = await listAssistantFiles(folder)
          const about = await readAbout(folder)
          const meta = await readMeta(folder)
          return { id, name: id, folder, files, about, meta, hasVoice: !!e.hasVoice }
        })
      )
      res.json({ assistants, active: activeAssistantId })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── GET /api/workflows/assistant-designer/assistants/:id ────────────────────
  // Full metadata for a single assistant

  app.get('/api/workflows/assistant-designer/assistants/:id', async (req: any, res: any) => {
    try {
      const { id } = req.params
      const folder = getFolder(id)
      if (!await fs.exists(folder)) return res.status(404).json({ error: `Assistant "${id}" not found` })

      const files = await listAssistantFiles(folder)
      const about = await readAbout(folder)
      const meta = await readMeta(folder)

      // Read voice config if present
      let voiceConfig = null
      try {
        const voiceContent = ((await fs.readFileAsync(container.paths.join(folder, 'voice.yaml'), 'utf8')) as any).toString('utf-8')
        voiceConfig = yaml.parse(voiceContent)
      } catch {}

      res.json({
        id, name: id, folder, files, about, meta, voiceConfig,
        isActive: activeAssistantId === id,
        hasRuntime: activeAssistantId === id && !!assistant,
        messageCount: activeAssistantId === id ? (assistant?.messages?.length || 0) : 0,
      })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── GET /api/workflows/assistant-designer/assistants/:id/files/:filename ────
  // Read raw content of an assistant file

  app.get('/api/workflows/assistant-designer/assistants/:id/files/:filename', async (req: any, res: any) => {
    try {
      const { id, filename } = req.params
      const filePath = container.paths.join(getFolder(id), filename)
      if (!await fs.exists(filePath)) return res.status(404).json({ error: `File "${filename}" not found in assistant "${id}"` })
      const content = ((await fs.readFileAsync(filePath, 'utf8')) as any).toString('utf-8')
      res.json({ filename, content })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── PUT /api/workflows/assistant-designer/assistants/:id/files/:filename ────
  // Write content back to an assistant file on disk

  app.put('/api/workflows/assistant-designer/assistants/:id/files/:filename', async (req: any, res: any) => {
    try {
      const { id, filename } = req.params
      const { content } = req.body || {}
      if (content === undefined) return res.status(400).json({ error: 'Missing content in body' })
      const folder = getFolder(id)
      await fs.mkdirp(folder)
      const filePath = container.paths.join(folder, filename)
      await fs.writeFileAsync(filePath, content)

      // Broadcast file change event
      broadcast('file_changed', { assistantId: id, filename })

      res.json({ ok: true, filename, assistantId: id })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── POST /api/workflows/assistant-designer/assistants/:id/reload ────────────
  // Trigger runtime reload of the assistant after edits

  app.post('/api/workflows/assistant-designer/assistants/:id/reload', async (req: any, res: any) => {
    try {
      const { id } = req.params
      const folder = getFolder(id)
      if (!await fs.exists(folder)) return res.status(404).json({ error: `Assistant "${id}" not found` })

      await loadAssistant(id)
      broadcast('assistant_reloaded', { assistantId: id })

      res.json({ ok: true, assistantId: id, messageCount: assistant?.messages?.length || 0 })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── GET /api/workflows/assistant-designer/assistants/:id/history ────────────
  // List conversation history sessions for an assistant

  app.get('/api/workflows/assistant-designer/assistants/:id/history', async (req: any, res: any) => {
    try {
      const { id } = req.params
      // History is stored via the assistant's thread system
      // List threads that match the designer prefix
      const historyDir = container.paths.resolve('.luca', 'threads')
      let sessions: any[] = []
      try {
        const allFiles = await fs.readdir(historyDir)
        const prefix = `designer:${id}`
        const matching = allFiles.filter((f: string) => f.startsWith(prefix) || f.includes(id))
        sessions = await Promise.all(
          matching.map(async (f: string) => {
            const filePath = container.paths.join(historyDir, f)
            try {
              const stat = await fs.statAsync(filePath)
              const content = ((await fs.readFileAsync(filePath, 'utf8')) as any).toString('utf-8')
              const messages = JSON.parse(content)
              return {
                threadId: f.replace('.json', ''),
                messageCount: Array.isArray(messages) ? messages.length : 0,
                updatedAt: (stat as any).mtime,
              }
            } catch {
              return { threadId: f.replace('.json', ''), messageCount: 0, updatedAt: null }
            }
          })
        )
        sessions.sort((a: any, b: any) => {
          if (!a.updatedAt) return 1
          if (!b.updatedAt) return -1
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        })
      } catch {}

      res.json({ assistantId: id, sessions })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── GET /api/workflows/assistant-designer/features ──────────────────────────
  // List available Luca features that assistants can use()

  app.get('/api/workflows/assistant-designer/features', async (_req: any, res: any) => {
    try {
      const registered = container.helpers.registered('features') || []
      const features = registered.map((name: string) => {
        try {
          const feat = container.feature(name as any)
          return {
            name,
            description: (feat as any).constructor?.description || '',
            shortcut: (feat as any).constructor?.shortcut || '',
          }
        } catch {
          return { name, description: '', shortcut: '' }
        }
      })
      res.json({ features })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── GET /api/workflows/assistant-designer/models ────────────────────────────
  // List available models from OpenAI and LM Studio

  app.get('/api/workflows/assistant-designer/models', async (_req: any, res: any) => {
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

  // ── POST /api/workflows/assistant-designer/chat ─────────────────────────────
  // SSE streaming chat with the active assistant

  app.post('/api/workflows/assistant-designer/chat', async (req: any, res: any) => {
    const { message, assistantId } = req.body || {}
    if (!message) return res.status(400).json({ error: 'Missing message' })

    // Auto-load if assistant specified and not already active
    if (assistantId && assistantId !== activeAssistantId) {
      try { await loadAssistant(assistantId) } catch (err: any) {
        return res.status(500).json({ error: `Failed to load assistant: ${err.message}` })
      }
    }

    if (!assistant) {
      return res.status(400).json({ error: 'No assistant loaded. Select an assistant first.' })
    }

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
      send('done', { response, messageCount: assistant.messages?.length || 0, assistantId: activeAssistantId })
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

  // ── DELETE /api/workflows/assistant-designer/chat ────────────────────────────
  // Clear chat history / reset assistant

  app.delete('/api/workflows/assistant-designer/chat', async (_req: any, res: any) => {
    try {
      if (assistant && activeAssistantId) {
        await loadAssistant(activeAssistantId)
      }
      res.json({ ok: true })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── GET /api/workflows/assistant-designer/messages ──────────────────────────
  // Get current conversation messages

  app.get('/api/workflows/assistant-designer/messages', (_req: any, res: any) => {
    res.json({ messages: assistant?.messages || [], assistantId: activeAssistantId })
  })

  // ── POST /api/workflows/assistant-designer/eval ─────────────────────────────
  // REPL evaluation

  app.post('/api/workflows/assistant-designer/eval', async (req: any, res: any) => {
    try {
      const { code } = req.body || {}
      if (!code) return res.status(400).json({ error: 'Missing code' })
      replContext.assistant = assistant
      replContext.activeAssistantId = activeAssistantId
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

  // ── POST /api/workflows/assistant-designer/watch/:id ────────────────────────
  // Start file watching for hot reload

  app.post('/api/workflows/assistant-designer/watch/:id', async (req: any, res: any) => {
    try {
      const { id } = req.params
      const folder = getFolder(id)
      if (!await fs.exists(folder)) return res.status(404).json({ error: `Assistant "${id}" not found` })

      // Clear existing watchers
      for (const w of fileWatchers) { try { w.close() } catch {} }
      fileWatchers.length = 0

      // Watch each known file
      const { watch } = await import('node:fs')
      for (const filename of KNOWN_FILES) {
        const filePath = container.paths.join(folder, filename)
        try {
          if (await fs.exists(filePath)) {
            let debounce: any = null
            const watcher = watch(filePath, () => {
              if (debounce) clearTimeout(debounce)
              debounce = setTimeout(async () => {
                broadcast('file_changed', { assistantId: id, filename })
                // Auto-reload if this assistant is active
                if (activeAssistantId === id) {
                  try {
                    await loadAssistant(id)
                    broadcast('assistant_reloaded', { assistantId: id, auto: true })
                  } catch {}
                }
              }, 300)
            })
            fileWatchers.push(watcher)
          }
        } catch {}
      }

      res.json({ ok: true, assistantId: id, watching: KNOWN_FILES })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })

  // ── POST /api/workflows/assistant-designer/create ───────────────────────────
  // Create a new assistant from scratch

  app.post('/api/workflows/assistant-designer/create', async (req: any, res: any) => {
    try {
      const { name } = req.body || {}
      if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
        return res.status(400).json({ error: 'Name must be alphanumeric with dashes/underscores' })
      }
      const folder = getFolder(name)
      if (await fs.exists(folder)) {
        return res.status(409).json({ error: `Assistant "${name}" already exists` })
      }
      await fs.mkdirp(folder)
      await fs.writeFileAsync(container.paths.join(folder, 'CORE.md'), `# ${name}\n\nYou are a helpful assistant.\n`)
      await fs.writeFileAsync(container.paths.join(folder, 'ABOUT.md'), `# ${name}\n\nA custom assistant.\n`)
      await fs.writeFileAsync(container.paths.join(folder, 'tools.ts'), `import { z } from 'zod'\n\nexport const schemas = {}\n`)

      await assistantsManager.discover()
      broadcast('assistant_created', { assistantId: name })

      res.json({ ok: true, assistantId: name, folder })
    } catch (err: any) {
      res.status(500).json({ error: err.message })
    }
  })
}
