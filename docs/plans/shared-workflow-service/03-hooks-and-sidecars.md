---
status: completed 
project: shared-workflow-service
---

# Phase 3: Hooks and Sidecar Pattern

Define and implement the `hooks.ts` extension point so workflows that need custom server-side logic can register routes, WebSocket handlers, and spawn sidecar processes — all within the shared service. Migrate project-reviewer and project-builder as the proving grounds.

The demoable outcome: project-reviewer's custom `start_review` WS message works through the shared service, and project-builder can trigger builds via its custom API route with sidecar output streamed to the browser — both without their own servers.

## Deliverables

1. **`WorkflowHooks` TypeScript interface**:
   - `chat` config: `defaultAssistant`, `threadPrefix`, `historyMode`
   - `onSetup({ app, chatService, docs, container, broadcast })` — called at service boot
   - `onTeardown()` — cleanup hook
   - Custom routes namespaced to `/api/workflows/:name/`
   - Custom WS message type handlers

2. **`broadcast(workflowName, event)` utility**:
   - Sends events to all WebSocket clients subscribed to a specific workflow
   - Sidecar processes can bridge stdout events into the broadcast channel

3. **Sidecar lifecycle management**:
   - Hooks can spawn child processes via `container.feature('proc')`
   - Stdout JSON lines from sidecars are bridged to WS broadcast
   - Sidecars are cleaned up on service shutdown or `onTeardown`

4. **Migrate project-reviewer**:
   - Create `workflows/project-reviewer/hooks.ts` with custom WS handler for `start_review`
   - Remove its `luca.serve.ts` and `endpoints/`

5. **Migrate project-builder**:
   - Create `workflows/project-builder/hooks.ts` with custom route for `/api/workflows/project-builder/start-build`
   - Sidecar spawns the builder script, bridges events to WS broadcast
   - Remove its `luca.serve.ts` and `endpoints/`

## References

- `hooks.ts` examples from the idea document: `docs/ideas/shared-workflow-service.md`
- Project-builder's current `luca.serve.ts` for logic to migrate
- Project-reviewer's current endpoint logic
- Phase 2 deliverables: shared API, ChatService

## Handoff Notes from Phase 1

- `WorkflowService.start()` is the right place to load `hooks.ts` — call `container.paths.resolve(workflow.folderPath, 'hooks.ts')`, check if the file exists with `container.fs.existsSync`, and if so import it and call `hooks.onSetup({ app, chatService, docs, container })`.
- The express app is available as `this._expressServer.app` inside the feature. Custom hook routes should be namespaced to `/api/workflows/:name/` to avoid conflicts with shared endpoints.
- `workflows/shared/` is not a real workflow — filter it before iterating over library.workflows for hook loading.

## Test plan

- Start the service and confirm hooks from project-reviewer and project-builder are loaded
- Send a `start_review` WS message — confirm the reviewer workflow handles it correctly
- `POST /api/workflows/project-builder/start-build` — confirm it spawns a sidecar
- Confirm sidecar events appear on the WebSocket broadcast for subscribed clients
- Stop the service — confirm all sidecars are cleaned up (no orphan processes)
- Confirm project-reviewer and project-builder have no `luca.serve.ts` and still work fully
- A workflow without `hooks.ts` (e.g., capture) continues to work as pure static
