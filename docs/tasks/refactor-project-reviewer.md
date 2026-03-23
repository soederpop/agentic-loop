---
title: Refactor Project Reviewer WebSocket Streaming
status: pending
createdBy: chief
createdAt: 2026-03-22T00:00:00.000Z
running: false
lastRanAt: 1774222168224
---

# Refactor Project Reviewer WebSocket Streaming

The `workflows/project-reviewer` flow is getting stuck while Claude is processing, and websocket events are not reliably making it to the UI.

## Goal

Refactor the project reviewer chat transport so streaming assistant events reach the browser reliably during review sessions.

## Problems observed

* Claude appears to get stuck during `start_review` or follow-up chat
* The websocket sidecar is not reliably delivering streaming events to the UI
* The implementation differs from the known-working pattern in `commands/web-chat.ts`
* Tool activity tracking currently keys by tool name, which can collide if the same tool is called multiple times
* `isProcessing` is global instead of scoped per websocket connection

## Proposed refactor

1. Align `workflows/project-reviewer/luca.serve.ts` with the websocket pattern used in `commands/web-chat.ts`
2. Prefer attaching websocket handling to the main HTTP server instead of a separate sidecar port, if supported by `luca serve`
3. Add clear logging around websocket send/receive, chunk emission, and assistant lifecycle
4. Scope processing state per connection instead of globally
5. Use stable unique IDs for tool call start/end events
6. Keep the current UI event contract intact, or update the UI and server together if the contract changes

## Acceptance criteria

* Opening project review chat consistently establishes a working realtime connection
* Starting a review streams assistant chunks into the UI
* Tool start/end events appear in the UI while the assistant is working
* Follow-up user messages stream correctly after the initial review
* Repeated calls to the same tool do not corrupt tool activity tracking
* The transport implementation is simpler and closer to the shared web chat pattern

## References

* `workflows/project-reviewer/luca.serve.ts`
* `workflows/project-reviewer/public/index.html`
* `commands/web-chat.ts`
