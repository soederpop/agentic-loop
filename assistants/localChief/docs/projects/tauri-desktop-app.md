---
status: draft
goal: have-10-users-of-the-agentic-loop
---

# Tauri Desktop App

This project turns the agentic loop into a real desktop application with Tauri as the native shell and Luca as the bundled runtime engine.

The product goal is not just to wrap a web UI in a desktop window. The app should:

- ship Luca as a bundled sidecar/runtime
- supervise `luca main` as the long-running local engine
- run Luca in a user-selected instance workspace/project directory rather than directly in the shared app home
- install and maintain a shared Agentic Loop helper-pack home at `~/.luca/agentic-loop` for reusable commands, features, templates, and app-managed support files
- let users create new Agentic Loop instances that bootstrap into their own project directories and discover shared helpers via `luca.cli.ts`
- present Luca’s current authority state, logs, workflows, and subsystem health in a desktop shell
- optionally install the same Luca binary into a user-managed PATH location for terminal use
- verify and repair additional local dependencies required by important subsystems such as voice and native integrations
- replace the current Swift-native launcher path with a Tauri-native window authority over time

This is a strategic packaging and platform project. It keeps Luca as the engine, but makes the desktop app the primary OS-facing shell for onboarding, installation, updating, native lifecycle, and user trust.

## Overview

Five delivery phases, each with a distinct demoable outcome:

1. **Desktop shell bootstrap + bundled Luca runtime** — Create the Tauri app shell, bundle Luca as a sidecar, start/stop/supervise `luca main`, and prove we can connect to Luca’s authority runtime from the app.
2. **Authority dashboard + lifecycle controls** — Build the desktop UI around Luca’s existing authority WebSocket so the app can show logs, status, events, and runtime controls.
3. **External CLI installation + repair flows** — Add optional installation of the same Luca binary for terminal use, plus version/path checks and repair/update UX.
4. **Tauri-native window manager foundation** — Introduce a `tauri-window-manager` backend that preserves the existing `windowManager` contract for overlays, hotkeys, and Tauri-managed windows.
5. **Window-manager parity + Swift launcher retirement** — Extend the Tauri-native window manager toward functional parity, migrate key callers, and remove the Swift launcher dependency.

## Execution

- [Phase 1: Desktop Shell Bootstrap + Bundled Luca Runtime](../plans/tauri-desktop-app/01-desktop-shell-bootstrap-and-bundled-luca-runtime.md)
- [Phase 2: Authority Dashboard + Lifecycle Controls](../plans/tauri-desktop-app/02-authority-dashboard-and-lifecycle-controls.md)
- [Phase 3: External CLI Installation + Repair Flows](../plans/tauri-desktop-app/03-external-cli-installation-and-repair-flows.md)
- [Phase 4: Tauri-Native Window Manager Foundation](../plans/tauri-desktop-app/04-tauri-native-window-manager-foundation.md)
- [Phase 5: Window-Manager Parity + Swift Launcher Retirement](../plans/tauri-desktop-app/05-window-manager-parity-and-swift-launcher-retirement.md)
