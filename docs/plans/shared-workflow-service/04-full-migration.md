---
status: completed 
project: shared-workflow-service
---

# Phase 4: Full Migration + Retire Per-Workflow Servers

Migrate all remaining workflows to the shared service and remove every `luca.serve.ts` and `endpoints/` directory. Update `luca workflow <name>` to point at the central service. The WorkflowService becomes the single entry point for all workflow UIs.

The demoable outcome: `luca workflow-service` starts one process, and every workflow in the system is accessible at `/workflows/:name/` — no per-workflow servers exist anymore. The `luca workflow <name>` command opens the correct URL on the shared service.

## Deliverables

1. **Migrate remaining workflows**:
   - `assistant-designer` — hooks.ts for LLM proxy sidecar
   - `prompt-studio` — hooks.ts for `luca run` subprocess sidecar
   - `voice-designer` — hooks.ts if needed, or pure static
   - `blank-slate`, `ideas`, `shape`, `dashboard`, `setup` — likely pure static, just update API URLs

2. **Remove all per-workflow server infrastructure**:
   - Delete every `workflows/*/luca.serve.ts`
   - Delete every `workflows/*/endpoints/` directory
   - Verify no workflow imports or references these files

3. **Update `luca workflow <name>` command**:
   - Instead of spawning a per-workflow server, ensure the shared service is running
   - Open `http://localhost:<port>/workflows/<name>/` in the browser
   - If the service isn't running, start it first

4. **Update the presenter feature**:
   - Currently opens individual workflow URLs at different ports
   - Update to use `/workflows/:name/` paths on the single port

5. **Shared CSS adoption**:
   - Update all remaining workflow `index.html` files to import `/shared/base.css`
   - Remove inlined design token CSS from each file

## References

- All `workflows/*/luca.serve.ts` files — logic to extract into hooks or remove
- All `workflows/*/endpoints/` directories — logic to move to hooks or shared API
- Presenter feature for URL routing updates
- `luca workflow` command implementation
- Phases 1-3 deliverables

## Handoff Notes from Phase 1

- All 12 workflow `public/` dirs are already statically served at `/workflows/:name/` on port 7700. Phase 4 just needs to remove the per-workflow server infrastructure and update frontend fetch paths.
- `workflows/shared/base.css` is live at `/shared/base.css`. The shared CSS adoption task in this phase means adding `<link rel="stylesheet" href="/shared/base.css">` and removing each workflow's `<style>` `:root { ... }` block.
- When updating `luca workflow <name>`, the command should check if the service is already listening (feature state `workflowService.isListening`) and either open the URL or start the service first. The feature's `start()` method is idempotent if guarded.
- The `workflows/shared/` directory appears in WorkflowLibrary's discovery — it is NOT a real workflow. The final count of real workflow dirs is 12, not 13.

## Test plan

- Start `luca workflow-service --no-open` — confirm all 11 workflows are discovered and mounted
- Browse to each workflow URL and confirm it loads and functions correctly:
  - `/workflows/capture/`
  - `/workflows/review/`
  - `/workflows/dashboard/`
  - `/workflows/ideas/`
  - `/workflows/shape/`
  - `/workflows/blank-slate/`
  - `/workflows/setup/`
  - `/workflows/project-builder/`
  - `/workflows/assistant-designer/`
  - `/workflows/prompt-studio/`
  - `/workflows/voice-designer/`
- Confirm no `luca.serve.ts` files exist in any workflow directory
- Confirm no `endpoints/` directories exist in any workflow directory
- Run `luca workflow capture` — confirm it opens the correct URL on the shared service
- Confirm the presenter opens workflows at the shared service URL
- Confirm only one server process is running regardless of how many workflows are active
