---
goal: user-experience-improvements
tags:
  - workflow
  - infrastructure
  - websocket
  - chat
  - streaming
  - architecture
status: promoted
---

# Shared Workflow Service

A single central WorkflowService process that serves all workflows through one Express + WebSocket hub. Workflows are static HTML directories served by the hub. When a workflow needs server-side logic beyond the shared APIs, its `hooks.ts` can spawn sidecar processes.

## The Problem

After analyzing all 11 workflows, the duplication is significant:

**Identical code copy-pasted across workflows:**
- ContentDB initialization (`feature('contentDb', { rootPath })` + `load()` + `app.locals.docs`) appears in 8 of 11 workflows
- `serializeProject()` and `serializePlan()` are duplicated between project-reviewer and project-builder
- `/api/goals`, `/api/projects`, `/api/project/:slug` endpoints are identical across 4+ workflows
- Slug-from-title generation + file-write + `docs.reload()` pattern appears in 4 endpoint files
- SSE boilerplate (`writeHead`, `send` closure, `return new Promise(() => {})`) copy-pasted across 3 endpoints
- The CSS design system (custom properties, font stack, dark theme) is redefined in every `index.html`
- The `server.start` monkey-patch to attach WebSocket via `(server as any)._listener` is the only lifecycle hook — and it's fragile

**No shared utility layer exists.** Every workflow is fully self-contained, which was fine for the first few but doesn't scale. And each workflow runs as its own process on its own port, meaning 11 workflows = 11 Express servers doing the same ContentDB load and endpoint registration.

## The Vision

One process. One port. All workflows.

The luca main process spawns a single **WorkflowService** that acts as the central hub. It boots once, loads ContentDB once, starts ChatService once, discovers assistants once. Workflows are just directories with a `public/` folder — the service serves them as static routes under `/workflows/:name/`. The shared API surface (`/api/goals`, `/api/projects`, etc.) is available to every workflow's frontend without per-workflow server setup.

### WorkflowService (the single process)

One Express server + one WebSocket server, started by `luca`:

- **Express** serves all workflow UIs as static directories (`/workflows/capture/`, `/workflows/review/`, etc.)
- **Shared API** endpoints are mounted once at the root (`/api/goals`, `/api/projects`, `/api/ideas`, `/api/status`)
- **ChatService** runs once, managing WebSocket sessions for any workflow that needs chat — the `threadPrefix` in the WS `init` message distinguishes which workflow a session belongs to
- **AssistantsManager** discovers all assistants once
- **WorkflowLibrary** discovers all workflow metadata once
- **ContentDB** loads once, shared across all API handlers
- **Shared CSS** served at `/shared/base.css` — the design tokens every workflow UI imports
- **Event bus** for cross-workflow communication and lifecycle events

### Workflows as Static Directories

A workflow's `public/` directory is just HTML/CSS/JS. The service mounts it at `/workflows/:name/`. The frontend connects to the same host for API calls and WebSocket — no port juggling, no CORS.

```
GET /workflows/capture/         → workflows/capture/public/index.html
GET /workflows/review/          → workflows/review/public/index.html
GET /workflows/project-builder/ → workflows/project-builder/public/index.html
GET /api/goals                  → shared endpoint, same server
WS  /ws                         → ChatService, same server
```

### hooks.ts and Sidecars

When a workflow needs server-side logic beyond what the shared APIs provide, `hooks.ts` is the extension point. It runs when the WorkflowService starts (or when a workflow is activated) and can:

- **Register custom API routes** on the shared Express app, namespaced under `/api/workflows/:name/`
- **Register custom WebSocket message types** with the ChatService
- **Spawn sidecar processes** for heavy or isolated work (build runners, REPL sandboxes, LLM proxy loops) that communicate back to the hub via IPC or local HTTP
- **Set up workflow-specific state** on `app.locals.workflows[name]`

```ts
// workflows/project-reviewer/hooks.ts
import type { WorkflowHooks } from '../../features/workflow-service'

export default {
  chat: {
    defaultAssistant: 'chiefOfStaff',
    threadPrefix: 'project-reviewer',
    historyMode: 'session',
  },

  // Called when the service starts — register custom behavior
  onSetup({ app, chatService, docs, container }) {
    // Custom WS message type for this workflow
    chatService.onMessage(async (parsed, ctx) => {
      if (parsed.type === 'start_review') {
        const project = docs.query(docs.models.Project).where({ slug: parsed.slug }).first()
        // ... build briefing, inject as first assistant message
        return true
      }
      return false
    })
  },

  onTeardown() {
    // cleanup sidecars, timers, etc.
  },
} satisfies WorkflowHooks
```

```ts
// workflows/project-builder/hooks.ts — example with a sidecar
export default {
  chat: {
    defaultAssistant: 'chiefOfStaff',
    threadPrefix: 'project-builder',
    historyMode: 'session',
  },

  onSetup({ app, chatService, container, broadcast }) {
    // Custom API route namespaced to this workflow
    app.post('/api/workflows/project-builder/start-build', async (req, res) => {
      const { slug } = req.body
      // Spawn a sidecar process for the actual build
      const proc = container.feature('proc')
      const child = proc.spawn('luca', ['run', 'workflows/project-builder/builder.ts', slug])

      // Bridge sidecar events to the WebSocket broadcast channel
      child.stdout.on('data', (chunk) => {
        const event = JSON.parse(chunk.toString())
        broadcast('project-builder', event) // sends to all WS clients subscribed to this workflow
      })

      res.json({ started: true, slug })
    })

    chatService.onMessage(async (parsed, ctx) => {
      if (parsed.type === 'start_build') {
        // ... handle custom message
        return true
      }
      return false
    })
  },
} satisfies WorkflowHooks
```

Simple workflows don't need `hooks.ts` at all — they're just a `public/` directory that calls the shared API.

## What a Workflow Folder Looks Like

```
workflows/capture/
  ├── ABOUT.md           # metadata (title, description, tags)
  ├── public/
  │   └── index.html     # the UI — imports /shared/base.css, calls /api/*
  └── hooks.ts           # optional — custom routes, WS handlers, sidecars

workflows/project-builder/
  ├── ABOUT.md
  ├── public/
  │   └── index.html
  ├── hooks.ts           # spawns builder sidecar, registers custom WS messages
  └── builder.ts         # sidecar script — run by hooks.ts, not by the service directly
```

No `luca.serve.ts`. No `endpoints/` directory (custom routes go in `hooks.ts` or sidecar processes). No per-workflow ContentDB init. No per-workflow port.

## Architecture

```
luca (main process)
  │
  └── WorkflowService.start()  ← one process, one port
        │
        ├── ContentDB.load()
        ├── AssistantsManager.discover()
        ├── WorkflowLibrary.discover()
        ├── ChatService (WebSocket on /ws)
        │
        ├── Express
        │     ├── /shared/base.css           ← design tokens
        │     ├── /api/goals                 ← shared endpoints
        │     ├── /api/projects
        │     ├── /api/ideas
        │     ├── /api/status
        │     ├── /api/assistants
        │     ├── /api/workflows/:name/*     ← per-workflow custom routes (from hooks.ts)
        │     │
        │     ├── /workflows/capture/        ← static: workflows/capture/public/
        │     ├── /workflows/review/         ← static: workflows/review/public/
        │     ├── /workflows/project-builder/← static: workflows/project-builder/public/
        │     └── ...                        ← every discovered workflow with a public/ dir
        │
        └── Per-workflow hooks (loaded from hooks.ts)
              │
              ├── capture: (no hooks — pure static)
              ├── review: (no hooks — pure static)
              ├── project-reviewer: registers custom WS message type
              ├── project-builder: registers custom routes + spawns builder sidecar
              ├── assistant-designer: spawns LLM proxy sidecar for tool loops
              └── prompt-studio: spawns luca subprocess for prompt execution
```

## Shared API Surface

These endpoints are mounted once and serve all workflows:

| Endpoint | Description |
|---|---|
| `GET /api/goals` | All goals with horizon, aligned idea counts |
| `GET /api/ideas` | All ideas with meta, filterable by status/goal/tag |
| `GET /api/projects` | All projects with their plans |
| `GET /api/project/:slug` | Single project with full plan details |
| `GET /api/status` | Combined dashboard payload (goals, ideas by status, projects, recent activity) |
| `GET /api/assistants` | Available assistants from AssistantsManager |
| `GET /api/workflows` | Discovered workflows with metadata from ABOUT.md |
| `POST /api/docs/create` | Generic doc creation (slug generation, frontmatter, write, reload) |
| `GET /shared/base.css` | Design system tokens |

Workflow-specific routes are namespaced: `POST /api/workflows/project-builder/start-build`

## Shared Utilities

Available to `hooks.ts` via the setup context:

- `serializeProject(project)` / `serializePlan(plan)` / `serializeIdea(idea)` — consistent doc serialization
- `createDoc({ model, title, meta, body })` — slug generation + frontmatter write + ContentDB reload
- `broadcast(workflowName, event)` — send an event to all WebSocket clients subscribed to a workflow
- `streamSSE(res, asyncFn)` — SSE helper that handles writeHead, send closure, and cleanup
- `createREPLContext(extras)` — VM context with standard globals + container, for eval-capable workflows

## Delivery Roadmap

### Phase 1: WorkflowService Skeleton
Build the feature as `features/workflow-service.ts`. Single Express server, loads ContentDB, mounts shared API endpoints, serves workflow `public/` directories as static routes. No WebSocket yet. Migrate `capture` and `review` first — they're pure static + shared API, no hooks needed. Launch with `luca workflow-service` or integrate into `luca serve`.

### Phase 2: ChatService Integration
Wire up the ChatService on the same HTTP server. Define the `hooks.ts` interface. Migrate `project-reviewer` — it needs `hooks.ts` for its custom `start_review` message type but everything else is shared.

### Phase 3: Sidecar Pattern
Build the sidecar spawn + broadcast bridge. Migrate `project-builder` — it needs a sidecar for build execution and a broadcast channel for build events. Then `prompt-studio` (sidecar for `luca run`) and `assistant-designer` (sidecar for LLM proxy loop).

### Phase 4: Retire Per-Workflow Servers
Remove all `luca.serve.ts` files and `endpoints/` directories from workflows. Update `luca workflow run` to point at the central service instead of spawning individual servers. At this point the service is the single entry point for all workflow UIs.

## Open Questions

- Should the service auto-start all workflow hooks, or lazy-load them when a client first hits `/workflows/:name/`? Lazy loading keeps startup fast but adds first-request latency.
- How should the sidecar lifecycle be managed? Kill on workflow navigation away? Keep alive for the session? Manual cleanup in `onTeardown`?
- Should there be a workflow-level pub/sub where workflows can listen to each other's events? (e.g., project-builder emits `build_complete`, project-reviewer auto-refreshes)
- The presenter feature currently opens individual workflow URLs at different ports. Needs to be updated to use `/workflows/:name/` paths on the single port.

## Problem

It takes too long to build workflows, if we confine it to the frontend for the simpler ones it will become a lot faster.

## Scope

It needs to work and all existing workflows need to be adjusted to use it.

## Dependencies

I should be able to run it standalone outside of the luca main process, especially for testing.

## Success Criteria

Success will be when these workflow implementations are much smaller
