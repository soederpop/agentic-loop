---
status: complete
created: 2026-04-08
subject: tauri-desktop-app
---

# Tauri Desktop App Research for Luca

This report answers the open questions in `docs/ideas/tauri-desktop-app.md` by inspecting the actual Luca project, using `luca describe`, `luca eval`, and reading the project’s entrypoints and subsystems.

## Executive summary

Yes: a Tauri desktop app is a very good fit for Luca.

But after looking at the real codebase, the right mental model is slightly different from the original report:

- Luca is not just a simple CLI binary.
- It already behaves like a local orchestrator/runtime with:
  - a singleton-ish authority process model (`luca main`)
  - a WebSocket control plane
  - multiple managed subsystems
  - local IPC for native window control
  - assistant, workflow, scheduling, content, and voice services
- That means the Tauri app should not treat Luca as a dumb subprocess.
- Instead, Tauri should treat Luca as the app’s local engine/runtime, while also exposing the same installed binary to the OS as a first-class CLI.

So the best product shape is:

1. Ship one Luca binary inside the desktop app.
2. On first run, offer to install/symlink/copy that same binary into a user PATH location for external CLI usage.
3. Use that exact same binary as the engine behind the desktop app.
4. Let Tauri own lifecycle, install/upgrade UX, logs, permissions, and native shell affordances.
5. Let Luca continue to own orchestration, assistants, workflows, tools, and long-running agentic behaviors.

## What the current Luca project actually is

### Project startup customization

The project-level `luca.cli.ts` runs at CLI startup and does several important things:

- discovers project helpers via `container.helpers.discoverAll()`
- discovers assistants via `assistantsManager.discover()`
- creates a default `chiefOfStaff` assistant
- injects runtime context values into the container:
  - `luca`
  - `chief`
  - `voiceChief`
  - `docs`
  - `wm`

That means this project already expects Luca to be the primary runtime shell, not just a one-off command executor.

### Framework surface confirmed with `luca describe`

Using `luca describe features clients servers --platform=server`, this project exposes a large runtime surface including:

- features: `assistant`, `assistantsManager`, `conversation`, `fileTools`, `processManager`, `taskScheduler`, `projectBuilder`, `windowManager`, `voiceService`, `workflowService`, `instanceRegistry`, etc.
- clients: `rest`, `websocket`, `openai`, `voicebox`, etc.
- servers: `express`, `mcp`, `websocket`

This matters for Tauri because Luca already contains the primitives needed for:

- local service orchestration
- process management
- websocket communications
- file operations
- AI assistant loops
- local server hosting
- OS/window integration

## The real “main process” in Luca

The key command is `commands/main.ts`.

This is effectively Luca’s local daemon / orchestrator.

### `luca main` has authority/client behavior

`luca main` is not just “start a server.” It does this:

- checks the shared `instanceRegistry`
- determines whether an authority process is already running for the current project
- if one exists:
  - a second invocation becomes a client/dashboard process
  - or attaches a remote console
- if one does not exist:
  - it becomes the authority process
  - allocates ports
  - starts subsystems
  - exposes status/control over WebSocket

So Luca already has a daemon-ish architecture that maps well to a desktop app.

### Shared instance registry

The `instanceRegistry` feature stores entries under:

- `~/.luca/agentic-loops`

Each registered instance contains:

- project cwd
- pid
- start time
- allocated ports:
  - `authority`
  - `content`
  - `workflow`

`luca eval` confirmed the default base ports:

- authority: `4410`
- content: `4100`
- workflow: `7700`

This is a strong signal that the desktop app should integrate with Luca’s existing authority model instead of inventing an entirely separate runtime manager.

## Subsystems started by `luca main`

After reading `commands/main.ts`, the authority process currently manages these major subsystems.

### 1. WebSocket control plane

`luca main` starts a WebSocket server on the authority port.

It supports:

- initial state snapshot
- event subscription
- status querying
- command dispatch
- remote eval console
- log streaming

It sends:

- `state`
- `event`
- `log`
- `response`

It handles commands such as:

- `shutdown`
- `status`
- `pause-all`
- `resume-all`
- `eval`
- voice-related UI commands

This is important: Tauri does **not** need to invent a brand new IPC protocol to talk to Luca. There is already a useful control plane.

### 2. Task scheduler

The task scheduler is a first-class subsystem.

It:

- loads tasks from docs/content
- executes tasks on intervals
- spawns Luca commands to perform prompt-driven work
- logs lifecycle events
- updates docs/content after task completion or failure

This means Luca is already designed to be a long-running background automation engine.

### 3. Project builder watcher

The `projectBuilder` feature runs in watcher mode.

It:

- watches docs/projects
- triggers builds
- emits structured events for build start/plan start/plan completion/errors

This again reinforces that Luca already behaves like a persistent app runtime.

### 4. Voice service

The `voiceService` subsystem orchestrates:

- wake word handling
- STT
- TTS-backed assistant chats
- routing to voice-enabled assistants
- overlay UI integration via the window manager

The voice service is not a toy add-on. It is tightly integrated with the orchestrator.

### 5. Window manager

The `windowManager` feature is one of the most interesting findings.

It already provides a native window control abstraction via a separate native app called `LucaVoiceLauncher`.

It supports:

- spawning browser windows
- spawning terminal windows
- focusing/moving/resizing/closing windows
- evaluating JS inside spawned windows
- screenshots and video recording
- layout spawning and arrangement
- hotkey triggers

It uses Unix domain sockets and a broker/producer architecture so multiple Luca processes can share one native window-control backend.

This is the strongest evidence that the project already wants a native desktop shell.

### 6. Workflow service

The `workflowService` feature starts an Express-based local HTTP server that:

- serves workflow public directories
- serves shared CSS
- exposes workflow APIs
- renders workflow pages

So Luca is already capable of serving local web UI surfaces.

### 7. Content service

`luca main` also spawns an external `cnotes serve` process for docs/content browsing.

This means the current system already includes sidecar-like process management inside Luca itself.

### 8. Communications service

The communications subsystem can activate channels like:

- iMessage
- Telegram
- Gmail / Google Workspace

This makes Luca more like a personal local automation OS agent than a simple CLI.

## Why this matters for a Tauri architecture

The original idea assumed Luca might be either:

- an HTTP server, or
- a stdio CLI worker

After reading the code, the more accurate answer is:

- Luca is both a CLI and a local orchestrator runtime
- the most important integration point is not plain stdio
- the most valuable integration point is the authority process plus its control plane

So the Tauri app should center around `luca main` rather than around one-off command invocations alone.

## Recommended desktop architecture

## Recommendation: Tauri as shell, Luca as engine

Use this split:

### Tauri owns

- native install flow
- binary packaging and updates
- first-run onboarding
- OS integrations:
  - tray
  - launch at login
  - notifications
  - menu bar / status icon
  - file associations
  - permissions prompts
- desktop UI windows
- secure storage for app-managed config if needed
- lifecycle management of the Luca authority process
- external binary installation UX

### Luca owns

- assistants
- agentic task execution
- workflows
- docs/content loading
- file and search tools
- process spawning for tasks
- websocket control/event stream
- workflow/content local servers
- voice orchestration
- project-aware automation

This is the clean boundary.

## Best runtime shape

### Primary path

On app launch, Tauri should:

1. locate the bundled Luca binary
2. ensure app support directories exist
3. start `luca main` for the app/project context
4. wait for authority readiness
5. connect to the authority WebSocket
6. render desktop UI from the streamed state/events/logs

### Secondary path

The app should also expose one-off CLI usage:

- run `luca eval ...`
- run `luca prompt ...`
- run `luca serve`
- run workflows or project tasks

But those are secondary to the persistent authority process.

## Should Tauri talk to Luca via HTTP, WebSocket, or stdio?

### Best answer: WebSocket first, with HTTP for specific local services

Based on the real codebase:

- use **WebSocket** to communicate with `luca main`
- use **HTTP** for workflow/content services when needed
- use **direct process execution** for certain install/setup actions
- use **stdio only as a fallback** for isolated one-off commands, not as the primary app protocol

### Why WebSocket is the right primary protocol

Because `luca main` already provides:

- state snapshots
- events
- logs
- commands
- remote eval

That is exactly what a desktop shell wants.

### Where HTTP still makes sense

Some Luca subsystems are naturally HTTP-shaped:

- `workflowService`
- Express endpoints
- content browsing via `cnotes serve`

Tauri can embed or open those in webviews when it is useful.

### Where stdio still makes sense

Use stdio for:

- installer verification
- version checks
- one-shot commands like `luca describe ...`
- first-run bootstrap flows
- fallback diagnostics if the authority runtime is not healthy

But stdio should not be the main long-lived control path.

## The strongest product idea: one binary, two roles

The user goal is excellent:

> ship a desktop app which can install the luca binary for external usage, but also use that same luca binary to power the agentic loop's various activities and use the luca cli as a full blown first class citizen on the OS

This is the right strategy.

### Why it is strategically good

It avoids splitting the platform into:

- “desktop Luca” and
- “CLI Luca”

Instead, there is one engine.

Benefits:

- same version everywhere
- same behavior in desktop and terminal
- easier debugging
- easier documentation
- stronger user trust
- easier automation and scripting
- less architectural drift over time

## Recommended installation model for the binary

Use a two-layer distribution model.

### Layer 1: bundled binary inside app

The Tauri app ships with a private bundled Luca binary.

This is the app’s guaranteed runtime.

Use it for:

- app startup
- engine lifecycle
- background services
- recovery if PATH installation is missing or broken

### Layer 2: optional external CLI installation

During onboarding or settings, offer:

- “Install Luca CLI for terminal use”

Possible implementations:

- copy binary to `~/.local/bin/luca` on Linux
- copy binary to `~/bin/luca` or another managed user bin dir on macOS
- write a small wrapper into a PATH-managed location
- Windows: place under a user-level tools dir and update PATH

The key rule:

- the installed CLI should be the same binary payload, not a separate rebuild if possible

### Important UX detail

The app should show:

- installed version
- bundled version
- external CLI path
- whether PATH resolves correctly
- a repair/reinstall button

## How Tauri should manage Luca lifecycle

### Recommended ownership model

Tauri should be the parent/supervisor for the app-managed Luca authority process.

That means Tauri should:

- spawn `luca main`
- monitor health
- reconnect on restart
- stream logs to UI
- stop it gracefully on app quit when appropriate

### But preserve Luca’s own authority logic

Do not throw away Luca’s existing multi-instance logic.

Instead:

- start `luca main`
- let Luca decide whether it becomes authority or client
- if authority already exists for that cwd/context, Tauri can attach to it

This is especially useful if a user starts Luca outside the app first.

### Good desktop behavior options

Support modes like:

- Quit app, keep Luca engine running
- Quit app, stop Luca engine
- Start Luca at login
- Start desktop UI at login
- Headless background mode with tray

The current `pause-all` / `resume-all` / `shutdown` commands map well to desktop lifecycle controls.

## How the current window subsystem affects the Tauri decision

This codebase already has a native window control concept outside Tauri.

### Current state

`windowManager` talks to a native app (`LucaVoiceLauncher`) over Unix sockets.

That native app appears to handle:

- native windows
- browser windows
- terminal windows
- hotkeys
- overlays

### What this means

There are two possible product directions.

#### Option A: Tauri replaces the launcher over time

Tauri becomes the canonical desktop shell and absorbs some or all of the launcher’s responsibilities.

Pros:

- one desktop runtime
- simpler distribution story
- fewer native moving parts

Cons:

- requires re-implementing native capabilities currently provided by the launcher
- may lose some custom multi-window or terminal behavior unless rebuilt carefully

#### Option B: Tauri coexists with the launcher initially

Tauri provides the primary desktop UI and lifecycle management, while Luca’s existing `windowManager` / launcher path continues to power specialized windows and overlays.

Pros:

- much faster path to shipping
- lower migration risk
- preserves existing voice overlays and window semantics

Cons:

- more moving pieces
- duplicated desktop-native concerns

### Recommendation

Start with **Option B**.

Ship Tauri as the primary app shell first, while leaving Luca’s current native window subsystem intact for features that already depend on it.

Then, once the Tauri app is stable, decide which launcher responsibilities should migrate into Tauri.

## Security and platform considerations

### Good fit for Tauri

Tauri is a strong fit because Luca is local-first and OS-adjacent.

It benefits from:

- secure shell ownership of sidecar process spawning
- filesystem access under explicit control
- better desktop packaging than a raw script installer
- OS-native update and signing flows

### Main security concerns

Because Luca can:

- spawn processes
- read/write files
- interact with AI tools
- control windows
- run remote-ish automation flows

The desktop app should make permissions and trust boundaries visible.

Recommended UI concepts:

- show when Luca is running
- show current cwd / workspace
- show active subsystems
- show spawned child processes
- show network listeners and ports
- show a “tool activity” / “automation activity” panel
- easy kill switch

## Concrete architecture proposal

## Version 1 architecture

### Components

1. **Tauri shell**
   - installer
   - updater
   - settings
   - tray
   - logs UI
   - onboarding
   - status dashboard

2. **Bundled Luca binary**
   - sidecar/runtime engine
   - started as `luca main`

3. **Desktop UI ↔ Luca control channel**
   - WebSocket to authority port

4. **Optional local web surfaces**
   - workflow service
   - content service
   - embedded in webviews or opened externally

5. **Optional external CLI installation**
   - same binary copied/symlinked into user PATH

### Startup flow

1. Tauri launches
2. Tauri verifies or extracts bundled Luca binary
3. Tauri checks whether a Luca authority already exists for the selected context
4. If not, Tauri starts `luca main`
5. Tauri connects to authority WebSocket
6. Tauri renders:
   - subsystem health
   - logs
   - tasks
   - events
   - content/workflow links
   - voice/window status

### Settings flow

Settings should include:

- install CLI to PATH
- reinstall/repair CLI
- open Luca config/data folders
- launch at login
- start engine in background
- keep engine running after app close
- enable/disable voice/content/comms services
- choose project/workspace roots

## Suggested UI sections for the app

The existing Luca runtime naturally suggests these desktop screens:

### 1. Engine

- Luca version
- engine running/stopped
- pid
- uptime
- authority port
- start/stop/pause/resume

### 2. Activity

- live logs
- recent events
- tool calls
- current tasks

### 3. Workflows

- running workflow service
- available workflows
- open workflow UI

### 4. Content

- content models and counts
- open docs/content browser

### 5. Assistants

- discovered assistants
- voice-enabled assistants
- active threads/sessions

### 6. Voice + native

- wake word status
- STT/TTS availability
- overlay/window manager status
- hotkey status

### 7. CLI

- installed or not installed
- path location
- shell integration help
- test command button

## What not to do

### 1. Do not make Tauri the only API surface immediately

If Tauri tries to replace all Luca runtime APIs with Rust commands from day one, you will duplicate a lot of logic that already exists in Luca.

### 2. Do not rely on stdio as the sole protocol

You would lose the advantages of Luca’s already-existing long-running authority model.

### 3. Do not fork the binary into “desktop” and “cli” editions unless forced

That would create long-term drift and much worse release management.

### 4. Do not ignore the current instance registry model

Luca already has a notion of coexistence, authority, and per-project isolation. Preserve that.

## Open implementation questions to answer next

These are the next practical questions, now that the architecture is clearer.

### 1. What cwd/project context should the desktop app use?

Because `luca main` is cwd-sensitive, the app needs a clear model for:

- one global workspace?
- multiple workspaces?
- one engine per project?
- one global engine plus project switching?

### 2. Should desktop launch a single authority for one managed app workspace?

Most likely yes for V1.

That is simpler than trying to manage many project authorities in the first release.

### 3. Should the app surface existing workflow/content local servers directly in embedded webviews?

Probably yes.

This gives fast value without rebuilding those UIs immediately.

### 4. How much of `LucaVoiceLauncher` should Tauri absorb?

This is a second-phase decision.

## Final recommendation

Ship the Tauri app with this product posture:

- **Tauri is the desktop shell**
- **Luca is the local engine**
- **The same Luca binary is optionally installed for terminal use**
- **The desktop app talks to Luca primarily through the existing authority WebSocket model**
- **HTTP is used for workflow/content surfaces when appropriate**
- **Current native launcher/window subsystems can coexist initially**

That gives you:

- a real desktop product
- a first-class OS CLI
- one runtime to maintain
- a natural path from local assistant tool to local AI operating environment

## Bottom line

The original report was directionally right, but after inspecting the actual source, the best desktop architecture is even better than “Tauri + sidecar CLI.”

It should be:

**Tauri + Luca authority runtime + optional external CLI install of the same binary**

That matches the codebase Luca already has today.
