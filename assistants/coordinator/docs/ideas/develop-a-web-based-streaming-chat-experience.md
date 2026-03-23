---
status: exploring
goal: user-experience-improvements
tags:
  - ux
  - web
  - chat
  - streaming
  - voice
  - progressive-enhancement
  - websocket
---

# Web Based Streaming Chat Experience

For users who don't have native voice transcription capabilities, or haven't yet set them up.

We can have a `luca voice-chat` command that lives in the project and works similarly to the core luca `chat` command.

**Target:** Local-first. The CLI starts a local web server, opens the browser, and the UI connects over localhost websockets.

It should be a full featured web based Chat UI that uses websockets to display the output of the conversation with the assistant.

It should have a `microphone` button and a `voice` button that enable bi-directional voice.

The `microphone` needs to be powered by the luca WebContainer's `voice` feature for transcription.

## Why This Matters

This idea directly serves the **progressive enhancement** principle in the `user-experience-improvements` goal. The terminal-based `voice-chat` command (already built) requires local whisper transcription, rustpotter wake words, and an elevenlabs API key. That's a high barrier.

A browser-based chat UI lowers the floor dramatically:
- **Text-only works out of the box** — no dependencies beyond `luca serve`
- **Browser Speech API is free** — no elevenlabs key needed for basic voice
- **No native toolchain** — no rustpotter, no mlx_whisper compilation
- **Visual richness** — rendered markdown, tool call activity, streaming cursors — things the terminal can approximate but the browser does natively

This is the "skateboard" that makes the agentic loop usable for anyone who clones the repo, before they invest in the full voice stack.

## What Already Exists

The project already has all the infrastructure needed. No new dependencies required.

### Server-Side

| Capability | How to access | Notes |
|---|---|---|
| WebSocket server | `container.server('websocket')` | Bridges messages to luca event bus |
| Express server | `container.server('express')` | Auto-discovers `endpoints/`, serves static files |
| Conversation feature | `container.feature('conversation')` | Streaming via `ask()`, emits `chunk` events |
| Voice chat feature | `container.feature('voiceChat')` | Combines listener + assistant, streams responses |
| Assistants | `assistants/chiefOfStaff/` | Tools, voice config, system prompt in `CORE.md` |
| Container link | `container.feature('containerLink')` | WebSocket bridge between Node and browser containers |

### Browser-Side (Luca WebContainer)

| Capability | How to access | Notes |
|---|---|---|
| Voice recognition | `voice-recognition` feature | Web Speech API, interim + final transcripts |
| Speech synthesis | `speech` feature | Browser TTS with voice selection |
| Container link client | `container-link` feature | WebSocket client for bidirectional comms |
| Network/fetch | `network` feature | HTTP capabilities |

### Existing Patterns to Follow

- **Terminal voice chat** (`commands/voice-chat.ts`) — The React Ink chat UI with streaming, VU meters, phase indicators. This is the terminal equivalent of what we're building for the browser.
- **Voice training studio** (`commands/voice/train/server.ts`) — Express server serving a `public/` directory with API endpoints. This is the exact pattern for serving a web chat UI.
- **Endpoint pattern** (`endpoints/health.ts`) — File-based route discovery for `luca serve`.

## Requirements

- Should work fine without audio in or out (text-only mode).
- Should render beautiful markdown.
- Should show tool call activity (tool name, status, duration).
- Should stream assistant output as it is produced.
- Should support websocket transport between CLI/server and browser.
- Should follow progressive enhancement: text → voice input → voice output, each layer optional.
- Should allow choosing which assistant to talk to.

## Architecture Sketch

```
┌─────────────────────────────────────────────┐
│  Browser (localhost:PORT)                    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Chat UI (vanilla HTML/CSS/JS)      │    │
│  │  - Message list with markdown       │    │
│  │  - Text input + send button         │    │
│  │  - Mic button (Web Speech API)      │    │
│  │  - Speaker toggle (Web TTS)         │    │
│  │  - Tool call activity indicators    │    │
│  │  - Streaming cursor                 │    │
│  └──────────────┬──────────────────────┘    │
│                 │ WebSocket                  │
└─────────────────┼───────────────────────────┘
                  │
┌─────────────────┼───────────────────────────┐
│  Node (luca serve / luca web-chat)          │
│                 │                            │
│  ┌──────────────┴──────────────────────┐    │
│  │  WebSocket handler                  │    │
│  │  - Receives: user_message, init     │    │
│  │  - Sends: chunk, tool_start,        │    │
│  │    tool_end, message_complete        │    │
│  └──────────────┬──────────────────────┘    │
│                 │                            │
│  ┌──────────────┴──────────────────────┐    │
│  │  Conversation feature               │    │
│  │  - Assistant selection              │    │
│  │  - Streaming ask() with chunks      │    │
│  │  - Tool calling + results           │    │
│  │  - ConversationHistory persistence  │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

## Delivery Roadmap (Skateboard → Car)

### Skateboard: Text Chat
- `luca web-chat` command starts Express + WebSocket server
- Serves a single-page HTML chat UI from `public/web-chat/`
- Text input sends message over WebSocket
- Server pipes it through conversation feature, streams chunks back
- Browser renders streamed markdown in real-time
- **Usable by anyone who can run `bun`**

### Bicycle: Tool Visibility + Session Persistence
- Show tool call names and durations as collapsible cards
- Persist conversation thread via `ConversationHistory`
- Session ID in localStorage, reconnect to same thread
- Assistant selector dropdown

### Motorcycle: Browser Voice
- Mic button using Web Speech API (free, no API key)
- Speaker toggle using Web Speech synthesis
- Voice activity indicator in the UI
- Push-to-talk and continuous listening modes

### Car: Full Voice Integration
- Optional ElevenLabs TTS for high quality voice (if API key present)
- Node-side voice listener integration for local whisper transcription
- Wake word support bridged through WebSocket
- VU meter visualizations matching the terminal UI

## References

- Core luca chat command: https://github.com/soederpop/luca/blob/main/src/commands/chat.ts
- Voice recognition feature (WebContainer): https://github.com/soederpop/luca/blob/main/src/web/features/voice-recognition.ts
- Speech synthesis feature (WebContainer): https://github.com/soederpop/luca/blob/main/src/web/features/speech.ts
- WebSocket server: https://github.com/soederpop/luca/blob/main/src/node/servers/websocket.ts
- Container link: https://github.com/soederpop/luca/blob/main/src/node/features/container-link.ts
- Existing terminal voice chat: `commands/voice-chat.ts`
- Existing web server pattern: `commands/voice/train/server.ts`
- Express server: https://github.com/soederpop/luca/blob/main/src/node/servers/express.ts
