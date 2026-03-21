---
status: draft
goal: user-experience-improvements
---

# Web Chat for Chief (LAN Streaming)

## Overview

Build a simple, LAN-accessible web chat UI for talking to **Chief** (this assistant) with **streaming text responses**.

This is primarily a UX/progressive-enhancement on-ramp: users who haven’t set up the full local voice stack (wake word, whisper mlx, ElevenLabs) can still interact with the system in a modern, low-friction way.

**Non-goal (explicit):** rich “presentations” inside the chat UI. For rich HTML views, the system should continue to use the existing **Presenter** feature/tool.

### Target user experience

- Run a single command (name TBD, e.g. `luca web-chat`)
- It starts a local server bound to LAN (not only localhost)
- It prints the URL(s) and optionally opens the browser
- A clean chat page loads
- User types messages, Chief responds with **streaming text**

## Execution

### [Phase 1 (MVP): LAN streaming text chat](../plans/web-chat-for-chief/01-mvp-lan-streaming-chat.md)

**Requirements**
- LAN-accessible server bind (e.g. `0.0.0.0`) with a clearly printed URL.
- Web UI:
  - message list
  - text input + send
  - streaming assistant output (incremental chunks)
  - basic markdown rendering (nice-to-have; can be plain text if needed for first pass)
- Server:
  - WebSocket (or SSE) transport for streaming
  - bridges messages into the existing conversation/assistant stack
  - targets the **Chief** assistant by default
- Progressive enhancement:
  - must work with **text-only** and no audio setup

**Success criteria (observable)**
- From another device on the same network, loading `http://<host>:<port>/...` works.
- Sending a message yields a response that streams token-by-token / chunk-by-chunk.
- No attempt is made to “present” rich cards inside the chat UI; the Presenter tool remains the mechanism for that.

### [Phase 2: basic session ergonomics](../plans/web-chat-for-chief/02-persistence-and-assistant-picker.md)
- Conversation/session persistence (reconnect keeps thread)
- Assistant picker (optional; default remains Chief)
- Minimal visibility into tool usage (only if it’s essentially free; otherwise defer)

### [Phase 3+: voice (optional)](../plans/web-chat-for-chief/03-tool-activity-ui.md)
The original idea includes browser voice in/out, but this project’s approved MVP is text streaming only. Voice can be a later plan if desired.

## Notes / alignment

- Aligned to goal: **User Experience Improvements** (delightful, unsurprising, progressive enhancement).
- This project intentionally avoids inventing a second “presenter” system in the chat UI.

