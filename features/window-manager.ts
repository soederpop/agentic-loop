import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '@soederpop/luca'
import { Feature, features } from '@soederpop/luca'
import { Server as NetServer, Socket } from 'net'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { randomUUID } from 'crypto'
import { existsSync, unlinkSync, mkdirSync } from 'fs'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    windowManager: typeof WindowManager
  }
}

const DEFAULT_SOCKET_PATH = join(
  homedir(),
  'Library',
  'Application Support',
  'LucaVoiceLauncher',
  'ipc-window.sock'
)

function controlPathFor(socketPath: string): string {
  return socketPath.replace(/\.sock$/, '-control.sock')
}

const ErrorCodes = ['BadRequest', 'NotFound', 'EvalFailed', 'Internal', 'Timeout', 'Disconnected', 'NoClient'] as const
type WindowManagerErrorCode = typeof ErrorCodes[number]

/**
 * Custom error class for WindowManager operations.
 * Carries a `code` property for programmatic error handling.
 */
export class WindowManagerError extends Error {
  code: WindowManagerErrorCode

  constructor(message: string, code: WindowManagerErrorCode = 'Internal') {
    super(message)
    this.name = 'WindowManagerError'
    this.code = code
  }
}

// --- Schemas ---

export const WindowManagerOptionsSchema = FeatureOptionsSchema.extend({
  socketPath: z.string().default(DEFAULT_SOCKET_PATH)
    .describe('Path to the Unix domain socket the server listens on'),
  autoListen: z.boolean().optional()
    .describe('Automatically start listening when the feature is enabled'),
  requestTimeoutMs: z.number().default(10000)
    .describe('Per-request timeout in milliseconds for window operations'),
})
export type WindowManagerOptions = z.infer<typeof WindowManagerOptionsSchema>

/** One window as tracked in feature state (keys are canonical lowercase ids). */
export const WindowTrackedEntrySchema = z.object({
  windowId: z.string().describe('Canonical id (lowercase)'),
  nativeWindowId: z.string().optional().describe('Last id string from the native app (may differ in casing)'),
  openedAt: z.number().optional().describe('Epoch ms when this process first recorded the window'),
  lastAck: z.any().optional().describe('JSON-serializable snapshot of the last relevant ack payload'),
  kind: z.enum(['browser', 'terminal', 'unknown']).optional().describe('How the window was opened, if known'),
})
export type WindowTrackedEntry = z.infer<typeof WindowTrackedEntrySchema>

/** In-flight window IPC op (the Promise + timer remain internal to the feature). */
export const WindowPendingOperationSchema = z.object({
  requestId: z.string(),
  action: z.string().optional(),
  startedAt: z.number(),
})
export type WindowPendingOperation = z.infer<typeof WindowPendingOperationSchema>

export const WindowManagerStateSchema = FeatureStateSchema.extend({
  listening: z.boolean().default(false)
    .describe('Whether the IPC server is listening'),
  clientConnected: z.boolean().default(false)
    .describe('Whether the native launcher app is connected'),
  socketPath: z.string().optional()
    .describe('The socket path in use'),
  windowCount: z.number().default(0)
    .describe('Number of tracked windows (mirrors keys of `windows`)'),
  windows: z.record(z.string(), WindowTrackedEntrySchema).default({})
    .describe('Open windows keyed by canonical id'),
  pendingOperations: z.array(WindowPendingOperationSchema).default([])
    .describe('Window commands awaiting windowAck'),
  producerCount: z.number().default(0)
    .describe('Producer sockets connected to this broker (broker mode only)'),
  lastError: z.string().optional()
    .describe('Last error message'),
  mode: z.enum(['broker', 'producer']).optional()
    .describe('Whether this instance is the broker (owns app socket) or a producer (routes through broker)'),
})
export type WindowManagerState = z.infer<typeof WindowManagerStateSchema>

export const WindowManagerEventsSchema = FeatureEventsSchema.extend({
  listening: z.tuple([]).describe('Emitted when the IPC server starts listening'),
  clientConnected: z.tuple([z.any().describe('The client socket')]).describe('Emitted when the native app connects'),
  clientDisconnected: z.tuple([]).describe('Emitted when the native app disconnects'),
  message: z.tuple([z.any().describe('The parsed message object')]).describe('Emitted for any incoming message that is not a windowAck'),
  windowAck: z.tuple([z.any().describe('The window ack payload')]).describe('Emitted when a window ack is received from the app'),
  windowClosed: z.tuple([z.any().describe('Lifecycle payload; includes canonical lowercase `windowId` when the closed window can be inferred (from `windowId`, `id`, nested fields, etc.)')]).describe('Emitted when the native app reports a window closed event'),
  terminalExited: z.tuple([z.any().describe('Terminal lifecycle payload emitted when a terminal process exits')]).describe('Emitted when the native app reports a terminal process exit event'),
  windowFocus: z.tuple([z.any().describe('Focus payload with windowId, kind, focused (boolean), and frame {x, y, width, height}')]).describe('Emitted when a window gains or loses focus'),
  error: z.tuple([z.any().describe('The error')]).describe('Emitted on error'),
})

// --- Types ---

/** A dimension value — either absolute points or a percentage string like `"50%"`. */
export type DimensionValue = number | `${number}%`

/**
 * Options for spawning a new native browser window.
 * Dimensions and positions accept absolute points or percentage strings (e.g. `"50%"`)
 * resolved against the primary display.
 */
export interface SpawnOptions {
  url?: string
  width?: DimensionValue
  height?: DimensionValue
  x?: DimensionValue
  y?: DimensionValue
  alwaysOnTop?: boolean
  window?: {
    decorations?: 'normal' | 'hiddenTitleBar' | 'none'
    transparent?: boolean
    shadow?: boolean
    alwaysOnTop?: boolean
    opacity?: number
    clickThrough?: boolean
  }
}

/**
 * Options for spawning a native terminal window.
 * Dimensions and positions accept absolute points or percentage strings (e.g. `"50%"`)
 * resolved against the primary display.
 */
export interface SpawnTTYOptions {
  /** Executable name or path (required). */
  command: string
  /** Arguments passed after the command. */
  args?: string[]
  /** Working directory for the process. */
  cwd?: string
  /** Environment variable overrides. */
  env?: Record<string, string>
  /** Initial terminal columns. */
  cols?: number
  /** Initial terminal rows. */
  rows?: number
  /** Window title. */
  title?: string
  /** Window width in points. */
  width?: DimensionValue
  /** Window height in points. */
  height?: DimensionValue
  /** Window x position. */
  x?: DimensionValue
  /** Window y position. */
  y?: DimensionValue
  /** Chrome options (decorations, alwaysOnTop, etc.) */
  window?: SpawnOptions['window']
}

/**
 * Options for capturing a screenshot from a native window.
 */
export interface WindowScreenGrabOptions {
  /** Window ID. If omitted, the launcher uses the most recent window. */
  windowId?: string
  /** Output file path for the PNG image. */
  path: string
}

/**
 * Options for recording video from a native window.
 */
export interface WindowVideoOptions {
  /** Window ID. If omitted, the launcher uses the most recent window. */
  windowId?: string
  /** Output file path for the video file. */
  path: string
  /** Recording duration in milliseconds. */
  durationMs?: number
}

/**
 * The result returned from a window ack.
 */
export interface WindowAckResult {
  ok?: boolean
  windowId?: string
  value?: string
  json?: any
  [key: string]: any
}

// --- Layout Types ---

/**
 * A single entry in a layout configuration.
 * Use `type: 'tty'` for terminal windows, `type: 'window'` (or omit) for browser windows.
 * If `type` is omitted, entries with a `command` field are treated as TTY, otherwise as window.
 */
export type LayoutEntry =
  | ({ type: 'window' } & SpawnOptions)
  | ({ type: 'tty' } & SpawnTTYOptions)
  | ({ type?: undefined } & SpawnOptions)
  | ({ type?: undefined; command: string } & SpawnTTYOptions)

// --- WindowHandle Events ---

interface WindowHandleEvents {
  close: [msg: any]
  terminalExited: [msg: any]
  focus: [msg: any]
  blur: [msg: any]
}

// --- WindowHandle ---

/**
 * A lightweight handle to a single native window.
 * Delegates all operations back to the WindowManager instance.
 * Emits lifecycle events (`close`, `terminalExited`) when the native app reports them.
 *
 * @example
 * ```typescript
 * const handle = await windowManager.spawn({ url: 'https://example.com' })
 * handle.on('close', (msg) => console.log('window closed', msg))
 * handle.on('terminalExited', (info) => console.log('process exited', info))
 * ```
 */
export class WindowHandle {
  private _events: any

  /** The original ack result from spawning this window. */
  public result: WindowAckResult

  constructor(
    public readonly windowId: string,
    private manager: WindowManager,
    result?: WindowAckResult
  ) {
    this.result = result ?? {}
    this._events = manager.container.bus()
  }

  /** Register a listener for a lifecycle event. */
  on<E extends keyof WindowHandleEvents>(event: E, listener: (...args: WindowHandleEvents[E]) => void): this {
    this._events.on(event, listener)
    return this
  }

  /** Remove a listener for a lifecycle event. */
  off<E extends keyof WindowHandleEvents>(event: E, listener?: (...args: WindowHandleEvents[E]) => void): this {
    this._events.off(event, listener)
    return this
  }
  
  async waitFor(event: string) {
    return this._events.waitFor(event as any)
  }

  /** Register a one-time listener for a lifecycle event. */
  once<E extends keyof WindowHandleEvents>(event: E, listener: (...args: WindowHandleEvents[E]) => void): this {
    this._events.once(event, listener)
    return this
  }

  /** Emit a lifecycle event on this handle. */
  emit<E extends keyof WindowHandleEvents>(event: E, ...args: WindowHandleEvents[E]): void {
    this._events.emit(event, ...args)
  }

  /** Bring this window to the front. */
  async focus(): Promise<WindowAckResult> {
    return this.manager.focus(this.windowId)
  }

  /** Close this window. */
  async close(): Promise<WindowAckResult> {
    return this.manager.close(this.windowId)
  }

  /** Navigate this window to a URL. */
  async navigate(url: string): Promise<WindowAckResult> {
    return this.manager.navigate(this.windowId, url)
  }

  /** Evaluate JavaScript in this window's web view. */
  async eval(code: string, opts?: { timeoutMs?: number; returnJson?: boolean }): Promise<WindowAckResult> {
    return this.manager.eval(this.windowId, code, opts)
  }

  /** Capture a PNG screenshot of this window. */
  async screengrab(path: string): Promise<WindowAckResult> {
    return this.manager.screengrab({ windowId: this.windowId, path })
  }

  /** Record a video of this window to disk. */
  async video(path: string, opts?: { durationMs?: number }): Promise<WindowAckResult> {
    return this.manager.video({ windowId: this.windowId, path, durationMs: opts?.durationMs })
  }
}

// --- Private types ---

type PendingRequest = {
  resolve: (value: any) => void
  reject: (reason: any) => void
  timer: ReturnType<typeof setTimeout>
}

interface ClientConnection {
  socket: Socket
  buffer: string
}

// --- Feature ---

/**
 * WindowManager Feature — Native window control via LucaVoiceLauncher
 *
 * Uses a broker/producer architecture so multiple luca processes can trigger
 * window operations without competing for the same Unix socket.
 *
 * **Architecture:**
 * - The first process to call `listen()` becomes the **broker**. It owns
 *   the app-facing socket (`ipc-window.sock`) and a control socket
 *   (`ipc-window-control.sock`).
 * - Subsequent processes detect the broker and become **producers**. They
 *   connect to the control socket and route commands through the broker.
 * - The broker forwards producer commands to the native app and routes
 *   acks and lifecycle events back to the originating producer.
 *
 * **Protocol:**
 * - Bun listens on a Unix domain socket; the native app connects as a client
 * - Window dispatch commands are sent as NDJSON with a `window` field
 * - The app executes window commands and sends back `windowAck` messages
 * - Any non-windowAck message from the app is emitted as a `message` event
 * - Other features can use `send()` to write arbitrary NDJSON to the app
 *
 * **Capabilities:**
 * - Spawn native browser windows with configurable chrome
 * - Navigate, focus, close, and eval JavaScript in windows
 * - Multiple luca processes can trigger window operations simultaneously
 * - Automatic broker detection and producer fallback
 *
 * Observable state includes `windows` (open window metadata), `pendingOperations`
 * (in-flight command ids), and `producerCount` (broker). Sockets, promises, and
 * `WindowHandle` instances stay internal.
 *
 * **Producer state:** The broker pushes `windowStateSync` on the control socket when a
 * producer connects and whenever the window roster changes, so every process sees the
 * same `windows` / `windowCount` / `clientConnected` as the broker (not only its own acks).
 *
 * @example
 * ```typescript
 * const wm = container.feature('windowManager', { enable: true, autoListen: true })
 *
 * const handle = await wm.spawn({ url: 'https://google.com', width: 800, height: 600 })
 * handle.on('close', (msg) => console.log('window closed'))
 * await handle.navigate('https://news.ycombinator.com')
 * const title = await handle.eval('document.title')
 * await handle.close()
 *
 * // Other features can listen for non-window messages
 * wm.on('message', (msg) => console.log('App says:', msg))
 *
 * // Other features can write raw NDJSON to the app
 * wm.send({ id: 'abc', status: 'processing', speech: 'Working on it' })
 * ```
 */
export class WindowManager extends Feature<WindowManagerState, WindowManagerOptions> {
  static override shortcut = 'features.windowManager' as const
  static override stateSchema = WindowManagerStateSchema
  static override optionsSchema = WindowManagerOptionsSchema
  static override eventsSchema = WindowManagerEventsSchema
  static { Feature.register(this, 'windowManager') }

  // --- Shared state ---
  private _pending = new Map<string, PendingRequest>()
  private _handles = new Map<string, WindowHandle>()
  private _mode: 'broker' | 'producer' | null = null

  // --- Broker-only state ---
  private _server?: NetServer              // app-facing socket server
  private _controlServer?: NetServer       // producer-facing socket server
  private _client?: ClientConnection       // the connected native app
  private _producers = new Map<string, ClientConnection>()    // connected producer processes
  private _requestOrigins = new Map<string, Socket>()         // requestId → producer socket

  // --- Producer-only state ---
  private _controlClient?: ClientConnection  // connection to broker's control socket

  private normalizeRequestId(value: unknown): string | undefined {
    if (typeof value !== 'string') return undefined
    return value.toLowerCase()
  }

  /** Lowercase map key for `_handles` so lookups match regardless of native id casing. */
  private handleMapKey(value: unknown): string | undefined {
    if (typeof value === 'number' && !Number.isNaN(value)) return String(value).toLowerCase()
    return this.normalizeRequestId(value)
  }

  /**
   * Best-effort window id from a native lifecycle message (field names differ by app version).
   */
  private extractLifecycleWindowId(msg: any): string | undefined {
    if (!msg || typeof msg !== 'object') return undefined
    const candidates = [
      msg.windowId,
      msg.window_id,
      msg.windowID,
      msg.window?.id,
      msg.window?.windowId,
      msg.payload?.windowId,
      msg.result?.windowId,
      msg.id,
    ]
    for (const c of candidates) {
      if (typeof c === 'string' && c.length > 0) return c
      if (typeof c === 'number' && !Number.isNaN(c)) return String(c)
    }
    return undefined
  }

  /** Copy lifecycle message and set `windowId` to a canonical lowercase string when inferable. */
  private enrichLifecycleWithCanonicalWindowId(msg: any): any {
    const raw = this.extractLifecycleWindowId(msg)
    if (raw === undefined) return msg
    const key = this.handleMapKey(raw)
    if (!key) return msg
    return { ...msg, windowId: key }
  }

  /** Structured clone via JSON for stashing ack snapshots in observable state. */
  private snapshotForState(value: unknown): any {
    if (value === undefined) return undefined
    try {
      return JSON.parse(JSON.stringify(value))
    } catch {
      return undefined
    }
  }

  private syncProducerCount(): void {
    this.setState({ producerCount: this._producers.size })
  }

  private registerPendingOperation(id: string, action: string | undefined, entry: PendingRequest): void {
    this._pending.set(id, entry)
    this.setState((cur) => ({
      pendingOperations: [
        ...(cur.pendingOperations ?? []),
        { requestId: id, action, startedAt: Date.now() },
      ],
    }))
  }

  /** Clears timer, drops from `_pending` and from `pendingOperations` state. */
  private takePendingRequest(id: string): PendingRequest | undefined {
    const pending = this._pending.get(id)
    if (!pending) return undefined
    clearTimeout(pending.timer)
    this._pending.delete(id)
    this.setState((cur) => ({
      pendingOperations: (cur.pendingOperations ?? []).filter((o) => o.requestId !== id),
    }))
    return pending
  }

  /** Default state: not listening, no client connected, zero windows tracked. */
  override get initialState(): WindowManagerState {
    return {
      ...super.initialState,
      listening: false,
      clientConnected: false,
      windowCount: 0,
      windows: {},
      pendingOperations: [],
      producerCount: 0,
    }
  }

  /** Whether this instance is acting as the broker. */
  get isBroker(): boolean {
    return this._mode === 'broker'
  }

  /** Whether this instance is acting as a producer. */
  get isProducer(): boolean {
    return this._mode === 'producer'
  }

  /** Whether the IPC server is currently listening (broker) or connected to broker (producer). */
  get isListening(): boolean {
    return this.state.get('listening') || false
  }

  /** Whether the native app client is currently connected (only meaningful for broker). */
  get isClientConnected(): boolean {
    return this.state.get('clientConnected') || false
  }

  override async enable(options: any = {}): Promise<this> {
    await super.enable(options)

    if (this.options.autoListen) {
      await this.listen()
    }

    return this
  }

  /**
   * Start the window manager. Automatically detects whether a broker already
   * exists and either becomes the broker or connects as a producer.
   *
   * - If no broker is running: becomes the broker, binds the app socket and
   *   a control socket for producers.
   * - If a broker is already running: connects as a producer through the
   *   control socket.
   *
   * @param socketPath - Override the configured app socket path
   * @returns This feature instance for chaining
   */
  async listen(socketPath?: string): Promise<this> {
    if (this._mode) return this

    socketPath = socketPath || this.options.socketPath || DEFAULT_SOCKET_PATH
    const controlPath = controlPathFor(socketPath)

    // Ensure the directory exists
    const dir = dirname(socketPath)
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true })
      } catch (error: any) {
        this.setState({ lastError: `Failed to create socket directory ${dir}: ${error?.message || String(error)}` })
        return this
      }
    }

    // Try to connect to an existing broker's control socket
    const brokerAlive = await this.probeSocket(controlPath)
    if (brokerAlive) {
      return this.connectAsProducer(controlPath, socketPath)
    }

    // No broker — we become the broker
    return this.becomeBroker(socketPath, controlPath)
  }

  /**
   * Remove stale socket files without starting or stopping the server.
   * Useful when a previous process crashed and left dead sockets behind.
   * Will not remove sockets that have live listeners.
   *
   * @param socketPath - Override the configured socket path
   * @returns true if a stale socket was removed
   */
  async cleanupSocket(socketPath?: string): Promise<boolean> {
    socketPath = socketPath || this.options.socketPath || DEFAULT_SOCKET_PATH
    if (this._server) return false
    if (!existsSync(socketPath)) return false
    const isAlive = await this.probeSocket(socketPath)
    if (isAlive) return false
    try {
      unlinkSync(socketPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Stop the window manager and clean up all connections.
   * Rejects any pending window operation requests.
   *
   * @returns This feature instance for chaining
   */
  async stop(): Promise<this> {
    // Resolve all pending requests
    for (const [, pending] of this._pending) {
      clearTimeout(pending.timer)
      pending.resolve({ ok: false, error: 'Server stopping' })
    }
    this._pending.clear()
    this._handles.clear()

    // --- Producer cleanup ---
    if (this._controlClient) {
      this._controlClient.socket.destroy()
      this._controlClient = undefined
    }

    // --- Broker cleanup ---
    if (this._client) {
      this._client.socket.destroy()
      this._client = undefined
    }

    for (const [, producer] of this._producers) {
      producer.socket.destroy()
    }
    this._producers.clear()
    this._requestOrigins.clear()

    const socketPath = this.state.get('socketPath')
    const controlPath = socketPath ? controlPathFor(socketPath) : undefined

    if (this._controlServer) {
      await new Promise<void>((resolve) => {
        this._controlServer!.close(() => resolve())
      })
      this._controlServer = undefined
    }

    if (this._server) {
      await new Promise<void>((resolve) => {
        this._server!.close(() => resolve())
      })
      this._server = undefined
    }

    // Clean up socket files (only if we were the broker)
    if (this._mode === 'broker') {
      if (socketPath && existsSync(socketPath)) {
        try { unlinkSync(socketPath) } catch { /* ignore */ }
      }
      if (controlPath && existsSync(controlPath)) {
        try { unlinkSync(controlPath) } catch { /* ignore */ }
      }
    }

    this._mode = null
    this.setState({
      listening: false,
      clientConnected: false,
      socketPath: undefined,
      windowCount: 0,
      windows: {},
      pendingOperations: [],
      producerCount: 0,
      mode: undefined,
    })
    return this
  }

  // --- Window Operations ---

  /**
   * Spawn a new native browser window.
   * Sends a window dispatch to the app and waits for the ack.
   *
   * @param opts - Window configuration (url, dimensions, chrome options)
   * @returns A WindowHandle for the spawned window (with `.result` containing the ack data)
   */
  async spawn(opts: SpawnOptions = {}): Promise<WindowHandle> {
    const resolved = this.resolveDimensions(opts)
    const { window: windowChrome, ...flat } = resolved

    let ackResult: WindowAckResult
    if (windowChrome) {
      ackResult = await this.sendWindowCommand({
        action: 'open',
        request: {
          ...flat,
          window: windowChrome,
        },
      })
    } else {
      ackResult = await this.sendWindowCommand({
        action: 'open',
        ...flat,
        alwaysOnTop: flat.alwaysOnTop ?? false,
      })
    }

    return this.getOrCreateHandle(ackResult.windowId, ackResult, 'browser')
  }

  /**
   * Spawn a native terminal window running a command.
   * The terminal is read-only — stdout/stderr are rendered with ANSI support.
   * Closing the window terminates the process.
   *
   * @param opts - Terminal configuration (command, args, cwd, dimensions, etc.)
   * @returns A WindowHandle for the spawned terminal (with `.result` containing the ack data)
   */
  async spawnTTY(opts: SpawnTTYOptions): Promise<WindowHandle> {
    const resolved = this.resolveDimensions(opts)
    const { window: windowChrome, ...flat } = resolved

    let ackResult: WindowAckResult
    if (windowChrome) {
      ackResult = await this.sendWindowCommand({
        action: 'terminal',
        ...flat,
        window: windowChrome,
      })
    } else {
      ackResult = await this.sendWindowCommand({
        action: 'terminal',
        ...flat,
      })
    }

    return this.getOrCreateHandle(ackResult.windowId, ackResult, 'terminal')
  }

  /**
   * Bring a window to the front.
   *
   * @param windowId - The window ID. If omitted, the app uses the most recent window.
   * @returns The window ack result
   */
  async focus(windowId?: string): Promise<WindowAckResult> {
    return this.sendWindowCommand({
      action: 'focus',
      ...(windowId ? { windowId } : {}),
    })
  }

  /**
   * Close a window.
   *
   * @param windowId - The window ID. If omitted, the app closes the most recent window.
   * @returns The window ack result
   */
  async close(windowId?: string): Promise<WindowAckResult> {
    return this.sendWindowCommand({
      action: 'close',
      ...(windowId ? { windowId } : {}),
    })
  }

  /**
   * Navigate a window to a new URL.
   *
   * @param windowId - The window ID
   * @param url - The URL to navigate to
   * @returns The window ack result
   */
  async navigate(windowId: string, url: string): Promise<WindowAckResult> {
    return this.sendWindowCommand({
      action: 'navigate',
      windowId,
      url,
    })
  }

  /**
   * Evaluate JavaScript in a window's web view.
   *
   * @param windowId - The window ID
   * @param code - JavaScript code to evaluate
   * @param opts - timeoutMs (default 5000), returnJson (default true)
   * @returns The evaluation result from the window ack
   */
  async eval(windowId: string, code: string, opts?: { timeoutMs?: number; returnJson?: boolean }): Promise<WindowAckResult> {
    return this.sendWindowCommand({
      action: 'eval',
      windowId,
      code,
      ...(opts?.timeoutMs != null ? { timeoutMs: opts.timeoutMs } : {}),
      ...(opts?.returnJson != null ? { returnJson: opts.returnJson } : {}),
    })
  }

  /**
   * Capture a PNG screenshot from a window.
   *
   * @param opts - Window target and output path
   * @returns The window ack result
   */
  async screengrab(opts: WindowScreenGrabOptions): Promise<WindowAckResult> {
    return this.sendWindowCommand({
      action: 'screengrab',
      ...(opts.windowId ? { windowId: opts.windowId } : {}),
      path: opts.path,
    })
  }

  /**
   * Record a video from a window to disk.
   *
   * @param opts - Window target, output path, and optional duration
   * @returns The window ack result
   */
  async video(opts: WindowVideoOptions): Promise<WindowAckResult> {
    return this.sendWindowCommand({
      action: 'video',
      ...(opts.windowId ? { windowId: opts.windowId } : {}),
      path: opts.path,
      ...(opts.durationMs != null ? { durationMs: opts.durationMs } : {}),
    })
  }

  /**
   * Get a WindowHandle for chainable operations on a specific window.
   * Returns the tracked handle if one exists, otherwise creates a new one.
   *
   * @param windowId - The window ID
   * @returns A WindowHandle instance
   */
  window(windowId: string): WindowHandle {
    return this.getOrCreateHandle(windowId)
  }

  /**
   * Spawn multiple windows in parallel from a layout configuration.
   * Returns handles in the same order as the config entries.
   *
   * @param config - Array of layout entries (window or tty)
   * @returns Array of WindowHandle instances
   *
   * @example
   * ```typescript
   * const handles = await wm.spawnLayout([
   *   { type: 'window', url: 'https://google.com', width: 800, height: 600 },
   *   { type: 'tty', command: 'htop' },
   *   { url: 'https://github.com' }, // defaults to window
   * ])
   * ```
   */
  async spawnLayout(config: LayoutEntry[]): Promise<WindowHandle[]> {
    const handles: WindowHandle[] = []
    for (const entry of config) {
      if (entry.type === 'tty' || ('command' in entry && !entry.type)) {
        const { type, ...opts } = entry as { type?: string } & SpawnTTYOptions
        handles.push(await this.spawnTTY(opts))
      } else {
        const { type, ...opts } = entry as { type?: string } & SpawnOptions
        handles.push(await this.spawn(opts))
      }
    }
    return handles
  }

  /**
   * Spawn multiple layouts sequentially. Each layout's windows spawn in parallel,
   * but the next layout waits for the previous one to fully complete.
   *
   * @param configs - Array of layout configurations
   * @returns Array of handle arrays, one per layout
   *
   * @example
   * ```typescript
   * const [firstBatch, secondBatch] = await wm.spawnLayouts([
   *   [{ url: 'https://google.com' }, { url: 'https://github.com' }],
   *   [{ type: 'tty', command: 'htop' }],
   * ])
   * ```
   */
  async spawnLayouts(configs: LayoutEntry[][]): Promise<WindowHandle[][]> {
    const results: WindowHandle[][] = []
    for (const config of configs) {
      results.push(await this.spawnLayout(config))
    }
    return results
  }

  /**
   * Write an NDJSON message to the connected app client.
   * In producer mode, routes through the broker.
   * Public so other features can send arbitrary protocol messages over the same socket.
   *
   * @param msg - The message object to send (will be JSON-serialized + newline)
   * @returns True if the message was written, false if no connection is available
   */
  send(msg: Record<string, any>): boolean {
    if (this._mode === 'producer' && this._controlClient) {
      this._controlClient.socket.write(JSON.stringify(msg) + '\n')
      return true
    }
    if (!this._client) return false
    this._client.socket.write(JSON.stringify(msg) + '\n')
    return true
  }

  // =====================================================================
  // Private — Broker / Producer lifecycle
  // =====================================================================

  /** Get or create a tracked WindowHandle for a given windowId. */
  private getOrCreateHandle(
    windowId: string | undefined,
    result?: WindowAckResult,
    kind: 'browser' | 'terminal' | 'unknown' = 'unknown',
  ): WindowHandle {
    const id = windowId ?? result?.windowId ?? randomUUID()
    const mapKey = this.handleMapKey(id) ?? id
    let handle = this._handles.get(mapKey)
    if (!handle) {
      handle = new WindowHandle(id, this, result)
      this._handles.set(mapKey, handle)
    } else if (result) {
      handle.result = result
    }
    this.trackWindowOpened(id, { kind: kind !== 'unknown' ? kind : undefined })
    return handle
  }

  /**
   * Probe an existing socket to see if a live listener is behind it.
   * Attempts a quick connect — if it succeeds, someone is listening.
   */
  private probeSocket(socketPath: string): Promise<boolean> {
    if (!existsSync(socketPath)) return Promise.resolve(false)
    return new Promise<boolean>((resolve) => {
      const probe = new Socket()
      const timer = setTimeout(() => {
        probe.destroy()
        resolve(false)
      }, 500)

      probe.once('connect', () => {
        clearTimeout(timer)
        probe.destroy()
        resolve(true)
      })

      probe.once('error', () => {
        clearTimeout(timer)
        probe.destroy()
        resolve(false)
      })

      probe.connect(socketPath)
    })
  }

  // =====================================================================
  // Broker mode — owns the app socket and the control socket
  // =====================================================================

  private async becomeBroker(socketPath: string, controlPath: string): Promise<this> {
    // Clean up stale app socket
    if (existsSync(socketPath)) {
      try { unlinkSync(socketPath) } catch { /* ignore */ }
    }
    // Clean up stale control socket
    if (existsSync(controlPath)) {
      try { unlinkSync(controlPath) } catch { /* ignore */ }
    }

    // Bind the app-facing socket (native launcher connects here)
    const server = new NetServer((socket) => {
      this.handleAppClientConnect(socket)
    })
    this._server = server

    server.on('error', (err) => {
      this.setState({ lastError: err.message })
    })

    await new Promise<void>((resolve) => {
      server.listen(socketPath, () => resolve())
    })

    // Bind the control socket (producer processes connect here)
    const controlServer = new NetServer((socket) => {
      this.handleProducerConnect(socket)
    })
    this._controlServer = controlServer

    controlServer.on('error', (err) => {
      this.setState({ lastError: `Control socket error: ${err.message}` })
    })

    await new Promise<void>((resolve) => {
      controlServer.listen(controlPath, () => resolve())
    })

    this._mode = 'broker'
    this.setState({ listening: true, socketPath, mode: 'broker' })
    this.emit('listening')

    return this
  }

  /**
   * Handle a new app client connection from the native launcher.
   * Sets up NDJSON buffering and event forwarding.
   */
  private handleAppClientConnect(socket: Socket): void {
    const client: ClientConnection = { socket, buffer: '' }

    if (this._client) {
      this._client.socket.destroy()
    }
    this._client = client

    this.setState({ clientConnected: true })
    this.emit('clientConnected', socket)

    socket.on('data', (chunk) => {
      client.buffer += chunk.toString()
      const lines = client.buffer.split('\n')
      client.buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.trim()) this.processAppMessage(line)
      }
    })

    socket.on('close', () => {
      if (this._client === client) {
        this._client = undefined
        this._handles.clear()
        this.setState({
          clientConnected: false,
          windowCount: 0,
          windows: {},
          pendingOperations: [],
        })
        this.broadcastWindowStateSync()

        // Resolve all pending requests — the app is gone
        for (const [, pending] of this._pending) {
          clearTimeout(pending.timer)
          pending.resolve({ ok: false, error: 'Client disconnected' })
        }
        this._pending.clear()

        // Notify producers that app disconnected — resolve their in-flight requests
        for (const [reqId, producerSocket] of this._requestOrigins) {
          try {
            producerSocket.write(JSON.stringify({
              type: 'windowAck',
              id: reqId,
              success: false,
              error: 'App client disconnected',
            }) + '\n')
          } catch { /* producer gone */ }
        }
        this._requestOrigins.clear()

        this.emit('clientDisconnected')
      }
    })

    socket.on('error', (err) => {
      this.setState({ lastError: err.message })
    })
  }

  /**
   * Handle a new producer connection on the control socket.
   * Producers send window commands; broker forwards to app and routes acks back.
   */
  private handleProducerConnect(socket: Socket): void {
    const id = randomUUID()
    const client: ClientConnection = { socket, buffer: '' }
    this._producers.set(id, client)
    this.syncProducerCount()
    this.sendWindowStateSyncToSocket(socket)

    socket.on('data', (chunk) => {
      client.buffer += chunk.toString()
      const lines = client.buffer.split('\n')
      client.buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.trim()) this.processProducerMessage(line, socket)
      }
    })

    socket.on('close', () => {
      this._producers.delete(id)
      this.syncProducerCount()
      // Clean up request origins for this producer
      for (const [reqId, sock] of this._requestOrigins) {
        if (sock === socket) this._requestOrigins.delete(reqId)
      }
    })

    socket.on('error', () => {
      this._producers.delete(id)
      this.syncProducerCount()
    })
  }

  /**
   * Process a message from a producer. Records the origin so acks can be
   * routed back, then forwards the command to the app client.
   */
  private processProducerMessage(line: string, producerSocket: Socket): void {
    let msg: any
    try { msg = JSON.parse(line) } catch { return }

    const requestId = this.normalizeRequestId(msg.id)
    if (requestId) {
      this._requestOrigins.set(requestId, producerSocket)
    }

    // Forward to the native app client
    if (!this._client) {
      // No app connected — send error back to producer immediately
      if (requestId) {
        this._requestOrigins.delete(requestId)
        try {
          producerSocket.write(JSON.stringify({
            type: 'windowAck',
            id: msg.id,
            success: false,
            error: 'No native launcher client connected',
          }) + '\n')
        } catch { /* producer gone */ }
      }
      return
    }

    this._client.socket.write(line + '\n')
  }

  /**
   * Process a message from the native app (broker mode).
   * Routes windowAck back to the originating producer or resolves locally.
   * Broadcasts lifecycle events to all producers.
   */
  private processAppMessage(line: string): void {
    let msg: any
    try { msg = JSON.parse(line) } catch { return }

    if (msg.type === 'windowAck') {
      this.emit('windowAck', msg)
      const rosterChanged = this.updateTrackedWindowsFromAck(msg)

      const ackId = this.normalizeRequestId(msg.id)

      // Route to originating producer if this was a proxied request
      if (ackId && this._requestOrigins.has(ackId)) {
        const producerSocket = this._requestOrigins.get(ackId)!
        this._requestOrigins.delete(ackId)
        try {
          producerSocket.write(line + '\n')
        } catch { /* producer disconnected */ }
        if (rosterChanged) this.broadcastWindowStateSync()
        return
      }

      // Otherwise resolve locally (broker's own request)
      if (ackId) {
        const pending = this.takePendingRequest(ackId)
        if (pending) {
          if (msg.success) {
            pending.resolve(msg.result ?? msg)
          } else {
            pending.resolve({ ok: false, error: msg.error || 'Window operation failed' })
          }
        }
      }
      if (rosterChanged) this.broadcastWindowStateSync()
      return
    }

    let messageOut = msg

    if (msg.type === 'windowClosed') {
      messageOut = this.enrichLifecycleWithCanonicalWindowId(msg)
      this.trackWindowClosed(messageOut.windowId)
      const key = this.handleMapKey(messageOut.windowId)
      const handle = key ? this._handles.get(key) : undefined
      if (handle && key) {
        handle.emit('close', messageOut)
        this._handles.delete(key)
      }
      this.emit('windowClosed', messageOut)
      // Broadcast to all producers
      this.broadcastToProducers(JSON.stringify(messageOut))
      this.broadcastWindowStateSync()
    }

    if (msg.type === 'terminalExited') {
      messageOut = this.enrichLifecycleWithCanonicalWindowId(msg)
      const key = this.handleMapKey(messageOut.windowId)
      const handle = key ? this._handles.get(key) : undefined
      if (handle) handle.emit('terminalExited', messageOut)
      this.emit('terminalExited', messageOut)
      // Broadcast to all producers
      this.broadcastToProducers(JSON.stringify(messageOut))
    }

    if (msg.type === 'windowFocus') {
      messageOut = this.enrichLifecycleWithCanonicalWindowId(msg)
      const key = this.handleMapKey(messageOut.windowId)
      const handle = key ? this._handles.get(key) : undefined
      if (handle) handle.emit(messageOut.focused ? 'focus' : 'blur', messageOut)
      this.emit('windowFocus', messageOut)
      // Broadcast to all producers
      this.broadcastToProducers(JSON.stringify(messageOut))
    }

    this.emit('message', messageOut)
  }

  /** Send an NDJSON line to all connected producers. */
  private broadcastToProducers(line: string): void {
    for (const [, producer] of this._producers) {
      try {
        producer.socket.write(line + '\n')
      } catch { /* producer gone */ }
    }
  }

  /** Broker: snapshot of roster + app connectivity for producers (internal protocol). */
  private buildWindowStateSyncPayload(): Record<string, unknown> {
    return {
      type: 'windowStateSync',
      windows: this.state.get('windows') ?? {},
      windowCount: this.state.get('windowCount') ?? 0,
      clientConnected: this.state.get('clientConnected') ?? false,
    }
  }

  /** Broker: push current window roster to one producer control socket. */
  private sendWindowStateSyncToSocket(socket: Socket): void {
    if (this._mode !== 'broker') return
    try {
      socket.write(JSON.stringify(this.buildWindowStateSyncPayload()) + '\n')
    } catch { /* gone */ }
  }

  /** Broker: fan out roster snapshot so all producers converge with broker state. */
  private broadcastWindowStateSync(): void {
    if (this._mode !== 'broker' || this._producers.size === 0) return
    const line = JSON.stringify(this.buildWindowStateSyncPayload())
    this.broadcastToProducers(line)
  }

  // =====================================================================
  // Producer mode — routes commands through the broker
  // =====================================================================

  private connectAsProducer(controlPath: string, socketPath: string): Promise<this> {
    return new Promise<this>((resolve, reject) => {
      const socket = new Socket()
      const client: ClientConnection = { socket, buffer: '' }

      const timer = setTimeout(() => {
        socket.destroy()
        this.setState({ lastError: `Timed out connecting to broker at ${controlPath}` })
        reject(new WindowManagerError(`Timed out connecting to broker`, 'Timeout'))
      }, 3000)

      socket.connect(controlPath, () => {
        clearTimeout(timer)
        this._mode = 'producer'
        this._controlClient = client
        this.setState({ listening: true, socketPath, mode: 'producer' })
        this.emit('listening')
        resolve(this)
      })

      socket.on('data', (chunk) => {
        client.buffer += chunk.toString()
        const lines = client.buffer.split('\n')
        client.buffer = lines.pop() || ''
        for (const line of lines) {
          if (line.trim()) this.processProducerIncoming(line)
        }
      })

      socket.on('close', () => {
        this._controlClient = undefined
        this._mode = null
        for (const [mapKey, handle] of [...this._handles.entries()]) {
          handle.emit('close', {
            type: 'windowClosed',
            windowId: mapKey,
            reason: 'brokerDisconnected',
          })
        }
        this._handles.clear()
        this.setState({
          listening: false,
          mode: undefined,
          pendingOperations: [],
          windows: {},
          windowCount: 0,
        })

        // Resolve all pending requests — broker is gone
        for (const [, pending] of this._pending) {
          clearTimeout(pending.timer)
          pending.resolve({ ok: false, error: 'Broker disconnected' })
        }
        this._pending.clear()
      })

      socket.on('error', (err) => {
        clearTimeout(timer)
        this.setState({ lastError: `Broker connection error: ${err.message}` })
      })
    })
  }

  /**
   * Process a message received from the broker (producer mode).
   * Handles windowAck (resolves pending requests) and lifecycle events.
   */
  private processProducerIncoming(line: string): void {
    let msg: any
    try { msg = JSON.parse(line) } catch { return }

    if (msg.type === 'windowStateSync') {
      this.applyProducerWindowStateSync(msg)
      return
    }

    if (msg.type === 'windowAck') {
      this.emit('windowAck', msg)
      this.updateTrackedWindowsFromAck(msg)

      const ackId = this.normalizeRequestId(msg.id)
      if (ackId) {
        const pending = this.takePendingRequest(ackId)
        if (pending) {
          if (msg.success) {
            pending.resolve(msg.result ?? msg)
          } else {
            pending.resolve({ ok: false, error: msg.error || 'Window operation failed' })
          }
        }
      }
      return
    }

    let messageOut = msg

    if (msg.type === 'windowClosed') {
      messageOut = this.enrichLifecycleWithCanonicalWindowId(msg)
      this.trackWindowClosed(messageOut.windowId)
      const key = this.handleMapKey(messageOut.windowId)
      const handle = key ? this._handles.get(key) : undefined
      if (handle && key) {
        handle.emit('close', messageOut)
        this._handles.delete(key)
      }
      this.emit('windowClosed', messageOut)
    }

    if (msg.type === 'terminalExited') {
      messageOut = this.enrichLifecycleWithCanonicalWindowId(msg)
      const key = this.handleMapKey(messageOut.windowId)
      const handle = key ? this._handles.get(key) : undefined
      if (handle) handle.emit('terminalExited', messageOut)
      this.emit('terminalExited', messageOut)
    }

    if (msg.type === 'windowFocus') {
      messageOut = this.enrichLifecycleWithCanonicalWindowId(msg)
      const key = this.handleMapKey(messageOut.windowId)
      const handle = key ? this._handles.get(key) : undefined
      if (handle) handle.emit(messageOut.focused ? 'focus' : 'blur', messageOut)
      this.emit('windowFocus', messageOut)
    }

    this.emit('message', messageOut)
  }

  // =====================================================================
  // Shared internals
  // =====================================================================

  private _displayCache: { width: number; height: number } | null = null

  /**
   * Get the primary display resolution, cached for the lifetime of the feature.
   */
  private getPrimaryDisplay(): { width: number; height: number } {
    if (this._displayCache) return this._displayCache
    const osFeature = this.container.feature('os')
    const displays = osFeature.getDisplayInfo()
    const primary = displays.find(d => d.main) ?? displays[0]
    if (!primary) throw new Error('No displays found')
    this._displayCache = { width: primary.resolution.width, height: primary.resolution.height }
    return this._displayCache
  }

  /**
   * Resolve percentage-based dimension values to absolute points using the primary display.
   * Passes through absolute numbers unchanged. Only fetches display info if percentages are present.
   */
  private resolveDimensions<T extends Record<string, any>>(opts: T): T {
    const keys = ['width', 'height', 'x', 'y'] as const
    const hasPercentage = keys.some(k => typeof opts[k] === 'string' && (opts[k] as string).endsWith('%'))
    if (!hasPercentage) return opts

    const display = this.getPrimaryDisplay()
    const resolved = { ...opts }

    for (const key of keys) {
      const val = opts[key]
      if (typeof val === 'string' && val.endsWith('%')) {
        const pct = parseFloat(val) / 100
        const ref = (key === 'width' || key === 'x') ? display.width : display.height
        ;(resolved as any)[key] = Math.round(pct * ref)
      }
    }

    return resolved
  }

  /**
   * Send a window dispatch command and wait for the ack.
   * In broker mode, sends directly to the app client.
   * In producer mode, routes through the broker via the control socket.
   * If not yet started, calls listen() to auto-detect mode.
   */
  private sendWindowCommand(windowPayload: Record<string, any>): Promise<WindowAckResult> {
    return new Promise<WindowAckResult>(async (resolve, reject) => {
      const timeoutMs = this.options.requestTimeoutMs || 10000

      // Auto-start if needed
      if (!this._mode) {
        await this.listen()
      }

      // In producer mode, we don't wait for app client — the broker handles that.
      // We just need our control connection to be alive.
      if (this._mode === 'producer') {
        if (!this._controlClient) {
          resolve({ ok: false, error: 'Not connected to broker', code: 'Disconnected' })
          return
        }

        const rawId = randomUUID()
        const id = this.normalizeRequestId(rawId) || rawId

        const timer = setTimeout(() => {
          const p = this.takePendingRequest(id)
          if (p) {
            p.resolve({ ok: false, error: `Window ${windowPayload.action} timed out after ${timeoutMs}ms`, code: 'Timeout' })
          }
        }, timeoutMs)

        this.registerPendingOperation(id, windowPayload.action, { resolve, reject, timer })

        const payload = {
          id,
          status: 'processing',
          window: windowPayload,
          timestamp: new Date().toISOString(),
        }

        this._controlClient.socket.write(JSON.stringify(payload) + '\n')
        return
      }

      // Broker mode — send directly to app client
      if (!this._client) {
        // Wait for app client to connect
        const connected = await this.waitForAppClient(timeoutMs)
        if (!connected) {
          const error = `No native launcher client connected on socket ${this.state.get('socketPath') || this.options.socketPath}`
          this.setState({ lastError: error })
          resolve({ ok: false, error, code: 'NoClient' })
          return
        }
      }

      const rawId = randomUUID()
      const id = this.normalizeRequestId(rawId) || rawId

      const timer = setTimeout(() => {
        const p = this.takePendingRequest(id)
        if (p) {
          p.resolve({ ok: false, error: `Window ${windowPayload.action} timed out after ${timeoutMs}ms`, code: 'Timeout' })
        }
      }, timeoutMs)

      this.registerPendingOperation(id, windowPayload.action, { resolve, reject, timer })

      const payload = {
        id,
        status: 'processing',
        window: windowPayload,
        timestamp: new Date().toISOString(),
      }
      const sent = this.send(payload)

      if (!sent) {
        const p = this.takePendingRequest(id)
        const error = `Failed to send window ${windowPayload.action}: client disconnected`
        this.setState({ lastError: error })
        if (p) {
          p.resolve({ ok: false, error, code: 'Disconnected' })
        }
      }
    })
  }

  /** Wait for the native app to connect (broker mode only). */
  private waitForAppClient(timeoutMs: number): Promise<boolean> {
    if (this._client) return Promise.resolve(true)

    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.off('clientConnected', onConnected)
        resolve(false)
      }, timeoutMs)

      const onConnected = () => {
        clearTimeout(timer)
        resolve(true)
      }

      this.once('clientConnected', onConnected)
    })
  }

  /** Returns true if the open-window roster changed (broker should fan out `windowStateSync`). */
  private updateTrackedWindowsFromAck(msg: any): boolean {
    if (!msg?.success) return false
    if (typeof msg?.action !== 'string') return false

    const action = msg.action.toLowerCase()
    const resultWindowId = msg?.result?.windowId

    if (action === 'open' || action === 'spawn' || action === 'terminal') {
      const before = Object.keys(this.state.get('windows') ?? {}).length
      this.trackWindowOpened(resultWindowId, {
        kind: action === 'terminal' ? 'terminal' : 'browser',
        lastAck: msg,
      })
      return Object.keys(this.state.get('windows') ?? {}).length !== before
    }

    if (action === 'close') {
      const before = Object.keys(this.state.get('windows') ?? {}).length
      this.trackWindowClosed(resultWindowId)
      return Object.keys(this.state.get('windows') ?? {}).length !== before
    }

    return false
  }

  /** Producer: apply broker snapshot; drop local handles for windows no longer in the roster. */
  private applyProducerWindowStateSync(msg: any): void {
    const raw = msg?.windows
    const windows =
      raw && typeof raw === 'object' && !Array.isArray(raw)
        ? (raw as Record<string, WindowTrackedEntry>)
        : {}
    const windowCount =
      typeof msg?.windowCount === 'number' ? msg.windowCount : Object.keys(windows).length
    const patch: Partial<WindowManagerState> = { windows, windowCount }
    if (typeof msg?.clientConnected === 'boolean') {
      patch.clientConnected = msg.clientConnected
    }
    this.setState(patch)
    this.pruneHandlesMissingFromRoster(windows)
  }

  private pruneHandlesMissingFromRoster(windows: Record<string, WindowTrackedEntry>): void {
    const allowed = new Set(Object.keys(windows))
    for (const [mapKey, handle] of [...this._handles.entries()]) {
      if (!allowed.has(mapKey)) {
        handle.emit('close', {
          type: 'windowClosed',
          windowId: mapKey,
          reason: 'windowStateSync',
        })
        this._handles.delete(mapKey)
      }
    }
  }

  private trackWindowOpened(
    windowId: unknown,
    extra?: { kind?: 'browser' | 'terminal' | 'unknown'; lastAck?: unknown },
  ): void {
    const normalized = this.normalizeRequestId(windowId)
    if (!normalized) return
    const native = typeof windowId === 'string' ? windowId : normalized
    this.setState((cur) => {
      const windows = { ...(cur.windows ?? {}) }
      const prev = windows[normalized]
      windows[normalized] = {
        windowId: normalized,
        nativeWindowId: prev?.nativeWindowId ?? native,
        openedAt: prev?.openedAt ?? Date.now(),
        lastAck:
          extra?.lastAck !== undefined ? this.snapshotForState(extra.lastAck) : prev?.lastAck,
        kind: extra?.kind ?? prev?.kind ?? 'unknown',
      }
      return { windows, windowCount: Object.keys(windows).length }
    })
  }

  private trackWindowClosed(windowId: unknown): void {
    const normalized = this.normalizeRequestId(windowId)
    if (!normalized) return
    this.setState((cur) => {
      const windows = { ...(cur.windows ?? {}) }
      delete windows[normalized]
      return { windows, windowCount: Object.keys(windows).length }
    })
  }
}

export default features.register('windowManager', WindowManager)
