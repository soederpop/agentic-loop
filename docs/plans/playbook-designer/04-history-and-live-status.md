---
status: pending
project: playbook-designer
---

# Phase 4: History, Logs, and Live Status

Add execution history, log viewing, live status updates, and manual triggering. This is the "car" — the full-featured playbook management experience where you can see what happened, what's happening now, and trigger plays on demand.

The demoable outcome: click a play and see its recent execution history with timestamps, durations, and token counts. Watch the timeline update in real-time as plays start and finish. Click a "Run Now" button to manually trigger a play outside its schedule.

## Deliverables

1. **Execution history panel** in the play editor/detail view
   - Shows recent executions: timestamp, duration, token usage, pass/fail
   - Sourced from `logs/prompt-outputs/` directory (matched by play slug/task ID)
   - Paginated or "last N runs" view
   - Click an entry to see the full output log

2. **API endpoint: `GET /api/plays/:slug/history`**
   - Scans `logs/prompt-outputs/` for entries matching the play
   - Returns array of `{ timestamp, durationMs, outputTokens, status, logPath }`
   - Sorted most recent first

3. **API endpoint: `GET /api/plays/:slug/logs/:timestamp`**
   - Returns the full text content of a specific execution log

4. **Live status via polling or WebSocket**
   - Timeline auto-updates when a play starts or finishes
   - Running plays show an animated indicator
   - If WebSocket is available via the shared workflow service, use it; otherwise fall back to polling `/api/plays` every 10 seconds

5. **Manual trigger: `POST /api/plays/:slug/run`**
   - Spawns the play execution (same as the agentic loop does: `luca prompt <agent> <taskId>`)
   - Returns immediately with a job ID
   - UI shows "manually triggered" status on the play card
   - Execution result appears in history when complete

6. **Timeline enhancements**
   - "Last run" timestamps as relative time ("2 min ago") with tooltip showing absolute time
   - Plays that are overdue (past their next expected run) get a warning indicator
   - Filter/search plays by name, tag, agent, or schedule

## References

- Phase 3 deliverables (condition tester, play editor)
- Agentic loop command: `commands/agentic-loop.ts` (play execution via `luca prompt`)
- Log output directory: `logs/prompt-outputs/`
- Dashboard workflow (live status pattern): `workflows/dashboard/`
- TaskScheduler: `features/task-scheduler.ts`

## Verification

- Open a play that has been executed — confirm history panel shows recent runs with correct metadata
- Click a history entry — confirm the full log content is displayed
- Start the agentic loop and confirm the timeline updates in real-time when a play starts/finishes
- Click "Run Now" on a play — confirm it executes and the result appears in history
- Confirm manual trigger doesn't interfere with the scheduled run (no double-execution)
- Confirm overdue plays show a warning indicator
- Filter plays by tag — confirm only matching plays are shown
- Confirm history entries are sorted most recent first
