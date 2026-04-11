---
status: completed 
goal: user-experience-improvements
---


# Rebuild Assistant Designer

Rebuild the assistant designer as a disk-first editing experience with live hot-reloadable chat, REPL, and assistant gallery integration. The designer centers on assistants that live on disk in `assistants/` and provides a browser UI for configuring features, tools, hooks, interceptors, and custom tools — all backed by the existing chat service and web-chat infrastructure.

## Overview

The current assistant infrastructure already has the key seams: disk-based assistant folders, a websocket chat service, and a browser UI. This project layers a cohesive designer experience on top, delivered in three stages that each produce a usable, demoable artifact.

Stage 1 gives us a working backend API and a CLI-verifiable demo. Stage 2 gives us a functional browser-based editor. Stage 3 adds the live interactive experience with hot reload, chat, and history.

## Execution

- [Backend API and Assistant File Endpoints](../plans/rebuild-assistant-designer/backend-api.md)
- [Browser Editor UI](../plans/rebuild-assistant-designer/browser-editor-ui.md)
- [Live Chat, Hot Reload, and History](../plans/rebuild-assistant-designer/live-chat-and-hot-reload.md)
