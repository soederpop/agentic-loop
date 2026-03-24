---
status: completed
project: playbook-designer
costUsd: 1.4800716499999997
turns: 38
toolCalls: 77
completedAt: '2026-03-24T09:35:28.664Z'
---


# Phase 1: Read-Only Timeline

Build the workflow skeleton and a single-page timeline UI that shows all plays grouped by schedule frequency. This is the "skateboard" — immediately useful for understanding what the agentic loop is doing without editing any files.

The demoable outcome: run the workflow server and see every play as a card with its schedule, agent, last run time, duration, token usage, running status, and estimated next run. Plays grouped under schedule headers (every-ten-minutes, hourly, daily, etc.).

## Deliverables

1. **`workflows/playbook-designer/ABOUT.md`** — workflow metadata and description
2. **`workflows/playbook-designer/public/index.html`** — single-page app with the timeline UI
   - Fetches play data from the API on load
   - Groups plays by schedule frequency
   - Each play rendered as a card showing: title, agent, schedule, lastRanAt (relative time), duration, outputTokens, running status
   - Status indicators: running (blue), recently ran (green), skipped (yellow), errored (red), never run (gray)
   - Calculates and displays estimated next run based on schedule interval and lastRanAt
   - Auto-refreshes every 30 seconds
3. **API endpoint: `GET /api/plays`** — returns all play documents with full metadata
   - Uses ContentDB to query all Play model documents
   - Returns JSON array with: slug, title, agent, schedule, tags, lastRanAt, running, durationMs, outputTokens, body excerpt
4. **API endpoint: `GET /api/schedules`** — returns the list of valid schedule options with their intervals in ms
   - Derived from the TaskScheduler's schedule-to-ms mapping

## References

- Idea document: `docs/ideas/playbook-designer-workflow.md`
- Play model: `docs/models.ts`
- TaskScheduler schedule mapping: `features/task-scheduler.ts` (`_scheduleToMs()`)
- Dashboard workflow (visualization pattern): `workflows/dashboard/`
- Existing plays: `docs/plays/*.md`

## Verification

- Run the playbook-designer workflow and confirm the timeline loads in the browser
- Confirm all existing plays appear as cards with correct metadata
- Confirm plays are grouped by schedule frequency
- Confirm status indicators match actual play state (check a running play shows blue, a recently-run play shows green)
- Confirm estimated next run times are reasonable given the schedule and lastRanAt
- Confirm `GET /api/plays` returns valid JSON with all play documents
- Confirm `GET /api/schedules` returns the valid schedule options
- Confirm the page auto-refreshes and picks up state changes
