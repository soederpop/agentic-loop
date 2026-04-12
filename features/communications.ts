/**
 * Communications feature.
 *
 * Centralizes inbound message monitoring across supported channels and emits
 * normalized events the rest of the system can react to.
 *
 * Current implementation supports:
 * - iMessage via the `imsg` feature
 * - Telegram via the `telegram` feature
 * - Gmail polling and validation via the `gws` feature
 */
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    communications: typeof Communications
  }
}

type Channel = 'imsg'
| 'telegram'
| 'gmail'

const AVAILABLE_CHANNELS : Channel[] = ['imsg', 'telegram', 'gmail']

export const CommunicationsStateSchema = FeatureStateSchema.extend({
  started: z.boolean().default(false),
  paused: z.boolean().default(false),
  activeChannels: z.array(z.enum(['imsg', 'telegram', 'gmail'])).describe('Which channels have been activated'),
})

export type CommunicationsState = z.infer<typeof CommunicationsStateSchema>

export const CommunicationsOptionsSchema = FeatureOptionsSchema.extend({})
export type CommunicationsOptions = z.infer<typeof CommunicationsOptionsSchema>

/**
 * Central hub for channel activation, inbound message monitoring, and message event
 * forwarding across supported communications providers.
 *
 * This feature wires channel-specific integrations into a single event surface.
 * It currently starts watchers for iMessage and Telegram, and polls Gmail through
 * the Google Workspace feature with optional trusted-sender filtering.
 *
 * @extends Feature
 */
export class Communications extends Feature<CommunicationsState, CommunicationsOptions> {
  static override shortcut = 'features.communications' as const
  static override stateSchema = CommunicationsStateSchema
  static override optionsSchema = CommunicationsOptionsSchema

  static { Feature.register(this, 'communications') }

  override get initialState(): CommunicationsState {
    return {
      ...super.initialState,
      started: false,
      paused: false,
      activeChannels: [],
    }
  }

  get imessage() {
    return this.container.feature('imsg')
  }
  
  get activeChannels() {
    return this.state.get('activeChannels') || []
  }
  
  get telegramBot() {
    return this.container.feature('telegram')
  }
  
  get isPaused() {
    return !!this.state.get('paused')
  }
  
  get isStarted() {
    return !!this.state.get('started')
  }
  
  pause() {
    this.state.set('paused', true)
    this.emit('paused')
    return this
  }
  
  unpause() {
    this.state.set('paused', false)
    this.emit('unpaused')
    return this
  }
  
  _imessageHandler: any = null
  _telegramHandler: any = null
  _gmailPollTimer: any = null
  _gmailSeenIds: Set<string> = new Set()
  _gmailOptions: { profile?: string; pollIntervalMs?: number; trustedSenders?: string[] } = {}

  async start() {
    if (this.isStarted) {
      return this
    }

    const comms = this

    this.on('message:received', (channel: Channel, payload: any) => {
      this.emit('message', { channel, payload })
    })

    for(const channel of this.activeChannels) {
      if (channel === 'imsg') {
        this._imessageHandler = async function imessageHandler(message: any) {
          comms.emit('message:received', 'imsg', message)
        }

        this.imessage.on('message', this._imessageHandler)
        this.imessage.watch()
        this.emit('log', `imsg: watcher started`)
      } else if (channel === 'telegram') {
        this._telegramHandler = async function telegramHandler(message: any) {
          comms.emit('message:received', 'telegram', message)
        }

        this.telegramBot.handle('message:text', this._telegramHandler)
        this.telegramBot.start()
        this.emit('log', `telegram: listener started`)
      } else if (channel === 'gmail') {
        await this._startGmailPolling()
      }
    }

    this.state.set('started', true)
    this.emit('started')
    return this
  }

  /**
   * Polls gmail for unread inbox messages on an interval.
   * On first run, seeds the seen-set so only new arrivals trigger events.
   */
  private async _startGmailPolling() {
    const gws = this.container.feature('gws')
    const profile = this._gmailOptions.profile || null
    const interval = this._gmailOptions.pollIntervalMs || 30_000 
    const trustedSenders = this._gmailOptions.trustedSenders || []

    if (profile) gws.useProfile(profile)

    // Build a query that only matches trusted senders
    const baseQuery = 'in:inbox is:unread'
    const senderQuery = trustedSenders.length > 0
      ? `${baseQuery} {${trustedSenders.map(s => `from:${s}`).join(' ')}}`
      : baseQuery

    this.emit('log', `gmail: started polling every ${interval / 1000}s (trusted senders: ${trustedSenders.length || 'all'})`)

    const poll = async () => {
      if (this.isPaused) return
      try {
        const result = await gws.gmail.search({ query: senderQuery, maxResults: 20 })
        const messages = result?.messages || []
        const newCount = messages.filter(m => !this._gmailSeenIds.has(m.id)).length
        this.emit('log', `gmail: polled — ${messages.length} unread, ${newCount} new`)

        for (const msg of messages) {
          if (this._gmailSeenIds.has(msg.id)) continue
          this._gmailSeenIds.add(msg.id)

          // Validate authenticity before reading
          try {
            const validation = await gws.gmail.validate({ id: msg.id })
            if (validation.trustScore < 50) {
              this.emit('log', `gmail: REJECTED message ${msg.id} from ${validation.from?.address} — trust score ${validation.trustScore} (flags: ${validation.flags.join(', ')})`)
              continue
            }
            if (validation.trustScore < 75) {
              this.emit('log', `gmail: WARNING — message ${msg.id} from ${validation.from?.address} has trust score ${validation.trustScore} (flags: ${validation.flags.join(', ')})`)
            }

            const full = await gws.gmail.readMessage({ id: msg.id, markAsRead: true })
            this.emit('message:received', 'gws', {
              id: msg.id,
              threadId: msg.threadId,
              from: full.from,
              to: full.to,
              subject: full.subject,
              body: full.body?.text || full.snippet || '',
              text: full.body?.text || full.snippet || '',
              snippet: full.snippet,
              date: full.date,
              labels: full.labels,
              validation,
            })
          } catch (readErr: any) {
            this.emit('log', `gmail: failed to read/validate message ${msg.id} — ${readErr.message}`)
          }
        }
      } catch (err: any) {
        this.emit('log', `gmail: poll error — ${err.message}`)
      }
    }

    // First poll immediately, then on interval
    await poll()
    this._gmailPollTimer = setInterval(poll, interval)
  }
  
  activateChannel(channelName: Channel, options: any) {
    const { uniq } = this.container.utils.lodash

    if (this.isStarted) {
      throw new Error('Communications service is already started')
    }

    if (this.activeChannels.includes(channelName)) {
      return this
    }

    if (channelName === 'gmail' && options) {
      this._gmailOptions = {
        profile: options.profile,
        pollIntervalMs: options.pollIntervalMs,
        trustedSenders: options.trustedSenders,
      }
    }

    this.state.set('activeChannels', uniq([
      ...this.activeChannels,
      channelName
    ]).sort())

    return this
  }
}

export default Communications
