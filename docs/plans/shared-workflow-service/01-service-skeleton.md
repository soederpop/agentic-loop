---
status: completed 
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

## Retrospective

### What was built

All five deliverables shipped. `features/workflow-service.ts` uses the framework's `container.server('express', {...})` abstraction to create the HTTP server and `container.feature('workflowLibrary')` for discovery — no external deps needed. `workflows/shared/base.css` consolidates all CSS custom properties, base reset, font stack, and shared keyframes extracted from the inline styles in every workflow HTML. `commands/workflow-service.ts` wires the feature to the CLI with `--port` and `--no-open` flags. All routes passed smoke tests: static serving, `/shared/base.css`, `/api/workflows`, and the landing page.

### Key discoveries

**The `*/` gotcha in JSDoc.** The initial build failed with 7 parse errors because the JSDoc comment contained `workflows/*/public/` — the `*/` sequence closed the multi-line comment block early. Watch for this any time glob patterns appear in JSDoc inside `/** ... */` blocks.

**Use `container.server('express')` not raw Express.** The framework's `ExpressServer` exposes `server.express` (the express module itself), `server.app` (the Express app), and `server.useEndpoints(dir)`. There is no need to import `express` directly. The `static {}` registration block on the Feature class and a `features.register()` call at the bottom are mutually exclusive — pick one (the bottom `features.register()` is the cleaner pattern).

**WorkflowLibrary picks up `workflows/shared/`.** The new `workflows/shared/` directory is discovered as a workflow entry (with `hasPublicDir: false`). This is harmless — it's filtered from static mounts and the landing page — but it will appear in `/api/workflows` until the library gains a way to mark directories as non-workflow. Phase 2 should either filter it out via a naming convention (e.g., lowercase non-directory names) or add an `ignore` list to WorkflowLibrary options.

**Per-workflow endpoints not mounted in Phase 1.** Multiple workflow `endpoints/` directories export conflicting paths (e.g., both `capture/endpoints/ideas.ts` and `review/endpoints/ideas.ts` export `path = '/api/ideas'`). Mounting them naively would be first-match-wins and silently break workflows. Deferring this to Phase 2, which will move all shared endpoints to a single canonical set at the service level.

**`--no-open` flag parsing edge case.** The luca CLI may treat `--no-<flag>` as a negation of `<flag>` rather than setting `no-<flag>` to true. In practice this meant the browser opened even when `--no-open` was passed. Phase 2 should use `--open` (defaulting to false) rather than `--no-open` to avoid the ambiguity.
