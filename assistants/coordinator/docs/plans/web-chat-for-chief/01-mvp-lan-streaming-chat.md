---
status: completed
project: web-chat-for-chief
costUsd: 2.0651786000000008
tools: 0
turns: 50
toolCalls: 94
completedAt: '2026-03-21T03:29:50.651Z'
---


# Plan: MVP LAN Streaming Web Chat (WebSocket)

## References

- Project: `docs/projects/web-chat-for-chief.md`
- Idea source: `docs/ideas/develop-a-web-based-streaming-chat-experience.md`
- Luca patterns (existing in repo):
  - Express static + endpoints pattern: `commands/voice/train/server.ts`
  - Terminal chat precedent: `commands/voice-chat.ts`
  - Endpoint discovery example: `endpoints/health.ts`

## Scope

Implement the smallest useful browser chat UI that:
- is **LAN accessible**
- uses **WebSockets**
- streams assistant output
- defaults to the **Chief** assistant

Explicitly out of scope:
- persistence/reconnect (Plan 02)
- assistant picker (Plan 02)
- tool activity UI (Plan 03)
- any “presenter inside chat” UI

## Deliverables

1) **New command**: `luca web-chat`
   - starts an HTTP server and a WebSocket server
   - binds to `0.0.0.0` by default (LAN)
   - prints the chosen port and LAN URLs

2) **Static web UI** served by the command
   - single-page UI (no build step) under something like `public/web-chat/`
   - message list + input box + send button
   - streams assistant response into the last assistant message as chunks arrive

3) **Server-side chat bridge**
   - on WS `user_message`, call into existing conversation/assistant stack targeting **Chief**
   - emit incremental `chunk` events and final `message_complete`

## Implementation Outline

### 1. Command skeleton
- Add `commands/web-chat.ts` implementing the CLI command.
- Reuse existing server infrastructure (Express + WebSocket server) as used elsewhere in the repo.

### 2. HTTP server (static assets)
- Serve `public/web-chat/index.html` plus any CSS/JS.
- Keep everything frameworkless for MVP.

### 3. WebSocket protocol (v0)
Client → Server:
- `init` (optional in MVP)
- `user_message`: `{ text: string }`

Server → Client:
- `assistant_message_start`: `{ messageId: string }`
- `chunk`: `{ messageId: string; textDelta: string }`
- `assistant_message_complete`: `{ messageId: string }`
- `error`: `{ message?: string }`

### 4. Streaming hookup
- Use the conversation feature’s streaming mechanism (chunks) and forward to WS.
- Ensure backpressure doesn’t crash the process (basic try/catch + socket ready checks).

### 5. LAN bind + printed URL
- Default bind host: `0.0.0.0`
- Print:
  - `http://localhost:<port>/web-chat`
  - `http://<lan-ip>:<port>/web-chat` (best-effort detection)

## Verification

- From a second device on the same Wi‑Fi, open the printed LAN URL.
- Send a prompt; confirm:
  - response appears
  - response **streams** (multiple incremental updates)
  - server stays stable across multiple messages

