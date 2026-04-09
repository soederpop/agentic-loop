---
status: approved
project: tauri-desktop-app
---

# Phase 5: Window-Manager Parity + Swift Launcher Retirement

Extend the Tauri-native window manager toward functional parity with the existing `windowManager`, migrate key callers, and remove the Swift launcher dependency from the main desktop path.

The demoable outcome: the desktop app no longer relies on the Swift launcher for the supported desktop path, and Luca’s window-management calls resolve through the Tauri-native backend for the core supported capabilities.

## Deliverables

1. **Expanded window-manager parity** — Extend `tauri-window-manager` beyond overlays to cover the highest-value remaining behaviors from the current `windowManager`, in sound order:
   - `move()`
   - `resize()`
   - richer `setFrame()` behavior
   - `spawnLayout()` / `spawnLayouts()`
   - improved `windowStateSync`
   - lifecycle fidelity for focus and close events

2. **Terminal-window strategy implementation** — Implement or clearly scope the replacement for `spawnTTY()` inside Tauri. If full PTY-backed terminal windows are feasible in this phase, build them. If not, deliver a clearly documented supported subset and a follow-up path rather than silently dropping the feature.

3. **Screenshot and recording decision** — Either:
   - implement `screengrab()` and any realistic recording support in the Tauri-native path, or
   - explicitly mark unsupported portions with clear runtime errors and documentation while preserving the rest of the migration

4. **Caller migration** — Move the main desktop-app callers from the old Swift-backed `windowManager` path to the Tauri-native path. At minimum, ensure the voice system and desktop-managed windows use the Tauri-native backend by default.

5. **Facade/alias decision** — Decide and implement one of these stable end states:
   - `windowManager` becomes the canonical public feature and dispatches to the Tauri-native backend in the desktop app, or
   - `tauri-window-manager` remains explicit but the rest of the codebase is updated cleanly and consistently

6. **Swift launcher retirement** — Remove the Swift launcher from the primary desktop shipping path and update docs, packaging assumptions, startup flows, and verification paths accordingly.

## References

- `features/window-manager.ts`
- `features/voice-service.ts`
- `commands/main.ts`
- `docs/reports/tauri-desktop-app-research.md`
- `docs/reports/tauri-luca-desktop-shipping-report.md`

## Verification

- The supported desktop path no longer depends on the Swift launcher for its core window-management behavior
- The Tauri-native backend supports the required window operations for the desktop app’s primary workflows
- Voice overlays and picker flows work entirely through the Tauri-native backend
- Layout and frame operations behave correctly for supported windows
- Any unsupported parity gaps are explicit, documented, and surfaced clearly at runtime
- Desktop packaging, startup, and user-facing docs no longer describe the Swift launcher as a required dependency for the primary app path
