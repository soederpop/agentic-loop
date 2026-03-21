/** 
 * CURRENT STATUS:
 * 
 * Just writing this as a stub / placeholder for when we eventually implement this into the Agentic loop
*
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
 * The Communications Feature is a centralized hub that monitors multiple channels
 * for incoming messages, and reacts when they arrive.  The communications feature can
 * also be used to send messages back over those same channels. Supported channels are imessage, telegram, and gmail for now 
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
  _gmailHandler: any = null
  
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
      } else if (channel === 'telegram') {
        this._telegramHandler = async function telegramHandler(message: any) {
          comms.emit('message:received', 'telegram', message)     
        }

        this.telegramBot.handle('message:text', this._telegramHandler)
        this.telegramBot.start()
      } else if (channel === 'gmail') {
        // TODO: Figure out how to use the GWS feature to watch for new messages
      }
    }

    this.state.set('started', true)
    this.emit('started')
    return this
  }
  
  activateChannel(channelName: Channel, options: any) {
    const { uniq } = this.container.utils.lodash
    
    if (this.isStarted) {
      throw new Error('Communications service is alreadystarted')
    }
    
    if (this.activeChannels.includes(channelName)) {
      return this
    }
    
    this.state.set('activeChannels', uniq([
      ...this.activeChannels,
      channelName
    ]).sort())
    
    return this  
  }
}

export default Communications