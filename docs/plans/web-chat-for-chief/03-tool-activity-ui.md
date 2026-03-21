---
status: approved
project: web-chat-for-chief
costUsd: 0
tools: 0
toolCalls: 0
turns: 0
---

# Plan: Tool Activity UI (Must-have)

## References

- Project: `docs/projects/web-chat-for-chief.md`
- Plan 01: `plans/web-chat-for-chief/01-mvp-lan-streaming-chat.md`
- Plan 02: `plans/web-chat-for-chief/02-persistence-and-assistant-picker.md`

## Scope

Expose tool usage in the web chat UI so users can see what Chief is doing.

## Deliverables

1) Server emits tool lifecycle events
- When a tool starts: name + call id + timestamp.
- When it ends: status + duration + (optional) short summary.
- On error: error message.

2) Client displays tool activity
- A collapsible “Tool Activity” panel.
- Shows a chronological list:
  - tool name
  - running/completed state
  - duration
  - success/error

3) Keep payloads small
- Do **not** stream huge tool results by default.
- Allow optional “details” expansion if the payload is already small.

## Protocol additions

Server → Client:
- `tool_start`: `{ id: string; name: string; startedAt: number }`
- `tool_end`: `{ id: string; name: string; ok: boolean; endedAt: number; durationMs: number; summary?: string; error?: string }`

## Implementation Notes

- Hook into whatever event emitter / callbacks the conversation/assistant system already exposes for tool calling.
- If no clean hook exists, implement a lightweight wrapper around the tool executor used by the assistant.

## Verification

- Ask Chief a question that triggers at least one tool.
- Confirm UI shows tool start immediately, then end with duration.
- Confirm multiple tools in a single assistant response are displayed in order.

## Handoff from Plan 01

Key implementation details relevant to tool activity:

- **Assistant events already exist**: The assistant emits `toolCall(name, args)`, `toolResult(name, result)`, and `toolError(name, error)` events. See `features/voice-chat.ts` lines 159–175 for the pattern — you can wire up the same listeners in `commands/web-chat.ts` inside the WS connection handler, right next to the `chunk` listener.
- **Per-turn listener pattern**: The MVP uses `assistant.on('chunk', onChunk)` / `assistant.off('chunk', onChunk)` scoped to each user message turn. Tool events should follow the same pattern to avoid leaking listeners across turns.
- **UI complexity**: The single-file HTML is already ~200 lines. Adding a collapsible tool panel will push it further. Consider extracting JS and CSS into separate files at this stage if it gets unwieldy.
- **WS send helper**: There's a `send(ws, data)` function that checks `readyState` before writing. Use it for tool events too.

