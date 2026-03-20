---
tags:
  - web
  - chat
  - assistant
  - luca-web
status: exploring
goal: ''
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
2. Sends user messages over WebSocket (no HTTP/SSE chat endpoint)
3. The server routes messages into a chiefOfStaff assistant session and streams events back over the same WebSocket channel
4. Renders the conversation with basic markdown support
5. Shows tool calls in-flight (start/update/end) so the UI always has feedback during long operations
6. Persists the conversation thread until the user clears it (reload resumes the same thread)

New files needed (expected):
- `public/chief-chat/index.html` — self-contained chat UI (HTML + CSS + JS, no build step)
- WebSocket message router/handler on the server to bridge browser <-> assistant `ask()`

### Bicycle (next iteration)

- Tool call visualization details (args, partial progress, outputs)
- Inline document rendering when Chief references a doc (e.g. render `docs/...` content in a side panel)

### Motorcycle (future)

- Voice input/output in the browser (mic capture → whisper STT → assistant → ElevenLabs TTS)
- Multi-assistant switching (Chief, Friday, custom)
- Mobile-responsive layout

## Key Technical Decisions (Locked In)

1. **Streaming approach**: WebSocket-only (no SSE / no `/api/chat` streaming endpoint)
2. **Tool call transparency**: Required. The UI must show tool calls in-flight (similar to Claude Code) so the user is never waiting without feedback.
3. **Thread persistence**: Required. The chat thread must persist across reloads until the user explicitly clears it.

## Implementation Notes (for architects)

### Session / Thread Identity

- Browser generates and stores a stable `sessionId` in `localStorage` (e.g. `chief_chat_session_id`).
- On WS connect, client sends `{ type: 'init', sessionId }`.
- Server maps `sessionId` -> assistant conversation/thread id via `ConversationHistory` (disk persisted).
- Provide a UI control "Clear" that:
  - clears local transcript
  - clears localStorage `sessionId` (or rotates it)
  - sends `{ type: 'clear_thread' }` to server so server can start a fresh thread

### WebSocket Event Schema (minimum viable)

Client -> Server:
- `init`: `{ type: 'init', sessionId: string }`
- `user_message`: `{ type: 'user_message', sessionId: string, message: string }`
- `clear_thread`: `{ type: 'clear_thread', sessionId: string }`

Server -> Client:
- `thread_state`: `{ type: 'thread_state', sessionId: string, threadId: string, messages: Array<{ role: 'user'|'assistant'|'tool', content: string, ts?: number }> }` (sent after init to hydrate UI)
- `assistant_delta`: `{ type: 'assistant_delta', sessionId: string, textDelta: string }`
- `assistant_final`: `{ type: 'assistant_final', sessionId: string, messageId?: string }`
- `tool_call_started`: `{ type: 'tool_call_started', sessionId: string, toolCallId: string, name: string, args: any }`
- `tool_call_finished`: `{ type: 'tool_call_finished', sessionId: string, toolCallId: string, name: string, result: any }`
- `error`: `{ type: 'error', sessionId: string, message: string, details?: any }`

Notes:
- The schema should be adapted to whatever the current Luca WS server conventions already use; the important part is lifecycle events for tool calls and a hydration message for persistent threads.

## References

- Luca WebContainer browser source: `https://github.com/soederpop/luca/tree/main/src/web`
- Browser import: `https://esm.sh/@soederpop/luca@0.0.11/src/browser.ts`
- Chief of Staff system prompt: `assistants/chiefOfStaff/CORE.md`
- Chief of Staff tools: `assistants/chiefOfStaff/tools.ts` (readDocs, updateDocument, getOverallStatusSummary, ls)
- Existing endpoint pattern: `endpoints/health.ts`
- Server setup hook: `luca.serve.ts` (already discovers assistants + loads docs at boot)
- Express server docs: `luca describe express`
- WebSocket server docs: `luca describe websocket`
