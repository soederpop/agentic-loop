import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'

export const description = 'Describe the container, registries, or individual helpers — with optional browser UI'

export const positionals = ['target']

export const argsSchema = z.object({
  target: z.string().optional().describe('What to describe (e.g. fs, features, clients.rest, fs.readFile)'),
  json: z.boolean().default(false).describe('Output as JSON'),
  type: z.boolean().default(false).describe('Output as TypeScript type definition'),
  pretty: z.boolean().default(false).describe('Render markdown with terminal styling'),
  ui: z.union([z.boolean(), z.enum(['light', 'dark'])]).default(false).describe('Launch browser UI (true/light/dark)'),
  title: z.boolean().default(true).describe('Include title header (--no-title to omit)'),
  // Section filters
  description: z.boolean().default(false).describe('Show description section'),
  usage: z.boolean().default(false).describe('Show usage section'),
  methods: z.boolean().default(false).describe('Show methods section'),
  getters: z.boolean().default(false).describe('Show getters section'),
  events: z.boolean().default(false).describe('Show events section'),
  state: z.boolean().default(false).describe('Show state section'),
  options: z.boolean().default(false).describe('Show options section'),
  examples: z.boolean().default(false).describe('Show examples section'),
  platform: z.enum(['browser', 'web', 'server', 'node', 'all']).default('all').describe('Filter by platform'),
  port: z.number().default(0).describe('Port for the UI server (0 = auto-find available port)'),
})

const SECTION_FLAGS: Record<string, string> = {
  description: 'description',
  usage: 'usage',
  methods: 'methods',
  getters: 'getters',
  events: 'events',
  state: 'state',
  options: 'options',
  examples: 'examples',
}

function getSectionsFromFlags(flags: Record<string, any>): string[] {
  const sections: string[] = []
  for (const [flag, section] of Object.entries(SECTION_FLAGS)) {
    if (flags[flag] && !sections.includes(section)) {
      sections.push(section)
    }
  }
  return sections
}

export default async function desc(
  options: z.infer<typeof argsSchema>,
  context: ContainerContext,
) {
  const { container } = context
  const describer = (container as any).describer
  await describer.initialize()

  const args = (container as any).argv._ as string[]
  // positionals: _[0] is command name, _[1+] are targets
  const targets = options.target ? [options.target] : args.slice(1)

  // If --ui is set, launch the browser UI server
  if (options.ui !== false) {
    const theme = options.ui === true ? 'dark' : (options.ui as string)
    await launchUI(container, describer, theme, options.port)
    return
  }

  // No targets: show available registries
  if (targets.length === 0) {
    const ui = container.feature('ui') as any
    const registries = (container as any).registryNames as string[]
    console.log(ui.markdown(`# luca desc\n\nUsage: \`luca desc <target>\`\n\nAvailable registries: ${registries.join(', ')}\n\nExamples:\n- \`luca desc features\` — list all features\n- \`luca desc fs\` — describe a specific feature\n- \`luca desc fs.readFile\` — describe a specific method\n- \`luca desc --ui\` — launch browser UI`))
    return
  }

  const sections = getSectionsFromFlags(options)
  const result = await describer.describe(targets, {
    sections,
    noTitle: !options.title,
    platform: options.platform,
  })

  if (options.type) {
    for (const t of targets) {
      const typeText = await getTypeText(container, describer, t)
      console.log(typeText)
    }
  } else if (options.json) {
    console.log(JSON.stringify(result.json, null, 2))
  } else if (options.pretty) {
    const ui = container.feature('ui') as any
    console.log(ui.markdown(result.text))
  } else {
    console.log(result.text)
  }
}

// --- Find available port ---

// --- Get TypeScript type text for a target ---

async function getTypeText(container: any, describer: any, target: string): Promise<string> {
  try {
    const resolved = describer.resolve(target)
    const entry = Array.isArray(resolved) ? resolved[0] : resolved
    if (entry?.id) {
      // Try to get the instance from the appropriate registry
      let instance: any = null
      try {
        if (entry.registry === 'features') {
          instance = container.feature(entry.id)
        } else {
          instance = container[entry.registry]?.get?.(entry.id)
        }
      } catch {}
      const typeText = instance?.introspectAsType?.()
      if (typeText) return typeText
    }
  } catch {}
  return `// No TypeScript type available for ${target}`
}

// --- UI Server ---

async function launchUI(container: any, describer: any, theme: string, preferredPort: number) {
  const ui = container.feature('ui') as any
  const vm = container.feature('vm') as any
  const networking = container.feature('networking') as any

  const port = await networking.findOpenPort(preferredPort || 7711)

  // Build the navigation index
  const registryNames = container.registryNames as string[]
  const nav: Record<string, string[]> = {}
  for (const reg of registryNames) {
    const registry = container[reg]
    if (registry?.available) {
      nav[reg] = [...registry.available].sort()
    }
  }

  // Create a persistent VM context for the REPL
  const replContext = vm.createContext({
    container,
    console,
    Date, Promise, setTimeout, clearTimeout, setInterval, clearInterval,
    JSON, Math, Array, Object, String, Number, Boolean, RegExp, Map, Set,
    Error, Buffer, process, require,
    fetch: globalThis.fetch,
  })

  // Express server
  const express = (await import('express')).default
  const app = express()
  app.use(express.json())

  // API: describe a target — supports ?format=markdown|json|type
  app.get('/api/describe/*', async (req: any, res: any) => {
    try {
      const target = req.params[0] || ''
      if (!target) {
        return res.json({ nav })
      }
      const format = (req.query.format as string) || 'markdown'
      const describeTarget = target.replace(/\//g, '.')
      const result = await describer.describe([describeTarget], { platform: 'all' })

      if (format === 'json') {
        const jsonStr = JSON.stringify(result.json, null, 2)
        res.json({ markdown: '```json\n' + jsonStr + '\n```', json: result.json, target: describeTarget, format })
      } else if (format === 'type') {
        const typeText = await getTypeText(container, describer, describeTarget)
        res.json({ markdown: '```typescript\n' + typeText + '\n```', json: result.json, target: describeTarget, format })
      } else {
        res.json({ markdown: result.text, json: result.json, target: describeTarget, format })
      }
    } catch (err: any) {
      res.status(400).json({ error: err.message })
    }
  })

  // API: navigation index
  app.get('/api/nav', async (_req: any, res: any) => {
    res.json({ nav })
  })

  // API: eval (REPL) — formats results like luca's displayResult
  const { inspect } = await import('util')
  const BUILTIN_TYPES = new Set(['Object', 'Array', 'Map', 'Set', 'Date', 'RegExp', 'Promise', 'Error', 'Number', 'String', 'Boolean'])

  function formatResult(value: any): string | undefined {
    if (value === undefined) return undefined
    if (typeof value !== 'object' || value === null) return String(value)

    const hasCustomInspect = typeof value[Symbol.for('nodejs.util.inspect.custom')] === 'function'
    const ctorName = value.constructor?.name
    const isClassInstance = ctorName && !BUILTIN_TYPES.has(ctorName)

    if (hasCustomInspect || !isClassInstance) {
      return inspect(value, { colors: true, depth: 4 })
    }

    // Class instances: show clean data (no _ props, no functions)
    const data: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('_') || typeof v === 'function') continue
      data[k] = v
    }
    const body = inspect(data, { colors: true, depth: 3 })
    const lines: string[] = [`${ctorName} ${body}`]

    // Collect methods and getters from own + prototype chain
    const methods: string[] = []
    const getters: string[] = []

    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('_')) continue
      if (typeof v === 'function') methods.push(k)
    }

    let proto = Object.getPrototypeOf(value)
    while (proto && proto !== Object.prototype) {
      for (const k of Object.getOwnPropertyNames(proto)) {
        if (k === 'constructor' || k.startsWith('_')) continue
        const desc = Object.getOwnPropertyDescriptor(proto, k)
        if (!desc) continue
        if (desc.get && !getters.includes(k)) getters.push(k)
        else if (typeof desc.value === 'function' && !methods.includes(k)) methods.push(k)
      }
      proto = Object.getPrototypeOf(proto)
    }

    if (getters.length || methods.length) {
      const parts: string[] = []
      if (getters.length) parts.push(`  \x1b[36mgetters:\x1b[0m ${getters.sort().join(', ')}`)
      if (methods.length) parts.push(`  \x1b[36mmethods:\x1b[0m ${methods.sort().map(m => m + '()').join(', ')}`)
      lines.push(parts.join('\n'))
    }

    return lines.join('\n')
  }

  app.post('/api/eval', async (req: any, res: any) => {
    const { code } = req.body
    const logs: string[] = []
    const captureConsole = {
      log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? inspect(a, { colors: true, depth: 4 }) : String(a)).join(' ')),
      error: (...args: any[]) => logs.push('\x1b[31m' + args.map(a => typeof a === 'object' ? inspect(a, { colors: true, depth: 4 }) : String(a)).join(' ') + '\x1b[0m'),
      warn: (...args: any[]) => logs.push('\x1b[33m' + args.map(a => typeof a === 'object' ? inspect(a, { colors: true, depth: 4 }) : String(a)).join(' ') + '\x1b[0m'),
      info: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? inspect(a, { colors: true, depth: 4 }) : String(a)).join(' ')),
    }

    replContext.console = captureConsole

    try {
      const hasTopLevelAwait = /\bawait\b/.test(code)
      const wrapped = hasTopLevelAwait ? `(async function() { ${code} })()` : code
      const result = await vm.run(wrapped, replContext)
      replContext.console = console
      res.json({
        ok: true,
        output: logs.join('\n'),
        result: formatResult(result),
      })
    } catch (err: any) {
      replContext.console = console
      res.json({
        ok: false,
        output: logs.join('\n'),
        error: err.message || String(err),
      })
    }
  })

  // Serve the HTML UI
  app.get('*', (req: any, res: any) => {
    res.type('html').send(buildHTML(theme, nav))
  })

  const server = app.listen(port, () => {
    const url = `http://localhost:${port}`
    console.log(`Describe UI running at ${ui.colors.cyan(url)} (${theme} theme)`)
    console.log(`Press ${ui.colors.dim('Ctrl+C')} to stop`)
  })

  // Open browser (non-blocking)
  const { spawn } = await import('child_process')
  spawn('open', [`http://localhost:${port}`], { detached: true, stdio: 'ignore' }).unref()

  process.on('SIGINT', () => {
    server.close()
    process.exit(0)
  })

  await new Promise(() => {})
}

function buildHTML(theme: string, nav: Record<string, string[]>): string {
  const isDark = theme === 'dark'
  const bg = isDark ? '#0f0f17' : '#fafafa'
  const surface = isDark ? '#181822' : '#ffffff'
  const surface2 = isDark ? '#1e1e2a' : '#f5f5f5'
  const border = isDark ? '#2a2a3a' : '#e0e0e0'
  const text = isDark ? '#e0e0e8' : '#1a1a2e'
  const textDim = isDark ? '#8a8aa2' : '#666680'
  const textFaint = isDark ? '#56566e' : '#999'
  const accent = isDark ? '#7c6cf0' : '#5b4dc7'
  const accentDim = isDark ? '#7c6cf020' : '#5b4dc710'
  const error = isDark ? '#ff003c' : '#dc2626'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>luca describe</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/themes/${isDark ? 'prism-tomorrow' : 'prism'}.min.css" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg: ${bg};
    --surface: ${surface};
    --surface-2: ${surface2};
    --border: ${border};
    --text: ${text};
    --text-dim: ${textDim};
    --text-faint: ${textFaint};
    --accent: ${accent};
    --accent-dim: ${accentDim};
    --error: ${error};
    --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    --font-mono: 'SF Mono', 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
  }

  body {
    font-family: var(--font-sans);
    background: var(--bg);
    color: var(--text);
    line-height: 1.65;
    font-size: 15px;
    -webkit-font-smoothing: antialiased;
  }

  .layout {
    display: grid;
    grid-template-columns: 260px 1fr;
    min-height: 100vh;
  }

  /* --- Sidebar --- */
  .sidebar {
    background: var(--surface);
    border-right: 1px solid var(--border);
    padding: 24px 0;
    overflow-y: auto;
    position: sticky;
    top: 0;
    height: 100vh;
  }

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 20px;
    margin-bottom: 16px;
  }

  .sidebar-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-faint);
  }

  .repl-toggle-btn {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 5px;
    padding: 3px 10px;
    font-size: 11px;
    font-weight: 600;
    font-family: var(--font-mono);
    cursor: pointer;
    letter-spacing: 0.04em;
    transition: opacity 0.15s;
  }

  .repl-toggle-btn:hover { opacity: 0.85; }

  .nav-group { margin-bottom: 8px; }

  .nav-group-title {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--accent);
    padding: 8px 20px 4px;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .nav-group-title:hover { opacity: 0.8; }

  .nav-group-title .chevron {
    font-size: 10px;
    transition: transform 0.15s ease;
  }

  .nav-group.collapsed .chevron { transform: rotate(-90deg); }
  .nav-group.collapsed .nav-items { display: none; }

  .nav-item {
    display: block;
    padding: 3px 20px 3px 32px;
    font-size: 13px;
    color: var(--text-dim);
    text-decoration: none;
    cursor: pointer;
    transition: background 0.1s, color 0.1s;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .nav-item:hover {
    background: var(--accent-dim);
    color: var(--text);
  }

  .nav-item.active {
    color: var(--accent);
    background: var(--accent-dim);
    font-weight: 500;
  }

  /* --- Main content --- */
  .main {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  /* --- Format toggle bar --- */
  .format-bar {
    display: none;
    align-items: center;
    gap: 4px;
    padding: 12px 56px 0;
    max-width: 860px;
  }

  .format-bar.visible { display: flex; }

  .format-btn {
    padding: 4px 14px;
    font-size: 12px;
    font-weight: 500;
    font-family: var(--font-sans);
    background: none;
    color: var(--text-dim);
    border: 1px solid var(--border);
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.1s, color 0.1s, border-color 0.1s;
  }

  .format-btn:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  .format-btn.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  .content {
    flex: 1;
    max-width: 860px;
    padding: 48px 56px;
  }

  .content h1 {
    font-size: 28px;
    font-weight: 700;
    margin-bottom: 8px;
    letter-spacing: -0.02em;
  }

  .content h2 {
    font-size: 20px;
    font-weight: 600;
    margin-top: 40px;
    margin-bottom: 12px;
    padding-bottom: 6px;
    border-bottom: 1px solid var(--border);
  }

  .content h3 {
    font-size: 16px;
    font-weight: 600;
    margin-top: 28px;
    margin-bottom: 8px;
  }

  .content p { margin-bottom: 12px; }

  .content blockquote {
    border-left: 3px solid var(--accent);
    padding: 8px 16px;
    margin: 12px 0;
    color: var(--text-dim);
    background: var(--surface-2);
    border-radius: 0 6px 6px 0;
    font-size: 14px;
  }

  .content code {
    font-family: var(--font-mono);
    font-size: 13px;
    background: var(--surface-2);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .content pre {
    background: var(--surface-2) !important;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 20px;
    overflow-x: auto;
    margin: 12px 0;
    font-size: 13px;
    line-height: 1.5;
  }

  .content pre code {
    background: none;
    padding: 0;
  }

  .content table {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
    font-size: 14px;
  }

  .content th {
    text-align: left;
    font-weight: 600;
    padding: 8px 12px;
    border-bottom: 2px solid var(--border);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-faint);
  }

  .content td {
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }

  .content ul, .content ol {
    margin: 8px 0 8px 24px;
  }

  .content li { margin-bottom: 4px; }
  .content strong { font-weight: 600; }

  .content hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 32px 0;
  }

  /* --- Loading --- */
  .loading {
    color: var(--text-faint);
    padding: 48px;
    font-style: italic;
  }

  /* --- Welcome --- */
  .welcome h1 { font-size: 32px; margin-bottom: 16px; }
  .welcome p { color: var(--text-dim); font-size: 16px; line-height: 1.7; margin-bottom: 20px; }
  .welcome .hint {
    display: inline-block;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 2px 10px;
    font-family: var(--font-mono);
    font-size: 13px;
    color: var(--accent);
  }
  .welcome kbd {
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 1px 6px;
    font-family: var(--font-mono);
    font-size: 12px;
  }

  /* --- REPL Drawer (slides from left) --- */
  .repl-overlay {
    display: none;
    position: fixed;
    inset: 0;
    background: ${isDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.2)'};
    backdrop-filter: blur(2px);
    z-index: 200;
    transition: opacity 0.25s ease;
    opacity: 0;
  }

  .repl-overlay.open {
    display: block;
    opacity: 1;
  }

  .repl-drawer {
    position: fixed;
    top: 0;
    left: -52vw;
    width: 52vw;
    min-width: 440px;
    max-width: 800px;
    height: 100vh;
    background: ${isDark ? 'rgba(18, 18, 28, 0.97)' : 'rgba(255, 255, 255, 0.97)'};
    border-right: 1px solid var(--border);
    z-index: 201;
    display: flex;
    flex-direction: column;
    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: ${isDark ? '8px 0 40px rgba(0,0,0,0.5)' : '8px 0 40px rgba(0,0,0,0.12)'};
  }

  .repl-drawer.open {
    left: 0;
  }

  .repl-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .repl-drawer-title {
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-faint);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .repl-drawer-title .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: ${isDark ? '#39ff14' : '#16a34a'};
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 1; }
  }

  .repl-close {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-dim);
    width: 28px;
    height: 28px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.1s, color 0.1s;
  }

  .repl-close:hover {
    background: var(--surface-2);
    color: var(--text);
  }

  /* REPL history */
  .repl-history {
    flex: 1;
    overflow-y: auto;
    padding: 16px 24px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .repl-entry {
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
  }

  .repl-entry .repl-prompt-line {
    color: var(--accent);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .repl-entry .repl-output-text {
    color: var(--text);
    white-space: pre-wrap;
    word-break: break-all;
    padding-left: 2px;
  }

  .repl-entry .repl-result-text {
    color: var(--text);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .repl-entry .repl-error-text {
    color: var(--error);
    white-space: pre-wrap;
    word-break: break-all;
  }

  .repl-entry .repl-running {
    color: var(--text-faint);
    font-style: italic;
  }

  /* REPL input area */
  .repl-input-area {
    padding: 12px 24px 20px;
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .repl-prompt-symbol {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--accent);
    line-height: 1.5;
    padding-top: 8px;
    user-select: none;
    flex-shrink: 0;
  }

  .repl-input {
    flex: 1;
    font-family: var(--font-mono);
    font-size: 13px;
    line-height: 1.5;
    background: var(--surface-2);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 8px 12px;
    outline: none;
    resize: none;
    overflow: hidden;
    min-height: 36px;
    field-sizing: content;
  }

  .repl-input:focus {
    border-color: var(--accent);
  }

  .repl-input-hint {
    font-size: 11px;
    color: var(--text-faint);
    padding-top: 4px;
    text-align: right;
  }

  @media (max-width: 900px) {
    .layout { grid-template-columns: 1fr; }
    .sidebar { display: none; }
    .content { padding: 24px; }
    .repl-drawer { width: 90vw; left: -90vw; min-width: unset; }
  }
</style>
</head>
<body>
<div class="layout">
  <nav class="sidebar">
    <div class="sidebar-header">
      <div class="sidebar-title">luca describe</div>
      <button class="repl-toggle-btn" onclick="toggleRepl()">REPL</button>
    </div>
    <div id="nav"></div>
  </nav>
  <div class="main">
    <div class="format-bar" id="format-bar">
      <button class="format-btn active" data-format="markdown" onclick="setFormat('markdown')">Docs</button>
      <button class="format-btn" data-format="type" onclick="setFormat('type')">Type</button>
      <button class="format-btn" data-format="json" onclick="setFormat('json')">JSON</button>
    </div>
    <div class="content" id="content">
      <div class="welcome">
        <h1>luca describe</h1>
        <p>Interactive documentation and REPL for the Luca container.<br/>Select a registry or helper from the sidebar to get started.</p>
        <p><span class="hint">REPL</span> &mdash; click the button in the sidebar, or press <kbd>\`</kbd></p>
      </div>
    </div>
  </div>
</div>

<!-- REPL Drawer Overlay -->
<div class="repl-overlay" id="repl-overlay" onclick="toggleRepl()"></div>
<div class="repl-drawer" id="repl-drawer">
  <div class="repl-drawer-header">
    <div class="repl-drawer-title"><span class="dot"></span> REPL</div>
    <button class="repl-close" onclick="toggleRepl()">&times;</button>
  </div>
  <div class="repl-history" id="repl-history">
    <div class="repl-entry">
      <div class="repl-output-text" style="color:var(--text-faint); font-style:italic; padding: 4px 0;">container is available. Enter runs, Shift+Enter for newline.</div>
    </div>
  </div>
  <div class="repl-input-area">
    <div class="repl-prompt-symbol">&gt;</div>
    <div style="flex:1; display:flex; flex-direction:column;">
      <textarea class="repl-input" id="repl-input" rows="1" spellcheck="false" placeholder="container.feature('fs')"></textarea>
      <div class="repl-input-hint">Enter to run &middot; Shift+Enter for newline &middot; &uarr;/&darr; history</div>
    </div>
  </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/marked@12/marked.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/prism.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-typescript.min.js"><\/script>
<script src="https://cdn.jsdelivr.net/npm/prismjs@1.29.0/components/prism-bash.min.js"><\/script>
<script>
const NAV = ${JSON.stringify(nav)};
let currentTarget = null;
let currentFormat = 'markdown';
let replOpen = false;
const replHistory = [];
let historyIndex = -1;

// --- REPL Drawer ---

function toggleRepl() {
  replOpen = !replOpen;
  document.getElementById('repl-overlay').classList.toggle('open', replOpen);
  document.getElementById('repl-drawer').classList.toggle('open', replOpen);
  if (replOpen) {
    setTimeout(() => document.getElementById('repl-input').focus(), 300);
  }
}

// Keyboard shortcut: backtick to toggle repl
document.addEventListener('keydown', (e) => {
  if (e.key === '\`' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    const tag = document.activeElement?.tagName;
    if (tag === 'TEXTAREA' || tag === 'INPUT') {
      // Only handle if not in the repl input itself
      if (document.activeElement.id !== 'repl-input') return;
      // If repl input is empty and focused, close it
      if (document.getElementById('repl-input').value === '') {
        e.preventDefault();
        toggleRepl();
        return;
      }
      return; // Let backtick type normally
    }
    e.preventDefault();
    toggleRepl();
  }
  // Escape to close
  if (e.key === 'Escape' && replOpen) {
    toggleRepl();
  }
});

// Auto-resize textarea
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

document.getElementById('repl-input').addEventListener('input', function() {
  autoResize(this);
});

// REPL input handler
document.getElementById('repl-input').addEventListener('keydown', (e) => {
  const input = e.target;

  // Enter without shift = run
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    const code = input.value.trim();
    if (!code) return;
    runReplLine(code);
    replHistory.push(code);
    historyIndex = replHistory.length;
    input.value = '';
    autoResize(input);
    return;
  }

  // Up arrow for history (only when cursor is at start)
  if (e.key === 'ArrowUp' && input.selectionStart === 0) {
    e.preventDefault();
    if (historyIndex > 0) {
      historyIndex--;
      input.value = replHistory[historyIndex];
      autoResize(input);
    }
    return;
  }

  // Down arrow for history (only when cursor is at end)
  if (e.key === 'ArrowDown' && input.selectionStart === input.value.length) {
    e.preventDefault();
    if (historyIndex < replHistory.length - 1) {
      historyIndex++;
      input.value = replHistory[historyIndex];
    } else {
      historyIndex = replHistory.length;
      input.value = '';
    }
    autoResize(input);
    return;
  }

  // Tab for indent
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = input.selectionStart;
    const end = input.selectionEnd;
    input.value = input.value.substring(0, start) + '  ' + input.value.substring(end);
    input.selectionStart = input.selectionEnd = start + 2;
  }
});

async function runReplLine(code) {
  const historyEl = document.getElementById('repl-history');

  // Show the prompt + code
  const entry = document.createElement('div');
  entry.className = 'repl-entry';

  const promptLine = document.createElement('div');
  promptLine.className = 'repl-prompt-line';
  promptLine.textContent = '> ' + code;
  entry.appendChild(promptLine);

  const runningEl = document.createElement('div');
  runningEl.className = 'repl-running';
  runningEl.textContent = '...';
  entry.appendChild(runningEl);

  historyEl.appendChild(entry);
  historyEl.scrollTop = historyEl.scrollHeight;

  try {
    const res = await fetch('/api/eval', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();

    // Remove running indicator
    entry.removeChild(runningEl);

    if (data.output) {
      const outputEl = document.createElement('div');
      outputEl.className = 'repl-output-text';
      outputEl.innerHTML = ansiToHtml(data.output);
      entry.appendChild(outputEl);
    }
    if (data.result !== undefined) {
      const resultEl = document.createElement('div');
      resultEl.className = 'repl-result-text';
      resultEl.innerHTML = ansiToHtml(data.result);
      entry.appendChild(resultEl);
    }
    if (data.error) {
      const errorEl = document.createElement('div');
      errorEl.className = 'repl-error-text';
      errorEl.innerHTML = ansiToHtml(data.error);
      entry.appendChild(errorEl);
    }
    if (!data.output && data.result === undefined && !data.error) {
      const emptyEl = document.createElement('div');
      emptyEl.className = 'repl-output-text';
      emptyEl.style.color = 'var(--text-faint)';
      emptyEl.textContent = 'undefined';
      entry.appendChild(emptyEl);
    }
  } catch (err) {
    entry.removeChild(runningEl);
    const errorEl = document.createElement('div');
    errorEl.className = 'repl-error-text';
    errorEl.textContent = err.message;
    entry.appendChild(errorEl);
  }

  historyEl.scrollTop = historyEl.scrollHeight;
}

// --- Navigation ---

function buildNav() {
  const navEl = document.getElementById('nav');
  let html = '';

  html += '<div class="nav-item" onclick="navigate(\\'container\\')">container</div>';

  for (const [registry, helpers] of Object.entries(NAV)) {
    html += '<div class="nav-group">';
    html += '<div class="nav-group-title" onclick="toggleGroup(this)"><span class="chevron">\\u25BC</span> ' + registry + ' <span style="color:var(--text-faint);font-size:11px;font-weight:400">(' + helpers.length + ')</span></div>';
    html += '<div class="nav-items">';
    for (const h of helpers) {
      html += '<div class="nav-item" data-target="' + registry + '/' + h + '" onclick="navigate(\\'' + registry + '.' + h + '\\')">' + h + '</div>';
    }
    html += '</div></div>';
  }

  navEl.innerHTML = html;
}

function toggleGroup(el) {
  el.parentElement.classList.toggle('collapsed');
}

function setFormat(fmt) {
  currentFormat = fmt;
  document.querySelectorAll('.format-btn').forEach(el => {
    el.classList.toggle('active', el.dataset.format === fmt);
  });
  if (currentTarget) navigate(currentTarget);
}

async function navigate(target) {
  currentTarget = target;

  // Show format bar when viewing a specific target
  document.getElementById('format-bar').classList.add('visible');

  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const navTarget = target.replace('.', '/');
  const activeEl = document.querySelector('.nav-item[data-target="' + navTarget + '"]');
  if (activeEl) activeEl.classList.add('active');

  const contentEl = document.getElementById('content');
  contentEl.innerHTML = '<div class="loading">Loading...</div>';

  try {
    const res = await fetch('/api/describe/' + target.replace(/\\./g, '/') + '?format=' + currentFormat);
    const data = await res.json();

    if (data.error) {
      contentEl.innerHTML = '<div style="color:var(--error);padding:48px">' + escapeHtml(data.error) + '</div>';
      return;
    }

    const html = marked.parse(data.markdown, { gfm: true, breaks: false });
    contentEl.innerHTML = html;

    contentEl.querySelectorAll('pre code').forEach(block => {
      Prism.highlightElement(block);
    });

    history.pushState(null, '', '/' + navTarget);
  } catch (err) {
    contentEl.innerHTML = '<div style="color:var(--error);padding:48px">Error: ' + escapeHtml(err.message) + '</div>';
  }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Convert ANSI escape codes to styled HTML spans.
// ANSI escapes arrive as real \\x1b chars in the JSON string.
// We must extract them BEFORE HTML-escaping the surrounding text.
function ansiToHtml(str) {
  const COLORS = {
    '30': '#666', '31': 'var(--error)', '32': '#16a34a', '33': '#ca8a04',
    '34': '#3b82f6', '35': '#a855f7', '36': '#06b6d4', '37': 'var(--text)',
    '90': 'var(--text-faint)', '91': '#ff6b6b', '92': '#4ade80', '93': '#fbbf24',
    '94': '#60a5fa', '95': '#c084fc', '96': '#22d3ee', '97': '#fff',
  };
  // Split on ANSI escape sequences, escaping text segments individually
  // Match: ESC[ followed by semicolon-separated numbers, ending with m
  const parts = str.split(/(\\x1b\\[\\d+(?:;\\d+)*m)/);
  let html = '';
  for (const part of parts) {
    const m = part.match(/^\\x1b\\[([\\d;]+)m$/);
    if (m) {
      const codes = m[1].split(';');
      for (const code of codes) {
        if (code === '0' || code === '39') { html += '</span>'; continue; }
        const color = COLORS[code];
        if (color) { html += '<span style="color:' + color + '">'; continue; }
        if (code === '1') { html += '<span style="font-weight:600">'; continue; }
        if (code === '2') { html += '<span style="opacity:0.6">'; continue; }
        if (code === '3') { html += '<span style="font-style:italic">'; continue; }
        if (code === '4') { html += '<span style="text-decoration:underline">'; continue; }
      }
    } else {
      html += escapeHtml(part);
    }
  }
  return html;
}

window.addEventListener('popstate', () => {
  const path = window.location.pathname.replace(/^\\//, '');
  if (path) {
    navigate(path.replace(/\\//g, '.'));
  }
});

const initialPath = window.location.pathname.replace(/^\\//, '');
if (initialPath && initialPath !== '/') {
  navigate(initialPath.replace(/\\//g, '.'));
}

buildNav();
<\/script>
</body>
</html>`
}
