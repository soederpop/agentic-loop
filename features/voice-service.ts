import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature, features } from '@soederpop/luca'
import type { ContainerContext, WindowManager } from '@soederpop/luca'
import type { VoiceRouter } from './voice-router'
import type { VoiceListener } from './voice-listener'
import type VoiceChat from './voice-chat'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    voiceService: typeof VoiceService
  }
}

export const VoiceServiceStateSchema = FeatureStateSchema.extend({
  running: z.boolean().default(false),
  handlerCount: z.number().default(0),
  socketPath: z.string().default(''),
  wakeWordAvailable: z.boolean().default(false),
  sttAvailable: z.boolean().default(false),
  ttsAvailable: z.boolean().default(false),
  capabilityMissing: z.array(z.string()).default([]),
})
export type VoiceServiceState = z.infer<typeof VoiceServiceStateSchema>

export const VoiceServiceOptionsSchema = FeatureOptionsSchema.extend({})
export type VoiceServiceOptions = z.infer<typeof VoiceServiceOptionsSchema>

/**
 * Orchestrates the voice subsystem: VoiceRouter, launcher listener, and window manager.
 */
export class VoiceService extends Feature<VoiceServiceState, VoiceServiceOptions> {
  static override shortcut = 'features.voiceService' as const
  static override stateSchema = VoiceServiceStateSchema
  static override optionsSchema = VoiceServiceOptionsSchema

  static {
	  Feature.register(this, 'voiceService')
  }

  /** Returns the VoiceRouter instance, or null if the service has not started. */
  get router() {
	  return this.container.feature('voiceRouter' as any) as unknown as VoiceRouter
  }

  get listener() {
    return this.container.feature('voiceListener' as any, {
      debug: !!this.container.argv.debug 
    }) as unknown as VoiceListener
  }

   get voiceAssistantChat() {
    return this.container.feature('voiceChat', {
      assistant: 'voice-assistant',
      playPhrases: true,
      prependPrompt: VOICE_INSTRUCTIONS_PRE,
      appendPrompt: VOICE_INSTRUCTIONS_POST,
      maxTokens: 500 
    }) as unknown as VoiceChat
  }
 
  get chiefChat() {
    return this.container.feature('voiceChat', {
      assistant: 'chiefOfStaff',
      playPhrases: true,
      prependPrompt: VOICE_INSTRUCTIONS_PRE,
      appendPrompt: VOICE_INSTRUCTIONS_POST,
      maxTokens: 500 
    }) as unknown as VoiceChat
  }

  get windowManager() {
	  return this.container.feature('windowManager' as any) as unknown as WindowManager
  }

  /** Returns the router's command handler manifest, or an empty array if not started. */
  get manifest(): any[] {
    return this.router.manifest
  }

  /** Boots the voice subsystem: discovers features, loads the router and listener, and wires up event forwarding. */
  async start() {
    if (this.state.get('running')) return this

    if (this.state.get('starting')) {
      this.emit('info', 'Voice service already starting, waiting 100ms')
      await this.container.sleep(100)
      return this.start()
    }

    this.state.set('starting', true)
    this.emit('info', 'Voice service starting')

    const { listener, router, chiefChat, voiceAssistantChat } = this

    // 1. Check all capabilities before booting anything
    const [listenerCaps, chatCaps] = await Promise.all([
      listener.checkCapabilities(),
      voiceAssistantChat.checkCapabilities(),
    ])

    const allMissing = [...listenerCaps.missing, ...chatCaps.missing]

    this.state.setState({
      wakeWordAvailable: listener.state.get('wakeWordAvailable') as boolean,
      sttAvailable: listener.state.get('sttAvailable') as boolean,
      ttsAvailable: chatCaps.available,
      capabilityMissing: allMissing,
    })

    // 2. Log a clear startup summary
    this.emit('info', '── Voice capability check ──')
    this.emit('info', `  Wake word: ${listener.state.get('wakeWordAvailable') ? 'available' : `UNAVAILABLE (${listenerCaps.missing.filter(m => m.includes('rustpotter') || m.includes('.rpw')).join(', ') || 'unknown'})`}`)
    this.emit('info', `  STT:       ${listener.state.get('sttAvailable') ? 'available' : `UNAVAILABLE (${listenerCaps.missing.filter(m => m.includes('sox') || m.includes('mlx_whisper')).join(', ') || 'unknown'})`}`)
    this.emit('info', `  TTS/LLM:   ${chatCaps.available ? 'available' : `UNAVAILABLE (${chatCaps.missing.join(', ')})`}`)

    // 3. Always start the router (no external deps)
    await router.start().catch((err: any) => {
      this.emit('error', err)
      throw err
    })

    // 4. Boot TTS chats only if available
    if (chatCaps.available) {
      chiefChat.mute()

      await Promise.all([
        chiefChat.start(),
        voiceAssistantChat.start(),
      ]).catch((err: any) => {
        this.emit('error', err)
        this.emit('info', `TTS chat startup failed: ${err.message}`)
      })

      // Give handlers access to TTS via speakPhrase
      router.chat = voiceAssistantChat

      this.emit('info', 'Preloading context for chief chat')
      await chiefChat.ask('Read your readme, memories, todos, my goals, and be ready to answer questions.')
      this.emit('info', 'Context preloaded for chief chat')
      chiefChat.unmute()
    } else {
      this.emit('info', 'TTS/LLM unavailable — voice output disabled')
    }

    // 5. Wire up wake word listener only if available
    if (listener.state.get('wakeWordAvailable')) {
      listener.on('triggerWord', (wakeword: string) => {
        this.emit('info', `Trigger word: ${wakeword}`)
        this.handleTriggerWord(wakeword)
      })
      listener.waitForTriggerWord()
    } else {
      this.emit('info', 'Wake word listener not started — run voice/wakeword/setup-wakeword.sh to enable')
    }

    this.state.set('running', true)
    this.emit('started')

    return this
  }

  /** Tears down the voice subsystem: disables the listener, clears references, and resets state. */
  async stop() {
    if (!this.state.get('running')) return this

    this.listener.stopWaitingForTriggerWord()

    this.state.set('running', false)
    this.state.set('handlerCount', 0)

    return this
  }

  async handleTriggerWord(wakeword: string) {
    const { listener, router } = this

    // Guard: STT must be available to transcribe voice input
    if (!listener.state.get('sttAvailable')) {
      this.emit('info', 'Triggered but STT unavailable — cannot transcribe')
      if (this.state.get('ttsAvailable')) router.playPhrase('error')
      return
    }

    listener.lock()

    this.emit('info', `Handling trigger word: ${wakeword}`)
    
    if (wakeword.toLowerCase().includes('chief')) {
      this.container.ui.print.red('MIC IS HOT')

      const text = await this.listener.listen({ silenceTimeout: 7000 }).then(r => r.trim())
      
      if (text?.length > 0) {
        await this.handleChiefCommand(text)
      } else {
        console.log('Got no text')
      }
      
      listener.unlock()
      return
    }    
    
    this.container.ui.print.red('Mic is HOT')

    const commandUtterance = await listener.listen()
    const text = commandUtterance.trim()

    this.emit('info', `User said: ${text}`)

    // All other wakewords route through the voice router
    const result = await router.route({
      id: `demo-${Date.now()}`,
      source: 'demo',
      text,
      payload: { text, source: 'voice-service', wakeword },
      isFinished: false,
      ack: (data) => { return true },
      progress: (data) => { return true },
      finish: (data) => {
        if (data?.result?.action === "unknown") {
          this.emit('info', 'Unknown command')
          router.playPhrase('error')
        }
        listener.unlock()
        return true
      },
      fail: (data) => {
        this.emit('info', `Command failed: ${data?.error}`)
        listener.unlock()
        return true
      },
    })
    
    if (!result.matched) {
      this.emit('info', `No handler matched for: ${text}`)
      
      this.askVoiceAssistant(text)

    }

    listener.unlock()
  }

  async handleChiefCommand(text: string) {
    const { listener } = this
    // chief-specific handling goes here
    listener.lock()

    if (!this.chiefChat.isStarted) {
      this.emit('info', 'Starting Assistant Chief Of Staff')
      await this.chiefChat.start()
    }

    this.emit('info', `Asking Assistant Chief Of Staff: ${text}`)
    await this.chiefChat.ask(text)
    this.emit('info', 'Assistant Chief Of Staff finished speaking')
    listener.unlock()
  }
  
  async askVoiceAssistant(text: string): Promise<string> {
    const { listener } = this
    
    if (!this.voiceAssistantChat.isStarted) {
      this.emit('info', 'Starting Assistant Voice Assistant')
      await this.voiceAssistantChat.start()
    }
    
    listener.lock()

    this.emit('info', `Asking Assistant Voice Assistant: ${text}`)
    const response = await this.voiceAssistantChat.ask(text)
    this.emit('info', 'Assistant Voice Assistant finished speaking, checking for followup')
    
    listener.unlock()
   
    return response
  }
  

}

export default VoiceService 

export const VOICE_INSTRUCTIONS_PRE = `
VERY IMPORTANT: DO NOT RESPOND IN MARKDOWN. EVERYTHING YOU SAY WILL BE PIPED THROUGH TO ELEVENLABS ELEVEN_V3 Model.
BE BRIEF.  ONE to THREE SENTENCES MAX.  DON'T OVERLY ENCOURAGE FOLLOW UP QUESTIONS, I WILL ALWAYS FOLLOW UP IF I WANT TO.
DO NOT USE MARKDOWN, EMOJIS, OR ANYTHING THAT CAN'T BE TURNED INTO SPEECH. 

YOU CAN USE [emotion] TAGS to [direct] THE DELIVERY OF YOUR RESPONSE.

AVOID LONG STREAMS OF TOOL CALLS WITHOUT A BREAK TO EXPLAIN WHAT YOU ARE DOING AND WHY. TO THE USER'S PERSPECTIVE THIS SEEMS LIKE AWKWARD SILENCE AND LEADS TO CONFUSION.
`

export const VOICE_INSTRUCTIONS_POST = `
REMEMBER: NO MARKDOWN.  ONE TO THREE SENTENCES MAX.  SHOW CHARACTER AND PERSONALITY THROUGH [emotion] and [direction] TAGS TO GET THE PRECISE DELIVERY YOU INTEND.
  
AVOID LONG STREAMS OF TOOL CALLS WITHOUT A BREAK TO EXPLAIN WHAT YOU ARE DOING AND WHY.
`
