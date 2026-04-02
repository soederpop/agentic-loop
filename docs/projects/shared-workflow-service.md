---
title: Shared Workflow Service
status: draft
goal: user-experience-improvements
---

# Shared Workflow Service

Consolidate all 11 workflow servers into a single Express + WebSocket process that serves every workflow UI as a static directory, shares one ContentDB instance, one ChatService, and one set of API endpoints. Workflows that need custom server-side logic use a `hooks.ts` extension point instead of their own server.

This eliminates massive duplication (ContentDB init in 8/11 workflows, identical API endpoints across 4+, copy-pasted CSS design tokens in every `index.html`) and makes building new workflows dramatically faster — a new workflow is just a `public/` folder that calls the shared API.

## Overview

The WorkflowService is a single luca feature (`features/workflow-service.ts`) that boots one Express server, loads ContentDB once, discovers all workflows, mounts their `public/` directories as static routes under `/workflows/:name/`, and exposes a shared API surface. Workflows that need WebSocket handlers or custom routes declare them in `hooks.ts`. Heavy work (build runners, LLM proxy loops) runs in sidecar processes spawned by hooks.

Key architectural decisions:
- **One process, one port** — no more 11 servers on 11 ports
- **Static-first** — most workflows are just HTML/CSS/JS calling shared endpoints
- **hooks.ts for extensions** — custom routes namespaced to `/api/workflows/:name/`, custom WS message types, sidecar lifecycle
- **Shared CSS design tokens** — served at `/shared/base.css`, imported by all workflow UIs

## Execution

- [Phase 1: Service Skeleton + Static Serving](../plans/shared-workflow-service/01-service-skeleton.md)
- [Phase 2: Shared API + ChatService Integration](../plans/shared-workflow-service/02-shared-api-and-chat.md)
- [Phase 3: Hooks and Sidecar Pattern](../plans/shared-workflow-service/03-hooks-and-sidecars.md)
- [Phase 4: Full Migration + Retire Per-Workflow Servers](../plans/shared-workflow-service/04-full-migration.md)
