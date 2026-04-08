---
status: pending
project: tauri-desktop-app
---

# Phase 1: Desktop Shell Bootstrap + Bundled Luca Runtime

Create the Tauri app shell, bundle the Luca binary as a sidecar, and prove that the app can start, stop, and supervise `luca main` successfully.

The demoable outcome: launch the desktop app, have it start the bundled Luca runtime, detect readiness, and show that the engine is running for the selected workspace. Quitting the app should follow an explicit engine lifecycle policy rather than leaving orphaned processes accidentally.

## Deliverables

1. **Tauri app scaffold in-repo** — Add the Tauri app structure, configuration, and build scripts needed to run a desktop shell from this repository. The shell does not need polished UX yet; it needs to be buildable, startable, and capable of invoking Rust-side commands.

2. **Bundled Luca sidecar wiring** — Configure the Tauri app to include the Luca binary as an external bundled executable with the correct target-triple naming conventions. Document the expected artifact locations and the release-time assumptions for building those binaries.

3. **Rust-side Luca supervisor** — Add a Rust-side process manager for the bundled Luca binary that can:
   - spawn `luca main`
   - pass the correct workspace/cwd context
   - capture boot output
   - stop the process cleanly
   - detect unexpected exits
   - expose engine status back to the frontend

4. **Readiness detection flow** — Implement a reliable readiness check for the engine using Luca-aware signals, in sound order:
   - process spawned successfully
   - instance registry entry appears for the workspace
   - authority port is known
   - WebSocket connection to the authority succeeds
   - optional status query succeeds

5. **Workspace/cwd selection for V1** — Define and implement a simple first version of the workspace model. For this phase, it is enough to support one app-owned workspace/cwd with a clearly visible path in the UI and code.

6. **Engine lifecycle policy** — Implement at least one explicit policy for app close behavior, such as:
   - quit app and stop Luca
   - optionally keep Luca running in background for later phases
   For this phase, clarity and predictability matter more than flexibility.

## References

- `docs/reports/tauri-desktop-app-research.md`
- `docs/reports/tauri-luca-desktop-shipping-report.md`
- `commands/main.ts` — Authority runtime behavior
- `features/instance-registry.ts` — Shared registry and port allocation
- `luca.cli.ts` — Project startup behavior

## Verification

- The desktop app builds and launches locally
- The bundled Luca binary is present and executable from the app runtime
- Launching the desktop app starts `luca main` successfully for the configured workspace
- Readiness detection completes without relying only on arbitrary sleep delays
- The app can display engine status such as pid, running/stopped state, workspace, and authority port
- Closing the app follows the documented lifecycle policy with no orphaned Luca authority process left behind unintentionally
- Restarting the app after a clean shutdown starts the engine again successfully
