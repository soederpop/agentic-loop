---
status: pending
project: shared-workflow-service
---

# Phase 2: Shared API + ChatService Integration

Mount the shared API endpoints that are currently duplicated across 4+ workflows, and wire up the ChatService WebSocket on the same server. This gives every workflow frontend access to ContentDB data and streaming chat without any per-workflow server code.

The demoable outcome: the capture and review workflows work fully — browsing content, creating docs, and chatting with assistants — all through the shared service with zero workflow-specific server code.

## Deliverables

1. **Shared API endpoints** mounted once on the service:
   - `GET /api/goals` — all goals with horizon, aligned counts
   - `GET /api/ideas` — all ideas, filterable by status/goal/tag
   - `GET /api/projects` — all projects with their plans
   - `GET /api/project/:slug` — single project with full plan details
   - `GET /api/status` — combined dashboard payload
   - `GET /api/assistants` — available assistants
   - `POST /api/docs/create` — generic doc creation (slug generation, frontmatter, write, reload)

2. **Shared utility functions** available to hooks and endpoints:
   - `serializeProject(project)` / `serializePlan(plan)` / `serializeIdea(idea)`
   - `createDoc({ model, title, meta, body })`
   - `streamSSE(res, asyncFn)` — SSE boilerplate helper

3. **ChatService on WebSocket** at `/ws`:
   - Reuse existing ChatService patterns from the codebase
   - `threadPrefix` in WS `init` message distinguishes workflows
   - AssistantsManager discovers all assistants once at boot

4. **Migrate capture + review workflows** to use shared API:
   - Update their `public/index.html` to call `/api/*` instead of local endpoints
   - Verify they work without any `luca.serve.ts` or `endpoints/` directory

## References

- Existing shared endpoints across workflows (grep for `/api/goals`, `/api/projects`)
- `serializeProject` / `serializePlan` patterns in `workflows/project-builder/`
- ChatService / WebSocket patterns in existing `luca.serve.ts` files
- Phase 1 deliverables: `features/workflow-service.ts`, `commands/workflow-service.ts`

## Test plan

- Start the service and confirm all shared API endpoints return correct data
- `GET /api/goals` returns goals matching what `cnotes export` shows
- `GET /api/projects` includes plan details
- `POST /api/docs/create` creates a document and it appears in subsequent queries
- Open the capture workflow at `/workflows/capture/` and create a new idea — confirm it persists
- Open the review workflow at `/workflows/review/` and browse projects — confirm data loads
- Connect to `/ws` via WebSocket, send an `init` + `user_message`, confirm streaming response
- Confirm capture and review workflows have no `luca.serve.ts` or `endpoints/` directory and still work fully
