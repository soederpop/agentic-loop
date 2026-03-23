# Project Reviewer Chat Status

## Summary

`workflows/project-reviewer` still has chat connection problems, while `commands/web-chat.ts` works.

Important context: the Luca framework's websocket ask/reply semantics were **added because of struggles in this area**. In other words, `project-reviewer` was not failing because it ignored a long-existing protocol; rather, the difficulties in `project-reviewer` helped motivate adding a cleaner websocket request/reply model to Luca.

So the right framing is:

- `project-reviewer` currently uses a bespoke raw websocket protocol
- that protocol has been brittle and difficult to reason about
- Luca now has new websocket ask/reply primitives intended to make flows like this easier
- `project-reviewer` likely needs to be refactored to take advantage of those newer primitives

## What I inspected

### Working reference: `commands/web-chat.ts`

File: `commands/web-chat.ts`

This command still uses raw `ws` directly, but its browser client and server are internally consistent.

It:
- creates a `WebSocketServer` attached to the main HTTP server
- expects raw JSON messages such as:
  - `init`
  - `user_message`
- sends streaming events such as:
  - `assistant_message_start`
  - `chunk`
  - `tool_start`
  - `tool_end`
  - `assistant_message_complete`
  - `error`

This works because both sides of the protocol agree with each other.

### Problem area: `workflows/project-reviewer/luca.serve.ts`

File: `workflows/project-reviewer/luca.serve.ts`

The workflow server currently:
- creates `new WebSocketServer({ noServer: true })`
- monkey-patches `server.start()` to attach the HTTP upgrade handler after startup
- parses raw JSON messages from the browser
- switches on ad hoc message types:
  - `init`
  - `start_review`
  - `user_message`
- sends ad hoc event packets back:
  - `init_ok`
  - `review_started`
  - `assistant_message_start`
  - `chunk`
  - `tool_start`
  - `tool_end`
  - `assistant_message_complete`
  - `error`

It also has more workflow-specific orchestration than `web-chat`, including:
- session creation/resume
- project loading from docs
- a synthetic `start_review` action that builds a long project briefing prompt
- streaming tool activity during review

That makes it a more complex control flow than `web-chat`.

### Project reviewer browser client

File: `workflows/project-reviewer/public/index.html`

The browser client also uses raw `WebSocket` directly:

```js
ws = new WebSocket(`${proto}://${location.hostname}:${location.port}`)
sendWS({ type: 'init', sessionId: chatSessionId })
sendWS({ type: 'start_review', projectSlug })
sendWS({ type: 'user_message', text })
```

So the current implementation is a custom protocol on both sides.

## New Luca websocket semantics

### Luca websocket client

File: `node_modules/@soederpop/luca/src/clients/websocket.ts`

The websocket client now supports request/reply semantics:

```ts
await ws.ask('getUser', { id: 42 })
```

This sends a request shaped like:

```json
{ "type": "getUser", "data": { "id": 42 }, "requestId": "..." }
```

And expects a reply shaped like:

```json
{ "replyTo": "...", "data": ... }
```

### Luca websocket server

File: `node_modules/@soederpop/luca/src/servers/socket.ts`

The server now supports:
- `server.ask(ws, type, data)`
- automatic correlation of replies via `replyTo`
- incoming request helpers when `requestId` exists:
  - `data.reply(responseData)`
  - `data.replyError(error)`

These semantics are a better fit for explicit command-style websocket operations than the existing ad hoc control-plane messages.

## Current interpretation

The likely issue is **not** that `project-reviewer` violated an older Luca convention.

The likely issue is:

1. `project-reviewer` has a bespoke websocket control flow that became hard to maintain and debug.
2. New ask/reply primitives were added to Luca to improve exactly this kind of problem.
3. `project-reviewer` still appears to be using the older hand-rolled protocol rather than the newer request/reply model.
4. Because it has a more complex setup than `web-chat`, it is a better candidate for adopting the new protocol primitives.

## Recommended direction

Refactor `workflows/project-reviewer/luca.serve.ts` and `workflows/project-reviewer/public/index.html` so the **control plane** uses Luca’s ask/reply semantics, while the **streaming plane** remains event-based.

### Use ask/reply for explicit request/response actions
These are good candidates:
- `init`
- `start_review`
- optionally `user_message` submission acknowledgement

### Keep fire-and-forget events for streaming
These should likely stay as normal emitted websocket messages:
- `assistant_message_start`
- `chunk`
- `tool_start`
- `tool_end`
- `assistant_message_complete`
- `error`

That preserves the existing UI behavior while making the command flow more structured and debuggable.

## Why this should help

The new ask/reply semantics give a cleaner model for:
- waiting for `init` to finish before sending `start_review`
- surfacing failures as direct replies instead of implicit state
- making session setup explicit
- reducing race conditions in connection/bootstrap flow
- making the protocol easier to inspect and log

This seems especially useful in `project-reviewer`, where the browser currently has to infer readiness from asynchronous custom events.

## Concrete notes for Claude

Please inspect and refactor with these goals:

1. Update `workflows/project-reviewer/luca.serve.ts` to use Luca’s newer websocket ask/reply semantics for control-plane messages.
2. Update `workflows/project-reviewer/public/index.html` accordingly.
3. Preserve the current streaming assistant UX:
   - chunk streaming
   - tool activity streaming
   - assistant start/complete events
4. Keep reconnect/session behavior intact:
   - `sessionId`
   - `assistant.resumeThread('project-reviewer:${sessionId}')`
5. Reduce brittleness in startup / handshake flow.
6. Compare behavior with:
   - `commands/web-chat.ts`
   - `node_modules/@soederpop/luca/src/clients/websocket.ts`
   - `node_modules/@soederpop/luca/src/servers/socket.ts`

## Suggested prompt for Claude

```md
Investigate and fix the chat connection flow in `workflows/project-reviewer`.

Context:
- `commands/web-chat.ts` works, but `workflows/project-reviewer` still has websocket/chat issues.
- The Luca websocket ask/reply semantics were recently added specifically because this class of integration was proving brittle.
- `project-reviewer` still appears to use a hand-rolled raw websocket control protocol (`init`, `start_review`, `user_message`) rather than the newer request/reply model.

Tasks:
1. Inspect:
   - `workflows/project-reviewer/luca.serve.ts`
   - `workflows/project-reviewer/public/index.html`
   - `commands/web-chat.ts`
   - `node_modules/@soederpop/luca/src/clients/websocket.ts`
   - `node_modules/@soederpop/luca/src/servers/socket.ts`
2. Refactor project-reviewer so its websocket control-plane messages use Luca’s ask/reply semantics.
3. Preserve event-based streaming for:
   - assistant chunk output
   - tool activity
   - assistant start/complete events
4. Preserve session resume behavior and existing review UX.
5. Simplify or clarify the handshake/bootstrap logic so it is easier to reason about and debug.

Deliverables:
- updated `workflows/project-reviewer/luca.serve.ts`
- any required updates in `workflows/project-reviewer/public/index.html`
- a brief explanation of what was brittle before, and how the ask/reply migration improves it
```

## Key files

- `workflows/project-reviewer/luca.serve.ts`
- `workflows/project-reviewer/public/index.html`
- `commands/web-chat.ts`
- `node_modules/@soederpop/luca/src/clients/websocket.ts`
- `node_modules/@soederpop/luca/src/servers/socket.ts`
