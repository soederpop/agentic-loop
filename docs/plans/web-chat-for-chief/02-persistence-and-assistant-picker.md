---
status: approved
project: web-chat-for-chief
costUsd: 0
tools: 0
toolCalls: 0
turns: 0
---

# Plan: Persistence + Assistant Picker

## References

- Project: `docs/projects/web-chat-for-chief.md`
- Plan 01: `plans/web-chat-for-chief/01-mvp-lan-streaming-chat.md`

## Scope

Add “must-have” ergonomics:
- **persistent sessions** (reload/reconnect keeps the same thread)
- **assistant picker** in the UI (default Chief)

## Deliverables

1) Session identity
- Browser generates/stores a `sessionId` in `localStorage`.
- WS `init` includes `{ sessionId }`.

2) Server-side session routing
- Map `sessionId` → conversation history / thread.
- On reconnect, continue appending to the same session.

3) Assistant picker
- UI dropdown of allowed assistants.
- WS `init` (or each `user_message`) includes `{ assistantId }`.
- Server validates assistantId is allowed; defaults to `chiefOfStaff` (or whatever the canonical id is).

4) Minimal UI changes
- Top bar with assistant selector + connection indicator.

## Protocol additions

Client → Server:
- `init`: `{ sessionId: string; assistantId?: string }`
- `user_message`: `{ text: string; sessionId: string; assistantId?: string }`

Server → Client:
- `init_ok`: `{ sessionId: string; assistantId: string }`
- `init_error`: `{ message: string }`

## Verification

- Start server, open UI, send message.
- Reload page, confirm session resumes (conversation context persists).
- Switch assistant, confirm subsequent replies come from that assistant.
- Reconnect after temporarily killing Wi‑Fi, confirm it recovers cleanly.

## Handoff from Plan 01

Key implementation details from the MVP:

- **Command**: `commands/web-chat.ts` — Express + WebSocket on same HTTP server.
- **UI**: `public/web-chat/index.html` — single-file, no build step. Auto-reconnects on disconnect (2s retry).
- **Assistant per connection**: Each WS connection creates its own `assistantsManager.create(assistantName)` instance. For persistence, you'll need a `Map<sessionId, Assistant>` on the server side so reconnecting clients resume the same assistant/conversation.
- **WS protocol**: Already has `user_message` → `assistant_message_start` → `chunk` → `assistant_message_complete` flow. Adding `init` with `sessionId` is straightforward — the client already connects on page load.
- **`_listener` access**: The WebSocket server is attached via `(expressServer as any)._listener`. This is the raw `http.Server` from Express. It's a private property — watch for breakage on luca upgrades.
- **Assistant list**: `assistantsManager.discover()` is already called at startup. `assistantsManager.list()` should give you the available assistants for the picker dropdown. You may want to add an `/api/assistants` endpoint to expose this to the UI.
- **The `historyMode` option** on assistant creation controls persistence. The voice-chat feature uses `'lifecycle'` mode. Investigate what modes are available and pick the right one for session-based persistence.

## Retrospective

### What was built

Session persistence and assistant switching for the web chat. The browser generates a `sessionId` (stored in `localStorage`), sends it on every WebSocket connect via an `init` message, and the server maps each `sessionId:assistantId` pair to a persistent assistant instance. On reconnect or page reload, the same conversation thread resumes with full history. An assistant picker dropdown lets users switch between available assistants; each gets its own conversation thread per session.

### Key decisions

- **`historyMode: 'session'`** was the right choice. The assistant framework supports `lifecycle` (no persistence), `daily` (one thread per day), `persistent` (single long-running thread), and `session` (thread scoped to a specific ID). Using `session` with `resumeThread('web-chat:${sessionKey}')` gives exactly per-session persistence with no day-boundary weirdness.

- **Session key is `sessionId:assistantId`**, not just `sessionId`. This means switching assistants gives you a separate conversation per assistant, which is the natural UX. Going back to a previous assistant resumes that conversation.

- **Sessions are held in a server-side `Map`** — they survive WebSocket disconnects/reconnects but not server restarts. The `resumeThread` call rehydrates conversation history from disk on server restart, so history survives even if the process restarts. The in-memory map just caches the assistant instance.

- **The `init` → `init_ok` handshake** blocks message sending until the session is established. The client disables the send button until `init_ok` arrives. This prevents race conditions where a message arrives before the session is wired up.

### What I learned

The assistant framework's `resumeThread(threadId)` must be called before `start()`. The thread ID can be any string — it doesn't need to match the framework's auto-generated format. The framework handles loading existing history from disk transparently. The `historyMode` enum options weren't documented in the `luca describe` output — I had to discover them from the validation error message (`"lifecycle"|"daily"|"persistent"|"session"`).

