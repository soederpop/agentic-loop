# Workflow Design Specs

What is a workflow?

A Workflow is each of the things that live in the [Workflows Folder at the Project Root](../../workflows).

It is a server / UI combination whose purpose is to provide targeted UIs for manipulating our project docs and controlling the agentic loop.

## How Workflows Are Served

All workflows are served by the **WorkflowService** feature (`features/workflow-service.ts`) — a single Express + WebSocket server (default port 7700) that:

- Discovers all workflow folders and serves each `public/` dir at `/workflows/<name>/`
- Loads ContentDB once and shares it across all workflows via shared API endpoints
- Loads each workflow's `hooks.ts` (if present) to register custom per-workflow routes
- Attaches a ChatService WebSocket at `/ws` for real-time communication

You can see all available workflows at `http://localhost:7700/api/workflows`.

## Workflow Folder Structure

```
workflows/<name>/
  hooks.ts          ← optional: custom API routes via onSetup()
  ABOUT.md          ← required: purpose, triggers, when NOT to use
  public/
    index.html      ← the UI (single self-contained HTML file)
```

## Workflow Library Feature

The [Workflow Library](../../features/workflow-library.ts) is a feature that can be passed to `assistant.use()`.

This feature discovers all the workflows and provides an interface for learning about them.

## Workflow ABOUT.md Files

Every workflow should have an `ABOUT.md` file that describes the workflow, when it is appropriate to use, and what a user might say to warrant triggering that workflow.

## Workflow Backend Pattern

- Workflows that need custom routes use a `hooks.ts` file exporting `onSetup(ctx)` — see [Creating Assistant Workflows](./creating-assistant-workflows.md) for the full pattern
- The `onSetup` context provides: `app` (express), `chatService`, `docs` (ContentDB), `container`, `broadcast`, `wss`
- Custom routes should be namespaced: `/api/workflows/<name>/...`
- Workflows that only need the shared API (goals, ideas, projects, status) need no hooks file at all

## Workflow Frontend Pattern

- Workflows should be single page static HTML files
- Workflows load the `@soederpop/luca` browser container from esm.sh and build UI logic as composable Features
- The standard pattern is three layers: **ApiClient** (fetch wrapper) → **Store** (data + state) → **App** (orchestrator)
- Features use reactive state and event buses — DOM is updated via event subscriptions, not direct manipulation from handlers
- Expose `window.app` and `window.luca` for devtools inspection
- Use shared CSS design tokens (link `/shared/base.css` or inline the `:root` variables)
- New workflows should prefer linking `/shared/base.css` over inlining tokens

See [Creating Assistant Workflows](./creating-assistant-workflows.md) for the full guide with code examples.
