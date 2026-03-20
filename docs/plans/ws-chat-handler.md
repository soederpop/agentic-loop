---
status: pending
project: projects/web-based-chief-chat
---

# Server-Side WebSocket Chat Handler

Wire up the luca WebSocket server to handle chat messages for the Chief of Staff assistant. When a browser client connects and sends `init` / `user_message` / `clear_thread` events, the server routes them into a chiefOfStaff assistant session, streams `assistant_delta` / `assistant_final` / `tool_call_started` / `tool_call_finished` events back, and uses ConversationHistory to persist threads by sessionId.

This plan focuses entirely on server-side logic. The browser UI is handled by the next plan.

### Approach

1. Create a WebSocket message handler (likely in `endpoints/` or a dedicated module) that listens for the chat event types defined in the idea doc
2. On `init`, look up or create a ConversationHistory thread for the given `sessionId`, send back `thread_state` with existing messages
3. On `user_message`, feed the message into the chiefOfStaff assistant's `ask()` method, streaming deltas and tool call lifecycle events back over the WebSocket connection
4. On `clear_thread`, rotate the thread so the next `init` starts fresh
5. Register this handler in `luca.serve.ts` so it activates when the server boots

### Key constraints

- Use only existing container features (conversation, conversationHistory, websocket server, assistantsManager)
- Follow the WebSocket event schema from the idea doc
- Do not introduce new npm dependencies

## References

- Idea doc: `docs/ideas/web-based-assistant-chat-application.md` — full WS event schema in "Implementation Notes"
- WebSocket server: `luca describe websocket`
- Conversation feature: `container.feature('conversation')`
- ConversationHistory feature: `container.feature('conversationHistory')`
- AssistantsManager bootstrap: `luca.serve.ts`
- Chief of Staff assistant: `assistants/chiefOfStaff/`

## Test plan

- Start the server with `luca serve` and confirm it boots without errors
- Connect to the WebSocket and send an `init` message with a new sessionId — verify a `thread_state` response with an empty messages array
- Send a `user_message` and verify `assistant_delta` events stream back followed by `assistant_final`
- Send a message that triggers a tool call and verify `tool_call_started` and `tool_call_finished` events appear
- Reload / reconnect with the same sessionId and verify `thread_state` includes the previous messages
- Send `clear_thread` and verify the next `init` returns an empty thread
