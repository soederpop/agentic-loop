---
tags: []
status: planning
relatedReports: []
---

# Tauri + Luca desktop shipping report

## Objective
Research how to use Tauri to ship a native desktop app that bundles the Luca binary, optionally installs that same binary into a user PATH location, and uses Luca to power the app’s long-running agentic runtime.

## Resynthesized context from the Luca research
After reading `docs/reports/tauri-desktop-app-research.md`, the right framing is clearer:

- Luca is not just a one-shot CLI.
- Luca already behaves like a local orchestrator with an authority process model, WebSocket control plane, subsystem management, local servers, scheduling, voice, and native-window integration.[1]
- Therefore, the Tauri app should not be designed around “run one Luca command and parse stdout” as its main architecture.
- Instead, Tauri should act as the native desktop shell, while Luca remains the local engine/runtime.[1]

That implies a product shape with one Luca binary playing two roles:
1. bundled inside the Tauri app as the guaranteed engine runtime,
2. optionally copied or linked into a user PATH location so Luca is also a first-class terminal command.[1]

## Core conclusion
Yes, Tauri can accomplish this well.

The most credible V1 is:
- bundle Luca as a Tauri sidecar using `bundle.externalBin`,[3][5]
- have the Rust side of Tauri supervise `luca main`,[1][3][4]
- connect the desktop UI to Luca primarily through Luca’s existing authority WebSocket model rather than stdio,[1]
- optionally install the same Luca binary into a user-writable CLI location during onboarding or from Settings,[1][9]
- use Tauri’s signed updater flow to update the desktop app and refresh the bundled Luca binary together.[7]

## What Luca already needs from the desktop shell
The earlier Luca report establishes several facts that materially change the Tauri design:

- `luca main` already has authority/client behavior and instance-registry logic, so Tauri should preserve that instead of replacing it with a new app-local process model.[1]
- Luca already exposes a WebSocket control plane with state snapshots, events, logs, commands, and remote eval, which is a much better desktop integration surface than plain stdio.[1]
- Luca already manages long-running subsystems such as task scheduling, workflow/content services, voice services, communications, and a native window-management path.[1]
- Luca already uses sidecar-like child-process management itself, including spawning `cnotes serve` for content browsing.[1]

So Tauri’s job is mainly to provide:
- packaging,
- native installation UX,
- app lifecycle supervision,
- tray/menu/window affordances,
- onboarding and settings,
- secure permissions boundaries,
- updater/relaunch flows,
- optional CLI installation/repair UX.[1][6][7][8]

## What Tauri supports directly

### 1. Bundling Luca inside the app
Tauri v2 supports embedding external executables via `bundle.externalBin` in `tauri.conf.json`.[3][5]

This is the core primitive for shipping Luca inside the app bundle.

Important details:
- paths may be relative to `src-tauri/tauri.conf.json`,[3]
- Tauri expects per-platform/per-architecture filenames using the target triple suffix,[3][5]
- for example, Luca binaries would need names like:
  - `luca-x86_64-pc-windows-msvc.exe`
  - `luca-x86_64-apple-darwin`
  - `luca-aarch64-apple-darwin`
  - `luca-x86_64-unknown-linux-gnu`.[5]

This makes Luca sidecar packaging straightforward as long as your release pipeline can produce the correct artifacts for each target.

### 2. Launching Luca from Tauri
Tauri’s shell plugin is the main API for spawning child processes and sidecars on desktop platforms.[4]

The sidecar guide shows that on the Rust side you can call `app.shell().sidecar("my-sidecar")`, spawn it, receive process events such as stdout, and write to stdin.[3]

For Luca specifically, that means Tauri Rust can:
- spawn `luca main`,
- pass startup arguments,
- observe boot logs,
- detect readiness,
- gracefully shut down or restart the engine,
- run one-off commands like `luca describe` or `luca eval` for diagnostics/bootstrap when needed.[1][3][4]

### 3. Restricting launch permissions
Tauri’s shell access is capability-driven. Frontend access to shell commands is blocked by default and must be explicitly allowed, including whether a sidecar may be executed or spawned and which arguments are permitted.[3][4][8]

That is valuable here because Luca is powerful. It can spawn processes, manage files, run tools, and orchestrate long-lived automation.[1]

So the safest architecture is:
- keep Luca process spawning and supervision in Rust,
- expose narrow Tauri commands/events to the frontend,
- avoid giving broad shell access directly to the webview.[3][4][8]

### 4. Filesystem access for CLI installation
If we decide to copy Luca out of the app bundle into a user-managed CLI location, Tauri’s filesystem plugin is a practical way to support that flow from the app.[9]

This is useful for:
- first-run installation of `luca` into a user bin directory,
- repair/reinstall flows,
- version/path checks,
- replacing an older installed copy with the bundled version after user confirmation.[1][9]

### 5. Updates and relaunch
Tauri’s updater plugin provides signed updates for the app itself, and those signatures are mandatory for trusted updates.[7]
The process plugin provides relaunch/exit primitives that are useful when an update has been applied.[6]

This matters because the cleanest update model is usually:
- update the desktop app,
- replace the bundled Luca binary as part of that app update,
- optionally prompt the user to refresh the PATH-installed CLI copy if one exists.[6][7]

## Recommended architecture

### Principle: Tauri is the shell, Luca is the engine
This exactly matches the conclusions from the earlier Luca report and is strongly supported by Tauri’s capabilities.[1][3][4][8]

**Tauri should own:**
- install/update UX,
- onboarding,
- settings,
- tray/menu bar,
- native notifications,
- launch-at-login behavior,
- app windows,
- CLI install/repair UX,
- supervision of the Luca runtime.[1][6][7]

**Luca should own:**
- assistants,
- workflows,
- scheduler,
- communications,
- local content/workflow servers,
- the agentic loop itself,
- authority state/events/logs,
- existing project-aware orchestration logic.[1]

### Primary runtime path
On launch, the Tauri app should:
1. resolve the bundled Luca sidecar,
2. ensure app support/data directories exist,
3. determine the app’s selected workspace/cwd model,
4. start `luca main` for that context, or attach if Luca’s own authority logic determines an authority already exists,
5. wait for readiness by observing process output and/or probing Luca’s instance registry / authority port,
6. connect to Luca’s authority WebSocket,
7. render UI from Luca state, events, logs, and subsystem status.[1][3][4]

This follows Luca’s current design instead of fighting it.

### Secondary runtime path
Use direct process execution for narrow, one-shot tasks such as:
- `luca --version`,
- `luca describe ...`,
- `luca eval ...`,
- bootstrap/setup checks,
- fallback diagnostics when the authority runtime is unhealthy.[1][3][4]

But stdio should not be the main steady-state app protocol; the Luca report clearly favors WebSocket-first integration.[1]

## How to install Luca into the user’s PATH
The Luca report’s “one binary, two roles” approach is sound and Tauri can support it.[1]

### Recommended distribution model
Use two layers:

**Layer 1: bundled private Luca runtime**
- always ships inside the Tauri app,
- always available for the app itself,
- used for startup, recovery, and guaranteed compatibility.[1][3][5]

**Layer 2: optional external CLI installation**
- user opts in during onboarding or in Settings,
- app copies or symlinks the same Luca payload into a user-accessible location,
- app records installation status, path, and version and offers repair/reinstall.[1][9]

### Platform guidance

**macOS**
- Prefer a user-owned location rather than trying to mutate system directories.
- Viable choices include a managed directory such as `~/bin` or another app-defined user tools directory, with UX that helps the user add it to PATH if necessary.[1]
- Avoid writing to `/usr/local/bin` or other privileged locations by default because that complicates permissions and trust.
- Also note that app-bundle internals are not the right place to treat as a long-term user CLI path; copy out instead.

**Linux**
- `~/.local/bin/luca` is the cleanest default if it is present in the user PATH, matching the earlier Luca report’s recommendation.[1]
- If that directory is not in PATH, the app should explain how to add it or offer a different user-managed location.

**Windows**
- Install Luca under a user-level tools directory and help the user add that directory to user PATH.[1]
- Because Windows packaging and PATH behavior differ, a small launcher/wrapper may be useful, but the key goal remains: the external command should resolve to the same Luca payload/version conceptually.[1]

### Should we actually write to PATH automatically?
Probably not on day one.

A better V1 UX is:
- install/copy Luca to a user-managed directory,
- detect whether that directory is already in PATH,
- if not, show exact instructions or offer a clearly explained opt-in PATH update flow.

That is lower-risk than silently mutating user shell configuration on macOS/Linux or environment variables on Windows.

## Recommended communication model for the agentic loop
Given Luca’s real architecture, the agentic loop should be powered as follows:

### Primary control plane: WebSocket to `luca main`
Use Luca’s existing authority WebSocket for:
- state snapshots,
- log streaming,
- command dispatch,
- pause/resume/shutdown controls,
- event subscriptions,
- potentially remote eval or structured runtime inspection where appropriate.[1]

This gives the desktop app a real-time runtime dashboard with minimal reimplementation.[1]

### HTTP as a secondary surface
Use HTTP/webviews for workflow and content surfaces that Luca already serves.[1]
This is an acceleration path because you can embed existing Luca-served UIs instead of rebuilding all of them in Tauri immediately.

### Stdio as fallback only
Use stdio for setup, repair, bootstrap, and diagnostics—not as the primary long-running agent loop interface.[1][3]

## Security and trust-boundary implications
Tauri’s security model distinguishes between the privileged Rust core/plugins and the less-trusted frontend webview, with capabilities controlling exposed commands.[8]
That lines up well with Luca’s power level.

Recommended security posture:
- spawn and supervise Luca from Rust, not directly from frontend JS,[3][4][8]
- expose only narrow app commands such as “start engine,” “stop engine,” “install CLI,” “repair CLI,” and “open logs,”
- gate dangerous CLI install/update actions behind explicit user intent,
- show runtime transparency in the UI: current workspace, running subsystems, active ports, child processes, and recent tool activity, echoing the earlier Luca report.[1]

Because Luca can orchestrate substantial local automation, visibility is part of the security model, not just a UX nice-to-have.[1]

## Shipping strategy recommendation

### Best V1
Start with coexistence, not total replacement.

That means:
- ship Tauri as the primary desktop shell,
- bundle Luca as the engine sidecar,
- keep Luca’s current authority model intact,
- keep Luca’s current launcher/window-manager path intact where already needed,
- use Tauri mostly for lifecycle, UI, onboarding, and distribution.[1]

This matches the earlier recommendation to let Tauri coexist with `LucaVoiceLauncher` initially instead of replacing all native-window behavior immediately.[1]

### Why this is the least risky path
- It minimizes rewrites.
- It preserves Luca’s existing subsystem behavior.
- It gives you a strong app shell quickly.
- It avoids forking Luca into separate “desktop” and “CLI” products.[1]

## Concrete implementation plan

### Build-time
1. Produce Luca binaries for each target architecture/platform you ship.
2. Name them according to Tauri’s target-triple requirements.[3][5]
3. Add them to `bundle.externalBin` in `src-tauri/tauri.conf.json`.[3][5]
4. Initialize the shell plugin and define narrowly scoped capabilities.[3][4]
5. Enable updater/process/fs plugins as needed for update, relaunch, and CLI-copy flows.[6][7][9]

### First run
1. Launch the Tauri app.
2. Spawn `luca main` from Rust.
3. Wait until Luca becomes authority or attaches as client according to its own logic.[1]
4. Connect UI to Luca’s WebSocket.
5. Offer onboarding action: “Install Luca CLI for terminal use.”[1]
6. If accepted, copy/symlink Luca into a user directory, verify executability, and test `luca --version`.[1][9]

### Normal operation
1. Tauri monitors Luca health.
2. Luca runs the long-lived agentic subsystems.
3. UI reflects logs, subsystem status, workflows, content links, voice status, and CLI install state.[1]
4. On quit, allow policies such as:
   - quit app and keep Luca running,
   - quit app and stop Luca,
   - background tray mode.[1]

### Update flow
1. Use Tauri updater to deliver signed app updates.[7]
2. Relaunch app after update if necessary.[6]
3. On next launch, compare bundled Luca version against any PATH-installed Luca copy.
4. Offer “Update installed CLI” if they differ.

## Replacing the Swift launcher with a Tauri-native window manager
The earlier Luca research recommended coexistence with the current `LucaVoiceLauncher` path for V1.[1]

However, if the product goal is to fully replace the Swift launcher, the right move is to create a **`tauri-window-manager`** that preserves the current `windowManager` contract as closely as possible while implementing the behavior inside the Tauri shell.

This is the key requirement:

- **copy the behavior and API shape of `windowManager`**
- **repoint its backend from Swift + Unix socket window control to Tauri-managed native windows**
- **let the rest of Luca keep talking to a familiar window-management abstraction**

That is a good direction because `voiceService` and other callers already depend heavily on the current `windowManager` semantics:

- `spawn()` browser-like windows with HTML or URL
- `spawnTTY()` terminal windows
- `focus()`, `close()`, `navigate()`, `eval()`
- `move()`, `resize()`, `setFrame()`
- `screengrab()`, `video()`
- `spawnLayout()` / `spawnLayouts()`
- hotkey trigger events
- authoritative `windowStateSync`
- lifecycle events like `windowClosed`, `windowFocus`, `terminalExited`

### Best implementation strategy
Do **not** try to make Luca features call Tauri Rust APIs directly.

Instead, keep the architectural separation:

1. **Tauri app owns the actual native windows**
2. **Luca talks to a Tauri-facing window backend over a transport**
3. **A Luca feature named `tauri-window-manager` implements the same high-level behavior as `windowManager`**
4. **The existing `windowManager` callers migrate with minimal code changes, ideally behind configuration or aliasing**

That keeps the Tauri shell as the native owner while preserving Luca’s current feature-oriented design.

### Recommended transport
The easiest migration path is:

- Tauri starts Luca as usual
- Tauri exposes a local IPC surface for window operations
- `tauri-window-manager` talks to that IPC surface
- Tauri sends back acknowledgements and lifecycle events

Good transport options, in order:

1. **WebSocket on localhost**
   - easiest to debug
   - easiest cross-platform shape
   - close to the current Luca authority/event model
2. **local IPC socket / named pipe**
   - slightly more private/native feeling
   - more platform-specific complexity
3. **stdio bridge**
   - workable, but less natural for multi-window async event routing

For V1 of the Tauri-native replacement, **WebSocket is the most practical choice**.

### Recommended feature shape
Create a new Luca feature:

- `features/tauri-window-manager.ts`

Its job should be to mirror the current `windowManager` API and state shape as much as possible.

That means it should preserve, or intentionally emulate:

- methods:
  - `listen()`
  - `stop()`
  - `spawn()`
  - `spawnTTY()`
  - `focus()`
  - `close()`
  - `navigate()`
  - `eval()`
  - `move()`
  - `resize()`
  - `setFrame()`
  - `spawnLayout()`
  - `spawnLayouts()`
  - `screengrab()`
  - `video()`
  - `wm*` tool methods
- events:
  - `listening`
  - `clientConnected` / equivalent backend-connected event
  - `windowAck`
  - `windowClosed`
  - `windowFocus`
  - `windowStateSync`
  - `hotkeyTrigger`
  - `terminalExited`
  - `error`
- state:
  - `listening`
  - `clientConnected`
  - `windowCount`
  - `windows`
  - `pendingOperations`
  - `lastError`
  - `mode` (or a compatible equivalent)

### Important simplification
The current `windowManager` has a broker/producer architecture because multiple Luca processes may compete for one Swift-native socket backend.[1]

Inside a Tauri desktop shell, that requirement changes.

If the Tauri app is the canonical native shell, then the replacement can simplify the internals:

- Tauri is the single native window authority
- Luca connects to Tauri as a client/backend consumer
- `tauri-window-manager` can emulate broker-like behavior for compatibility, but it probably does **not** need the exact same Unix-socket producer/broker complexity internally

So the goal is **API compatibility**, not necessarily **implementation identity**.

### Capability-by-capability mapping

#### 1. `spawn({ url, html, ... })`
Map this to Tauri-managed windows.

Tauri should be able to:
- create new webview windows
- load either:
  - a local/internal route for inline HTML rendering, or
  - an external/local URL
- apply frame/chrome options like:
  - width/height
  - x/y
  - always-on-top
  - decorations
  - transparency where supported

For inline HTML, the Tauri shell will likely need a small internal route or data-loading mechanism rather than a direct 1:1 equivalent of the Swift path.

#### 2. `spawnTTY()`
This is the hardest part of the migration.

The current system supports terminal windows that:
- run a command
- render ANSI output
- terminate the process when the window closes

Inside Tauri, this likely becomes:
- spawn PTY-backed process from Rust
- render terminal in a Tauri webview using a terminal frontend such as xterm.js
- forward resize/input/output events through Tauri
- emit `terminalExited` back to Luca

This is doable, but should be treated as a major subsystem, not a trivial port.

#### 3. `eval(windowId, code)`
For Tauri-managed webview windows, this should map to evaluating JS inside the target webview and returning a structured result.

This is important because the current voice overlay flow relies on lightweight imperative updates like:
- `setStatus('listening')`
- `setStatus('generating')`
- `setStatus('speaking')`
- `setVU(level)`

The replacement must preserve this capability.

#### 4. `focus`, `move`, `resize`, `setFrame`, `close`
These should map cleanly onto Tauri window APIs and should be preserved nearly exactly.

#### 5. `windowStateSync`
Tauri should maintain an authoritative registry of all app-managed windows and push state snapshots to Luca whenever:
- a window opens
- closes
- changes frame
- changes focus
- changes relevant metadata

This mirrors one of the most useful parts of the current feature.

#### 6. `hotkeyTrigger`
The current voice flow depends on hotkey-triggered assistant picker behavior.[1]

So the Tauri shell must own global or app-level hotkeys and forward them into Luca as events that `tauri-window-manager` re-emits as `hotkeyTrigger`.

#### 7. screenshots / video
These may require platform-specific implementation inside Tauri/Rust.

Recommendation:
- preserve `screengrab()` in V1 if feasible
- treat `video()` / recording as a V2 capability if it slows shipping too much

If needed, document a temporary compatibility matrix instead of pretending full parity exists immediately.

### Migration plan

#### Phase 1: compatibility feature
Create `tauri-window-manager` as a new Luca feature while leaving `windowManager` untouched.

- Tauri app exposes a backend window-control service
- `tauri-window-manager` connects to it
- implement the smallest full slice needed for current voice UX:
  - `spawn`
  - `eval`
  - `close`
  - `focus`
  - `setFrame`
  - `windowStateSync`
  - `hotkeyTrigger`
- update `voiceService` to use `tauri-window-manager` behind a config switch or feature alias

This gets the overlay and picker working in Tauri first.

#### Phase 2: parity for layouts and terminals
Add:
- `spawnTTY`
- `spawnLayout`
- `spawnLayouts`
- `move` / `resize`
- richer state sync
- terminal lifecycle events

#### Phase 3: retire Swift launcher
Once parity is proven for the required use cases:
- remove `LucaVoiceLauncher` dependency
- deprecate socket-path assumptions in the old `windowManager`
- either:
  - rename `tauri-window-manager` to become the canonical `windowManager`, or
  - keep `windowManager` as a facade that dispatches to either Swift or Tauri backend based on environment

### Recommended end state
The cleanest end state is probably:

- `windowManager` becomes the stable public Luca feature name
- its backend becomes environment-dependent
- in the Tauri desktop app, it uses the Tauri-native backend
- outside Tauri, it may still use the legacy launcher backend until that path is fully removed

That minimizes churn in the rest of the Luca codebase.

### Product implication
If this is the goal, then the shipping report’s V1 recommendation changes slightly:

- Tauri is still the shell
- Luca is still the engine
- but **Tauri must also become the native window authority**
- and `tauri-window-manager` becomes a required migration layer, not an optional future enhancement

This is still a good plan. It is just a bigger V1 than “ship Tauri around the existing launcher.”

## Risks and open questions
1. **Workspace model**: Luca is cwd-sensitive, so the desktop app needs a clear V1 rule for which workspace/project context it owns.[1]
2. **Terminal emulation scope**: `spawnTTY()` parity inside Tauri is likely the hardest part of replacing the Swift launcher.
3. **Window eval model**: define a reliable, secure equivalent for `eval(windowId, code)` in Tauri-managed windows.
4. **Hotkey implementation**: the assistant-picker flow depends on reliable hotkey forwarding from the shell into Luca.[1]
5. **PATH management UX**: user education and repair flows matter more than aggressive automatic shell mutation.
6. **Multi-platform release pipeline**: Luca must be produced for every target triple Tauri expects.[3][5]
7. **Readiness detection**: define a robust “Luca is ready” check using process output, registry state, and/or authority WebSocket availability.

## Final recommendation
Use Tauri to ship Luca as a bundled sidecar runtime and desktop shell, but do not architect the app as if Luca were only a dumb subprocess.

The best design is:
- **Tauri as the native shell**
- **Luca as the authority runtime/engine**
- **WebSocket as the primary steady-state control protocol**
- **optional PATH installation of the same Luca binary for terminal use**
- **signed app updates that refresh the bundled Luca together with the app**

That is both technically supported by Tauri and aligned with how Luca already works.[1][3][4][5][7][8]
