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

