import { z } from 'zod'
import { Feature, features } from '@soederpop/luca'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca/schemas'
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from 'fs'
import { resolve, dirname } from 'path'

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const ProjectBuilderStateSchema = FeatureStateSchema.extend({
  loaded: z.boolean().default(false).describe('Whether the project has been loaded'),
  buildStatus: z.enum(['idle', 'loading', 'ready', 'running', 'aborting', 'completed', 'error']).default('idle')
    .describe('Current build lifecycle status'),
  currentPlanId: z.string().nullable().default(null)
    .describe('ID of the currently executing plan'),
  projectSlug: z.string().default('')
    .describe('Slug of the loaded project'),
  mode: z.enum(['standalone', 'server', 'client']).default('standalone')
    .describe('IPC operation mode'),
  watching: z.boolean().default(false)
    .describe('Whether the watcher is actively polling for approved projects'),
})

export const ProjectBuilderOptionsSchema = FeatureOptionsSchema.extend({
  projectSlug: z.string().optional().describe('Slug of the project to load from contentbase'),
  docsPath: z.string().default('./docs').describe('Path to the docs folder containing contentbase models'),
  dangerouslySkipPermissions: z.boolean().default(true)
    .describe('Whether to run Claude Code sessions without permission prompts'),
  socketPath: z.string().default('tmp/project-builder.sock')
    .describe('Relative path for the IPC socket file'),
  watchInterval: z.number().default(60_000)
    .describe('Interval in ms between polls for approved projects (watcher mode)'),
})

export type ProjectBuilderState = z.infer<typeof ProjectBuilderStateSchema>
export type ProjectBuilderOptions = z.infer<typeof ProjectBuilderOptionsSchema>

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PlanInfo {
  id: string
  title: string
  status: string
  group: number
  content: string
  costUsd?: number
  turns?: number
  toolCalls?: number
  completedAt?: string
}

export interface PlanCacheData {
  output: string
  toolCalls: { name: string; input: any; id: string; timestamp: number }[]
  messages: any[]
  toolResults: Record<string, string>
  costUsd: number
  turns: number
  result: string | null
  completedAt: string
}

export interface ProjectInfo {
  id: string
  title: string
  status: string
  executionOrder: string[][]
}

export type BuildStatus = ProjectBuilderState['buildStatus']

const MAX_TOOL_OUTPUT = 500
const DISK_CACHE_KEY = 'project-builder:state-v2'
const REQUEST_TIMEOUT_MS = 10_000

const ONE_FINAL_NOTE = (planPath: string, remainingPlanPaths: string[]) => `

## ONE FINAL NOTE

This plan document is located at: ${planPath}

When you finish this plan, do the following:

1. Add a \`## Retrospective\` section to the end of this plan document (${planPath}) and write a few short paragraphs about what you learned.
2. Update any remaining plans in the sequence with anything critical they need to know based on your work. Add your handoff notes to those plans — DO NOT OVERWRITE any existing content in them.
${remainingPlanPaths.length > 0 ? `\nRemaining plans:\n${remainingPlanPaths.map(p => `- ${p}`).join('\n')}` : ''}
`

/** Events that trigger a disk state snapshot when in server mode. */
const KEY_EVENTS = [
  'build:loaded', 'build:start', 'build:complete',
  'build:error', 'build:aborting', 'build:aborted',
  'plan:start', 'plan:complete', 'plan:error',
]

function truncate(s: string, max = MAX_TOOL_OUTPUT): string {
  if (!s || s.length <= max) return s
  return s.slice(0, max) + `\n... (truncated, ${s.length} chars total)`
}

// ─── Feature ─────────────────────────────────────────────────────────────────

/**
 * ProjectBuilder Feature
 *
 * Loads contentbase projects and their plans, executes them sequentially
 * via Claude Code sessions, caches results, writes build reports, and
 * persists plan completion status back to the markdown files.
 *
 * Supports cross-process operation via IPC:
 *   - **server** mode: runs the build, broadcasts events, handles requests
 *   - **client** mode: proxies commands to the server, relays events locally
 *   - **standalone** mode: operates independently (default)
 *
 * Auto-detection: on creation, probes `tmp/project-builder.sock` —
 * if reachable, enters client mode; otherwise standalone (promotable to server).
 *
 * Events:
 *   build:loaded   - Project and plans loaded from contentbase
 *   build:start    - Build execution starting
 *   build:complete - All plans finished successfully
 *   build:error    - A plan failed, stopping the build
 *   build:aborting - Abort requested, killing active session
 *   build:aborted  - Build was manually aborted
 *   plan:skipped   - Plan was already completed, skipping
 *   plan:queued    - Plan is next in the execution queue
 *   plan:start     - Plan execution started (Claude Code session spawned)
 *   plan:delta     - Streaming text delta from the plan's Claude session
 *   plan:message   - Full message from the plan's Claude session
 *   plan:complete  - Plan finished successfully
 *   plan:error     - Plan execution failed
 *
 * @extends Feature
 */
export class ProjectBuilder extends Feature<ProjectBuilderState, ProjectBuilderOptions> {
  static override shortcut = 'features.projectBuilder' as const
  static override stateSchema = ProjectBuilderStateSchema
  static override optionsSchema = ProjectBuilderOptionsSchema

  override get initialState(): ProjectBuilderState {
    return {
      ...super.initialState,
      loaded: false,
      buildStatus: 'idle',
      currentPlanId: null,
      projectSlug: '',
      mode: 'standalone',
    }
  }

  // ── Internal state (not in observable state, these are large data structures) ──
  private planSessionMap = new Map<string, string>()
  private currentSessionId: string | null = null
  private _aborted = false

  private planOutput = new Map<string, string>()
  private planToolCalls = new Map<string, any[]>()
  private planMessages = new Map<string, any[]>()
  private planToolResults = new Map<string, Record<string, string>>()

  /** The loaded project info. */
  project: ProjectInfo | null = null
  /** All plans belonging to this project. */
  plans: PlanInfo[] = []
  /** Cached execution data for completed plans. */
  planCache = new Map<string, PlanCacheData>()

  // ── IPC state ───────────────────────────────────────────────────────────────
  private _ipc: any = null
  private _pendingRequests = new Map<string, { resolve: Function; reject: Function; timeout: ReturnType<typeof setTimeout> }>()
  private _cleanupHandlers: Array<() => void> = []
  private _ready: Promise<void> = Promise.resolve()

  // ── Convenience Getters ────────────────────────────────────────────────────

  /** Current build status. */
  get buildStatus(): BuildStatus {
    return this.state.get('buildStatus')
  }

  /** ID of the plan currently being executed. */
  get currentPlanId(): string | null {
    return this.state.get('currentPlanId')
  }

  /** Whether the project has been loaded. */
  get isLoaded(): boolean {
    return this.state.get('loaded')
  }

  /** Whether the builder is idle (not actively running a build). */
  get isIdle(): boolean {
    const status = this.buildStatus
    return status === 'idle' || status === 'ready' || status === 'completed'
  }

  /** Whether this instance is operating as an IPC client. */
  get isClient(): boolean {
    return this.state.get('mode') === 'client'
  }

  /** Whether this instance is operating as an IPC server. */
  get isServer(): boolean {
    return this.state.get('mode') === 'server'
  }

  /** Resolved absolute path for the IPC socket. */
  get resolvedSocketPath(): string {
    return this.container.paths.resolve(this.options.socketPath || 'tmp/project-builder.sock')
  }

  /** The contentDb feature instance for this project's docs. */
  private get contentDb() {
    return this.container.feature('contentDb', { rootPath: this.options.docsPath })
  }

  /** The diskCache feature instance. */
  private get cache() {
    return this.container.feature('diskCache', { enable: true })
  }

  /** Directory for build reports. */
  private get buildDir(): string {
    return resolve(this.options.docsPath, 'project-builds', this.requireSlug())
  }

  private cacheKey(planId: string): string {
    return `build:${this.requireSlug()}:${planId}`
  }

  /**
   * Returns the project slug from options or state. Throws if not set.
   */
  private requireSlug(): string {
    const slug = this.options.projectSlug || this.state.get('projectSlug')
    if (!slug) throw new Error('projectSlug is required but not set — pass it as an option or connect as a client to a running server')
    return slug
  }

  /**
   * Returns a promise that resolves when auto-detection and initial
   * hydration (client connect or disk snapshot load) is complete.
   */
  whenReady(): Promise<void> {
    return this._ready
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  override afterInitialize() {
    const socketPath = this.resolvedSocketPath

    if (existsSync(socketPath)) {
      this._ready = this._connectAndHydrate(socketPath)
    } else {
      this._ready = this._loadDiskSnapshot()
    }
  }

  private async _connectAndHydrate(socketPath: string): Promise<void> {
    try {
      const ipc = this.container.feature('ipcSocket')
      this._ipc = ipc
      await ipc.connect(socketPath)
      this.setState({ mode: 'client' })
      this._setupClientMessageHandler()

      const state = await this.sendRequest('getState')
      if (state) {
        if (state.buildStatus) this.setState({ buildStatus: state.buildStatus })
        if (state.currentPlanId !== undefined) this.setState({ currentPlanId: state.currentPlanId })
        if (state.projectSlug) this.setState({ projectSlug: state.projectSlug })
        if (state.project) this.project = state.project
        if (state.plans) this.plans = state.plans
        if (state.loaded) this.setState({ loaded: true })
      }
    } catch {
      // Socket exists but connection failed — stale lock, fall back
      this._ipc = null
      this.setState({ mode: 'standalone' })
      await this._loadDiskSnapshot()
    }
  }

  // ── Event broadcasting ────────────────────────────────────────────────────

  override emit(event: string, ...args: any[]) {
    const result = super.emit(event, ...args)

    if (this.isServer && this._ipc) {
      try {
        this._ipc.broadcast({ type: 'event', event, payload: args[0] })
      } catch {}

      if (KEY_EVENTS.includes(event)) {
        this._persistStateSnapshot().catch(() => {})
      }
    }

    return result
  }

  // ── IPC Server ────────────────────────────────────────────────────────────

  /**
   * Start the IPC server. Listens on the socket path and accepts client connections.
   * Should be called from the authoritative process (e.g. `luca project-builder`).
   */
  async startServer(): Promise<void> {
    if (this.isClient) {
      throw new Error('Cannot start server: already connected as client to an existing server')
    }

    const socketPath = this.resolvedSocketPath
    const socketDir = dirname(socketPath)
    if (!existsSync(socketDir)) {
      mkdirSync(socketDir, { recursive: true })
    }

    const ipc = this.container.feature('ipcSocket')
    this._ipc = ipc
    await ipc.listen(socketPath, true)
    this.setState({ mode: 'server' })
    this._setupServerMessageHandler()

    // Register process exit cleanup
    const cleanup = () => {
      try {
        if (existsSync(socketPath)) {
          unlinkSync(socketPath)
        }
      } catch {}
    }
    process.on('exit', cleanup)
    process.on('SIGTERM', cleanup)
    process.on('SIGINT', cleanup)
    this._cleanupHandlers.push(cleanup)
  }

  /**
   * Stop the IPC server and clean up the socket file.
   */
  async stopServer(): Promise<void> {
    if (this._ipc && this.isServer) {
      try {
        await this._ipc.stopServer()
      } catch {}

      const socketPath = this.resolvedSocketPath
      try {
        if (existsSync(socketPath)) {
          unlinkSync(socketPath)
        }
      } catch {}

      this._ipc = null
    }

    this.setState({ mode: 'standalone' })

    for (const handler of this._cleanupHandlers) {
      process.off('exit', handler)
      process.off('SIGTERM', handler)
      process.off('SIGINT', handler)
    }
    this._cleanupHandlers = []
  }

  private _setupServerMessageHandler(): void {
    if (!this._ipc) return

    this._ipc.on('message', async (msg: any) => {
      const data = msg.data
      if (!data || data.type !== 'request') return

      try {
        let result: any

        switch (data.method) {
          case 'status':
            result = { buildStatus: this.buildStatus, isIdle: this.isIdle, mode: 'server' }
            break
          case 'getState':
            result = this._getStateSnapshot()
            break
          case 'getPlans':
            result = this.plans.map(p => ({ ...p, content: '' }))
            break
          case 'getProject':
            result = this.project
            break
          case 'load':
            await this.load()
            result = { success: true }
            break
          case 'run':
            this.run().catch(() => {})
            result = { success: true }
            break
          case 'abort':
            await this.abort()
            result = { success: true }
            break
          default:
            throw new Error(`Unknown method: ${data.method}`)
        }

        this._ipc!.broadcast({ type: 'response', replyTo: data.id, result, error: null })
      } catch (err: any) {
        this._ipc!.broadcast({ type: 'response', replyTo: data.id, result: null, error: err.message || String(err) })
      }
    })
  }

  // ── IPC Client ────────────────────────────────────────────────────────────

  /**
   * Send a request to the IPC server and wait for the correlated response.
   */
  async sendRequest(method: string, args?: any): Promise<any> {
    if (!this._ipc) throw new Error('Not connected to server')

    const id = this.container.utils.uuid()

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._pendingRequests.delete(id)
        reject(new Error(`Request "${method}" timed out after ${REQUEST_TIMEOUT_MS}ms`))
      }, REQUEST_TIMEOUT_MS)

      this._pendingRequests.set(id, { resolve, reject, timeout })
      this._ipc!.send({ type: 'request', id, method, args })
    })
  }

  private _setupClientMessageHandler(): void {
    if (!this._ipc) return

    this._ipc.on('message', (msg: any) => {
      const data = msg.data
      if (!data) return

      if (data.type === 'response') {
        const pending = this._pendingRequests.get(data.replyTo)
        if (pending) {
          clearTimeout(pending.timeout)
          this._pendingRequests.delete(data.replyTo)
          if (data.error) {
            pending.reject(new Error(data.error))
          } else {
            pending.resolve(data.result)
          }
        }
      } else if (data.type === 'event') {
        this._handleRemoteEvent(data.event, data.payload)
      }
    })
  }

  private _handleRemoteEvent(event: string, payload: any): void {
    switch (event) {
      case 'build:loaded':
        if (payload?.project) this.project = payload.project
        if (payload?.plans) this.plans = payload.plans
        this.setState({ loaded: true })
        break
      case 'build:start':
        this.setState({ buildStatus: 'running' })
        break
      case 'build:complete':
        this.setState({ buildStatus: 'completed', currentPlanId: null })
        break
      case 'build:error':
        this.setState({ buildStatus: 'error' })
        break
      case 'build:aborting':
        this.setState({ buildStatus: 'aborting' })
        break
      case 'build:aborted':
        this.setState({ buildStatus: 'ready', currentPlanId: null })
        break
      case 'plan:start':
        this.setState({ currentPlanId: payload?.planId || null })
        break
    }

    // Re-emit locally so UI/callers can listen
    super.emit(event, payload)
  }

  // ── Disk Persistence ──────────────────────────────────────────────────────

  private _getStateSnapshot(): Record<string, any> {
    return {
      buildStatus: this.buildStatus,
      currentPlanId: this.currentPlanId,
      projectSlug: this.state.get('projectSlug'),
      loaded: this.isLoaded,
      mode: this.state.get('mode'),
      project: this.project,
      plans: this.plans.map(p => ({ id: p.id, title: p.title, status: p.status, group: p.group })),
    }
  }

  private async _persistStateSnapshot(): Promise<void> {
    try {
      await this.cache.set(DISK_CACHE_KEY, this._getStateSnapshot())
    } catch {}
  }

  private async _loadDiskSnapshot(): Promise<void> {
    try {
      const snapshot = await this.cache.get(DISK_CACHE_KEY, true)

      console.log('Snapshot', DISK_CACHE_KEY)

      if (snapshot && typeof snapshot === 'object') {
        if (snapshot.buildStatus) this.setState({ buildStatus: snapshot.buildStatus })
        if (snapshot.currentPlanId !== undefined) this.setState({ currentPlanId: snapshot.currentPlanId })
        if (snapshot.projectSlug) this.setState({ projectSlug: snapshot.projectSlug })
        if (snapshot.project) this.project = snapshot.project
        if (snapshot.plans) this.plans = snapshot.plans
      }
    } catch {}
  }

  // ── Load ───────────────────────────────────────────────────────────────────

  /**
   * Load the project and its plans from contentbase.
   * Discovers the execution order, resolves plan documents, and restores
   * cached data for previously completed plans.
   *
   * In client mode, proxies the request to the server.
   */
  async load(): Promise<void> {
    await this._ready

    if (this.isClient) {
      await this.sendRequest('load', { projectSlug: this.options.projectSlug })
      // Refresh local state from server
      const state = await this.sendRequest('getState')
      if (state) {
        if (state.buildStatus) this.setState({ buildStatus: state.buildStatus })
        if (state.currentPlanId !== undefined) this.setState({ currentPlanId: state.currentPlanId })
        if (state.projectSlug) this.setState({ projectSlug: state.projectSlug })
        if (state.project) this.project = state.project
        if (state.plans) this.plans = state.plans
        if (state.loaded) this.setState({ loaded: true })
      }
      return
    }

    const slug = this.requireSlug()
    this.setState({ buildStatus: 'loading', projectSlug: slug })

    const contentDb = this.contentDb
    if (!contentDb.isLoaded) await contentDb.load()

    const collection = contentDb.collection
    const projectPath = `projects/${slug}`

    if (!collection.available.includes(projectPath)) {
      const available = collection.available
        .filter((id: string) => id.startsWith('projects/'))
        .map((id: string) => id.replace('projects/', ''))
      throw new Error(`Project "${slug}" not found. Available: ${available.join(', ')}`)
    }

    const { Project, Plan } = contentDb.models
    const projectInstance = collection.getModel(projectPath, Project)
    const executionOrder: string[][] = projectInstance.computed.executionOrder

    const plans: PlanInfo[] = []
    for (let groupIdx = 0; groupIdx < executionOrder.length; groupIdx++) {
      const group = executionOrder[groupIdx]
      for (const planUrl of group) {
        const planPath = planUrl.replace(/\.(md|mdx)$/, '')
        try {
          collection.getModel(planPath, Plan)
          const doc = collection.document(planPath)
          plans.push({
            id: planPath,
            title: doc.title || planPath.split('/').pop() || planPath,
            status: doc.meta?.status || 'pending',
            group: groupIdx,
            content: doc.content || '',
            costUsd: doc.meta?.costUsd,
            turns: doc.meta?.turns,
            toolCalls: doc.meta?.toolCalls,
            completedAt: doc.meta?.completedAt,
          })
        } catch (err) {
          plans.push({
            id: planPath,
            title: planPath.split('/').pop() || planPath,
            status: 'error',
            group: groupIdx,
            content: `Error loading plan: ${err}`,
          })
        }
      }
    }

    // Restore cached session data for completed plans
    for (const plan of plans) {
      if (plan.status === 'completed') {
        try {
          const cached = await this.cache.get(this.cacheKey(plan.id), true)
          if (cached) {
            this.planCache.set(plan.id, cached)
          }
        } catch {}
      }
    }

    this.project = {
      id: projectPath,
      title: projectInstance.document?.title || slug,
      status: projectInstance.document?.meta?.status || 'draft',
      executionOrder,
    }
    this.plans = plans

    // Determine build status from plan states
    const allCompleted = plans.length > 0 && plans.every(p => p.status === 'completed')
    const hasError = plans.some(p => p.status === 'error')
    const buildStatus = allCompleted ? 'completed' : hasError ? 'error' : 'ready'
    this.setState({ buildStatus, loaded: true })

    const cachedData: Record<string, PlanCacheData> = {}
    for (const [planId, data] of this.planCache) {
      cachedData[planId] = data
    }

    this.emit('build:loaded', { project: this.project, plans: this.plans, cached: cachedData })
  }

  // ── Run ────────────────────────────────────────────────────────────────────

  /**
   * Execute all pending plans sequentially via Claude Code sessions.
   * Already-completed plans are skipped. Emits events for each lifecycle
   * stage. Stops on the first plan error.
   *
   * In client mode, proxies the request to the server.
   */
  async run(): Promise<void> {
    await this._ready

    if (this.isClient) {
      await this.sendRequest('run')
      return
    }

    if (this.buildStatus !== 'ready') {
      throw new Error(`Cannot run: build status is "${this.buildStatus}", expected "ready". ${this.buildStatus === 'aborting' ? 'Wait for abort to finish.' : ''}`)
    }

    const slug = this.requireSlug()
    this._aborted = false
    this.setState({ buildStatus: 'running' })
    await this.updateProjectStatus('running')

    const pendingPlans = this.plans.filter(p => p.status !== 'completed')
    const skippedPlans = this.plans.filter(p => p.status === 'completed')

    for (const plan of skippedPlans) {
      this.emit('plan:skipped', { planId: plan.id, reason: 'already completed' })
    }

    this.emit('build:start', {
      projectSlug: slug,
      planCount: this.plans.length,
      pendingCount: pendingPlans.length,
      skippedCount: skippedPlans.length,
    })

    if (pendingPlans.length === 0) {
      this.setState({ buildStatus: 'completed' })
      this.emit('build:complete', { projectSlug: slug, totalCost: 0, totalDuration: 0 })
      return
    }

    const cc = this.container.feature('claudeCode', { streaming: true })
    let totalCost = 0

    const deltaHandler = (data: any) => {
      if (this._aborted) return
      const planId = this.sessionToPlan(data.sessionId)
      if (planId) {
        const current = this.planOutput.get(planId) || ''
        this.planOutput.set(planId, current + data.text)
        this.emit('plan:delta', { planId, sessionId: data.sessionId, text: data.text })
      }
    }

    const messageHandler = (data: any) => {
      if (this._aborted) return
      const planId = this.sessionToPlan(data.sessionId)
      if (planId) {
        const msgs = this.planMessages.get(planId) || []
        msgs.push(data.message)
        this.planMessages.set(planId, msgs)

        if (data.message?.message?.content) {
          for (const block of data.message.message.content) {
            if (block.type === 'tool_use') {
              const calls = this.planToolCalls.get(planId) || []
              calls.push({ name: block.name, input: block.input, id: block.id, timestamp: Date.now() })
              this.planToolCalls.set(planId, calls)
            }
          }
        }

        this.emit('plan:message', { planId, sessionId: data.sessionId, message: data.message })
      }
    }

    const eventHandler = (data: any) => {
      if (this._aborted) return
      const { sessionId, event } = data
      if (event?.type === 'tool_result') {
        const planId = this.sessionToPlan(sessionId)
        if (planId) {
          const results = this.planToolResults.get(planId) || {}
          results[event.tool_use_id] = event.content || ''
          this.planToolResults.set(planId, results)
        }
      }
    }

    cc.on('session:delta', deltaHandler)
    cc.on('session:message', messageHandler)
    cc.on('session:event', eventHandler)

    try {
      for (let i = 0; i < this.plans.length; i++) {
        if (this._aborted) break

        const plan = this.plans[i]
        if (plan.status === 'completed') continue

        this.setState({ currentPlanId: plan.id })

        this.planOutput.set(plan.id, '')
        this.planToolCalls.set(plan.id, [])
        this.planMessages.set(plan.id, [])
        this.planToolResults.set(plan.id, {})

        this.emit('plan:queued', { planId: plan.id, index: i, total: this.plans.length })

        if (this._aborted) break

        const remainingPlanPaths = this.plans
          .slice(i + 1)
          .filter(p => p.status !== 'completed')
          .map(p => resolve(this.options.docsPath, `${p.id}.md`))

        const planFilePath = resolve(this.options.docsPath, `${plan.id}.md`)
        const prompt = plan.content + ONE_FINAL_NOTE(planFilePath, remainingPlanPaths)

        const sessionId = await cc.start(prompt, {
          cwd: process.cwd(),
          streaming: true,
          dangerouslySkipPermissions: this.options.dangerouslySkipPermissions,
        })

        this.planSessionMap.set(plan.id, sessionId)
        this.currentSessionId = sessionId

        this.emit('plan:start', { planId: plan.id, sessionId })

        const session = await cc.waitForSession(sessionId)

        if (this._aborted) break

        if (session.status === 'error') {
          this.emit('plan:error', { planId: plan.id, sessionId, error: session.error })
          this.setState({ buildStatus: 'error' })
          await this.updateProjectStatus('failed')
          this.emit('build:error', {
            projectSlug: slug,
            error: session.error,
            failedPlanId: plan.id,
          })
          return
        }

        totalCost += session.costUsd || 0

        const toolCalls = this.planToolCalls.get(plan.id) || []
        const toolResults = this.planToolResults.get(plan.id) || {}
        const cacheData: PlanCacheData = {
          output: this.planOutput.get(plan.id) || '',
          toolCalls,
          messages: this.planMessages.get(plan.id) || [],
          toolResults,
          costUsd: session.costUsd || 0,
          turns: session.turns || 0,
          result: session.result || null,
          completedAt: new Date().toISOString(),
        }
        await this.cachePlanResult(plan.id, cacheData)
        this.planCache.set(plan.id, cacheData)

        await this.writeBuildReport(plan, cacheData)
        await this.markPlanCompleted(plan.id, {
          costUsd: session.costUsd || 0,
          turns: session.turns || 0,
          toolCalls: toolCalls.length,
        })
        plan.status = 'completed'

        this.emit('plan:complete', {
          planId: plan.id,
          sessionId,
          result: session.result,
          costUsd: session.costUsd,
          turns: session.turns,
        })
      }

      if (this._aborted) return

      this.setState({ buildStatus: 'completed', currentPlanId: null })
      this.currentSessionId = null
      await this.updateProjectStatus('completed')

      this.emit('build:complete', {
        projectSlug: slug,
        totalCost,
      })
    } finally {
      cc.off('session:delta', deltaHandler)
      cc.off('session:message', messageHandler)
      cc.off('session:event', eventHandler)
    }
  }

  // ── Abort ──────────────────────────────────────────────────────────────────

  /**
   * Abort the current build execution. Kills the active Claude Code session
   * and resets build status to ready.
   *
   * In client mode, proxies the request to the server.
   */
  async abort(): Promise<void> {
    await this._ready

    if (this.isClient) {
      await this.sendRequest('abort')
      return
    }

    if (this._aborted) return

    this._aborted = true
    this.setState({ buildStatus: 'aborting' })
    this.emit('build:aborting', { projectSlug: this.requireSlug() })

    if (this.currentSessionId) {
      try {
        const cc = this.container.feature('claudeCode')
        // Race abort against a timeout so we don't hang forever
        await Promise.race([
          cc.abort(this.currentSessionId),
          new Promise((_, reject) => setTimeout(() => reject(new Error('abort timed out')), 5_000)),
        ])
      } catch (err) {
        console.error(`Warning: could not abort session ${this.currentSessionId}:`, err)
      }
    }

    this.setState({ buildStatus: 'ready', currentPlanId: null })
    this.currentSessionId = null
    this.emit('build:aborted', { projectSlug: this.requireSlug() })
  }

  // ── Build Report Generation ────────────────────────────────────────────────

  /**
   * Write a markdown build report for a completed plan.
   * Reports include a summary table, full execution log with tool calls
   * and their results, and the final output.
   */
  private async writeBuildReport(plan: PlanInfo, data: PlanCacheData): Promise<void> {
    const slug = plan.id.split('/').pop() || plan.id
    const filePath = resolve(this.buildDir, `${slug}.md`)

    try {
      mkdirSync(dirname(filePath), { recursive: true })
    } catch {}

    const lines: string[] = []
    const projectSlug = this.requireSlug()

    lines.push('---')
    lines.push(`plan: ${plan.id}`)
    lines.push(`project: ${projectSlug}`)
    lines.push(`costUsd: ${data.costUsd}`)
    lines.push(`turns: ${data.turns}`)
    lines.push(`toolCalls: ${data.toolCalls.length}`)
    lines.push(`completedAt: "${data.completedAt}"`)
    lines.push('---')
    lines.push('')
    lines.push(`# ${plan.title} — Build Report`)
    lines.push('')
    lines.push('## Summary')
    lines.push('')
    lines.push('| Metric | Value |')
    lines.push('|--------|-------|')
    lines.push(`| Cost | $${data.costUsd.toFixed(4)} |`)
    lines.push(`| Turns | ${data.turns} |`)
    lines.push(`| Tool Calls | ${data.toolCalls.length} |`)
    lines.push(`| Completed | ${data.completedAt} |`)
    lines.push('')
    lines.push('## Execution Log')
    lines.push('')

    for (const msg of data.messages) {
      if (!msg?.message?.content) continue
      for (const block of msg.message.content) {
        if (block.type === 'text' && block.text?.trim()) {
          lines.push(block.text.trim())
          lines.push('')
        }
        if (block.type === 'tool_use') {
          lines.push(`### \`${block.name}\``)
          lines.push('')
          const paramSummary = this.formatToolParams(block.name, block.input)
          if (paramSummary) {
            lines.push('```')
            lines.push(paramSummary)
            lines.push('```')
            lines.push('')
          }
          const result = data.toolResults[block.id]
          if (result) {
            lines.push('<details>')
            lines.push(`<summary>Output (${result.length} chars)</summary>`)
            lines.push('')
            lines.push('```')
            lines.push(truncate(result))
            lines.push('```')
            lines.push('')
            lines.push('</details>')
            lines.push('')
          }
        }
      }
    }

    if (data.result) {
      lines.push('## Result')
      lines.push('')
      lines.push(data.result)
      lines.push('')
    }

    try {
      writeFileSync(filePath, lines.join('\n'), 'utf-8')
    } catch (err) {
      console.error(`Warning: could not write build report for ${plan.id}:`, err)
    }
  }

  private formatToolParams(name: string, input: any): string {
    if (!input) return ''
    switch (name) {
      case 'Read':
        return `file_path: ${input.file_path || '?'}${input.offset ? `\noffset: ${input.offset}` : ''}${input.limit ? `\nlimit: ${input.limit}` : ''}`
      case 'Write':
        return `file_path: ${input.file_path || '?'}\ncontent: (${(input.content || '').length} chars)`
      case 'Edit':
        return `file_path: ${input.file_path || '?'}\nold_string: ${truncate(input.old_string || '', 120)}\nnew_string: ${truncate(input.new_string || '', 120)}`
      case 'Bash':
        return `command: ${truncate(input.command || '', 200)}`
      case 'Grep':
        return `pattern: ${input.pattern || '?'}${input.path ? `\npath: ${input.path}` : ''}${input.glob ? `\nglob: ${input.glob}` : ''}`
      case 'Glob':
        return `pattern: ${input.pattern || '?'}${input.path ? `\npath: ${input.path}` : ''}`
      case 'Task':
        return `description: ${input.description || '?'}\nsubagent_type: ${input.subagent_type || '?'}`
      case 'WebFetch':
        return `url: ${input.url || '?'}`
      case 'WebSearch':
        return `query: ${input.query || '?'}`
      default:
        try {
          return truncate(JSON.stringify(input, null, 2), 300)
        } catch {
          return ''
        }
    }
  }

  // ── Persistence ────────────────────────────────────────────────────────────

  private async cachePlanResult(planId: string, data: PlanCacheData): Promise<void> {
    try {
      await this.cache.set(this.cacheKey(planId), data)
    } catch (err) {
      console.error(`Warning: could not cache result for ${planId}:`, err)
    }
  }

  /**
   * Persist plan completion status and stats back to the contentbase document.
   * Uses the Document API: mutate meta, then doc.save().
   */
  private async markPlanCompleted(planId: string, stats: { costUsd: number; turns: number; toolCalls: number }): Promise<void> {
    try {
      const doc = this.contentDb.collection.document(planId)
      doc.meta.status = 'completed'
      doc.meta.costUsd = stats.costUsd
      doc.meta.turns = stats.turns
      doc.meta.toolCalls = stats.toolCalls
      doc.meta.completedAt = new Date().toISOString()
      await doc.save({ normalize: false })
    } catch (err) {
      console.error(`Warning: could not update plan status for ${planId}:`, err)
    }
  }

  /**
   * Update the project document's status field.
   */
  private async updateProjectStatus(status: string): Promise<void> {
    try {
      const doc = this.contentDb.collection.document(`projects/${this.requireSlug()}`)
      doc.meta.status = status
      await doc.save({ normalize: false })
    } catch (err) {
      console.error(`Warning: could not update project status to "${status}":`, err)
    }
  }

  private sessionToPlan(sessionId: string): string | null {
    for (const [planId, sid] of this.planSessionMap) {
      if (sid === sessionId) return planId
    }
    return null
  }

  // ── Watcher Mode ──────────────────────────────────────────────────────────
  // Polls contentbase for approved projects and builds them automatically.
  // This is used by the orchestrator (luca main) instead of per-project mode.

  private _watchTimer: ReturnType<typeof setInterval> | null = null
  private _buildsInProgress = new Set<string>()

  /** Currently building project slugs. */
  get buildsInProgress(): string[] {
    return [...this._buildsInProgress]
  }

  /**
   * Start polling for approved projects. Each approved project gets a
   * ProjectBuilder instance that loads and runs its plans. Completed
   * or already-in-progress projects are skipped.
   */
  async startWatcher(): Promise<this> {
    if (this.state.get('watching')) return this

    this.setState({ watching: true })
    this.emit('watcher:started')

    // Run immediately, then on interval
    await this._watchTick()
    this._watchTimer = setInterval(() => this._watchTick(), this.options.watchInterval)

    return this
  }

  /** Stop the watcher. Does not abort in-progress builds. */
  stopWatcher(): this {
    if (this._watchTimer) {
      clearInterval(this._watchTimer)
      this._watchTimer = null
    }
    this.setState({ watching: false })
    this.emit('watcher:stopped')
    return this
  }

  private async _watchTick(): Promise<void> {
    try {
      const docs = (this.container as any).docs
      if (!docs.isLoaded) await docs.load()
      await docs.collection.load({ refresh: true })

      const { Project } = docs.models
      if (!Project) return

      const approved = await docs.query(Project).where('meta.status', 'approved').fetchAll()
      if (approved.length === 0) return

      for (const project of approved) {
        const slug = project.id.replace(/^projects\//, '')

        if (this._buildsInProgress.has(slug)) continue

        this._buildsInProgress.add(slug)
        this.emit('watcher:building', { slug })

        // Run async so we don't block other projects or the next tick
        this._buildProject(slug).finally(() => {
          this._buildsInProgress.delete(slug)
          // Refresh docs so subsequent ticks see updated statuses
          docs.collection.load({ refresh: true }).catch(() => {})
        })
      }
    } catch (err: any) {
      this.emit('watcher:error', { error: err?.message || String(err) })
    }
  }

  private async _buildProject(slug: string): Promise<void> {
    try {
      await this.container.helpers.discover('features')
      const builder = this.container.feature('projectBuilder', {
        projectSlug: slug,
        docsPath: this.options.docsPath,
        dangerouslySkipPermissions: this.options.dangerouslySkipPermissions,
      })

      await builder.load()

      if (!builder.project) {
        this.emit('watcher:build:error', { slug, error: 'failed to load project' })
        return
      }

      const pending = builder.plans.filter((p: any) => p.status !== 'completed')
      if (pending.length === 0) {
        this.emit('watcher:build:skipped', { slug, reason: 'all plans completed' })
        return
      }

      this.emit('watcher:build:start', { slug, pendingPlans: pending.length })

      // Forward builder events with slug context
      const forward = (event: string) => (data: any) => {
        this.emit(`watcher:${event}`, { slug, ...data })
      }

      builder.on('plan:start', forward('plan:start'))
      builder.on('plan:delta', forward('plan:delta'))
      builder.on('plan:complete', forward('plan:complete'))
      builder.on('plan:error', forward('plan:error'))
      builder.on('build:complete', forward('build:complete'))
      builder.on('build:error', forward('build:error'))

      await builder.run()
    } catch (err: any) {
      this.emit('watcher:build:error', { slug, error: err?.message || String(err) })
    }
  }
}

export default features.register('projectBuilder', ProjectBuilder)
