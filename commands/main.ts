import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'
import { startCommsService } from './comms-service'
import { startTaskScheduler } from './task-scheduler'

export const argsSchema = CommandOptionsSchema.extend({
  port: z.number().default(0).describe('WebSocket port (0 = auto-allocate from instance registry)'),
  watchInterval: z.number().default(60_000).describe('Ms between project builder polls'),
  docsPath: z.string().default('./docs').describe('Path to the docs folder'),
  dryRun: z.boolean().default(false).describe('Show what would start without actually starting'),
  stop: z.boolean().default(false).describe('Pause all subsystems (process stays alive for launchctl)'),
  pause: z.boolean().default(false).describe('Pause all subsystems (process stays alive for launchctl)'),
  unpause: z.boolean().default(false).describe('Resume all paused subsystems'),
  kill: z.boolean().default(false).describe('Fully shutdown the running main process and exit'),
  console: z.boolean().default(false).describe('Connect to running main process with a remote eval console'),
  voiceService: z.boolean().default(true).describe('Enable voice service (use --no-voice-service to disable)'),
  contentService: z.boolean().default(true).describe('Enable content service / cnotes serve (use --no-content-service to disable)'),
  commsService: z.boolean().default(true).describe('Enable communications service (use --no-comms-service to disable)'),
  taskScheduler: z.boolean().default(true).describe('Enable task scheduler (use --no-task-scheduler to disable)'),
})

type MainOptions = z.infer<typeof argsSchema>

/**
 * Merge config.yml values into options. CLI flags win over config.yml, config.yml wins over defaults.
 * We detect explicit CLI flags by scanning process.argv for --flagName patterns.
 */
function applyConfigToOptions(options: MainOptions, config: Record<string, any>): MainOptions {
  const argv = process.argv.join(' ')

  function wasExplicit(flag: string): boolean {
    // Check for --flag-name (kebab) and --flagName (camel) forms
    const kebab = flag.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)
    return argv.includes(`--${flag}`) || argv.includes(`--${kebab}`) || argv.includes(`--no-${flag}`) || argv.includes(`--no-${kebab}`)
  }

  const main = config.main || {}
  const builder = config.builder || {}
  const services = config.services || {}

  // main section
  if (main.docsPath != null && !wasExplicit('docsPath')) options.docsPath = main.docsPath

  // builder section
  if (builder.watchInterval != null && !wasExplicit('watchInterval')) options.watchInterval = builder.watchInterval

  // services section (enable/disable)
  if (services.voice != null && !wasExplicit('voiceService')) options.voiceService = services.voice
  if (services.content != null && !wasExplicit('contentService')) options.contentService = services.content
  if (services.comms != null && !wasExplicit('commsService')) options.commsService = services.comms
  if (services.taskScheduler != null && !wasExplicit('taskScheduler')) options.taskScheduler = services.taskScheduler

  return options
}

async function main(options: MainOptions, context: ContainerContext) {
  const { container } = context as any

  const networking = container.feature('networking')
  const proc = container.feature('proc')
  const ui = container.feature('ui')

  // --- Instance registry: check for existing authority ---
  await container.helpers.discover('features')
  const registry = container.feature('instanceRegistry')
  registry.pruneStale()

  const existing = registry.getSelf()
  const authorityRunning = existing && !(await networking.isPortOpen(existing.ports.authority))

  // Resolve port for client commands — use existing registry entry or explicit flag
  const resolvedPort = authorityRunning ? existing!.ports.authority : options.port

  if (options.kill) {
    if (!authorityRunning) {
      ui.print.yellow('No luca main process detected.')
      return
    }
    return await sendCommand(container, resolvedPort, 'shutdown')
  }

  if (options.stop || options.pause) {
    if (!authorityRunning) {
      ui.print.yellow('No luca main process detected.')
      return
    }
    return await sendCommand(container, resolvedPort, 'pause-all')
  }

  if (options.unpause) {
    if (!authorityRunning) {
      ui.print.yellow('No luca main process detected.')
      return
    }
    return await sendCommand(container, resolvedPort, 'resume-all')
  }

  if (options.console) {
    if (!authorityRunning) {
      ui.print.yellow('No luca main process detected. Start one with: luca main')
      return
    }
    options.port = resolvedPort
    return await runConsole(container, options, ui)
  }

  if (authorityRunning) {
    // 2nd instance: connect as client and show live TUI
    options.port = resolvedPort
    return await runClient(container, options, ui)
  }

  // --- 1st instance: become the authority ---
  // Allocate ports from registry (avoids collisions with other instances)
  const ports = await registry.allocatePorts()
  options.port = ports.authority
  ;(options as any)._registryPorts = ports

  return await runAuthority(container, options, ui, proc)
}

function timeSince(ts: number): string {
  const diff = Date.now() - ts
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ${mins % 60}m ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ${hrs % 24}h ago`
}

// ─── Authority Mode ───────────────────────────────────────────────────────────

async function runAuthority(container: any, options: MainOptions, ui: any, proc: any) {
  proc.establishLock('tmp/luca-main.pid')

  const fs = container.feature('fs')
  fs.ensureFolder(container.paths.resolve('logs'))
  fs.ensureFolder(container.paths.resolve('logs/prompt-outputs'))

  // --- Load config.yml and merge into options (CLI flags still win) ---
  const yaml = container.feature('yaml')
  const configPath = container.paths.resolve('config.yml')
  let projectConfig: Record<string, any> = {}

  if (fs.exists(configPath)) {
    try {
      projectConfig = yaml.parse(fs.readFileSync(configPath, 'utf-8').toString('utf-8')) || {}
    } catch (err: any) {
      console.warn(`Warning: failed to parse config.yml: ${err?.message || err}`)
    }
  }

  applyConfigToOptions(options, projectConfig)

  // Features already discovered in main() for registry access
  await container.docs.load()

  // --- Register this instance in the shared registry ---
  const registry = container.feature('instanceRegistry')
  const ports = (options as any)._registryPorts
  const instanceEntry = registry.register(ports)

  // --- Subscribers map (declared early so broadcastLog can reference it) ---
  const subscribers = new Map<any, Set<string>>()

  // --- Log stream: collect and broadcast log lines ---
  const logEntries: Array<{ ts: number; source: string; text: string }> = []
  const MAX_LOGS = 200

  const log = (source: string, ...args: any[]) => {
    const ts = new Date().toISOString().slice(11, 19)
    console.log(`${ui.colors.gray(ts)} ${ui.assignColor(source)(`[${source}]`)}`, ...args)
    const text = args.map((a: any) => typeof a === 'string' ? a : JSON.stringify(a)).join(' ')
    const entry = { ts: Date.now(), source, text }
    logEntries.push(entry)
    if (logEntries.length > MAX_LOGS) logEntries.shift()
    broadcastLog(entry)
  }

  function broadcastLog(entry: { ts: number; source: string; text: string }) {
    const msg = JSON.stringify({ type: 'log', ...entry })
    for (const [ws] of subscribers) {
      try { ws.send(msg) } catch {}
    }
  }

  // --- Git status tracker ---
  const git = container.feature('git')
  let gitSummary: { branch: string | null; modified: string[]; untracked: string[]; deleted: string[]; summary: Record<string, { added: number; modified: number; deleted: number }>; recentCommits: string[] } = {
    branch: null, modified: [], untracked: [], deleted: [], summary: {}, recentCommits: []
  }

  async function refreshGitStatus() {
    try {
      const modified = await git.lsFiles({ modified: true })
      const untracked = await git.lsFiles({ others: true, exclude: ['node_modules', '.git', 'dist', 'tmp'] })
      const deleted = await git.lsFiles({ deleted: true })

      // Group by top-level folder for summary
      const summary: Record<string, { added: number; modified: number; deleted: number }> = {}
      for (const f of untracked) {
        const dir = f.includes('/') ? f.split('/')[0] : '.'
        if (!summary[dir]) summary[dir] = { added: 0, modified: 0, deleted: 0 }
        summary[dir].added++
      }
      for (const f of modified) {
        const dir = f.includes('/') ? f.split('/')[0] : '.'
        if (!summary[dir]) summary[dir] = { added: 0, modified: 0, deleted: 0 }
        summary[dir].modified++
      }
      for (const f of deleted) {
        const dir = f.includes('/') ? f.split('/')[0] : '.'
        if (!summary[dir]) summary[dir] = { added: 0, modified: 0, deleted: 0 }
        summary[dir].deleted++
      }

      const recentCommits = (await git.getLatestChanges(3)).map((c: any) => c.title)
      gitSummary = { branch: git.branch, modified, untracked, deleted, summary, recentCommits }
    } catch {}
  }

  await refreshGitStatus()
  // Refresh git status every 30 seconds
  const gitRefreshTimer = setInterval(refreshGitStatus, 30_000)

  // --- Dry run: just list what would start ---
  if (options.dryRun) {
    log('main', 'Dry run mode — showing configuration')
    log('main', `WebSocket port: ${options.port}`)
    log('main', `Watch interval: ${options.watchInterval}ms`)
    log('main', `Docs path: ${options.docsPath}`)
    return
  }

  // --- State aggregator: collect all events ---
  const events: Array<{ ts: number; source: string; event: string; data: any }> = []
  const MAX_EVENTS = 500

  function recordEvent(source: string, event: string, data?: any) {
    events.push({ ts: Date.now(), source, event, data })
    if (events.length > MAX_EVENTS) events.shift()
    broadcastEvent(source, event, data)
  }

  // --- WebSocket server ---
  const wss = container.server('websocket', { port: options.port })
  await wss.start({ port: options.port })
  log('main', `WebSocket listening on port ${options.port}`)

  function broadcastEvent(source: string, event: string, data?: any) {
    const msg = JSON.stringify({ type: 'event', source, event, data, ts: Date.now() })
    for (const [ws, patterns] of subscribers) {
      if (matchesPatterns(patterns, `${source}:${event}`)) {
        try { ws.send(msg) } catch {}
      }
    }
  }

  function matchesPatterns(patterns: Set<string>, eventKey: string): boolean {
    if (patterns.has('*')) return true
    for (const p of patterns) {
      if (p === eventKey) return true
      if (p.endsWith(':*') && eventKey.startsWith(p.slice(0, -1))) return true
      if (p.endsWith('*') && eventKey.startsWith(p.slice(0, -1))) return true
    }
    return false
  }

  let contentCounts: Record<string, number> = {}

  async function refreshContentCounts() {
    try {
      const docs = container.docs
      if (!docs?.isLoaded) {
        log('main', 'content: docs not loaded yet')
        return
      }
      const counts: Record<string, number> = {}
      for (const [name, model] of Object.entries(docs.models)) {
        if (name === 'Base') continue
        try {
          const all = await docs.query(model).fetchAll()
          counts[name] = all.length
        } catch (err: any) {
          log('main', `content count error for ${name}: ${err?.message || err}`)
          counts[name] = 0
        }
      }
      contentCounts = counts
    } catch (err: any) {
      log('main', `content counts error: ${err?.message || err}`)
    }
  }

  await refreshContentCounts()
  log('main', `content models: ${Object.entries(contentCounts).map(([k, v]) => `${k}:${v}`).join(', ') || 'none'}`)

  // --- Global pause state ---
  let paused = false

  function pauseAll() {
    if (paused) return
    paused = true
    log('main', 'Pausing all subsystems...')
    builder.stopWatcher()
    if (voiceService) voiceService.stop().catch(() => {})
    if (contentServiceProcess) {
      try { contentServiceProcess.kill('SIGTERM') } catch {}
      contentServiceProcess = null
    }
    if (commsService) commsService.pause()
    if (taskSchedulerService) { taskSchedulerService.stop(); taskSchedulerService = null }
    log('main', 'All subsystems paused. Process alive, WebSocket still listening.')
    recordEvent('main', 'paused')
  }

  async function resumeAll() {
    if (!paused) return
    paused = false
    log('main', 'Resuming all subsystems...')
    await builder.startWatcher()
    if (voiceService) {
      try { await voiceService.start() } catch (err: any) {
        log('voice', `failed to resume: ${err?.message || err}`)
      }
    }
    if (options.contentService && !contentServiceProcess) {
      try {
        const docsPath = container.paths.resolve(options.docsPath)
        contentServiceProcess = proc.spawn('cnotes', ['serve', docsPath, '--port', String(contentServicePort), '--refresh-interval', '20'], {
          cwd: container.paths.cwd,
          stdout: 'pipe',
          stderr: 'pipe',
        })
        contentServiceProcess.stdout?.on('data', (chunk: Buffer) => {
          const line = chunk.toString().trim()
          if (line) log('contentService', line)
        })
        contentServiceProcess.stderr?.on('data', (chunk: Buffer) => {
          const line = chunk.toString().trim()
          if (line) log('contentService', line)
        })
        contentServiceProcess.on('exit', (code: number | null) => {
          log('contentService', `exited with code ${code}`)
          contentServiceProcess = null
        })
        log('contentService', `resumed on port ${contentServicePort}`)
      } catch (err: any) {
        log('contentService', `failed to resume: ${err?.message || err}`)
      }
    }
    if (commsService) commsService.unpause()
    if (options.taskScheduler && !taskSchedulerService) {
      try {
        const schedulerConfig = projectConfig.scheduler || {}
        taskSchedulerService = await startTaskScheduler(container, {
          interval: schedulerConfig.taskInterval || 15,
          concurrencyOneOff: schedulerConfig.concurrencyOneOff || 2,
          concurrencyScheduled: schedulerConfig.concurrencyScheduled || 2,
        }, { log: (source, msg) => log(source, msg), recordEvent })
      } catch (err: any) {
        log('scheduler', `failed to resume: ${err?.message || err}`)
      }
    }
    log('main', 'All subsystems resumed.')
    recordEvent('main', 'resumed')
  }

  function getStatusSnapshot() {
    return {
      pid: process.pid,
      uptime: process.uptime(),
      paused,
      builder: {
        watching: builder.state.get('watching'),
        buildsInProgress: builder.buildsInProgress,
      },
      voice: voiceService ? {
        running: voiceService.state.get('running'),
        assistantCount: voiceService.state.get('assistantCount'),
        socketPath: voiceService.state.get('socketPath'),
        clientConnected: voiceService.state.get('clientConnected'),
      } : { running: false, disabled: true },
      windowManager: windowManager ? {
        listening: windowManager.isListening,
        clientConnected: windowManager.isClientConnected,
        socketPath: windowManager.state.get('socketPath'),
        windowCount: windowManager.state.get('windowCount'),
      } : { listening: false, disabled: true },
      workflowService: workflowService ? {
        listening: workflowService.state.get('listening'),
        port: workflowService.state.get('port'),
        workflowCount: workflowService.state.get('workflowCount'),
      } : { listening: false, disabled: true },
      contentService: contentServiceProcess ? {
        running: true,
        port: contentServicePort,
        pid: contentServiceProcess.pid,
      } : { running: false, disabled: !options.contentService },
      comms: commsService ? {
        started: commsService.isStarted,
        paused: commsService.isPaused,
        channels: commsService.activeChannels,
      } : { started: false, disabled: true },
      scheduler: taskSchedulerService ? {
        running: true,
        taskCount: taskSchedulerService.scheduler?.tasks?.length || 0,
      } : { running: false, disabled: !options.taskScheduler },
      instance: {
        id: instanceEntry.id,
        cwd: instanceEntry.cwd,
        ports: instanceEntry.ports,
      },
      git: gitSummary,
      content: contentCounts,
      recentEvents: events.slice(-50),
      recentLogs: logEntries.slice(-100),
    }
  }

  wss.on('connection', (ws: any) => {
    // Default: subscribe to all events
    subscribers.set(ws, new Set(['*']))

    // Send initial state snapshot
    try {
      ws.send(JSON.stringify({ type: 'state', data: getStatusSnapshot() }))
    } catch {}

    ws.on('close', () => subscribers.delete(ws))
  })

  wss.on('message', (raw: any, ws: any) => {
    try {
      const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString())

      if (msg.type === 'subscribe') {
        subscribers.set(ws, new Set(msg.payload?.events || ['*']))
        return
      }

      if (msg.type === 'query') {
        const response = { type: 'response', id: msg.id, data: getStatusSnapshot() }
        ws.send(JSON.stringify(response))
        return
      }

      if (msg.type === 'command') {
        handleCommand(msg.payload, ws)
        return
      }
    } catch {}
  })

  // --- Remote eval context (persists across calls for console sessions) ---
  const evalSessions = new Map<any, any>() // ws -> vm context

  function getEvalContext(ws: any) {
    if (evalSessions.has(ws)) return evalSessions.get(ws)
    const vm = container.feature('vm')
    const ctx = vm.createContext({
      container,
      builder,
      voiceService,
      windowManager,
      commsService,
      taskSchedulerService,
      log,
      events,
      getStatusSnapshot,
      console,
      setTimeout,
      setInterval,
      clearTimeout,
      clearInterval,
      fetch,
    })
    evalSessions.set(ws, ctx)
    return ctx
  }

  function handleCommand(payload: any, ws: any) {
    const { action, subsystem } = payload || {}
    const respond = (data: any) => {
      try { ws.send(JSON.stringify({ type: 'response', id: payload?.id, data })) } catch {}
    }

    switch (action) {
      case 'shutdown':
        respond({ ok: true })
        shutdown('command')
        break
      case 'status':
        respond(getStatusSnapshot())
        break
      case 'pause':
        break
      case 'resume':
        break
      case 'pause-all':
        pauseAll()
        respond({ ok: true, paused: true })
        break
      case 'resume-all':
        resumeAll()
        respond({ ok: true, paused: false })
        break
      case 'voice-route':
        handleVoiceRoute(payload, respond)
        break
      case 'voice-cancel':
        if (voiceService) {
          voiceService.cancelInteraction()
          log('voice', 'cancelled by overlay')
          respond({ ok: true })
        } else {
          respond({ error: 'voice service not running' })
        }
        break
      case 'assistant-picker-select':
        if (voiceService) {
          voiceService.handlePickerSelect(payload.assistant)
          log('voice', `picker selected: ${payload.assistant}`)
          respond({ ok: true })
        } else {
          respond({ error: 'voice service not running' })
        }
        break
      case 'assistant-picker-cancel':
        if (voiceService) {
          voiceService.handlePickerCancel()
          log('voice', 'picker cancelled')
          respond({ ok: true })
        } else {
          respond({ error: 'voice service not running' })
        }
        break
      case 'eval':
        handleEval(payload, ws, respond)
        break
      default:
        respond({ error: `unknown action: ${action}` })
    }
  }

  async function handleVoiceRoute(payload: any, respond: (data: any) => void) {
    if (!voiceService) {
      respond({ error: 'voice service not running' })
      return
    }

    const { text, target } = payload || {}
    if (!text) {
      respond({ error: 'missing text' })
      return
    }

    log('voice', `yo relay: "${text}" (target: ${target || 'default'})`)

    try {
      // Simulate a wake word trigger to route through the alias map
      const wakeword = target || 'default'
      await voiceService.handleTriggerWord(wakeword)
      respond({ ok: true, source: target || 'voice-service' })
    } catch (err: any) {
      respond({ error: err?.message || String(err) })
    }
  }

  async function handleEval(payload: any, ws: any, respond: (data: any) => void) {
    const { code } = payload
    if (!code) return respond({ error: 'no code provided' })

    const vm = container.feature('vm')
    const ctx = getEvalContext(ws)
    const { inspect } = await import('util')

    try {
      let result = await vm.run(code, ctx)
      ctx._ = result
      const output = inspect(result, { depth: 4, colors: true, maxArrayLength: 50 })
      respond({ output })
    } catch (err: any) {
      respond({ error: err.message || String(err) })
    }
  }

  // Clean up eval sessions when clients disconnect
  wss.on('connection', (ws: any) => {
    ws.on('close', () => evalSessions.delete(ws))
  })

  // --- Start subsystems ---

  // 1. Project Builder (watcher mode)
  const builder = container.feature('projectBuilder', {
    docsPath: options.docsPath,
    watchInterval: options.watchInterval,
  })

  // Start IPC server so external clients (e.g. project-builder workflow) can tap into live builds
  await builder.startServer()
  log('builder', 'IPC server listening')

  builder.on('watcher:building', (d: any) => {
    log('builder', `building: ${d.slug}`)
    recordEvent('builder', 'building', d)
  })
  builder.on('watcher:build:start', (d: any) => {
    log('builder', `${d.slug}: ${d.pendingPlans} pending plan(s)`)
    recordEvent('builder', 'build:start', d)
  })
  builder.on('watcher:plan:start', (d: any) => {
    log('builder', `${d.slug}: plan started`)
    recordEvent('builder', 'plan:start', d)
  })
  builder.on('watcher:plan:delta', (d: any) => {
    const preview = (d.text || '').slice(0, 120).replace(/\n/g, ' ')
    log('builder', `${d.slug}: ${preview}`)
  })
  builder.on('watcher:plan:complete', (d: any) => {
    const cost = d.costUsd != null ? `$${d.costUsd.toFixed(4)}` : ''
    log('builder', `${d.slug}: plan done ${cost}`)
    recordEvent('builder', 'plan:complete', d)
  })
  builder.on('watcher:plan:error', (d: any) => {
    log('builder', `${d.slug}: plan FAILED: ${d.error || 'unknown'}`)
    recordEvent('builder', 'plan:error', d)
  })
  builder.on('watcher:build:complete', (d: any) => {
    const cost = d.totalCost != null ? `$${d.totalCost.toFixed(4)}` : ''
    log('builder', `${d.slug}: build complete ${cost}`)
    recordEvent('builder', 'build:complete', d)
  })
  builder.on('watcher:build:error', (d: any) => {
    log('builder', `${d.slug}: build FAILED: ${d.error || 'unknown'}`)
    recordEvent('builder', 'build:error', d)
  })
  builder.on('watcher:build:skipped', (d: any) => {
    log('builder', `${d.slug}: skipped (${d.reason})`)
  })

  await builder.startWatcher()
  log('builder', `watcher running (interval: ${options.watchInterval}ms)`)

  // 3. Voice Service
  let voiceService: any = null

  if (options.voiceService) {
    try {
      const { startVoiceService } = await import('./voice')
      voiceService = await startVoiceService(container, { log, recordEvent })
      voiceService.getStatusSnapshot = getStatusSnapshot
    } catch (err: any) {
      log('voice', `failed to start: ${err?.message || err}`)
    }
  } else {
    log('voice', 'disabled via --no-voice-service')
  }

  // 4. Window Manager
  let windowManager: any = null

  try {
    windowManager = container.feature('windowManager')
    await windowManager.listen()

    windowManager.on('clientDisconnected', () => {
      log('windowManager', 'native app disconnected')
      recordEvent('windowManager', 'clientDisconnected')
    })
    windowManager.on('error', (err: any) => {
      log('windowManager', `error: ${err?.message || err}`)
    })

    const socketPath = windowManager.state.get('socketPath')
    log('windowManager', socketPath ? `listening on ${socketPath}` : 'started')
  } catch (err: any) {
    log('windowManager', `failed to start: ${err?.message || err}`)
  }

  // 5. Workflow Service
  let workflowService: any = null

  try {
    const registryPorts = (options as any)._registryPorts
    workflowService = container.feature('workflowService', {
      ...(registryPorts?.workflow ? { port: registryPorts.workflow } : {}),
    })
    await workflowService.start()
    const hooksLoaded = workflowService.state.get('hooksLoaded') || 0
    const workflowCount = workflowService.state.get('workflowCount') || 0
    log('workflowService', `listening on http://localhost:${workflowService.port} — ${workflowCount} workflows, ${hooksLoaded} hooks`)
    recordEvent('workflowService', 'started', { port: workflowService.port })
  } catch (err: any) {
    log('workflowService', `failed to start: ${err?.message || err}`)
  }

  // 6. Content Service (cnotes serve)
  let contentServiceProcess: any = null
  let contentServicePort: number | null = null

  if (options.contentService) {
    try {
      const registryPorts = (options as any)._registryPorts
      contentServicePort = registryPorts?.content || 4100
      const docsPath = container.paths.resolve(options.docsPath)

      contentServiceProcess = proc.spawn('cnotes', ['serve', docsPath, '--port', String(contentServicePort), '--refresh-interval', '20'], {
        cwd: container.paths.cwd,
        stdout: 'pipe',
        stderr: 'pipe',
      })

      contentServiceProcess.stdout?.on('data', (chunk: Buffer) => {
        const line = chunk.toString().trim()
        if (line) log('contentService', line)
      })
      contentServiceProcess.stderr?.on('data', (chunk: Buffer) => {
        const line = chunk.toString().trim()
        if (line) log('contentService', line)
      })
      contentServiceProcess.on('exit', (code: number | null) => {
        log('contentService', `exited with code ${code}`)
        recordEvent('contentService', 'exited', { code })
        contentServiceProcess = null
      })

      log('contentService', `starting cnotes serve on port ${contentServicePort} (docs: ${options.docsPath})`)
      recordEvent('contentService', 'started', { port: contentServicePort })
    } catch (err: any) {
      log('contentService', `failed to start: ${err?.message || err}`)
    }
  } else {
    log('contentService', 'disabled via --no-content-service')
  }

  // 7. Communications Service
  let commsService: any = null

  if (options.commsService) {
    try {
      const commsConfig = projectConfig.communications || {}

      commsService = await startCommsService(container, {
        imsg: commsConfig.imsg?.enabled,
        telegram: commsConfig.telegram?.enabled,
        gmail: commsConfig.gws?.enabled,
      }, {
        log,
        recordEvent,
      })
    } catch (err: any) {
      log('comms', `failed to start: ${err?.message || err}`)
    }
  } else {
    log('comms', 'disabled via --no-comms-service')
  }

  // 8. Task Scheduler
  let taskSchedulerService: any = null

  if (options.taskScheduler) {
    try {
      const schedulerConfig = projectConfig.scheduler || {}
      taskSchedulerService = await startTaskScheduler(container, {
        interval: schedulerConfig.taskInterval || 15,
        concurrencyOneOff: schedulerConfig.concurrencyOneOff || 2,
        concurrencyScheduled: schedulerConfig.concurrencyScheduled || 2,
      }, { log: (source, msg) => log(source, msg), recordEvent })
    } catch (err: any) {
      log('scheduler', `failed to start: ${err?.message || err}`)
    }
  } else {
    log('scheduler', 'disabled via --no-task-scheduler')
  }

  // --- Status summary ---
  log('main', '')
  log('main', `luca main running (pid ${process.pid})`)
  log('main', `WebSocket: ws://localhost:${options.port}`)
  log('main', `Send SIGUSR1 (kill -USR1 ${process.pid}) for status dump`)
  log('main', '')

  // --- SIGUSR1 status dump ---
  process.on('SIGUSR1', () => {
    const status = getStatusSnapshot()
    log('main', '── Status ──')
    log('main', `Uptime: ${Math.round(status.uptime)}s`)
    log('main', `Builder: ${status.builder.buildsInProgress.length} building`)
    log('main', `Voice: ${status.voice.running ? 'running' : 'stopped'}, ${status.voice.assistantCount || 0} assistants`)
    log('main', `WindowManager: ${status.windowManager.listening ? `listening` : 'off'}, client ${status.windowManager.clientConnected ? 'connected' : 'disconnected'}, ${status.windowManager.windowCount || 0} windows`)
    log('main', `WorkflowService: ${status.workflowService.listening ? `listening on :${status.workflowService.port}` : 'off'}, ${status.workflowService.workflowCount || 0} workflows`)
    log('main', `ContentService: ${status.contentService.running ? `running on :${status.contentService.port} (pid ${status.contentService.pid})` : status.contentService.disabled ? 'disabled' : 'stopped'}`)
    log('main', `Comms: ${status.comms.started ? `running [${status.comms.channels?.join(', ') || 'no channels'}]` : status.comms.disabled ? 'disabled' : 'stopped'}${status.comms.paused ? ' (paused)' : ''}`)
    log('main', `Scheduler: ${status.scheduler.running ? `running, ${status.scheduler.taskCount} tasks` : status.scheduler.disabled ? 'disabled' : 'stopped'}`)
    log('main', '')
  })

  // --- Graceful shutdown ---
  function shutdown(signal: string) {
    log('main', `Shutting down (${signal})...`)

    clearInterval(gitRefreshTimer)
    builder.stopWatcher()

    voiceService?.stop().catch(() => {})
    windowManager?.stop().catch(() => {})
    workflowService?.stop().catch(() => {})
    if (contentServiceProcess) {
      try { contentServiceProcess.kill('SIGTERM') } catch {}
      contentServiceProcess = null
    }
    if (commsService?.isStarted) commsService.pause()
    if (taskSchedulerService) taskSchedulerService.stop()

    wss.stop().catch(() => {})

    // Deregister from shared instance registry
    registry.deregister()

    log('main', 'Goodbye.')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // Keep alive
  await new Promise(() => {})
}

// ─── Client Mode (TUI) ───────────────────────────────────────────────────────

async function runClient(container: any, options: MainOptions, ui: any) {
  const ws = container.client('websocket', {
    baseURL: `ws://localhost:${options.port}`,
    json: true,
    reconnect: true,
    maxReconnectAttempts: 5,
  })

  let status: any = null
  let events: any[] = []
  let logs: any[] = []
  let needsRender = true
  const MAX_VISIBLE_EVENTS = 200
  const MAX_VISIBLE_LOGS = 200

  // Source color registry (mirrors authority-side ui.assignColor)
  const sourceColors: Record<string, string> = {}
  const COLOR_PALETTE = [
    '#4ECDC4', '#FF6B6B', '#FFD166', '#06D6A0', '#118AB2',
    '#EF476F', '#73D2DE', '#FCB69F', '#A8E6CF', '#FDCB6E',
    '#6C5CE7', '#00B894', '#E17055', '#0984E3', '#FDCB6E', '#E84393',
  ]
  let nextColorIdx = 0
  function getSourceColor(source: string): string {
    if (!sourceColors[source]) {
      sourceColors[source] = COLOR_PALETTE[nextColorIdx % COLOR_PALETTE.length]!
      nextColorIdx++
    }
    return sourceColors[source]!
  }

  ws.on('open', () => {
    ws.send({ type: 'query', id: 'init' })
  })

  ws.on('message', (msg: any) => {
    if (msg.type === 'state' || msg.type === 'response') {
      status = msg.data
      // Seed logs from initial snapshot
      if (msg.data?.recentLogs?.length && logs.length === 0) {
        logs = msg.data.recentLogs.slice(-MAX_VISIBLE_LOGS)
      }
      if (msg.data?.recentEvents?.length && events.length === 0) {
        events = msg.data.recentEvents.slice(-MAX_VISIBLE_EVENTS)
      }
      needsRender = true
    }

    if (msg.type === 'event') {
      events.push(msg)
      if (events.length > MAX_VISIBLE_EVENTS) events.shift()
      needsRender = true
    }

    if (msg.type === 'log') {
      logs.push(msg)
      if (logs.length > MAX_VISIBLE_LOGS) logs.shift()
      needsRender = true
    }
  })

  ws.on('error', (err: any) => {
    ui.print.red(`Connection error: ${err?.message || err}`)
    process.exit(1)
  })

  ws.on('close', () => {
    cleanup()
    ui.print.yellow('Connection closed.')
    process.exit(0)
  })

  await ws.connect()

  // --- Terminal setup ---
  process.stdout.write('\x1b[?1049h\x1b[?25l')

  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.setEncoding('utf-8')
  }

  function cleanup() {
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(false)
      process.stdin.pause()
    }
    process.stdout.write('\x1b[?25h\x1b[?1049l')
    if (renderTimer) clearInterval(renderTimer)
    if (refreshTimer) clearInterval(refreshTimer)
  }

  // --- Drawing helpers ---
  const chalk = ui.colors

  /** Strip ANSI codes to get visible length */
  function visLen(s: string): number {
    return s.replace(/\x1b\[[0-9;]*m/g, '').length
  }

  /** Pad or truncate a string to exactly `w` visible characters */
  function fit(s: string, w: number): string {
    const vl = visLen(s)
    if (vl <= w) return s + ' '.repeat(w - vl)
    // Truncate: walk through chars, counting visible length
    let out = ''
    let seen = 0
    let inEsc = false
    for (const ch of s) {
      if (ch === '\x1b') inEsc = true
      if (inEsc) { out += ch; if (ch === 'm') inEsc = false; continue }
      if (seen >= w - 1) { out += '…'; break }
      out += ch
      seen++
    }
    return out
  }

  /** Wrap text to width, returning array of lines */
  function wrapText(s: string, w: number): string[] {
    if (w <= 0) return [s]
    const plain = s.replace(/\x1b\[[0-9;]*m/g, '')
    if (plain.length <= w) return [s]
    const lines: string[] = []
    let current = ''
    let currentLen = 0
    for (const word of plain.split(' ')) {
      if (currentLen + word.length + (current ? 1 : 0) > w) {
        if (current) lines.push(current)
        current = word
        currentLen = word.length
      } else {
        current += (current ? ' ' : '') + word
        currentLen += word.length + (current.length > word.length ? 1 : 0)
      }
    }
    if (current) lines.push(current)
    return lines.length ? lines : ['']
  }

  /** Draw a box border (top or bottom) */
  function boxTop(w: number, title?: string): string {
    if (title) {
      const t = ` ${title} `
      return chalk.gray('┌' + t + '─'.repeat(Math.max(0, w - 2 - t.length)) + '┐')
    }
    return chalk.gray('┌' + '─'.repeat(w - 2) + '┐')
  }
  function boxBottom(w: number): string {
    return chalk.gray('└' + '─'.repeat(w - 2) + '┘')
  }
  function boxLine(content: string, w: number): string {
    return chalk.gray('│') + fit(' ' + content, w - 2) + chalk.gray('│')
  }
  function boxEmpty(w: number): string {
    return chalk.gray('│') + ' '.repeat(w - 2) + chalk.gray('│')
  }

  function render() {
    if (!status) return
    const cols = process.stdout.columns || 120
    const rows = process.stdout.rows || 40

    // Layout constants
    const leftW = Math.max(30, Math.floor(cols * 0.38))
    const rightW = cols - leftW
    const headerH = 2
    const bodyH = rows - headerH

    const output: string[] = []

    // ═══ HEADER ═══
    const uptimeStr = formatUptime(status.uptime)
    const pausedTag = status.paused ? chalk.bold.yellow('  ⏸ PAUSED') : ''
    const headerLeft = chalk.bold.cyan(' LUCA MAIN') + pausedTag + chalk.gray(`  pid ${status.pid}  up ${uptimeStr}`)
    const headerRight = chalk.gray('q:quit  r:refresh')
    const headerPad = Math.max(1, cols - visLen(headerLeft) - visLen(headerRight))
    output.push(headerLeft + ' '.repeat(headerPad) + headerRight)

    // Subsystem indicators
    const wmStatus = status.windowManager
    const wmIndicator = wmStatus?.listening
      ? wmStatus.clientConnected
        ? chalk.green('●') + ' wm ' + chalk.green('connected') + (wmStatus.windowCount ? chalk.gray(` ${wmStatus.windowCount}w`) : '')
        : chalk.yellow('●') + ' wm ' + chalk.gray('waiting')
      : chalk.red('●') + ' wm'

    const indicators = [
      status.builder.watching
        ? chalk.green('●') + ' builder'
        : chalk.red('●') + ' builder',
      status.voice.running
        ? chalk.green('●') + ' voice ' + (status.voice.clientConnected ? chalk.green('connected') : chalk.gray('waiting'))
        : chalk.yellow('●') + ' voice',
      wmIndicator,
      status.comms?.started
        ? (status.comms.paused
          ? chalk.yellow('●') + ' comms ' + chalk.gray('paused')
          : chalk.green('●') + ' comms ' + chalk.gray(status.comms.channels?.join(', ') || ''))
        : status.comms?.disabled
          ? chalk.gray('●') + ' comms ' + chalk.gray('disabled')
          : chalk.red('●') + ' comms',
      status.scheduler?.running
        ? chalk.green('●') + ' scheduler ' + chalk.gray(`${status.scheduler.taskCount}t`)
        : status.scheduler?.disabled
          ? chalk.gray('●') + ' scheduler ' + chalk.gray('disabled')
          : chalk.red('●') + ' scheduler',
    ]
    output.push(' ' + indicators.join(chalk.gray('  │  ')))

    // ═══ BODY: Two columns ═══
    // Build left column lines, then right column lines, then merge

    // --- LEFT COLUMN ---
    const leftLines: string[] = []

    // Box 1: Stats (git summary + scheduler info)
    const statsLines: string[] = []

    // Git info
    if (status.git) {
      const g = status.git
      if (g.branch) statsLines.push(chalk.white('branch: ') + chalk.cyan(g.branch))
      const totalM = g.modified?.length || 0
      const totalA = g.untracked?.length || 0
      const totalD = g.deleted?.length || 0
      const totalFiles = totalM + totalA + totalD
      if (totalFiles > 0) {
        const parts: string[] = []
        if (totalM) parts.push(chalk.yellow(`${totalM} changed`))
        if (totalA) parts.push(chalk.green(`+${totalA} new`))
        if (totalD) parts.push(chalk.red(`-${totalD} deleted`))
        statsLines.push(chalk.white(`${totalFiles} files dirty: `) + parts.join(chalk.gray(' · ')))

        // Folder breakdown
        const dirs = Object.entries(g.summary || {}).sort((a: any, b: any) =>
          (b[1].added + b[1].modified + b[1].deleted) - (a[1].added + a[1].modified + a[1].deleted)
        )
        for (const [dir, counts] of dirs) {
          const c = counts as any
          const total = c.added + c.modified + c.deleted
          const dp: string[] = []
          if (c.modified) dp.push(chalk.yellow(`${c.modified}`))
          if (c.added) dp.push(chalk.green(`+${c.added}`))
          if (c.deleted) dp.push(chalk.red(`-${c.deleted}`))
          statsLines.push(chalk.gray('  ') + chalk.white(`${dir}/`) + chalk.gray(` ${total} `) + dp.join(chalk.gray('/')))
        }
      } else {
        statsLines.push(chalk.gray('working tree clean'))
      }

      // Recent commits
      if (g.recentCommits?.length) {
        statsLines.push('')
        for (const title of g.recentCommits) {
          statsLines.push(chalk.gray('  ') + chalk.white(title))
        }
      }
    }

    const statsBoxH = Math.max(4, statsLines.length + 2)
    leftLines.push(boxTop(leftW, 'Stats'))
    for (let i = 0; i < statsBoxH - 2; i++) {
      leftLines.push(boxLine(statsLines[i] || '', leftW))
    }
    leftLines.push(boxBottom(leftW))

    // Box 2: Tasks In Progress
    const taskLines: string[] = []
    for (const slug of (status.builder.buildsInProgress || [])) {
      taskLines.push(chalk.blue('▸ ') + 'build: ' + slug)
    }
    if (!taskLines.length) taskLines.push(chalk.gray('none'))

    const taskBoxH = Math.min(Math.max(3, taskLines.length + 2), 8)
    leftLines.push(boxTop(leftW, 'Tasks In Progress'))
    for (let i = 0; i < taskBoxH - 2; i++) {
      leftLines.push(boxLine(taskLines[i] || '', leftW))
    }
    leftLines.push(boxBottom(leftW))

    // Box 3: Content Models grid
    const MODEL_COLORS = [
      '#FF6B6B', '#4ECDC4', '#FFD166', '#06D6A0', '#118AB2',
      '#EF476F', '#73D2DE', '#6C5CE7', '#00B894', '#E17055',
      '#FDCB6E', '#E84393',
    ]
    const contentCounts = status.content || {}
    const modelNames = Object.keys(contentCounts)
    const contentLines: string[] = []

    if (modelNames.length) {
      // 2-column grid
      const colW = Math.floor((leftW - 4) / 2)
      for (let i = 0; i < modelNames.length; i += 2) {
        const left = modelNames[i]!
        const right = modelNames[i + 1]
        const lColor = MODEL_COLORS[i % MODEL_COLORS.length]!
        const lCell = chalk.hex(lColor)(left) + chalk.gray(` ${contentCounts[left]}`)
        const rCell = right
          ? chalk.hex(MODEL_COLORS[(i + 1) % MODEL_COLORS.length]!)(right) + chalk.gray(` ${contentCounts[right]}`)
          : ''
        contentLines.push(fit(lCell, colW) + ' ' + rCell)
      }
    } else {
      contentLines.push(chalk.gray('loading...'))
    }

    const contentBoxH = Math.max(3, contentLines.length + 2)
    leftLines.push(boxTop(leftW, 'Content'))
    for (let i = 0; i < contentBoxH - 2; i++) {
      leftLines.push(boxLine(contentLines[i] || '', leftW))
    }
    leftLines.push(boxBottom(leftW))

    // Box 4: Event Log (fill remaining space, capped)
    const eventBoxH = Math.max(5, bodyH - leftLines.length + 2)
    leftLines.push(boxTop(leftW, 'Event Log'))

    const visibleEvents = events.slice(-(eventBoxH - 2))
    for (let i = 0; i < eventBoxH - 2; i++) {
      const evt = visibleEvents[i]
      if (!evt) { leftLines.push(boxEmpty(leftW)); continue }
      const time = new Date(evt.ts).toISOString().slice(11, 19)
      const evtColor = (evt.event || '').includes('error') || (evt.event || '').includes('FAIL') || (evt.event || '').includes('crash')
        ? chalk.red : (evt.event || '').includes('complete') || (evt.event || '').includes('started')
        ? chalk.green : (evt.event || '').includes('skipped')
        ? chalk.yellow : chalk.gray

      let detail = ''
      if (evt.data?.taskId) detail = ' ' + evt.data.taskId
      else if (evt.data?.reason) detail = ' ' + evt.data.reason
      else if (evt.event === 'tick' && evt.data) {
        const d = evt.data
        detail = d.dueIds?.length ? ` ${d.dueOneOff}oo ${d.dueScheduled}s ${d.inProgress}ip` : ` ${d.totalTasks}t ok`
      }

      const evtText = chalk.gray(time) + ' ' + evtColor(`${evt.source}:${evt.event}`) + chalk.gray(detail)
      leftLines.push(boxLine(evtText, leftW))
    }
    leftLines.push(boxBottom(leftW))

    // --- RIGHT COLUMN: Log Stream ---
    const rightLines: string[] = []
    rightLines.push(boxTop(rightW, 'Log Stream'))

    const logBodyH = bodyH - 2  // minus top/bottom border
    const visibleLogs = logs.slice(-logBodyH)
    const rightInner = rightW - 2

    for (let i = 0; i < logBodyH; i++) {
      const entry = visibleLogs[i]
      if (!entry) { rightLines.push(boxEmpty(rightW)); continue }
      const time = new Date(entry.ts).toISOString().slice(11, 19)
      const srcHex = getSourceColor(entry.source)
      const prefix = chalk.hex(srcHex)(`[${entry.source}]`)
      const text = entry.text || ''

      // Wrap long log lines
      const prefixPart = chalk.gray(time) + ' ' + prefix + ' '
      const prefixVisLen = 9 + entry.source.length + 3  // time + [source] + spaces
      const remainW = rightInner - prefixVisLen
      if (remainW > 10 && visLen(text) > remainW) {
        // First line with prefix
        const wrapped = wrapText(text, remainW)
        rightLines.push(boxLine(prefixPart + wrapped[0], rightW))
        // Continuation lines indented
        for (let j = 1; j < wrapped.length && (i + j) < logBodyH; j++) {
          rightLines.push(boxLine(' '.repeat(prefixVisLen) + wrapped[j], rightW))
          i++  // consume a row
        }
      } else {
        rightLines.push(boxLine(prefixPart + text, rightW))
      }
    }
    rightLines.push(boxBottom(rightW))

    // --- MERGE LEFT + RIGHT ---
    for (let i = 0; i < bodyH; i++) {
      const left = leftLines[i] || ' '.repeat(leftW)
      const right = rightLines[i] || ' '.repeat(rightW)
      output.push(fit(left, leftW) + fit(right, rightW))
    }

    // Render frame
    const frame = '\x1b[H' + output.slice(0, rows).map(l => l + '\x1b[K').join('\n') + '\x1b[J'
    process.stdout.write(frame)
  }

  function formatUptime(secs: number): string {
    const s = Math.floor(secs)
    if (s < 60) return `${s}s`
    const m = Math.floor(s / 60)
    if (m < 60) return `${m}m ${s % 60}s`
    const h = Math.floor(m / 60)
    return `${h}h ${m % 60}m`
  }

  // Keyboard
  process.stdin.on('data', (key: string) => {
    if (key === 'q' || key === '\x03') {
      cleanup()
      ws.disconnect()
      process.exit(0)
    }
    if (key === 'r') {
      ws.send({ type: 'query', id: 'refresh' })
    }
  })

  process.on('SIGINT', () => { cleanup(); ws.disconnect(); process.exit(0) })
  process.on('SIGTERM', () => { cleanup(); ws.disconnect(); process.exit(0) })

  // Render loop
  const renderTimer = setInterval(() => {
    if (needsRender) {
      needsRender = false
      render()
    }
  }, 250)

  // Periodic refresh
  const refreshTimer = setInterval(() => {
    try { ws.send({ type: 'query', id: 'refresh' }) } catch {}
  }, 5000)

  await new Promise(() => {})
}

// ─── Remote Console ──────────────────────────────────────────────────────────

async function runConsole(container: any, options: MainOptions, ui: any) {
  const { createInterface } = await import('readline')

  const ws = container.client('websocket', {
    baseURL: `ws://localhost:${options.port}`,
    json: true,
  })

  let pendingResolve: ((value: any) => void) | null = null

  ws.on('message', (msg: any) => {
    if (msg.type === 'response' && pendingResolve) {
      const resolve = pendingResolve
      pendingResolve = null

      if (msg.data?.error) {
        console.log(ui.colors.red(msg.data.error))
      } else if (msg.data?.output !== undefined) {
        console.log(msg.data.output)
      }

      resolve(undefined)
    }
  })

  ws.on('error', (err: any) => {
    console.log(ui.colors.red(`Connection error: ${err?.message || err}`))
    process.exit(1)
  })

  ws.on('close', () => {
    console.log(ui.colors.yellow('\nDisconnected from luca main.'))
    process.exit(0)
  })

  await ws.connect()

  console.log()
  console.log(ui.colors.dim('  Remote console — evaluating in the running luca main process.'))
  console.log(ui.colors.dim('  Live objects: builder, voiceService, windowManager, container'))
  console.log(ui.colors.dim('  Last result available as _'))
  console.log(ui.colors.dim('  Type .exit to quit.'))
  console.log()

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: ui.colors.cyan('luca main') + ui.colors.dim(' > '),
  })

  rl.on('line', async (line: string) => {
    const trimmed = line.trim()
    if (!trimmed) { rl.prompt(); return }
    if (trimmed === '.exit') { rl.close(); ws.disconnect(); process.exit(0) }

    const response = new Promise<void>((resolve) => { pendingResolve = resolve })

    ws.send({
      type: 'command',
      payload: { action: 'eval', code: trimmed, id: Date.now().toString() },
    })

    // Timeout so we don't hang forever
    const timeout = setTimeout(() => {
      if (pendingResolve) {
        pendingResolve(undefined)
        pendingResolve = null
        console.log(ui.colors.yellow('(eval timed out)'))
      }
    }, 30_000)

    await response
    clearTimeout(timeout)
    rl.prompt()
  })

  rl.on('close', () => { ws.disconnect(); process.exit(0) })

  rl.prompt()
  await new Promise(() => {})
}

// ─── Send Command to Authority ────────────────────────────────────────────────

async function sendCommand(container: any, port: number, action: string, subsystem?: string) {
  const ws = container.client('websocket', {
    baseURL: `ws://localhost:${port}`,
    json: true,
  })

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.disconnect()
      reject(new Error('Command timed out'))
    }, 5000)

    ws.on('open', () => {
      ws.send({ type: 'command', payload: { action, subsystem } })
    })

    ws.on('message', (msg: any) => {
      clearTimeout(timeout)
      ws.disconnect()
      const label = action === 'pause-all' ? 'luca main paused (process still alive, all subsystems stopped)'
        : action === 'resume-all' ? 'luca main resumed (all subsystems restarted)'
        : `Sent "${action}" to luca main.`
      console.log(label)
      resolve()
    })

    ws.on('error', (err: any) => {
      clearTimeout(timeout)
      reject(err)
    })

    ws.connect()
  })
}

export default {
  description: 'Unified orchestrator for luca services. Runs project builder, task scheduler, voice, and domain services.',
  argsSchema,
  handler: main,
}
