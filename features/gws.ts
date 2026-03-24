import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature, features } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    gws: typeof Gws
  }
}

// Error classes
export class GwsError extends Error {
  constructor(
    message: string,
    public exitCode: number,
    public stderr: string,
    public command: string
  ) {
    super(message)
    this.name = 'GwsError'
  }
}

export class GwsNotFoundError extends GwsError {
  constructor(command: string) {
    super('GWS CLI not found. Install with: npm install -g @googleworkspace/cli', 1, '', command)
    this.name = 'GwsNotFoundError'
  }
}

export class GwsAuthError extends GwsError {
  constructor(message: string, exitCode: number, stderr: string, command: string) {
    super(message, exitCode, stderr, command)
    this.name = 'GwsAuthError'
  }
}

// Schemas
export const GwsStateSchema = FeatureStateSchema.extend({
  binaryPath: z.string().nullable().default(null),
  available: z.boolean().default(false),
  activeProfile: z.string().nullable().default(null),
})
export type GwsState = z.infer<typeof GwsStateSchema>

export const GwsOptionsSchema = FeatureOptionsSchema.extend({
  configDir: z.string().optional().describe('Path to GWS CLI config directory. Defaults to ~/.config/gws'),
})
export type GwsOptions = z.infer<typeof GwsOptionsSchema>

// Interfaces
interface GwsExecOptions {
  params?: Record<string, string | number | boolean>
  flags?: string[]
  json?: boolean
  ndjson?: boolean
  profile?: string
}

function extractVerdict(authResults: string, mechanism: string): string {
  // Matches patterns like "spf=pass", "dkim=fail", "dmarc=none"
  const re = new RegExp(`${mechanism}=([a-zA-Z]+)`)
  const match = authResults.match(re)
  return match ? match[1].toLowerCase() : 'none'
}

/**
 * Google Workspace CLI wrapper providing access to the full GWS API surface via subprocess.
 * Supports profile-based credential management and typed sub-interfaces for Gmail, Sheets, Calendar, Drive, Docs, and Chat.
 */
export class Gws extends Feature<GwsState, GwsOptions> {
  static override shortcut = 'features.gws' as const
  static override description = 'Google Workspace CLI wrapper providing access to the full GWS API surface via subprocess'
  static override stateSchema = GwsStateSchema
  static override optionsSchema = GwsOptionsSchema

  static tools = {
    gwsListProfiles: {
      description: 'List all available GWS credential profiles',
      schema: z.object({}),
    },
    gwsSendEmail: {
      description: 'Send an email via Gmail',
      schema: z.object({
        to: z.string().describe('Recipient email address'),
        subject: z.string().describe('Email subject line'),
        body: z.string().describe('Email body text'),
        profile: z.string().optional().describe('Named credential profile to use'),
      }),
    },
    gwsSearchEmail: {
      description: 'Search Gmail messages using a query string',
      schema: z.object({
        query: z.string().describe('Gmail search query (e.g. "from:someone@example.com is:unread")'),
        maxResults: z.number().optional().describe('Maximum number of results to return'),
        profile: z.string().optional().describe('Named credential profile to use'),
      }),
    },
    gwsReadEmail: {
      description: 'Read the full content of an email message by ID',
      schema: z.object({
        id: z.string().describe('Gmail message ID'),
        markAsRead: z.boolean().optional().describe('Mark the message as read after reading'),
        profile: z.string().optional().describe('Named credential profile to use'),
      }),
    },
    gwsTriageEmail: {
      description: 'Get a triage summary of recent Gmail messages',
      schema: z.object({
        max: z.number().optional().describe('Maximum number of messages to triage'),
        query: z.string().optional().describe('Gmail search query to filter messages'),
        profile: z.string().optional().describe('Named credential profile to use'),
      }),
    },
    gwsTrashEmail: {
      description: 'Move an email to the trash',
      schema: z.object({
        id: z.string().describe('Gmail message ID'),
        profile: z.string().optional().describe('Named credential profile to use'),
      }),
    },
    gwsArchiveEmail: {
      description: 'Archive an email (remove from inbox)',
      schema: z.object({
        id: z.string().describe('Gmail message ID'),
        profile: z.string().optional().describe('Named credential profile to use'),
      }),
    },
    gwsValidateEmail: {
      description: 'Validate an email message for authenticity (SPF, DKIM, DMARC) and compute a trust score',
      schema: z.object({
        id: z.string().describe('Gmail message ID'),
        profile: z.string().optional().describe('Named credential profile to use'),
      }),
    },
    gwsGetCalendarAgenda: {
      description: 'View upcoming calendar events',
      schema: z.object({
        days: z.number().optional().describe('Number of days to look ahead'),
        calendar: z.string().optional().describe('Calendar ID to query'),
        profile: z.string().optional().describe('Named credential profile to use'),
      }),
    },
    gwsCreateCalendarEvent: {
      description: 'Create a new calendar event',
      schema: z.object({
        summary: z.string().describe('Event title'),
        start: z.string().describe('Start time (ISO 8601 or natural language)'),
        end: z.string().optional().describe('End time'),
        duration: z.number().optional().describe('Duration in minutes (alternative to end)'),
        calendar: z.string().optional().describe('Calendar ID'),
        location: z.string().optional().describe('Event location'),
        description: z.string().optional().describe('Event description'),
        attendees: z.array(z.string()).optional().describe('List of attendee email addresses'),
        profile: z.string().optional().describe('Named credential profile to use'),
      }),
    },
    gwsReadSpreadsheet: {
      description: 'Read data from a Google Sheets spreadsheet',
      schema: z.object({
        spreadsheet: z.string().describe('Spreadsheet ID or URL'),
        range: z.string().describe('Cell range (e.g. "Sheet1!A1:D10")'),
        profile: z.string().optional().describe('Named credential profile to use'),
      }),
    },
    gwsAppendToSpreadsheet: {
      description: 'Append rows to a Google Sheets spreadsheet',
      schema: z.object({
        spreadsheet: z.string().describe('Spreadsheet ID or URL'),
        values: z.string().optional().describe('Comma-separated values to append'),
        jsonValues: z.array(z.array(z.string())).optional().describe('2D array of values to append'),
        profile: z.string().optional().describe('Named credential profile to use'),
      }),
    },
    gwsSearchDrive: {
      description: 'Search Google Drive for files',
      schema: z.object({
        query: z.string().describe('Drive search query'),
        pageSize: z.number().optional().describe('Maximum number of results'),
        profile: z.string().optional().describe('Named credential profile to use'),
      }),
    },
    gwsSendChatMessage: {
      description: 'Send a message to a Google Chat space',
      schema: z.object({
        space: z.string().describe('Chat space ID'),
        text: z.string().describe('Message text'),
        profile: z.string().optional().describe('Named credential profile to use'),
      }),
    },
    gwsCheckAuth: {
      description: 'Check whether GWS authentication is valid for the current or specified profile',
      schema: z.object({
        profile: z.string().optional().describe('Named credential profile to check'),
      }),
    },
  }

  private _binaryPath: string | null = null
  private _resolved = false

  override get initialState(): GwsState {
    return {
      ...super.initialState,
      binaryPath: null,
      available: false,
      activeProfile: null,
    }
  }

  private get proc() {
    return this.container.feature('proc')
  }

  private get fs() {
    return this.container.feature('fs')
  }

  get configDir(): string {
    return this.options.configDir || this.container.paths.resolve(this.container.os.homedir, '.config', 'gws')
  }

  /** Returns the config directory for a given profile. No profile uses ~/.config/gws, named profiles use ~/.config/gws-<name>. */
  configDirForProfile(profile?: string | null): string {
    const homeConfig = this.container.paths.resolve(this.container.os.homedir, '.config', 'gws')
    if (!profile) return homeConfig
    return `${homeConfig}-${profile}`
  }

  private async resolveBinary(): Promise<string | null> {
    if (this._resolved) return this._binaryPath

    try {
      const result = await this.proc.spawnAndCapture('which', ['gws'])
      if (result.exitCode === 0 && result.stdout.trim()) {
        this._binaryPath = result.stdout.trim()
        this._resolved = true
        this.state.setState({ binaryPath: this._binaryPath, available: true })
        return this._binaryPath
      }
    } catch {}

    // Fallback: check npx
    try {
      const result = await this.proc.spawnAndCapture('npx', ['@googleworkspace/cli', '--version'])
      if (result.exitCode === 0) {
        this._binaryPath = 'npx @googleworkspace/cli'
        this._resolved = true
        this.state.setState({ binaryPath: this._binaryPath, available: true })
        return this._binaryPath
      }
    } catch {}

    this._resolved = true
    this.state.setState({ available: false })
    return null
  }

  /** Checks whether the GWS CLI binary can be resolved on this system. */
  async isAvailable(): Promise<boolean> {
    await this.resolveBinary()
    return this._binaryPath !== null
  }

  /** Returns the installed GWS CLI version string. */
  async version(): Promise<string> {
    const bin = await this.resolveBinary()
    if (!bin) throw new GwsNotFoundError('gws --version')

    const result = await this.proc.spawnAndCapture('gws', ['--version'])
    return result.stdout.trim()
  }

  private buildEnv(profile?: string): Record<string, string> {
    // Resolve which profile to use: per-call override > active state > default (no profile)
    const targetProfile = profile || this.currentProfile || undefined

    // Handle inline credentials path (from useCredentials)
    if (targetProfile?.startsWith('__inline:')) {
      const path = targetProfile.slice('__inline:'.length)
      const dir = this.configDirForProfile()
      return {
        GOOGLE_WORKSPACE_CLI_CONFIG_DIR: dir,
        GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE: path,
      }
    }

    // Default uses ~/.config/gws, named profile uses ~/.config/gws-<name>
    const dir = this.configDirForProfile(targetProfile)
    const env: Record<string, string> = {
      GOOGLE_WORKSPACE_CLI_CONFIG_DIR: dir,
    }

    // Check for profile.json (oauth login reference)
    const profileJsonPath = `${dir}/profile.json`
    if (this.fs.exists(profileJsonPath)) {
      try {
        const cfg = JSON.parse(this.fs.readFile(profileJsonPath))
        if (cfg.account) {
          env.GOOGLE_WORKSPACE_CLI_ACCOUNT = cfg.account
        }
        if (cfg.credentialsFile) {
          env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE = cfg.credentialsFile
        }
        return env
      } catch {}
    }

    // Fallback: direct credential files in the config dir
    const saPath = `${dir}/service-account.json`
    const credPath = `${dir}/credentials.json`

    if (this.fs.exists(saPath)) {
      env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE = saPath
    } else if (this.fs.exists(credPath)) {
      env.GOOGLE_WORKSPACE_CLI_CREDENTIALS_FILE = credPath
    }

    return env
  }

  private buildArgs(
    path: string[],
    options?: GwsExecOptions
  ): string[] {
    const args = [...path]

    if (options?.params && Object.keys(options.params).length > 0) {
      args.push('--params', JSON.stringify(options.params))
    }

    if (options?.flags) {
      args.push(...options.flags)
    }

    return args
  }

  private parseOutput(stdout: string, options?: GwsExecOptions): any {
    if (options?.json === false) return stdout

    if (options?.ndjson) {
      return stdout
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => JSON.parse(line))
    }

    const trimmed = stdout.trim()
    if (!trimmed) return null

    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }

  private classifyError(exitCode: number, stderr: string, command: string): GwsError {
    const lower = stderr.toLowerCase()
    if (lower.includes('auth') || lower.includes('credential') || lower.includes('token') || lower.includes('login')) {
      return new GwsAuthError(`GWS auth error: ${stderr.trim()}`, exitCode, stderr, command)
    }
    return new GwsError(`GWS CLI error (exit ${exitCode}): ${stderr.trim()}`, exitCode, stderr, command)
  }

  /** Executes an arbitrary GWS CLI command. Accepts path segments and an optional trailing options object. */
  async exec(...segments: [...string[], GwsExecOptions] | string[]): Promise<any> {
    let options: GwsExecOptions | undefined
    let path: string[]

    // Last arg may be options object
    const last = segments[segments.length - 1]
    if (typeof last === 'object' && last !== null) {
      options = last as GwsExecOptions
      path = segments.slice(0, -1) as string[]
    } else {
      path = segments as string[]
    }

    const bin = await this.resolveBinary()
    if (!bin) throw new GwsNotFoundError(`gws ${path.join(' ')}`)

    const args = this.buildArgs(path, options)
    const env = this.buildEnv(options?.profile)
    const commandStr = `gws ${args.join(' ')}`
    
    console.log('gws exec', { args, env })

    const result = await this.proc.spawnAndCapture('gws', args, {
      env: { ...process.env, ...env },
    })

    if (result.exitCode !== 0) {
      throw this.classifyError(result.exitCode, result.stderr, commandStr)
    }

    return this.parseOutput(result.stdout, options)
  }

  /** Executes a GWS CLI helper command (e.g. `gws gmail +send`). Helpers use --key value args instead of --params JSON. */
  async helper(service: string, helperName: string, options?: GwsExecOptions): Promise<any> {
    const bin = await this.resolveBinary()
    if (!bin) throw new GwsNotFoundError(`gws ${service} ${helperName}`)

    const args = [service, helperName]

    // Helpers use --key value style, not --params JSON
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        args.push(`--${key}`, String(value))
      }
    }
    if (options?.flags) {
      args.push(...options.flags)
    }

    // Default to JSON output unless explicitly set to false or ndjson
    if (options?.json !== false && !options?.ndjson) {
      args.push('--format', 'json')
    }

    const env = this.buildEnv(options?.profile)
    const commandStr = `gws ${args.join(' ')}`

    console.log('gws helper', { args, env })

    const result = await this.proc.spawnAndCapture('gws', args, {
      env: { ...process.env, ...env },
    })

    if (result.exitCode !== 0) {
      throw this.classifyError(result.exitCode, result.stderr, commandStr)
    }

    return this.parseOutput(result.stdout, options)
  }

  /** Returns the name of the currently active credential profile, or null if none is set. */
  get currentProfile(): string | null {
    return this.state.get('activeProfile') || null
  }

  /** Activates a named credential profile. Throws if ~/.config/gws-<name> does not exist. */
  useProfile(name: string): void {
    const dir = this.configDirForProfile(name)
    if (!this.fs.exists(dir)) {
      throw new Error(`GWS profile '${name}' not found at ${dir}`)
    }
    this.state.setState({ activeProfile: name })
  }

  /** Clears the active credential profile so subsequent commands use default credentials. */
  clearProfile(): void {
    this.state.setState({ activeProfile: null })
  }

  /** Points all subsequent commands at a specific credentials file path, bypassing the profile system. */
  useCredentials(path: string): void {
    if (!this.fs.exists(path)) {
      throw new Error(`Credentials file not found: ${path}`)
    }
    // Store the raw path as a special "inline" profile
    this.state.setState({ activeProfile: `__inline:${path}` })
  }

  /** Lists all available credential profile names by scanning for ~/.config/gws-* directories. */
  profiles(): string[] {
    const configParent = this.container.paths.resolve(this.container.os.homedir, '.config')
    try {
      const entries = this.fs.readdirSync(configParent)
      const profiles: string[] = []

      for (const name of entries) {
        if (!name.startsWith('gws-')) continue
        const profileName = name.slice('gws-'.length)
        if (!profileName) continue
        const dir = `${configParent}/${name}`
        if (this.fs.exists(`${dir}/profile.json`) || this.fs.exists(`${dir}/credentials.json`) || this.fs.exists(`${dir}/service-account.json`)) {
          profiles.push(profileName)
        }
      }

      return profiles
    } catch {
      return []
    }
  }

  /** Authentication sub-interface for checking, inspecting, and refreshing GWS auth state. */
  auth = {
    check: async (): Promise<boolean> => {
      try {
        const env = this.buildEnv()
        const result = await this.proc.spawnAndCapture('gws', ['auth', 'status'], {
          env: { ...process.env, ...env },
        })
        return result.exitCode === 0
      } catch {
        return false
      }
    },

    info: async (): Promise<Record<string, any>> => {
      const env = this.buildEnv()
      const result = await this.proc.spawnAndCapture('gws', ['auth', 'status'], {
        env: { ...process.env, ...env },
      })
      if (result.exitCode !== 0) {
        throw this.classifyError(result.exitCode, result.stderr, 'gws auth status')
      }
      const trimmed = result.stdout.trim()
      try {
        return JSON.parse(trimmed)
      } catch {
        return { raw: trimmed }
      }
    },

    refresh: async (): Promise<void> => {
      const env = this.buildEnv()
      const result = await this.proc.spawnAndCapture('gws', ['auth', 'refresh'], {
        env: { ...process.env, ...env },
      })
      if (result.exitCode !== 0) {
        throw this.classifyError(result.exitCode, result.stderr, 'gws auth refresh')
      }
    },
  }

  /** Gmail sub-interface for sending, triaging, reading, searching, and validating email messages. */
  gmail = {
    send: async (opts: { to: string; subject: string; body: string; profile?: string }) => {
      return this.helper('gmail', '+send', {
        params: { to: opts.to, subject: opts.subject, body: opts.body },
        profile: opts.profile,
      })
    },

    triage: async (opts?: { max?: number; query?: string; labels?: boolean; profile?: string }) => {
      const params: Record<string, string | number | boolean> = {}
      if (opts?.max) params.max = opts.max
      if (opts?.query) params.query = opts.query
      if (opts?.labels) params.labels = true
      return this.helper('gmail', '+triage', { params, profile: opts?.profile })
    },

    watch: async (opts?: { project?: string; subscription?: string; once?: boolean; cleanup?: boolean; profile?: string }) => {
      const params: Record<string, string | number | boolean> = {}
      const flags: string[] = []
      if (opts?.project) params.project = opts.project
      if (opts?.subscription) params.subscription = opts.subscription
      if (opts?.once) flags.push('--once')
      if (opts?.cleanup) flags.push('--cleanup')
      return this.helper('gmail', '+watch', { params, flags, ndjson: true, profile: opts?.profile })
    },

    get: async (opts: { id: string; format?: 'full' | 'metadata' | 'minimal' | 'raw'; profile?: string }) => {
      return this.exec('gmail', 'users', 'messages', 'get', {
        params: { userId: 'me', id: opts.id, ...(opts.format ? { format: opts.format } : {}) },
        profile: opts.profile,
      })
    },

    markAsRead: async (opts: { id: string; profile?: string }) => {
      return this.exec('gmail', 'users', 'messages', 'modify', {
        params: { userId: 'me', id: opts.id },
        flags: ['--json', JSON.stringify({ removeLabelIds: ['UNREAD'] })],
        profile: opts.profile,
      })
    },

    readMessage: async (opts: { id: string; markAsRead?: boolean; profile?: string }): Promise<{
      id: string
      subject: string
      from: string
      to: string
      date: string
      body: { text: string | null; html: string | null }
      snippet: string
      labels: string[]
    }> => {
      const msg = await this.gmail.get({ id: opts.id, format: 'full', profile: opts.profile })

      const headers: Record<string, string> = {}
      for (const h of (msg?.payload?.headers || [])) {
        headers[h.name.toLowerCase()] = h.value
      }

      const decode = (data: string): string =>
        Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8')

      const extractBody = (payload: any): { text: string | null; html: string | null } => {
        // Simple message — body directly on payload
        if (!payload.parts) {
          const mime = payload.mimeType || ''
          const data = payload.body?.data
          if (!data) return { text: null, html: null }
          const decoded = decode(data)
          return {
            text: mime.includes('plain') ? decoded : null,
            html: mime.includes('html') ? decoded : null,
          }
        }

        // Multipart — walk parts recursively
        let text: string | null = null
        let html: string | null = null

        const walk = (parts: any[]) => {
          for (const part of parts) {
            if (part.parts) {
              walk(part.parts)
            } else if (part.body?.data) {
              const decoded = decode(part.body.data)
              if (part.mimeType === 'text/plain' && !text) text = decoded
              if (part.mimeType === 'text/html' && !html) html = decoded
            }
          }
        }
        walk(payload.parts)
        return { text, html }
      }

      if (opts.markAsRead) {
        await this.gmail.markAsRead({ id: opts.id, profile: opts.profile })
      }

      return {
        id: msg.id,
        subject: headers['subject'] || '',
        from: headers['from'] || '',
        to: headers['to'] || '',
        date: headers['date'] || '',
        body: extractBody(msg.payload),
        snippet: msg.snippet || '',
        labels: msg.labelIds || [],
      }
    },

    search: async (opts: { query: string; maxResults?: number; profile?: string }) => {
      const params: Record<string, string | number | boolean> = { userId: 'me', q: opts.query }
      if (opts.maxResults) params.maxResults = opts.maxResults
      return this.exec('gmail', 'users', 'messages', 'list', { params, profile: opts.profile })
    },

    trash: async (opts: { id: string; profile?: string }) => {
      return this.exec('gmail', 'users', 'messages', 'trash', {
        params: { userId: 'me', id: opts.id },
        profile: opts.profile,
      })
    },

    archive: async (opts: { id: string; profile?: string }) => {
      return this.exec('gmail', 'users', 'messages', 'modify', {
        params: { userId: 'me', id: opts.id },
        flags: ['--json', JSON.stringify({ removeLabelIds: ['INBOX'] })],
        profile: opts.profile,
      })
    },

    getHeaders: async (opts: { id: string; profile?: string }): Promise<Record<string, string>> => {
      const msg = await this.gmail.get({ id: opts.id, format: 'metadata', profile: opts.profile })
      const headers: Record<string, string> = {}
      for (const h of (msg?.payload?.headers || [])) {
        // Keep first occurrence for single-value headers, last for multi-value
        const key = h.name.toLowerCase()
        headers[key] = h.value
      }
      return headers
    },

    authResults: async (opts: { id: string; profile?: string }): Promise<{
      spf: string; dkim: string; dmarc: string; raw: string
    }> => {
      const headers = await this.gmail.getHeaders(opts)
      const raw = headers['authentication-results'] || ''
      return {
        spf: extractVerdict(raw, 'spf'),
        dkim: extractVerdict(raw, 'dkim'),
        dmarc: extractVerdict(raw, 'dmarc'),
        raw,
      }
    },

    parseFrom: (fromHeader: string): { name: string; address: string; domain: string } => {
      const match = fromHeader.match(/^(?:"?([^"<]*?)"?\s*)?<?([^\s>]+@([^\s>]+))>?$/)
      if (!match) return { name: '', address: fromHeader, domain: '' }
      return { name: (match[1] || '').trim(), address: match[2], domain: match[3].toLowerCase() }
    },

    validate: async (opts: { id: string; profile?: string }): Promise<{
      from: { name: string; address: string; domain: string }
      replyTo: { address: string; domain: string } | null
      returnPath: { address: string; domain: string } | null
      auth: { spf: string; dkim: string; dmarc: string; raw: string }
      flags: string[]
      trustScore: number
    }> => {
      const headers = await this.gmail.getHeaders(opts)

      console.log('headers', headers)

      const authRaw = headers['authentication-results'] || ''

      const from = this.gmail.parseFrom(headers['from'] || '')
      const auth = {
        spf: extractVerdict(authRaw, 'spf'),
        dkim: extractVerdict(authRaw, 'dkim'),
        dmarc: extractVerdict(authRaw, 'dmarc'),
        raw: authRaw,
      }

      // Parse Reply-To
      let replyTo: { address: string; domain: string } | null = null
      if (headers['reply-to']) {
        const parsed = this.gmail.parseFrom(headers['reply-to'])
        replyTo = { address: parsed.address, domain: parsed.domain }
      }

      // Parse Return-Path
      let returnPath: { address: string; domain: string } | null = null
      if (headers['return-path']) {
        const parsed = this.gmail.parseFrom(headers['return-path'])
        returnPath = { address: parsed.address, domain: parsed.domain }
      }

      // Build flags
      const flags: string[] = []

      if (auth.spf !== 'pass') flags.push(`spf-${auth.spf}`)
      if (auth.dkim !== 'pass') flags.push(`dkim-${auth.dkim}`)
      if (auth.dmarc !== 'pass') flags.push(`dmarc-${auth.dmarc}`)

      if (replyTo && replyTo.domain !== from.domain) {
        flags.push(`reply-to-mismatch: ${replyTo.address} vs ${from.domain}`)
      }

      if (returnPath && returnPath.domain !== from.domain) {
        flags.push(`return-path-mismatch: ${returnPath.address} vs ${from.domain}`)
      }

      // Display name spoofing: name contains an email-like string from a different domain
      if (from.name) {
        const embeddedEmail = from.name.match(/[\w.+-]+@[\w.-]+/)
        if (embeddedEmail) {
          const embeddedDomain = embeddedEmail[0].split('@')[1]?.toLowerCase()
          if (embeddedDomain && embeddedDomain !== from.domain) {
            flags.push(`display-name-spoofing: name contains ${embeddedEmail[0]}`)
          }
        }
      }

      // Trust score: start at 100, deduct for issues
      let trustScore = 100
      if (auth.spf !== 'pass') trustScore -= 25
      if (auth.dkim !== 'pass') trustScore -= 25
      if (auth.dmarc !== 'pass') trustScore -= 25
      if (replyTo && replyTo.domain !== from.domain) trustScore -= 15
      if (returnPath && returnPath.domain !== from.domain) trustScore -= 10
      if (flags.some(f => f.startsWith('display-name-spoofing'))) trustScore -= 20
      trustScore = Math.max(0, trustScore)

      return { from, replyTo, returnPath, auth, flags, trustScore }
    },

    searchAndValidateEmails: async (opts: {
      from?: string
      unread?: boolean
      maxResults?: number
      profile?: string
    }) => {
      const queryParts: string[] = []
      if (opts.from) queryParts.push(`from:${opts.from}`)
      if (opts.unread) queryParts.push('is:unread')
      const query = queryParts.join(' ') || 'in:inbox'

      const results = await this.gmail.search({
        query,
        maxResults: opts.maxResults,
        profile: opts.profile,
      })

      const messages: { id: string; threadId?: string }[] = results?.messages || []
      if (!messages.length) return []

      return Promise.all(
        messages.map(async (msg) => {
          const full = await this.gmail.get({ id: msg.id, format: 'metadata', profile: opts.profile })
          const validation = await this.gmail.validate({ id: msg.id, profile: opts.profile })
          return { id: msg.id, snippet: full?.snippet || '', validation }
        })
      )
    },
  }

  /** Google Sheets sub-interface for reading and appending spreadsheet data. */
  sheets = {
    read: async (opts: { spreadsheet: string; range: string; profile?: string }) => {
      return this.helper('sheets', '+read', {
        params: { spreadsheet: opts.spreadsheet, range: opts.range },
        profile: opts.profile,
      })
    },

    append: async (opts: { spreadsheet: string; values?: string; jsonValues?: string[][]; profile?: string }) => {
      const params: Record<string, string | number | boolean> = { spreadsheet: opts.spreadsheet }
      if (opts.values) params.values = opts.values
      if (opts.jsonValues) params['json-values'] = JSON.stringify(opts.jsonValues)
      return this.helper('sheets', '+append', { params, profile: opts.profile })
    },
  }

  /** Google Calendar sub-interface for viewing agenda and inserting events. */
  calendar = {
    agenda: async (opts?: { days?: number; calendar?: string; profile?: string }) => {
      const params: Record<string, string | number | boolean> = {}
      if (opts?.days) params.days = opts.days
      if (opts?.calendar) params.calendar = opts.calendar
      return this.helper('calendar', '+agenda', { params, profile: opts?.profile })
    },

    insert: async (opts: {
      summary: string
      start: string
      end?: string
      duration?: number
      calendar?: string
      location?: string
      description?: string
      attendees?: string[]
      profile?: string
    }) => {
      const params: Record<string, string | number | boolean> = {
        summary: opts.summary,
        start: opts.start,
      }
      if (opts.end) params.end = opts.end
      if (opts.duration) params.duration = opts.duration
      if (opts.calendar) params.calendar = opts.calendar
      if (opts.location) params.location = opts.location
      if (opts.description) params.description = opts.description

      const flags: string[] = []
      if (opts.attendees) {
        for (const email of opts.attendees) {
          flags.push(`--attendee=${email}`)
        }
      }

      return this.helper('calendar', '+insert', { params, flags, profile: opts.profile })
    },
  }

  /** Google Drive sub-interface for uploading files and searching drive contents. */
  drive = {
    upload: async (opts: { file: string; parent?: string; name?: string; profile?: string }) => {
      const flags = [opts.file]
      const params: Record<string, string | number | boolean> = {}
      if (opts.parent) params.parent = opts.parent
      if (opts.name) params.name = opts.name
      return this.helper('drive', '+upload', { params, flags, profile: opts.profile })
    },

    search: async (opts: { query: string; pageSize?: number; orderBy?: string; fields?: string; profile?: string }) => {
      const params: Record<string, string | number | boolean> = { q: opts.query }
      if (opts.pageSize) params.pageSize = opts.pageSize
      if (opts.orderBy) params.orderBy = opts.orderBy
      if (opts.fields) params.fields = opts.fields
      return this.exec('drive', 'files', 'list', { params, profile: opts.profile })
    },
  }

  /** Google Docs sub-interface for writing, reading, listing, and exporting documents. */
  docs = {
    write: async (opts: { document: string; text: string; profile?: string }) => {
      return this.helper('docs', '+write', {
        params: { document: opts.document, text: opts.text },
        profile: opts.profile,
      })
    },

    get: async (opts: { document: string; profile?: string }) => {
      return this.exec('docs', 'documents', 'get', {
        params: { documentId: opts.document },
        profile: opts.profile,
      })
    },

    list: async (opts?: { query?: string; pageSize?: number; profile?: string }) => {
      const q = opts?.query
        ? `mimeType = 'application/vnd.google-apps.document' and ${opts.query}`
        : `mimeType = 'application/vnd.google-apps.document'`
      const params: Record<string, string | number | boolean> = { q }
      if (opts?.pageSize) params.pageSize = opts.pageSize
      return this.exec('drive', 'files', 'list', { params, profile: opts?.profile })
    },

    exportMarkdown: async (opts: { document: string; profile?: string }) => {
      return this.exec('drive', 'files', 'export', {
        params: { fileId: opts.document, mimeType: 'text/markdown' },
        json: false,
        profile: opts.profile,
      })
    },
  }

  /** Google Chat sub-interface for sending messages to Chat spaces. */
  chat = {
    send: async (opts: { space: string; text: string; profile?: string }) => {
      return this.helper('chat', '+send', {
        params: { space: opts.space, text: opts.text },
        profile: opts.profile,
      })
    },
  }

  // --- Tool handlers (matched by name to static tools) ---

  async gwsListProfiles() {
    const profiles = this.profiles()
    return { profiles, activeProfile: this.currentProfile }
  }

  async gwsSendEmail(opts: { to: string; subject: string; body: string; profile?: string }) {
    return this.gmail.send(opts)
  }

  async gwsSearchEmail(opts: { query: string; maxResults?: number; profile?: string }) {
    return this.gmail.search(opts)
  }

  async gwsReadEmail(opts: { id: string; markAsRead?: boolean; profile?: string }) {
    return this.gmail.readMessage(opts)
  }

  async gwsTriageEmail(opts: { max?: number; query?: string; profile?: string }) {
    return this.gmail.triage(opts)
  }

  async gwsTrashEmail(opts: { id: string; profile?: string }) {
    return this.gmail.trash(opts)
  }

  async gwsArchiveEmail(opts: { id: string; profile?: string }) {
    return this.gmail.archive(opts)
  }

  async gwsValidateEmail(opts: { id: string; profile?: string }) {
    return this.gmail.validate(opts)
  }

  async gwsGetCalendarAgenda(opts: { days?: number; calendar?: string; profile?: string }) {
    return this.calendar.agenda(opts)
  }

  async gwsCreateCalendarEvent(opts: {
    summary: string; start: string; end?: string; duration?: number;
    calendar?: string; location?: string; description?: string;
    attendees?: string[]; profile?: string
  }) {
    return this.calendar.insert(opts)
  }

  async gwsReadSpreadsheet(opts: { spreadsheet: string; range: string; profile?: string }) {
    return this.sheets.read(opts)
  }

  async gwsAppendToSpreadsheet(opts: { spreadsheet: string; values?: string; jsonValues?: string[][]; profile?: string }) {
    return this.sheets.append(opts)
  }

  async gwsSearchDrive(opts: { query: string; pageSize?: number; profile?: string }) {
    return this.drive.search(opts)
  }

  async gwsSendChatMessage(opts: { space: string; text: string; profile?: string }) {
    return this.chat.send(opts)
  }

  async gwsCheckAuth(opts: { profile?: string }) {
    if (opts.profile) {
      const prevProfile = this.currentProfile
      this.useProfile(opts.profile)
      const result = await this.auth.check()
      if (prevProfile) this.useProfile(prevProfile)
      else this.clearProfile()
      return { authenticated: result, profile: opts.profile }
    }
    return { authenticated: await this.auth.check(), profile: this.currentProfile || 'default' }
  }
}

export default features.register('gws', Gws)
