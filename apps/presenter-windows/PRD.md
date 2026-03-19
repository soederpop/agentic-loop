Product Requirements
1. Functional Requirements
1.1 App lifecycle & distribution

App must be a standard macOS .app bundle (macOS 12+ recommended).

Launchable from Finder, Dock, or as a background agent. Provide an installer or direct download (no App Store constraints).

Option to run at login (toggleable).

1.2 Global hotkey

User-configurable global hotkey to open/close the UI.

Default hotkey: ⌘ + Space (but allow override).

Implementation: use Carbon RegisterEventHotKey (for reliability unsandboxed) or an established HotKey library (e.g., HotKey by Sindre Sorhus) with fallback to NSApplication event monitor for when app is active.

1.3 Main UI (launcher dialog)

Minimal single-line / multi-line floating window:

Centered on screen by default (but should be multi-monitor aware).

Compact, translucent background, high-contrast text.

On open it becomes key window and accepts typing immediately.

Primary elements:

Text input field (single-line with history/auto-complete affordances).

Microphone icon / VU meter to indicate audio level & mic state.

Pending/queue indicator (small badge) that shows count or red error icon when stalls occur.

Optional small results area under input (for local actions or immediate results).

Behavior:

Window opens on hotkey; closes on ESC or clicking outside (configurable).

Submitting: Return/Enter sends current text to Bun via socket. Optionally allow ⌘Enter to send but keep simple: Enter = send.

When dialog is open, microphone is automatically live (streaming) by default, but this is toggleable in Settings.

1.4 Voice input / transcription

Use Apple Speech framework (SFSpeechRecognizer or Speech) for offline transcription.

Behavior:

When dialog opens and mic-auto-on is enabled, start audio capture and streaming transcription into the text input in real time.

Interim/transcribed text should appear as the text field contents (streaming).

Allow a microphone toggle (UI button) to mute/unmute during dialog.

Respect macOS microphone privacy flow: request permission at first use and present a clear explanation dialog if denied with a link to System Preferences.

Allow configuring mic-auto-on default (on/off) in Preferences.

1.5 IPC — Unix domain socket event protocol

The app writes JSON event objects to a Unix domain socket file that a Bun process listens to.

Socket type: Unix domain socket (AF_UNIX / SOCK_STREAM) located in:

~/Library/Application Support/<AppName>/ipc.sock

fallback /tmp/<appname>.<uid>.sock

Provide configurable socket path in Settings (default to Application Support path).

Message format: newline-delimited JSON (NDJSON) or length-prefixed JSON. Use NDJSON to keep simple.

Event lifecycle:

App: writes event { "id": "<uuid>", "type": "command", "payload": { "text": "...", "transcript": "...", "source": "typed|voice", "timestamp": "<ISO8601>" }, "status": "queued" } to socket.

Bun: reads event, responds on socket with acknowledgement: { "id": "<uuid>", "status": "processing", "pid": <bun_pid>, "timestamp": "<ISO8601>" }.

Bun: when done, sends { "id": "<uuid>", "status": "finished", "result": { ... }, "timestamp": "<ISO8601>", "success": true } or error: { "id":"...","status":"finished","success":false,"error":"..."}

Duplex: the socket is full-duplex. The app should open a client connection to the socket and listen for responses for events it has submitted. Alternatively, the app can create a listener for Bun connections and accept messages. We recommend the app act as a client writing to the server socket created by Bun; Bun is the server accepting client connections for commands and sending back callbacks.

Concurrency: multiple outstanding events are allowed. Each event tracked by id.

1.6 Pending / timeout UI

After sending an event, the launcher shows a small pending indicator (spinner/badge).

State model:

queued — app wrote event to socket but Bun has not acknowledged processing.

processing — Bun responded with processing status.

finished / success — Bun responded with finished+success; indicator removed.

finished / error — Bun responded with finished+error; show a transient error badge or toast with the error, allow user to clear.

stalled — after 30s without Bun marking processing, show red stalled icon with option to clear/abort.

Clearing: user can click the red icon to remove the event from UI queue. Clearing does not attempt to delete on Bun; it only clears local pending indicator. (Optional: send a cancel event if Bun supports it.)

Retry: if Bun becomes available later and processes still-present events, UI should reconcile state (described in reconnection section).

1.7 History / queue view

Minimal, simple history accessible from the dialog (e.g., ⇧ shows recent commands).

Show last N commands (configurable, default 50).

Each entry shows timestamp, text, and status (success, error, processing, stalled).

Allow re-submitting any history entry.

1.8 Settings

Global hotkey (editable).

Mic auto-on (default = true).

Socket path (editable).

Timeout duration (default 30s; editable).

History retention limit.

Run at login (toggle).

Microphone and privacy info.

2. Non-functional Requirements
2.1 Performance

UI must open within <100ms on hotkey press (target).

Transcription latency: streaming interim results appear as soon as SFSpeech provides them.

2.2 Reliability

App must handle Bun not running gracefully:

On send attempt, if socket connection fails, queue events locally and display an icon indicating Bun is offline.

Attempt auto-reconnect with exponential backoff.

If queued events are older than configurable retention, optionally purge.

2.3 Security & Privacy

Only request microphone permission when necessary. Explain offline transcription and local processing.

Socket file permissions: ensure socket is created with mode 0700 or user-only access. Configure default path in Application Support (user-owned) to avoid world-readable / writable sockets.

Be explicit in settings about what is sent over socket (plain text).

2.4 Compatibility

macOS 12+ (or specify minimum).

Architectures: Apple Silicon and Intel.

3. Architecture & Implementation Notes
3.1 Suggested Swift frameworks & libraries

UI: SwiftUI (modern), or AppKit if more control is needed for floating window. (SwiftUI + NSWindowRepresentable for floating window).

Concurrency: Combine or Swift Concurrency (async/await).

Audio capture & Speech:

AVAudioEngine for audio input

Speech framework (SFSpeechRecognizer, SFSpeechAudioBufferRecognitionRequest) for streaming transcription

IPC (Unix domain sockets):

POSIX sockets via Foundation/DispatchIO or a small socket wrapper; or use Network.framework if supported for unix domain sockets (but POSIX is safe/explicit).

Implement a small reconnecting client that uses a single connection and tags outgoing JSON with id.

Hotkey:

Carbon RegisterEventHotKey or HotKey library; must be implemented unsandboxed.

Persistence:

Use UserDefaults for small settings

Use a small SQLite/CoreData/Realm for history (or a JSON file in Application Support).

Logging: os_log for system logging.

3.2 Core components

LauncherWindowController / SwiftUI view: main UI.

SpeechManager: AVAudioEngine + Speech streaming, exposes Combine publishers with interim/final transcripts.

IPCClient: manages Unix domain socket, send JSON events, listen for server responses, reconnects, exponential backoff.

EventStore: tracks pending events, history, statuses; persists history.

SettingsManager: holds configurable parameters.

HotkeyManager: registers and maintains the global hotkey.

IconManager: manages menu bar icon (optional) and pending badge.

4. IPC Protocol (detailed)
4.1 Socket path (default)

Primary default: ~/Library/Application Support/<AppName>/ipc.sock

Fallback for temp usage: /tmp/<appname>.<uid>.sock

4.2 JSON event schemas
Sent by App → Bun
{
  "id": "uuid-v4",
  "type": "command",
  "payload": {
    "text": "open file /Users/you/Documents/todo.txt",
    "transcript": "open file users you documents todo dot text",
    "source": "typed",  // or "voice"
    "user": {
      "uid": 1000,
      "username": "jonathan"
    },
    "timestamp": "2026-02-19T14:32:00Z",
    "meta": { "hotkey": "Cmd+Space" }
  }
}
Acknowledgement from Bun → App (processing)
{
  "id": "uuid-v4",
  "status": "processing",
  "worker": "bun-1234",
  "timestamp": "2026-02-19T14:32:01Z"
}
Bun → App (finished)

Success:

{
  "id": "uuid-v4",
  "status": "finished",
  "success": true,
  "result": { "action": "open", "target": "/Applications/Notes.app" },
  "timestamp": "2026-02-19T14:32:05Z"
}

Failure:

{
  "id": "uuid-v4",
  "status": "finished",
  "success": false,
  "error": "file-not-found: /Users/you/Documents/todo.txt",
  "timestamp": "2026-02-19T14:32:05Z"
}
Optional: Bun can send an intermediate progress update
{ "id":"...", "status":"progress", "progress": 0.42, "message":"fetching" }
4.3 Connection & message boundaries

Use NDJSON: each JSON object terminated by \n.

App writes the event JSON then immediately waits (non-blocking) for responses tagged with same id.

The Bun server must accept multiple client connections (one per app instance) and be able to send back responses over the same connection.

5. Event lifecycle / State machine

States: created -> queued -> processing -> finished(success|error) OR stalled (if no processing after timeout)

created: event created locally

queued: written to socket

processing: bun acknowledged

finished: bun completed

stalled: no processing after timeout

Transitions:

created -> queued (on send)

queued -> processing (on Bun ack)

queued -> stalled (if no ack within 30s)

processing -> finished (on finished message)

stalled -> queued (if Bun picks it up later — reconcile logic)

stalled -> cleared (if user clears)

UI mapping:

queued: spinner

processing: animated progress or spinner with worker label

finished success: success animation or silent remove

finished error: toast with error message

stalled: red icon, click to clear

6. UX Details & Edge Cases
6.1 Microphone start/stop

Microphone starts on window open (if auto-on).

When mic is live, a small VU meter and mic icon (with pulse) should be shown.

User can mute toggle in UI; setting persisted.

6.2 Submit flow

On Enter:

If transcription is in progress, capture current transcript (final or interim) and send as payload.text.

Add event to EventStore and render spinner.

Attempt to send via IPCClient. If no connection, mark queued and show offline icon. Attempt reconnect.

6.3 When Bun is not running

Attempt to connect on app launch and on send; if fails:

Keep events queued locally.

Show a small indicator (e.g., a small gray dot or "Bun offline" toast).

Exponential backoff for reconnect: 1s, 2s, 4s, up to 60s.

If connected later, automatically send queued events in FIFO order.

6.4 Race conditions / duplicate handling

Use id UUIDs to deduplicate on Bun side.

If the app restarts, persist queued events locally so they can be resent.

6.5 Clearing stalled events

A user click on red/stalled icon: prompt "Clear stalled commands?" with Clear / Keep options.

Clearing removes local state only (unless API for cancellation exists).

6.6 Reconciliation on reconnection

On reconnect, Bun may have processed events that the app thought were stalled. Bun should provide final finished messages; the app should merge states by matching id.

7. Acceptance Criteria / Tests
7.1 Acceptance tests

Hotkey opens and closes the UI reliably.

When typing text and hitting Enter, a JSON event is written to socket path and UI shows queued state.

When Bun responds with processing, UI updates to processing state.

Bun finished success removes pending indicator.

If Bun does not acknowledge within 30s, UI shows red stalled icon and allows clearing.

If mic permission denied, the app shows a clear guide to enable mic permission in System Preferences and does not crash.

Streaming transcription appears in text field while speaking.

History shows last N commands and allows re-submit.

7.2 Unit / Integration tests

Unit tests for EventStore state transitions.

Integration tests for IPCClient with a mock Bun server (local test server) to validate message exchanges and reconnect behavior.

UI test for hotkey and window open/close.

Accessibility tests for keyboard navigation and VoiceOver basics.

8. Developer Handoff & Implementation Checklist
8.1 Code skeleton (suggested folders)
/AppName
  /Sources
    /App
      App.swift
      MainView.swift (SwiftUI)
    /Managers
      HotkeyManager.swift
      SettingsManager.swift
      SpeechManager.swift
      IPCClient.swift
      EventStore.swift
    /Models
      Event.swift
    /Views
      PendingIndicatorView.swift
      HistoryView.swift
    /Utils
      JSONHelpers.swift
      SocketHelpers.swift
  /Resources
    Assets.xcassets
  /Tests
    EventStoreTests.swift
    IPCClientTests.swift
8.2 Implementation milestones

Project scaffold + hotkey + floating window open/close.

Text input + Enter sending local Event object to EventStore.

Implement IPCClient (POSIX socket) and simple client-server mock test.

Implement SpeechManager streaming transcription into text field.

Handle event lifecycle UI + 30s stall behavior.

History, settings UI, persistence.

Polish: iconography, animations, privacy messaging, packaging.

9. Example sequences (illustrative)
Send typed command

User presses hotkey ➜ window opens.

User types open ~/Documents/todo.txt and presses Enter.

App creates event id=123, writes JSON to socket.

UI shows pending spinner.

Bun reads event and sends processing for id=123.

UI switches to processing label bun-1234.

Bun completes task and sends finished success.

UI removes spinner; history entry added with success.

Voice flow

Hotkey ➜ window opens, mic auto-starts.

User speaks "create new note meeting notes".

Interim transcript streams into text input.

User presses Enter; same as typed flow with source: "voice".

10. Notes for Bun implementer (what Bun must support)

Bun should create a server Unix domain socket at configured path and accept connections.

Bun should correctly parse NDJSON messages, respond with processing quickly on pickup, and later finished.

Bun should include id in responses to match events to apps.

11. Edge considerations & future extensions (non-blocking)

Add plugin architecture so different backends can register to handle commands.

Provide streaming reverse responses (e.g., streaming search results).

Add secure authentication on socket (e.g., handshake token).

Add a small optional HTTP server for richer integration (if not using sockets).

If you want, I can now:

Produce a complete Codex prompt that includes the PRD + exact TypeScript/Swift function signatures and example Swift code for IPCClient and SpeechManager to paste into Codex and have it generate code; or

Generate the first-iteration Swift skeleton (SwiftUI app + hotkey + speech streaming + socket client stub) ready to drop into Xcode.

Which would you prefer? (No need to answer if you want me to go straight to code — I'll pick the Swift skeleton and generate it.)
