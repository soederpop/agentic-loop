---
goal: user-experience-improvements
status: exploring
tags:
  - ux
  - web
  - chat
  - voice
  - progressive-enhancement
  - websocket
  - daily-driver
---

# Web Chat Interface Improvements

The web chat for Chief is working (streaming text, tool visibility, session persistence, assistant picker). Now it needs to become a **daily driver** — the single pane of glass for interacting with the agentic loop, whether you're typing, talking, or both.

## Why This Matters

The completed web-chat-for-chief project proved the streaming text chat works. But the terminal `voice-chat` command still owns the voice experience, and the web chat and voice chat are completely separate worlds — different assistant instances, different sessions, different state.

This directly serves the **User Experience Improvements** goal:
- **Progressive enhancement**: text works out of the box, voice layers on when capabilities are present
- **Unsurprising**: one conversation thread regardless of whether you're typing in the browser or talking via `luca yo`
- **Delightful**: a polished, responsive interface that makes Chief feel like a real assistant, not a CLI tool

## What Already Exists

### Completed Web Chat (web-chat-for-chief project)

| Capability | Status | File |
|---|---|---|
| WebSocket streaming | Done | `commands/web-chat.ts` |
| Session persistence | Done | `commands/web-chat.ts` (resumeThread) |
| Assistant picker | Done | `public/web-chat/index.html` |
| Tool activity UI | Done | `public/web-chat/index.html` |
| LAN accessible | Done | Binds `0.0.0.0` |

### Voice Infrastructure (server-side)

| Capability | How to access | Notes |
|---|---|---|
| VoiceChat feature | `container.feature('voiceChat')` | Wraps Assistant + SpeechStreamer for ElevenLabs TTS |
| SpeechStreamer | `voice/speech-streamer.ts` | Chunks text → ElevenLabs API → audio playback |
| Voice listener | `container.feature('voiceListener')` | Whisper MLX transcription from microphone |
| Phrase manifests | `assistants/*/generated/manifest.json` | Pre-generated audio phrases for snappy playback |
| Capability check | `voiceChat.checkCapabilities()` | Detects ELEVENLABS_API_KEY + voice.yaml |

### Browser Voice (Luca WebContainer)

| Capability | Feature | Notes |
|---|---|---|
| Voice recognition | `voice-recognition` | Web Speech API, interim + final transcripts, free |
| Speech synthesis | `speech` | Browser TTS with voice selection, free |
| Container link | `container-link` | WebSocket bridge for bidirectional browser↔server comms |

## Core Problems to Solve

### 1. Unified Assistant Instance

**Current state**: `web-chat.ts` creates its own Assistant via `assistantsManager.create()`. The `voiceChat` feature also creates its own Assistant via `this.assistantsManager.create()`. These are separate objects with separate conversation histories.

**Problem**: If you talk to Chief via `luca yo` and then open the web chat, you're talking to a different Chief. Tool calls from voice don't appear in the web UI. Context is lost.

**Solution**: The VoiceChat feature needs to accept an externally-created Assistant instance rather than always creating its own. The web-chat command should be the authority that creates the Assistant, and voice layers should attach to that same instance.

```
// Current: voiceChat creates its own assistant
get assistant() { return this.assistantsManager.create(...) }

// Needed: accept an injected assistant
start({ assistant?: Assistant }) {
  this._assistant = assistant ?? this.assistantsManager.create(...)
}
```

### 2. Server Authority Pattern

**Current state**: `luca web-chat` starts its own Express + WebSocket server. `luca main` runs separately. They don't know about each other.

**Problem**: Running both means two servers, two ports, potentially two sets of assistant instances.

**Solution**: Three modes of operation:
1. **Standalone** (current): `luca web-chat` starts its own server — works today
2. **Embedded**: `luca main` starts the web-chat server as part of its boot — web chat is always available when the main loop runs
3. **Client mode**: `luca web-chat --connect` detects a running main process and connects to it instead of starting a new server

The embedded mode is the highest-value change — it means the web chat is always there when the loop is running.

### 3. Voice Capability Detection and Routing

**Current state**: The web chat is text-only. The voice stack requires terminal + local whisper + ElevenLabs.

**Solution**: Progressive capability detection at two levels:

**Server capabilities** (detected on init):
- `ELEVENLABS_API_KEY` present → high-quality TTS available
- Whisper MLX installed → server-side STT available
- voice.yaml for assistant → voice personality configured

**Browser capabilities** (detected on page load):
- `speechRecognition` API available → browser STT
- `speechSynthesis` API available → browser TTS
- Microphone permission granted → audio input ready

**Routing logic**:
| Server has ElevenLabs | Browser has Speech API | Voice behavior |
|---|---|---|
| Yes | Yes | Server TTS (high quality), browser STT (low latency) |
| Yes | No | Server TTS, no STT (text input only) |
| No | Yes | Browser TTS + browser STT (fully free) |
| No | No | Text only (current behavior) |

### 4. Cross-Channel Visibility

**Problem**: When Chief responds to a `luca yo` voice command, the web chat doesn't show it. When you type in the web chat, the terminal doesn't reflect it.

**Solution**: The assistant instance emits events. The web-chat WebSocket handler already listens to these events (`chunk`, `toolCall`, `toolResult`). If all channels (web UI, voice, terminal) share the same Assistant instance, events naturally flow to all connected listeners.

The WebSocket protocol needs a new event type:
```
Server → Client:
  external_message: { role: 'user' | 'assistant', text: string, source: 'voice' | 'terminal' | 'web' }
```

This lets the web UI show: "You said (via voice): show me my calendar" followed by Chief's response.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│  Browser (localhost:PORT)                            │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │  Chat UI                                       │  │
│  │  - Message list with markdown                  │  │
│  │  - Text input + send                           │  │
│  │  - 🎤 Mic button (Web Speech API STT)          │  │
│  │  - 🔊 Speaker toggle (ElevenLabs or Web TTS)   │  │
│  │  - Tool activity panel                         │  │
│  │  - Capability indicators                       │  │
│  └──────────────┬─────────────────────────────────┘  │
│                 │ WebSocket                           │
└─────────────────┼────────────────────────────────────┘
                  │
┌─────────────────┼────────────────────────────────────┐
│  Server (luca main or luca web-chat)                 │
│                 │                                     │
│  ┌──────────────┴─────────────────────────────────┐  │
│  │  WebSocket Hub                                 │  │
│  │  - Routes messages to shared Assistant          │  │
│  │  - Broadcasts events to all connected clients   │  │
│  │  - Reports server capabilities on init          │  │
│  └──────────────┬─────────────────────────────────┘  │
│                 │                                     │
│  ┌──────────────┴─────────────────────────────────┐  │
│  │  Shared Assistant Instance                     │  │
│  │  (one per session, shared across channels)      │  │
│  │                                                 │  │
│  │  ← web-chat WebSocket                          │  │
│  │  ← luca yo (voice router)                      │  │
│  │  ← terminal voice-chat                         │  │
│  └──────────────┬─────────────────────────────────┘  │
│                 │                                     │
│  ┌──────────────┴─────────────────────────────────┐  │
│  │  Optional: VoiceChat feature (attached)         │  │
│  │  - SpeechStreamer for ElevenLabs TTS            │  │
│  │  - Phrase manifests for snappy playback         │  │
│  │  - Voice listener for server-side STT           │  │
│  └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Delivery Roadmap (Skateboard → Car)

### Skateboard: Browser Voice Input/Output (Free, No API Keys)

- Add mic button to web chat UI using Web Speech API for STT
- Add speaker toggle using Web Speech synthesis for TTS
- Server reports capabilities on `init_ok` response
- Browser detects its own Speech API availability
- Push-to-talk mode as default, with continuous listening option
- **Works with zero configuration beyond `bun`**

### Bicycle: ElevenLabs TTS via Server

- Server detects ElevenLabs capability, reports it in `init_ok`
- When server has ElevenLabs, stream audio chunks to browser via WebSocket (binary frames or base64)
- Browser plays audio chunks as they arrive (Web Audio API)
- VoiceChat feature modified to accept injected Assistant instance
- Shared assistant between text chat and voice — same thread, same context
- Voice quality indicator in UI (browser TTS vs ElevenLabs)

### Motorcycle: Embedded in luca main + Cross-Channel Visibility

- `luca main` starts web-chat server as part of its boot sequence
- All channels (web, voice, terminal) share the same Assistant instance per session
- WebSocket broadcasts `external_message` events so web UI shows voice interactions
- `luca yo` responses appear in the web chat in real time
- Connection status shows whether connected to standalone or main process

### Car: Full Voice Parity with Terminal

- Server-side whisper STT available through WebSocket (higher accuracy than browser Speech API)
- Wake word support bridged through WebSocket
- VU meter visualizations matching the terminal voice-chat UI
- Automatic voice mode switching based on best available capabilities
- Multiple simultaneous web clients seeing the same conversation

## References

- Completed web chat: `commands/web-chat.ts`, `public/web-chat/index.html`
- VoiceChat feature: `features/voice-chat.ts`
- SpeechStreamer: `voice/speech-streamer.ts`
- Terminal voice-chat UI: `commands/voice-chat.ts`
- WebContainer voice recognition: [luca repo](https://github.com/soederpop/luca/blob/main/src/web/features/voice-recognition.ts)
- WebContainer speech synthesis: [luca repo](https://github.com/soederpop/luca/blob/main/src/web/features/speech.ts)
- Container link: [luca repo](https://github.com/soederpop/luca/blob/main/src/node/features/container-link.ts)
- Chief of Staff assistant: `assistants/chiefOfStaff/`
- Web-chat-for-chief project: `docs/projects/web-chat-for-chief.md`
- Parent idea: `docs/ideas/develop-a-web-based-streaming-chat-experience.md`
