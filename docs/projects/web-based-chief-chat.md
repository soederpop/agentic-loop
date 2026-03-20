---
status: draft
goal: ''
---

# Web-Based Chief Chat

## Overview

Build a browser-based chat interface for the Chief of Staff assistant. The skateboard milestone delivers a fully functional single-page chat UI at `/chief-chat` that communicates over WebSocket with the existing luca server, streams assistant responses with tool call visibility, and persists conversation threads across page reloads. No build step, no new dependencies — just a self-contained HTML page and a thin server-side message router.

This project promotes the idea [web-based-assistant-chat-application](../ideas/web-based-assistant-chat-application.md) into an executable plan.

## Execution

- [Server-Side WebSocket Chat Handler](../plans/ws-chat-handler)
- [Browser Chat UI Page](../plans/browser-chat-ui)
