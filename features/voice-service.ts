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
  inputMode: z.enum(['wakeword', 'continuous', 'off']).default('off'),
})
export type VoiceServiceState = z.infer<typeof VoiceServiceStateSchema>

export const VoiceServiceOptionsSchema = FeatureOptionsSchema.extend({})
export type VoiceServiceOptions = z.infer<typeof VoiceServiceOptionsSchema>

type VoiceAssistantEntry = {
  assistantName: string
  aliases: string[]
  chat: VoiceChat | null
}

type WindowHandleLike = {
  windowId: string
  close(): Promise<any>
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

  /** Small transient overlay shown when the trigger word wakes the voice service */
  private _triggerOverlay: WindowHandleLike | null = null

  /** Set to true when the user dismisses the overlay mid-interaction */
  private _cancelled = false

  /** Bound VU handler for cleanup */
  private _vuHandler: ((level: number) => void) | null = null

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
      inputMode: listener.inputMode,
    })

    // 3. Log startup summary
    const wakewordReason = listener.state.get('wakeWordAvailable') ? 'available' : `UNAVAILABLE (${((listenerCaps.missing as string[]) || []).filter(m => m.includes('rustpotter') || m.includes('.rpw')).join(', ') || 'missing dependencies'})`
    const continuousReason = listener.state.get('sttAvailable') ? 'available' : `UNAVAILABLE (${((listenerCaps.missing as string[]) || []).filter(m => m.includes('sox') || m.includes('mlx_whisper')).join(', ') || 'missing dependencies'})`
    this.emit('info', '── Voice capability check ──')
    this.emit('info', `  Wake word mode: ${wakewordReason}`)
    this.emit('info', `  Continuous mode: ${continuousReason}`)
    this.emit('info', `  Active mode:     ${listener.inputMode}`)
    this.emit('info', `  TTS/LLM:         ${ttsAvailable ? 'available' : 'UNAVAILABLE'}`)
    this.emit('info', `  Assistants: ${this._entries.map(e => `${e.assistantName} [${e.aliases.join(', ')}]`).join(', ') || 'none'}`)

    // 4. Wire up input listener
    listener.on('triggerWord', (wakeword: string) => {
      this.emit('info', `Trigger word: ${wakeword}`)
      this.handleTriggerWord(wakeword)
    })

    if (listener.inputMode === 'wakeword') {
      listener.waitForTriggerWord()
    } else if (listener.inputMode === 'continuous') {
      listener.startContinuousListening()
    } else {
      this.emit('info', 'Voice input disabled — no available input mode')
    }

    this.state.set('running', true)
    this.emit('started')

    return this
  }

  /** Tears down the voice subsystem. */
  async stop() {
    if (!this.state.get('running')) return this

    await this.listener.stopWaitingForTriggerWord()
    await (this.listener as any).stopContinuousListening?.()

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

    entry.chat.on('toolCall', (payload: any) => {
      const name = payload?.name || 'unknown'
      const args = payload?.args || {}
      console.log(`[voice-service][${entry.assistantName}] toolCall ${name} ${JSON.stringify(args)}`)
    })

    entry.chat.on('toolResult', (payload: any) => {
      const name = payload?.name || 'unknown'
      const result = payload?.result
      let summary = ''

      if (typeof result === 'string') {
        summary = result.length > 200 ? `${result.slice(0, 200)}...` : result
      } else if (result !== undefined) {
        try {
          const serialized = JSON.stringify(result)
          summary = serialized.length > 200 ? `${serialized.slice(0, 200)}...` : serialized
        } catch {
          summary = String(result)
        }
      }

      console.log(`[voice-service][${entry.assistantName}] toolResult ${name}${summary ? ` ${summary}` : ''}`)
    })

    entry.chat.on('toolError', (payload: any) => {
      const name = payload?.name || 'unknown'
      const error = payload?.error
      const message = error instanceof Error ? error.message : String(error)
      console.log(`[voice-service][${entry.assistantName}] toolError ${name} ${message}`)
    })

    return entry.chat
  }

  private buildTriggerOverlayHtml(assistantName: string, wakeword: string) {
    const label = assistantName.replace(/[&<>"']/g, '')
    const phrase = wakeword.replace(/[&<>"']/g, '').replace(/_/g, ' ')

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    :root {
      color-scheme: dark;
      --bg: rgba(6, 10, 20, 0.68);
      --border: rgba(255,255,255,0.12);
      --text: rgba(255,255,255,0.96);
      --muted: rgba(210,225,255,0.72);
      --bar: linear-gradient(180deg, #8cf3ff 0%, #5bc0ff 45%, #8b5cf6 100%);
      --bar-speaking: linear-gradient(180deg, #a78bfa 0%, #c084fc 45%, #e879f9 100%);
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: transparent;
      overflow: hidden;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      border-radius: 24px;
    }
    body {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      backdrop-filter: blur(24px) saturate(140%);
      -webkit-backdrop-filter: blur(24px) saturate(140%);
    }
    .shell {
      width: 100%;
      height: 100%;
      border-radius: 24px;
      background: var(--bg);
      border: 1px solid var(--border);
      box-shadow:
        inset 0 1px 0 rgba(255,255,255,0.08);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      position: relative;
    }
    .status {
      font-size: 13px;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: var(--muted);
      transition: color 0.3s;
    }
    .status.listening { color: #7cf29a; }
    .status.generating { color: #fbbf24; }
    .status.speaking { color: #c084fc; }
    .status.done { color: #7cf29a; }
    .assistant {
      font-size: 26px;
      font-weight: 700;
      color: var(--text);
      text-shadow: 0 0 18px rgba(91,192,255,0.28);
    }
    .wave {
      height: 52px;
      width: 220px;
      display: flex;
      align-items: end;
      justify-content: center;
      gap: 6px;
      margin-top: 2px;
    }
    .bar {
      width: 8px;
      border-radius: 999px;
      background: var(--bar);
      box-shadow: 0 0 12px rgba(91,192,255,0.45);
      transform-origin: bottom center;
      transition: height 80ms ease-out;
      height: 4px;
    }
    .bar.speaking {
      background: var(--bar-speaking);
      box-shadow: 0 0 12px rgba(192,132,252,0.45);
    }
    .dot {
      position: absolute;
      top: 16px;
      right: 16px;
      width: 10px;
      height: 10px;
      border-radius: 999px;
      background: #7cf29a;
      box-shadow: 0 0 16px rgba(124,242,154,0.8);
      animation: breathe 1.4s ease-in-out infinite;
    }
    .dot.generating {
      background: #fbbf24;
      box-shadow: 0 0 16px rgba(251,191,36,0.8);
    }
    .dot.speaking {
      background: #c084fc;
      box-shadow: 0 0 16px rgba(192,132,252,0.8);
    }
    .dot.done {
      background: #7cf29a;
      box-shadow: 0 0 16px rgba(124,242,154,0.8);
      animation: none;
      opacity: 1;
    }
    .cancel {
      position: absolute;
      top: 12px;
      left: 16px;
      width: 22px;
      height: 22px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.15);
      background: rgba(255,255,255,0.08);
      color: var(--muted);
      font-size: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
    }
    .cancel:hover {
      background: rgba(255,80,80,0.25);
      color: #ff6b6b;
    }
    @keyframes breathe {
      0%, 100% { transform: scale(0.92); opacity: 0.7; }
      50% { transform: scale(1.15); opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="cancel">\u2715</div>
    <div class="dot" id="dot"></div>
    <div class="status" id="status">Listening</div>
    <div class="assistant">${label}</div>
    <div class="wave" id="wave">
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
      <div class="bar"></div>
    </div>
  </div>
  <script>
    const bars = document.querySelectorAll('.bar');
    const statusEl = document.getElementById('status');
    const dotEl = document.getElementById('dot');
    const barCount = bars.length;
    const MIN_H = 4;
    const MAX_H = 48;
    let mode = 'listening';
    let speakingAnim = null;
    let analyser = null;
    let tdArray = null;
    let vuTimer = null;

    function applyLevel(level) {
      const clamped = Math.max(0, Math.min(1, level));
      for (let i = 0; i < barCount; i++) {
        const distFromCenter = Math.abs(i - (barCount - 1) / 2) / ((barCount - 1) / 2);
        const scale = 1 - distFromCenter * 0.5;
        const jitter = 0.85 + Math.random() * 0.3;
        const h = MIN_H + (MAX_H - MIN_H) * clamped * scale * jitter;
        bars[i].style.height = Math.round(h) + 'px';
      }
    }

    // Real-time mic VU via Web Audio + setInterval
    // Uses setInterval instead of requestAnimationFrame because rAF
    // is throttled to ~1fps in unfocused/background windows
    async function startMicVU() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const ctx = new AudioContext();
        const source = ctx.createMediaStreamSource(stream);
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);
        tdArray = new Uint8Array(analyser.fftSize);
        startVULoop();
      } catch (e) {
        console.warn('Mic VU unavailable:', e);
      }
    }

    function startVULoop() {
      stopVULoop();
      vuTimer = setInterval(() => {
        if (mode !== 'listening' || !analyser) return;
        // Time-domain waveform: peak amplitude (samples centered at 128)
        analyser.getByteTimeDomainData(tdArray);
        let peak = 0;
        for (let i = 0; i < tdArray.length; i++) {
          const amp = Math.abs(tdArray[i] - 128);
          if (amp > peak) peak = amp;
        }
        const boosted = Math.min(1, (peak / 128) * 2.5);
        applyLevel(boosted);
      }, 33); // ~30fps, not subject to rAF throttling
    }

    function stopVULoop() {
      if (vuTimer) { clearInterval(vuTimer); vuTimer = null; }
    }

    // Called from host to set status: 'listening', 'generating', or 'speaking'
    window.setStatus = function(newMode) {
      mode = newMode;
      const labels = { listening: 'Listening', generating: 'Generating', speaking: 'Speaking', done: 'Done' };
      statusEl.textContent = labels[mode] || mode;
      statusEl.className = 'status ' + mode;
      dotEl.className = 'dot ' + mode;
      bars.forEach(b => {
        b.classList.remove('speaking');
        if (mode === 'speaking') b.classList.add('speaking');
      });

      if (mode === 'generating') {
        stopVULoop();
        if (speakingAnim) { clearInterval(speakingAnim); speakingAnim = null; }
        // Gentle pulsing animation for generating state
        speakingAnim = setInterval(() => {
          const t = Date.now() / 600;
          for (let i = 0; i < barCount; i++) {
            const phase = (i / barCount) * Math.PI * 2;
            const wave = 0.15 + 0.12 * Math.sin(t + phase);
            const h = MIN_H + (MAX_H - MIN_H) * wave;
            bars[i].style.height = Math.round(h) + 'px';
          }
        }, 80);
      } else if (mode === 'speaking') {
        stopVULoop();
        if (speakingAnim) { clearInterval(speakingAnim); speakingAnim = null; }
        speakingAnim = setInterval(() => {
          for (let i = 0; i < barCount; i++) {
            const distFromCenter = Math.abs(i - (barCount - 1) / 2) / ((barCount - 1) / 2);
            const base = 0.3 + Math.random() * 0.5;
            const scale = 1 - distFromCenter * 0.4;
            const h = MIN_H + (MAX_H - MIN_H) * base * scale;
            bars[i].style.height = Math.round(h) + 'px';
          }
        }, 120);
      } else if (mode === 'done') {
        stopVULoop();
        if (speakingAnim) { clearInterval(speakingAnim); speakingAnim = null; }
        // Settle bars to resting height
        for (let i = 0; i < barCount; i++) {
          bars[i].style.height = MIN_H + 'px';
        }
      } else {
        if (speakingAnim) { clearInterval(speakingAnim); speakingAnim = null; }
        startVULoop();
      }
    };

    // Also keep setVU as fallback if host sends levels
    window.setVU = function(level) { applyLevel(level); };

    // Auto-start mic VU
    startMicVU();
  </script>
</body>
</html>`
  }

  private async showTriggerOverlay(assistantName: string, wakeword: string) {
    try {
      await this.closeTriggerOverlay()

      const wm = this.windowManager as any
      const overlayWidth = 320
      const display = wm.getPrimaryDisplay()
      const centeredX = Math.round((display.width - overlayWidth) / 2)
      const handle = await wm.spawn({
        html: this.buildTriggerOverlayHtml(assistantName, wakeword),
        width: overlayWidth,
        height: 200,
        x: centeredX,
        y: 26,
        alwaysOnTop: true,
        decorations: 'none',
        role: 'overlay',
        transparent: true,
        shadow: false,
      })

      this._triggerOverlay = handle as WindowHandleLike
      this.windowManager.on('windowFocus', this._onOverlayFocused)

      // Wire up VU meter from listener to overlay
      this._vuHandler = (level: number) => {
        if (this._triggerOverlay) {
          (this._triggerOverlay as any).eval(`setVU(${level})`).catch(() => {})
        }
      }
      this.listener.on('vu', this._vuHandler)
    } catch (error: any) {
      this.emit('info', `Trigger overlay unavailable: ${error?.message || String(error)}`)
    }
  }

  private async closeTriggerOverlay() {
    if (this._vuHandler) {
      this.listener.off('vu', this._vuHandler)
      this._vuHandler = null
    }
    const overlay = this._triggerOverlay
    this._triggerOverlay = null
    this.windowManager.off('windowFocus', this._onOverlayFocused)
    await overlay?.close().catch(() => {})
  }

  /** Bound handler for when the overlay window gains focus (user clicked it to cancel) */
  private _onOverlayFocused = (payload: any) => {
    const focusedId = (payload?.windowId || payload?.id || '').toLowerCase()
    const overlayId = this._triggerOverlay?.windowId?.toLowerCase()
    if (focusedId && overlayId && focusedId === overlayId && payload?.focused) {
      this._cancelled = true
      this.killAfplay()
      this.listener.cancelListen()
      this.closeTriggerOverlay()
      this.emit('info', 'Voice interaction cancelled by user')
    }
  }

  /** Kill any running afplay processes */
  private killAfplay() {
    try {
      this.container.proc.exec('killall afplay')
    } catch {
      // no afplay running, that's fine
    }
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
      await this.closeTriggerOverlay()
      return
    }

    const entry = this.resolveWakeWord(wakeword)

    if (!entry) {
      this.emit('info', `No voice assistant matched wake word: ${wakeword}`)
      await this.closeTriggerOverlay()
      listener.unlock()
      return
    }

    listener.lock()
    this._cancelled = false

    this.emit('info', `Wake word "${wakeword}" → assistant "${entry.assistantName}"`)
    await this.showTriggerOverlay(entry.assistantName, wakeword)
    if (this._triggerOverlay) {
      (this._triggerOverlay as any).eval(`setStatus('listening')`).catch(() => {})
    }
    this.container.ui.print.red('MIC IS HOT')

    // Play a short audio acknowledgement so the user knows the assistant heard them
    const chat = this.getOrCreateChat(entry)
    if (!chat.isStarted) {
      await chat.start()
    }
    chat.playPhrase('generic-ack')

    const seededText = (listener.state.get('initialCommandText') as string || '').trim()
    const text = seededText.length
      ? seededText
      : await listener.listen({ silenceTimeout: 7000 }).then((r: string) => r.trim())
    listener.state.set('initialCommandText', '')

    if (this._cancelled) {
      listener.unlock()
      return
    }

    if (!text?.length) {
      this.emit('info', 'Got no text')
      await this.closeTriggerOverlay()
      listener.unlock()
      return
    }

    this.emit('info', `User said: ${text}`)
    this.emit('info', `Asking ${entry.assistantName}: ${text}`)

    // Wire up overlay status transitions from VoiceChat events
    const onGenerating = () => {
      console.log('[voice-service] overlay → generating')
      if (this._triggerOverlay) {
        (this._triggerOverlay as any).eval(`setStatus('generating')`).catch(() => {})
      }
    }
    const onSpeaking = () => {
      console.log('[voice-service] overlay → speaking')
      if (this._triggerOverlay) {
        (this._triggerOverlay as any).eval(`setStatus('speaking')`).catch(() => {})
      }
    }
    const onFinished = () => {
      console.log('[voice-service] overlay → done')
      if (this._triggerOverlay) {
        (this._triggerOverlay as any).eval(`setStatus('done')`).catch(() => {})
      }
    }
    chat.on('generating', onGenerating)
    chat.on('speaking', onSpeaking)
    chat.on('finished', onFinished)

    console.log('[voice-service] awaiting chat.ask()')
    await chat.ask(text)
    console.log('[voice-service] chat.ask() resolved')

    chat.off('generating', onGenerating)
    chat.off('speaking', onSpeaking)
    chat.off('finished', onFinished)

    this.emit('info', `${entry.assistantName} finished speaking`)

    // Brief pause so the user sees the "Done" state before overlay closes
    await this.container.sleep(1200)
    console.log('[voice-service] closing overlay')
    await this.closeTriggerOverlay()
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
