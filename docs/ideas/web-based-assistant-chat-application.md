---
tags: [web, chat, assistant, luca-web]
status: exploring
goal: ""
---

# web based assistant chat application

We need to extend the agentic loop by providing a web based interface for chatting with the chief of staff assistant.

## Why This Matters

The Chief of Staff assistant currently lives behind `luca chat chiefOfStaff` in the terminal and the "Hey Chief" voice wake word. A web-based chat UI would:

- Give a persistent, always-visible channel to interact with Chief without a terminal
- Let you review documents, status summaries, and project plans inline alongside the conversation
- Serve as the foundation for sharing the assistant interface with collaborators or displaying it on a second screen
- Align with the existing architecture: the express server, websocket server, and presenter feature all already run on the same stack

## Existing Infrastructure to Build On

### Server Side (already in place)

| Component | What it provides | Where |
|-----------|-----------------|-------|
| **Express server** (`luca serve`) | Static file serving from `public/`, endpoint mounting from `endpoints/` | `luca describe express` |
| **WebSocket server** | Real-time bidirectional messaging, client tracking, JSON framing | `luca describe websocket` (server) |
| **AssistantsManager** | Discovers assistant definitions, creates instances | `luca.serve.ts` already calls `mgr.discover()` at boot |
| **chiefOfStaff assistant** | System prompt (`CORE.md`), tools (`tools.ts`), voice config (`voice.yaml`), conversation history | `assistants/chiefOfStaff/` |
| **Conversation feature** | OpenAI streaming, tool calling, message state, context management | `container.feature('conversation')` |
| **ConversationHistory** | Disk-persisted threads, tagging, search | `container.feature('conversationHistory')` |
| **Health endpoint** | Proves the endpoint pattern works | `endpoints/health.ts` |

### Browser Side (already in place)

| Component | What it provides |
|-----------|-----------------|
| **Luca WebContainer** | `window.luca` with REST client + WebSocket client, imported via `https://esm.sh/@soederpop/luca@0.0.11/src/browser.ts` |
| **Architecture dashboard** | `public/index.html` — existing deep-blue + gold theme to match |
| **Presenter feature** | Express on `9210` + WS on `9211`, already injects the Luca browser container into HTML pages |

### Design Language

The existing `public/index.html` establishes the visual identity: deep-blue (`#0c1220`) + gold (`#d4a73a`) palette, Bricolage Grotesque + Fragment Mono fonts. The chat UI should feel native to this.

## How It Would Work

### Skateboard (functional MVP)

A single `public/chief-chat/index.html` page served at `http://localhost:3000/chief-chat` that:

1. Connects to the luca server via `window.luca` WebSocket client
2. Sends user messages to a new `/api/chat` endpoint
3. The endpoint creates/resumes a chiefOfStaff assistant session and streams the response back
4. Renders the conversation with basic markdown support

New files needed:
- `public/chief-chat/index.html` — self-contained chat UI (HTML + CSS + JS, no build step)
- `endpoints/chat.ts` — POST endpoint that bridges HTTP to the assistant's `ask()` method

### Bicycle (next iteration)

- Streaming responses via WebSocket instead of HTTP polling
- Conversation thread persistence (resume where you left off)
- Tool call visualization (show when Chief is calling `readDocs`, `getOverallStatusSummary`, etc.)
- Inline document rendering when Chief references a doc

### Motorcycle (future)

- Voice input/output in the browser (mic capture → whisper STT → assistant → ElevenLabs TTS)
- Multi-assistant switching (Chief, Friday, custom)
- Mobile-responsive layout

## Key Technical Decisions to Make

1. **Streaming approach**: SSE from the `/api/chat` endpoint vs. full WebSocket conversation channel? SSE is simpler for the skateboard, WebSocket scales better for the bicycle.
2. **Session identity**: Use a cookie/localStorage session ID to resume threads, or start fresh each page load?
3. **Tool call transparency**: Should the UI show tool calls in-flight (like Claude Code does), or just show the final response?

## References

- Luca WebContainer browser source: `https://github.com/soederpop/luca/tree/main/src/web`
- Browser import: `https://esm.sh/@soederpop/luca@0.0.11/src/browser.ts`
- Chief of Staff system prompt: `assistants/chiefOfStaff/CORE.md`
- Chief of Staff tools: `assistants/chiefOfStaff/tools.ts` (readDocs, updateDocument, getOverallStatusSummary, ls)
- Existing endpoint pattern: `endpoints/health.ts`
- Server setup hook: `luca.serve.ts` (already discovers assistants + loads docs at boot)
- Express server docs: `luca describe express`
- WebSocket server docs: `luca describe websocket`
