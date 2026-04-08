---
status: pending
project: tauri-desktop-app
---

# Phase 2: Authority Dashboard + Lifecycle Controls

Build the first real desktop UI around Luca’s existing authority WebSocket and lifecycle model.

The demoable outcome: after the app starts Luca, the desktop UI shows live authority state, recent logs, subsystem status, and allows the user to pause, resume, refresh, and shut down the engine from the desktop shell.

## Deliverables

1. **Authority WebSocket client in the desktop app** — Connect the app to Luca’s authority WebSocket and consume the existing message model for:
   - state snapshots
   - events
   - logs
   - command responses

2. **Engine dashboard surface** — Build a minimal but useful engine dashboard showing:
   - engine running/stopped
   - pid and uptime
   - workspace path
   - authority port
   - paused/running state
   - major subsystem summaries (scheduler, builder, voice, workflow service, content service, comms)

3. **Live log stream view** — Show recent logs from Luca in a scrollable desktop surface with enough structure to distinguish sources like `main`, `scheduler`, `builder`, `voice`, `workflowService`, and others.

4. **Lifecycle controls** — Add controls that map to Luca’s existing authority commands where possible:
   - refresh/query state
   - pause all
   - resume all
   - shutdown
   - restart engine

5. **Existing-authority attach behavior** — If an authority already exists for the selected workspace, the app should attach to it cleanly instead of duplicating or confusing the runtime state.

6. **Error and reconnect handling** — The app should show meaningful states when:
   - the WebSocket disconnects
   - Luca crashes
   - readiness fails
   - the authority disappears while the app is open

## References

- `commands/main.ts` — Authority WebSocket protocol, status snapshot, commands
- `docs/reports/tauri-desktop-app-research.md`
- `docs/reports/tauri-luca-desktop-shipping-report.md`

## Verification

- The app connects to Luca’s authority WebSocket after engine readiness
- The dashboard reflects real runtime state rather than mocked data
- New logs and events appear live while `luca main` is active
- Pause/resume/shutdown controls map correctly to Luca authority behavior
- If Luca is stopped externally, the app reflects that state cleanly
- If an authority is already running before app launch, the app can attach and display live state without starting a duplicate authority
