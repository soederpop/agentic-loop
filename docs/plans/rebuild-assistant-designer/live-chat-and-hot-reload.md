---
status: completed
project: rebuild-assistant-designer
---

# Live Chat, Hot Reload, and History

Add the interactive runtime experience to the designer: a live chat panel, a REPL panel, file-watching with hot reload, and a conversation history browser. This turns the static editor from stage 2 into a live development environment where edits are immediately reflected in the running assistant.

### What to build

- **Live chat panel** — embedded chat connected to the chat service via websocket, scoped to the currently selected assistant. Supports streaming responses, tool activity display, and session continuity. Reuses existing web-chat patterns.
- **Live REPL panel** — a panel for sending one-off evaluation prompts to the assistant and seeing results, useful for testing tool configurations or system prompt changes without a full conversation
- **Hot reload via file watching** — watch assistant definition files on disk. When a file changes (from the editor UI or an external editor), automatically reload the assistant runtime and notify the UI. The chat service should pick up changes without requiring a manual reload click.
- **Conversation history browser** — list past conversation sessions for the selected assistant using the history endpoint. Allow loading a previous session to review what was said. Read-only is sufficient.
- **WebSocket notifications** — extend the chat service websocket to push events for assistant reloads, file changes, and session updates so the UI stays in sync

## References

- `features/chat-service.ts` — websocket sessions, assistant runtime, streaming
- `commands/web-chat.ts` — server composition and file watching setup
- `public/web-chat/index.html` — existing chat UI patterns
- Backend API and editor UI from stages 1 and 2
- [Implementation Guide](../../reports/rebuild-assistant-designer-implementation-guide.md)

## Test plan

- The chat panel connects to the selected assistant and streams responses in real time
- Editing an assistant's system prompt in the editor tab and saving causes the next chat message to reflect the updated prompt (hot reload works)
- Changing an assistant file from an external editor (e.g. vim) triggers an automatic reload and the UI shows a notification
- The REPL panel accepts a prompt, sends it to the assistant, and displays the response
- The history browser lists past sessions for the selected assistant
- Loading a past session displays the conversation messages in read-only mode
- Switching assistants in the selector updates the chat panel, REPL, and history browser to the new assistant
- The chat panel remains functional during and after hot reloads (no dropped connections)
