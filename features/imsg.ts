import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    imsg: typeof Imsg
  }
}

export const ImsgStateSchema = FeatureStateSchema.extend({})
export type ImsgState = z.infer<typeof ImsgStateSchema>

export const ImsgOptionsSchema = FeatureOptionsSchema.extend({})
export type ImsgOptions = z.infer<typeof ImsgOptionsSchema>

export type Chat = {
  id: number
  name: string
  identifier: string
  service: string
  last_message_at: string
}

export type Message = {
  id: number
  guid: string
  chat_id: number
  sender: string
  text: string
  is_from_me: boolean
  created_at: string
  destination_caller_id: string
  reactions: any[]
  attachments: any[]
}

export type SendResult = {
  success: boolean
  error?: string
}

export type HistoryOptions = {
  limit?: number
  participants?: string
  start?: string
  end?: string
  attachments?: boolean
}

export type WatchOptions = {
  chatId?: number
  participants?: string
  sinceRowid?: number
  attachments?: boolean
  reactions?: boolean
  debounce?: string
}

/**
 * Wrapper around the imsg CLI for iMessage.
 *
 * Provides programmatic access to list chats, read history,
 * send messages, react, and watch for incoming messages.
 *
 * @example
 * ```typescript
 * const imsg = container.feature('imsg')
 * const chats = await imsg.chats({ limit: 5 })
 * const messages = await imsg.history(6, { limit: 10 })
 * await imsg.send('+15551234567', 'Hello from luca')
 * ```
 */
export class Imsg extends Feature<ImsgState, ImsgOptions> {
  static override shortcut = 'features.imsg' as const
  static override stateSchema = ImsgStateSchema
  static override optionsSchema = ImsgOptionsSchema
  static { Feature.register(this, 'imsg') }

  private get proc() {
    return this.container.feature('proc')
  }

  /** Parse newline-delimited JSON from imsg stdout */
  private parseJsonLines<T = any>(stdout: string): T[] {
    return stdout
      .trim()
      .split('\n')
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line))
  }

  /** Run imsg with an args array and return parsed JSON output */
  private async run<T = any>(args: string[]): Promise<{ data: T[]; exitCode: number; stderr: string }> {
    const result = await this.proc.spawnAndCapture('imsg', [...args, '--json'])

    if (result.exitCode !== 0) {
      return { data: [], exitCode: result.exitCode, stderr: result.stderr }
    }

    return {
      data: this.parseJsonLines<T>(result.stdout),
      exitCode: 0,
      stderr: '',
    }
  }

  /** List recent conversations */
  async chats(opts?: { limit?: number }): Promise<Chat[]> {
    const args = ['chats']
    if (opts?.limit) args.push('--limit', String(opts.limit))
    const { data } = await this.run<Chat>(args)
    return data
  }

  /** Get message history for a chat */
  async history(chatId: number, opts?: HistoryOptions): Promise<Message[]> {
    const args = ['history', '--chat-id', String(chatId)]
    if (opts?.limit) args.push('--limit', String(opts.limit))
    if (opts?.participants) args.push('--participants', opts.participants)
    if (opts?.start) args.push('--start', opts.start)
    if (opts?.end) args.push('--end', opts.end)
    if (opts?.attachments) args.push('--attachments')

    const { data } = await this.run<Message>(args)
    return data
  }

  /** Send a text message to a phone number/email or chat ID */
  async send(to: string, text: string, opts?: { file?: string; service?: string; chatId?: number }): Promise<SendResult> {
    const args = ['send']

    if (opts?.chatId) {
      args.push('--chat-id', String(opts.chatId))
    } else {
      args.push('--to', to)
    }

    args.push('--text', text)
    if (opts?.file) args.push('--file', opts.file)
    if (opts?.service) args.push('--service', opts.service)

    const result = await this.proc.spawnAndCapture('imsg', args)

    if (result.exitCode !== 0) {
      return { success: false, error: result.stderr || result.stdout }
    }

    return { success: true }
  }

  /** Send a tapback reaction to the most recent message in a chat */
  async react(chatId: number, reaction: string): Promise<SendResult> {
    const result = await this.proc.spawnAndCapture('imsg', ['react', '--chat-id', String(chatId), '--reaction', reaction])

    if (result.exitCode !== 0) {
      return { success: false, error: result.stderr || result.stdout }
    }

    return { success: true }
  }

  /**
   * Watch for incoming messages. Emits events:
   *   'message' — new message received (payload: Message)
   *   'error'   — stderr output from imsg watch
   *   'stop'    — watcher was stopped
   *
   * Returns { stop() } to kill the watcher process.
   */
  watch(opts?: WatchOptions): { stop: () => void } {
    const args = ['watch']
    if (opts?.chatId) args.push('--chat-id', String(opts.chatId))
    if (opts?.participants) args.push('--participants', opts.participants)
    if (opts?.sinceRowid) args.push('--since-rowid', String(opts.sinceRowid))
    if (opts?.attachments) args.push('--attachments')
    if (opts?.reactions) args.push('--reactions')
    if (opts?.debounce) args.push('--debounce', opts.debounce)
    args.push('--json')

    let watchPid: number | null = null

    // fire-and-forget — don't await so we can return the stop handle
    this.proc.spawnAndCapture('imsg', args, {
      onStart: (cp: any) => {
        watchPid = cp.pid ?? null
      },
      onOutput: (data: string) => {
        const lines = data.trim().split('\n').filter((l) => l.length > 0)
        for (const line of lines) {
          try {
            this.emit('message', JSON.parse(line))
          } catch {
            // partial line, skip
          }
        }
      },
      onError: (data: string) => {
        this.emit('error', data)
      },
      onExit: () => {
        watchPid = null
        this.emit('stop')
      },
    })

    return {
      stop: () => {
        if (watchPid) {
          this.proc.kill(watchPid)
          watchPid = null
        }
      },
    }
  }
}

export default Imsg
