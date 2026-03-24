---
status: pending
project: shared-workflow-service
---

# Phase 1: Service Skeleton + Static Serving

Build the foundational WorkflowService as `features/workflow-service.ts`. A single Express server that discovers all workflow directories, serves their `public/` folders as static routes, loads ContentDB once, and extracts shared CSS into a single file. No WebSocket, no hooks, no ChatService yet.

The demoable outcome: run `luca workflow-service` (or `luca serve` with a setup flag) and browse to `/workflows/capture/`, `/workflows/review/`, `/workflows/dashboard/` — all served from one port, one process.

## Deliverables

1. **`features/workflow-service.ts`** — the core feature
   - Discovers all `workflows/*/public/` directories
   - Parses `ABOUT.md` from each workflow for metadata
   - Mounts each as a static route at `/workflows/:name/`
   - Loads ContentDB once and attaches to `app.locals.docs`
   - Serves shared CSS at `/shared/base.css`

2. **`workflows/shared/base.css`** — extracted design tokens
   - Pull the common CSS custom properties, font stack, dark theme from existing workflow HTML files
   - Every workflow UI imports this instead of inlining its own copy

3. **`commands/workflow-service.ts`** — CLI command to start the service
   - Starts the WorkflowService on a configurable port (default 7700)
   - Binds to `0.0.0.0` for LAN access
   - Prints URLs for each discovered workflow
   - Supports `--port` and `--no-open` flags

4. **`GET /api/workflows`** — returns list of discovered workflows with metadata

5. **Landing page** at `/` — simple index page listing all available workflows with links

## References

- Idea: `docs/ideas/shared-workflow-service.md`
- Existing workflow `luca.serve.ts` files for patterns to consolidate
- Existing `workflows/*/public/index.html` for CSS extraction
- Luca feature scaffold: `luca scaffold feature workflow-service`

## Test plan

- Run `luca workflow-service --no-open` and confirm it starts on port 7700
- Browse to `/workflows/capture/` and confirm the capture UI loads
- Browse to `/workflows/dashboard/` and confirm the dashboard UI loads
- Browse to `/workflows/review/` and confirm the review UI loads
- Confirm `/shared/base.css` returns the design token stylesheet
- Confirm `/api/workflows` returns JSON with all discovered workflow metadata
- Confirm `/` shows the landing page with links to all workflows
- Confirm only one process is running (not 11 separate servers)
