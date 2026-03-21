---
plan: plans/web-chat-for-chief/03-tool-activity-ui
project: web-chat-for-chief
costUsd: 1.4495577000000002
turns: 27
toolCalls: 43
completedAt: "2026-03-21T03:41:26.352Z"
---

# Plan: Tool Activity UI (Must-have) — Build Report

## Summary

| Metric | Value |
|--------|-------|
| Cost | $1.4496 |
| Turns | 27 |
| Tool Calls | 43 |
| Completed | 2026-03-21T03:41:26.352Z |

## Execution Log

I'll start by exploring the current web chat implementation to understand the architecture.

### `Agent`

```
{
  "subagent_type": "feature-dev:code-explorer",
  "description": "Explore web chat architecture",
  "prompt": "I need to understand the web chat architecture for implementing a Tool Activity UI. Explore:\n\n1. The web chat server - look in `endpoints/` for websocket/chat related files\n2. The web 
... (truncated, 911 chars total)
```

### `Glob`

```
pattern: endpoints/**/*
path: /Users/jonathansoeder/@agentic-loop
```

### `Glob`

```
pattern: features/**/*
path: /Users/jonathansoeder/@agentic-loop
```

### `Glob`

```
pattern: **/*.html
path: /Users/jonathansoeder/@agentic-loop
```

### `Glob`

```
pattern: public/**/*
path: /Users/jonathansoeder/@agentic-loop
```

### `Glob`

```
pattern: commands/**/*
path: /Users/jonathansoeder/@agentic-loop
```

### `Read`

```
file_path: /Users/jonathansoeder/@agentic-loop/commands/web-chat.ts
```

### `Read`

```
file_path: /Users/jonathansoeder/@agentic-loop/public/web-chat/index.html
```

### `Glob`

```
pattern: **/*.ts
path: /Users/jonathansoeder/@agentic-loop/node_modules/@soederpop/luca/src
```

### `Glob`

```
pattern: node_modules/@soederpop/luca/**/*.ts
path: /Users/jonathansoeder/@agentic-loop
```

### `Read`

```
file_path: /Users/jonathansoeder/@agentic-loop/node_modules/@soederpop/luca/src/agi/features/assistant.ts
```

### `Read`

```
file_path: /Users/jonathansoeder/@agentic-loop/node_modules/@soederpop/luca/src/agi/features/conversation.ts
```

### `Glob`

```
pattern: assistants/**/*
path: /Users/jonathansoeder/@agentic-loop
```

### `Glob`

```
pattern: node_modules/@soederpop/luca/assistants/**/*
path: /Users/jonathansoeder/@agentic-loop
```

### `Read`

```
file_path: /Users/jonathansoeder/@agentic-loop/assistants/chiefOfStaff/tools.ts
```

### `Read`

```
file_path: /Users/jonathansoeder/@agentic-loop/assistants/chiefOfStaff/hooks.ts
```

### `Read`

```
file_path: /Users/jonathansoeder/@agentic-loop/node_modules/@soederpop/luca/src/agi/features/assistants-manager.ts
```

### `Read`

```
file_path: /Users/jonathansoeder/@agentic-loop/docs/plans/web-chat-for-chief/02-persistence-and-assistant-picker.md
```

Excellent. Now let me read the two key files I need to modify.

### `Read`

```
file_path: /Users/jonathansoeder/@agentic-loop/commands/web-chat.ts
```

### `Read`

```
file_path: /Users/jonathansoeder/@agentic-loop/public/web-chat/index.html
```

Now I have a clear picture. Let me implement both the server-side event forwarding and the client-side tool activity UI.

**Server changes**: Subscribe to `toolCall`, `toolResult`, `toolError` events and forward them over WebSocket.

**Client changes**: Handle the new message types with a collapsible tool activity display.

### `Edit`

```
file_path: /Users/jonathansoeder/@agentic-loop/commands/web-chat.ts
old_string: 			isProcessing = true
			const messageId = crypto.randomUUID()

			send(ws, { type: 'assistant_message_start', messageI
... (truncated, 606 chars total)
new_string: 			isProcessing = true
			const messageId = crypto.randomUUID()

			send(ws, { type: 'assistant_message_start', messageI
... (truncated, 2144 chars total)
```

Let me check the exact indentation.

### `Read`

```
file_path: /Users/jonathansoeder/@agentic-loop/commands/web-chat.ts
offset: 155
limit: 25
```

### `Bash`

```
command: cat -A /Users/jonathansoeder/@agentic-loop/commands/web-chat.ts | head -5
```

### `Bash`

```
command: cat -e /Users/jonathansoeder/@agentic-loop/commands/web-chat.ts | sed -n '158,176p'
```

Tabs. Let me use the exact content:

### `Edit`

```
file_path: /Users/jonathansoeder/@agentic-loop/commands/web-chat.ts
old_string: 			isProcessing = true
			const messageId = crypto.randomUUID()

			send(ws, { type: 'assistant_message_start', messageI
... (truncated, 606 chars total)
new_string: 			isProcessing = true
			const messageId = crypto.randomUUID()

			send(ws, { type: 'assistant_message_start', messageI
... (truncated, 2144 chars total)
```

The tabs are likely literal tab characters. Let me write the whole file instead.

### `Read`

```
file_path: /Users/jonathansoeder/@agentic-loop/commands/web-chat.ts
```

### `Write`

```
file_path: /Users/jonathansoeder/@agentic-loop/commands/web-chat.ts
content: (7955 chars)
```

Now let me update the client HTML with the tool activity UI.

### `Write`

```
file_path: /Users/jonathansoeder/@agentic-loop/public/web-chat/index.html
content: (17486 chars)
```

Now let me verify the server code compiles and read the plan document to add the retrospective.

### `Bash`

```
command: bun build --no-bundle commands/web-chat.ts --outdir /dev/null 2>&1 | head -20
```

### `Read`

```
file_path: /Users/jonathansoeder/@agentic-loop/docs/plans/web-chat-for-chief/03-tool-activity-ui.md
```

### `Glob`

```
pattern: docs/plans/web-chat-for-chief/0*.md
```

Good — only 3 plans (01, 02, 03), so no later plans to update with handoff notes. Let me check the build a different way and check for any remaining plans beyond 03.

### `Bash`

```
command: bun build --no-bundle commands/web-chat.ts --outdir /tmp/build-check 2>&1 | head -20
```

### `Glob`

```
pattern: docs/plans/web-chat-for-chief/04*.md
```

Transpiles fine. No plan 04 exists — nothing else to update. Now let me add the retrospective to the plan document, update the plan status, and validate/commit.

### `Edit`

```
file_path: /Users/jonathansoeder/@agentic-loop/docs/plans/web-chat-for-chief/03-tool-activity-ui.md
old_string: status: approved
new_string: status: completed
```

### `Read`

```
file_path: /Users/jonathansoeder/@agentic-loop/docs/plans/web-chat-for-chief/03-tool-activity-ui.md
offset: 75
```

### `Edit`

```
file_path: /Users/jonathansoeder/@agentic-loop/docs/plans/web-chat-for-chief/03-tool-activity-ui.md
old_string: - **`isProcessing` flag** is per-WS-connection, scoped inside the `wss.on('connection')` handler. Tool events fire durin
... (truncated, 186 chars total)
new_string: - **`isProcessing` flag** is per-WS-connection, scoped inside the `wss.on('connection')` handler. Tool events fire durin
... (truncated, 1522 chars total)
```

Now let me validate the docs and regenerate the summary.

### `Bash`

```
command: cnotes validate --setDefaultMeta 2>&1
```

That's a pre-existing validation error (not from my changes). Let me generate the summary.

### `Bash`

```
command: cnotes summary 2>&1
```

Now let me commit.

### `Bash`

```
command: git -C /Users/jonathansoeder/@agentic-loop status -u
```

### `Bash`

```
command: git -C /Users/jonathansoeder/@agentic-loop diff --stat
```

### `Bash`

```
command: git -C /Users/jonathansoeder/@agentic-loop log --oneline -5
```

There are other modified files beyond my changes (commands/project-builder.ts, features/project-builder.ts, features/voice-router.ts, docs/models.ts, docs/plans/.../02-persistence-and-assistant-picker.md, and the untracked project-builds). I should only commit my work. Let me check which files are mine.

### `Bash`

```
command: git -C /Users/jonathansoeder/@agentic-loop add commands/web-chat.ts public/web-chat/index.html docs/plans/web-chat-for-chief/03-tool-activity-ui.md docs/README.md docs/TABLE-OF-CONTENTS.md
```

### `Bash`

```
command: git commit -m "$(cat <<'EOF'
Add tool activity UI to web chat — show tool lifecycle in real time

Server subscribes to toolCall/toolResult/toolError events on the assistant
and forwards them as tool_s
... (truncated, 482 chars total)
```

Done. Here's what was implemented:

**Server (`commands/web-chat.ts`)**:
- Added `toolCall`, `toolResult`, and `toolError` event listeners alongside the existing `chunk` listener
- Forwards `tool_start` and `tool_end` messages over WebSocket with name, status, duration, and truncated summaries
- Listeners scoped per-turn and cleaned up in the `finally` block

**Client (`public/web-chat/index.html`)**:
- Collapsible "Tools" panel appears above the streaming message when tools are used
- Each tool shows: status icon (blinking amber = running, green = success, red = error), name, and duration
- Error messages shown inline; small summaries expandable on click
- Panel auto-expands during streaming, collapsible by clicking the header

**Protocol additions**:
- `tool_start`: `{ id, name, startedAt }`
- `tool_end`: `{ id, name, ok, endedAt, durationMs, summary?, error? }`

To verify: run `luca web-chat`, ask Chief something that triggers tools, and watch the tool panel appear with live status updates.

## Result

Done. Here's what was implemented:

**Server (`commands/web-chat.ts`)**:
- Added `toolCall`, `toolResult`, and `toolError` event listeners alongside the existing `chunk` listener
- Forwards `tool_start` and `tool_end` messages over WebSocket with name, status, duration, and truncated summaries
- Listeners scoped per-turn and cleaned up in the `finally` block

**Client (`public/web-chat/index.html`)**:
- Collapsible "Tools" panel appears above the streaming message when tools are used
- Each tool shows: status icon (blinking amber = running, green = success, red = error), name, and duration
- Error messages shown inline; small summaries expandable on click
- Panel auto-expands during streaming, collapsible by clicking the header

**Protocol additions**:
- `tool_start`: `{ id, name, startedAt }`
- `tool_end`: `{ id, name, ok, endedAt, durationMs, summary?, error? }`

To verify: run `luca web-chat`, ask Chief something that triggers tools, and watch the tool panel appear with live status updates.
