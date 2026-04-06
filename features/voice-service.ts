import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '@soederpop/luca'
import { Feature, features } from '@soederpop/luca'
import type { WindowManager } from '@soederpop/luca'
import type { VoiceListener } from './voice-listener'
import type VoiceChat from './voice-chat'

declare module '@soederpop/luca' {
  interface AvailableFeatures {
    voiceService: typeof VoiceService
  }
}

export const VoiceServiceStateSchema = FeatureStateSchema.extend({
  running: z.boolean().default(false),
  socketPath: z.string().default(''),
  wakeWordAvailable: z.boolean().default(false),
  sttAvailable: z.boolean().default(false),
  ttsAvailable: z.boolean().default(false),
  capabilityMissing: z.array(z.string()).default([]),
  assistantCount: z.number().default(0),
})
export type VoiceServiceState = z.infer<typeof VoiceServiceStateSchema>

export const VoiceServiceOptionsSchema = FeatureOptionsSchema.extend({})
export type VoiceServiceOptions = z.infer<typeof VoiceServiceOptionsSchema>

type VoiceAssistantEntry = {
  assistantName: string
  aliases: string[]
  chat: VoiceChat | null
}

/**
 * Orchestrates the voice subsystem: wake word detection, STT, and assistant routing.
 * Maps wake words to assistants via voice.yaml aliases discovered through assistantsManager.
 */
export class VoiceService extends Feature<VoiceServiceState, VoiceServiceOptions> {
  static override shortcut = 'features.voiceService' as const
  static override stateSchema = VoiceServiceStateSchema
  static override optionsSchema = VoiceServiceOptionsSchema

  static {
    Feature.register(this, 'voiceService')
  }

  /** Map of lowercase alias → assistant entry for wake word routing */
  private _aliasMap = new Map<string, VoiceAssistantEntry>()

  /** All voice-enabled assistant entries */
  private _entries: VoiceAssistantEntry[] = []

  get listener() {
    return this.container.feature('voiceListener' as any, {
      debug: !!this.container.argv.debug
    }) as unknown as VoiceListener
  }

  get windowManager() {
    return this.container.feature('windowManager' as any) as unknown as WindowManager
  }

  /** Returns the list of voice-enabled assistant names and their aliases. */
  get voiceAssistants(): Array<{ name: string; aliases: string[] }> {
    return this._entries.map(e => ({ name: e.assistantName, aliases: e.aliases }))
  }

  /** Boots the voice subsystem: discovers voice-enabled assistants, checks capabilities, starts listener. */
  async start() {
    if (this.state.get('running')) return this

    if (this.state.get('starting')) {
      this.emit('info', 'Voice service already starting, waiting 100ms')
      await this.container.sleep(100)
      return this.start()
    }

    this.state.set('starting', true)
    this.emit('info', 'Voice service starting')

    const { listener } = this

    // 1. Discover voice-enabled assistants and build alias map
    await this.discoverVoiceAssistants()

    // 2. Check capabilities
    const listenerCaps = await listener.checkCapabilities()

    // Pick the first voice-enabled assistant to check TTS capabilities
    const firstEntry = this._entries[0]
    let ttsAvailable = false
    if (firstEntry) {
      const chat = this.getOrCreateChat(firstEntry)
      const chatCaps = await chat.checkCapabilities()
      ttsAvailable = chatCaps.available

      this.state.setState({
        ttsAvailable,
        capabilityMissing: [...listenerCaps.missing, ...chatCaps.missing],
      })
    } else {
      this.state.setState({
        ttsAvailable: false,
        capabilityMissing: [...listenerCaps.missing, 'no voice-enabled assistants found'],
      })
    }

    this.state.setState({
      wakeWordAvailable: listener.state.get('wakeWordAvailable') as boolean,
      sttAvailable: listener.state.get('sttAvailable') as boolean,
    })

    // 3. Log startup summary
    this.emit('info', '── Voice capability check ──')
    this.emit('info', `  Wake word: ${listener.state.get('wakeWordAvailable') ? 'available' : 'UNAVAILABLE'}`)
    this.emit('info', `  STT:       ${listener.state.get('sttAvailable') ? 'available' : 'UNAVAILABLE'}`)
    this.emit('info', `  TTS/LLM:   ${ttsAvailable ? 'available' : 'UNAVAILABLE'}`)
    this.emit('info', `  Assistants: ${this._entries.map(e => `${e.assistantName} [${e.aliases.join(', ')}]`).join(', ') || 'none'}`)

    // 4. Wire up wake word listener
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

  /** Tears down the voice subsystem. */
  async stop() {
    if (!this.state.get('running')) return this

    this.listener.stopWaitingForTriggerWord()

    this.state.set('running', false)

    return this
  }

  /** Discovers all assistants with voice.yaml and builds the wake word alias map. */
  private async discoverVoiceAssistants() {
    const am = this.container.feature('assistantsManager' as any) as any
    await am.discover()

    const fs = this.container.feature('fs')
    const yaml = this.container.feature('yaml')

    const voiceAssistants = am.list().filter((a: any) => a.hasVoice)

    this._entries = []
    this._aliasMap = new Map()

    for (const entry of voiceAssistants) {
      const configPath = this.container.paths.resolve(entry.folder, 'voice.yaml')
      let aliases: string[] = []

      try {
        const raw = yaml.parse(fs.readFile(configPath))
        aliases = Array.isArray(raw?.aliases) ? raw.aliases.map((a: string) => a.toLowerCase().trim()) : []
      } catch (err: any) {
        this.emit('info', `Failed to parse voice.yaml for ${entry.name}: ${err.message}`)
      }

      const voiceEntry: VoiceAssistantEntry = {
        assistantName: entry.name,
        aliases,
        chat: null,
      }

      this._entries.push(voiceEntry)

      // Register the assistant name itself as an alias
      this._aliasMap.set(entry.name.toLowerCase(), voiceEntry)

      // Register each explicit alias
      for (const alias of aliases) {
        this._aliasMap.set(alias, voiceEntry)
      }
    }

    this.state.set('assistantCount', this._entries.length)
    this.emit('info', `Discovered ${this._entries.length} voice-enabled assistant(s)`)
  }

  /** Creates or returns the VoiceChat instance for an assistant entry. */
  private getOrCreateChat(entry: VoiceAssistantEntry): VoiceChat {
    if (entry.chat) return entry.chat

    entry.chat = this.container.feature('voiceChat', {
      assistant: entry.assistantName,
      playPhrases: true,
      prependPrompt: VOICE_INSTRUCTIONS_PRE,
      appendPrompt: VOICE_INSTRUCTIONS_POST,
      maxTokens: 500,
      historyMode: 'daily',
    }) as unknown as VoiceChat

    return entry.chat
  }

  /** Resolves a wake word to a voice assistant entry by matching against aliases. */
  private resolveWakeWord(wakeword: string): VoiceAssistantEntry | null {
    const normalized = wakeword.toLowerCase().replace(/_/g, ' ').trim()

    // Direct match
    if (this._aliasMap.has(normalized)) return this._aliasMap.get(normalized)!

    // Strip common wake word prefixes (e.g. "hey_friday" → "friday", "ok_chief" → "chief")
    const stripped = normalized.replace(/^(hey|ok|hi|yo)\s+/, '')
    if (this._aliasMap.has(stripped)) return this._aliasMap.get(stripped)!

    // Partial match: check if any alias is contained in the wake word or vice versa
    for (const [alias, entry] of this._aliasMap) {
      if (normalized.includes(alias) || alias.includes(normalized)) return entry
    }

    return null
  }

  /** Handles a wake word trigger: resolves the assistant, records speech, routes to the assistant's chat. */
  async handleTriggerWord(wakeword: string) {
    const { listener } = this

    // Guard: STT must be available
    if (!listener.state.get('sttAvailable')) {
      this.emit('info', 'Triggered but STT unavailable — cannot transcribe')
      return
    }

    const entry = this.resolveWakeWord(wakeword)

    if (!entry) {
      this.emit('info', `No voice assistant matched wake word: ${wakeword}`)
      listener.unlock()
      return
    }

    listener.lock()

    this.emit('info', `Wake word "${wakeword}" → assistant "${entry.assistantName}"`)
    this.container.ui.print.red('MIC IS HOT')

    const text = await listener.listen({ silenceTimeout: 7000 }).then((r: string) => r.trim())

    if (!text?.length) {
      this.emit('info', 'Got no text')
      listener.unlock()
      return
    }

    this.emit('info', `User said: ${text}`)

    const chat = this.getOrCreateChat(entry)

    if (!chat.isStarted) {
      this.emit('info', `Starting ${entry.assistantName} voice chat`)
      await chat.start()
    }

    this.emit('info', `Asking ${entry.assistantName}: ${text}`)
    await chat.ask(text)
    this.emit('info', `${entry.assistantName} finished speaking`)

    listener.unlock()
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
