---
status: approved
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

5. **Workspace/cwd selection for V1** — Define and implement a simple first version of the workspace model. For this phase, it is enough to support one app-owned workspace/cwd with a clearly visible path in the UI and code. The plan must explicitly distinguish between:
   - a shared per-user Agentic Loop home at `~/.luca/agentic-loop` that stores app-installed helper packs, templates, and app-managed support files
   - the selected instance workspace/project directory that Luca actually runs in as its cwd
   Luca should run in the selected instance workspace, not in `~/.luca/agentic-loop`.

6. **Instance creation/bootstrap flow** — Add the first-run and “new instance” path for creating a new Agentic Loop project. For V1 this should:
   - create or select a target instance directory
   - run `luca bootstrap --output <instance-dir>` or an equivalent app-owned starter flow
   - ensure the generated instance `luca.cli.ts` discovers both local project helpers and the shared helper pack from `~/.luca/agentic-loop`
   - define and document helper precedence/collision policy, with instance-local helpers taking precedence over shared defaults

7. **Shared helper-pack installation** — On first run, ensure `~/.luca/agentic-loop` exists and is populated with the Agentic Loop’s shared `commands/`, `features/`, and any other shipped helper directories needed by instances. This shared install must be versioned, repairable, and separable from any specific user project workspace.

8. **Engine lifecycle policy** — Implement at least one explicit policy for app close behavior, such as:
   - quit app and stop Luca
   - optionally keep Luca running in background for later phases
   For this phase, clarity and predictability matter more than flexibility.

## References

- `docs/reports/tauri-desktop-app-research.md`
- `docs/reports/tauri-luca-desktop-shipping-report.md`
- `commands/main.ts` — Authority runtime behavior
- `features/instance-registry.ts` — Shared registry and port allocation
- `luca.cli.ts` — Project startup behavior
- `setup.sh` — current setup expectations and dependency flow
- `scripts/install.sh` — current machine dependency installation flow

## Verification

- The desktop app builds and launches locally
- The bundled Luca binary is present and executable from the app runtime
- Launching the desktop app starts `luca main` successfully for the configured workspace
- The configured workspace/cwd shown in the UI is the instance project directory, while the shared helper-pack home is tracked separately as `~/.luca/agentic-loop`
- A new Agentic Loop instance can be created from the desktop app and bootstrapped successfully
- The bootstrapped instance loads shared Agentic Loop helpers from `~/.luca/agentic-loop` while preserving instance-local override behavior
- Readiness detection completes without relying only on arbitrary sleep delays
- The app can display engine status such as pid, running/stopped state, workspace, shared helper-pack location, and authority port
- Closing the app follows the documented lifecycle policy with no orphaned Luca authority process left behind unintentionally
- Restarting the app after a clean shutdown starts the engine again successfully
