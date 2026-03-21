---
status: completed
project: web-chat-for-chief
costUsd: 1.9568479499999998
tools: 0
toolCalls: 80
turns: 56
completedAt: '2026-03-21T03:36:31.749Z'
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

