---
title: Dashboard
description: Live system dashboard for the luca main authority process
tags: [system, dashboard, monitoring]
---

# Dashboard

Web-based dashboard that connects to the running `luca main` authority via WebSocket and displays live system state — subsystem indicators, git status, task progress, content model counts, event log, and streaming logs.

## When to use

- You want a visual overview of the running agentic loop
- You want to monitor task execution, events, and logs in a browser
- You want to share the dashboard view (e.g. on a second screen or via the presenter)

## When NOT to use

- The authority isn't running — start it first with `luca main`
- You want to interact with the system (use `luca main --console` instead)
