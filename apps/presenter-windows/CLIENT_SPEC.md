# LucaVoiceLauncher Client Spec (Bun Server)

This document defines how the Bun process should talk to the macOS launcher app.

## 1. Transport

- Protocol: Unix domain sockets (`AF_UNIX`, `SOCK_STREAM`)
- Message framing: NDJSON (one JSON object per line, `\n` terminated)
- Command channel socket path:
  - `~/Library/Application Support/LucaVoiceLauncher/ipc-command.sock`
- Window channel socket path:
  - `~/Library/Application Support/LucaVoiceLauncher/ipc-window.sock`
- No `/tmp` fallback is used; socket setup fails fast if these paths are unavailable

## 2. Direction

- App is the client.
- Bun is the server.
- App writes command events to Bun.
- Bun writes status/result messages back on the same connection.

## 3. Correlation

Every Bun response **must include** the same `id` received from the app command event.

## 4. App -> Bun command event

Example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "type": "command",
  "payload": {
    "text": "open notes",
    "transcript": "open notes",
    "source": "voice",
    "user": {
      "uid": 501,
      "username": "jon"
    },
    "timestamp": "2026-02-20T05:07:12Z",
    "meta": {
      "hotkey": "Cmd+Space"
    }
  },
  "status": "queued"
}
```

## 5. Bun -> App response schema

Base fields:

- `id` (string UUID, required)
- `status` (string, required): one of `processing`, `progress`, `finished`

Optional common fields:

- `timestamp` (ISO-8601 string)
- `worker` (string)
- `pid` (number)
- `message` (string)

### 5.1 Processing acknowledgement

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "worker": "bun-1234",
  "timestamp": "2026-02-20T05:07:13Z"
}
```

### 5.2 Progress update (optional)

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "progress",
  "progress": 0.42,
  "message": "Looking up app",
  "timestamp": "2026-02-20T05:07:13Z"
}
```

### 5.3 Finished success

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "finished",
  "success": true,
  "result": {
    "action": "open",
    "target": "/Applications/Notes.app"
  },
  "timestamp": "2026-02-20T05:07:15Z"
}
```

### 5.4 Finished failure

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "finished",
  "success": false,
  "error": "app-not-found: notes",
  "timestamp": "2026-02-20T05:07:15Z"
}
```

## 6. Spoken-response extension (implemented)

The macOS app now supports optional speech text in Bun responses.

If Bun includes either of these fields, the app will speak the phrase using macOS TTS:

- `speech` (preferred)
- `speak` (alias)

This can be sent with `processing`, `progress`, or `finished`.

Example (ack + speech):

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "worker": "bun-1234",
  "speech": "Working on it"
}
```

Example (finished + speech):

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "finished",
  "success": true,
  "result": {
    "action": "open",
    "target": "/Applications/Notes.app"
  },
  "speech": "Done. Opened Notes."
}
```

Backward-compatible fallback:

- If needed, app also checks `result.speech` and `result.speak`.

## 7. Window-dispatch extension (implemented)

The app now supports optional window commands in Bun responses on the same IPC connection.

Top-level field:

- `window` (object, optional)

Supported `window.action` values:

- `open` / `spawn`
- `terminal`
- `focus`
- `close`
- `navigate`
- `eval`
- `screengrab` / `screenshot` / `capture`
- `video` / `record`

`open`/`spawn` accepts either `request` or flat fields.

`terminal` spawns a read-only PTY-backed command window.

- Required: `command` (string)
- Optional: `args` (string array), `cwd` (string), `env` (object), `cols` (int), `rows` (int)
- Optional window fields follow the same shape as `open` (`title`, `width`, `height`, `x`, `y`, `window`)

Example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "window": {
    "action": "open",
    "url": "https://example.com",
    "width": 1024,
    "height": 768,
    "x": 180,
    "y": 140,
    "alwaysOnTop": false
  }
}
```

Or nested:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "window": {
    "action": "open",
    "request": {
      "url": "https://example.com",
      "width": 1024,
      "height": 768,
      "window": {
        "decorations": "hiddenTitleBar",
        "alwaysOnTop": true
      }
    }
  }
}
```

For `focus` or `close`, provide optional `windowId` (UUID string). If omitted, app uses most-recent window.

`navigate` requires `url` plus optional `windowId`.

Example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "window": {
    "action": "navigate",
    "windowId": "74D5A3C6-26D0-4E60-84AA-17E0AC46D219",
    "url": "https://news.ycombinator.com"
  }
}
```

`eval` requires `code` plus optional `windowId`.

- `timeoutMs` (optional, default `5000`, minimum effective `100`)
- `returnJson` (optional, default `true`)

Example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "window": {
    "action": "eval",
    "windowId": "74D5A3C6-26D0-4E60-84AA-17E0AC46D219",
    "code": "({ title: document.title, href: location.href })",
    "timeoutMs": 3000,
    "returnJson": true
  }
}
```

## 8. App -> Bun window state sync (implemented)

Because the macOS app is long-lived and Bun worker processes may reconnect often, the app now emits a full window snapshot whenever the IPC connection is established.

This lets a newly started Bun process immediately learn what browser and terminal windows the Swift app is already managing before it receives incremental lifecycle events.

Message shape:

```json
{
  "type": "windowStateSync",
  "timestamp": "2026-04-02T16:22:31Z",
  "windows": [
    {
      "windowId": "74D5A3C6-26D0-4E60-84AA-17E0AC46D219",
      "kind": "browser",
      "title": "Example Domain",
      "frame": {
        "x": 180,
        "y": 140,
        "width": 1024,
        "height": 768
      },
      "focused": true,
      "url": "https://example.com",
      "command": null,
      "pid": null
    },
    {
      "windowId": "E05D4490-C1B8-4AB1-A07B-93A471F0E433",
      "kind": "terminal",
      "title": "Build Logs",
      "frame": {
        "x": 220,
        "y": 220,
        "width": 920,
        "height": 640
      },
      "focused": false,
      "url": null,
      "command": "swift test --parallel",
      "pid": 4242
    }
  ]
}
```

Notes:

- `windows` may be empty if the app currently manages no windows.
- Browser entries populate `url`.
- Terminal entries populate `command` and usually `pid`.
- Existing incremental messages like `windowClosed`, `windowFocus`, and `terminalExited` still continue after the initial sync.

## 9. Bun -> App window state refresh request (implemented)

Bun can force the macOS app to emit a fresh `windowStateSync` snapshot at any time.

Top-level field:

- `windowStateRefresh` (boolean, optional)

Example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "windowStateRefresh": true,
  "timestamp": "2026-04-02T16:24:00Z"
}
```

Behavior:

- The app does not send a `windowAck` for this message.
- Instead, it responds by emitting a fresh `windowStateSync`.

`screengrab` writes a PNG image of the target window.

- Required: `path` (string, output file path)
- Optional: `windowId` (UUID string). If omitted, app uses most-recent window.

Example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "window": {
    "action": "screengrab",
    "windowId": "74D5A3C6-26D0-4E60-84AA-17E0AC46D219",
    "path": "~/Desktop/window.png"
  }
}
```

`video` records the target window to a movie file using macOS capture APIs.

- Required: `path` (string, output file path)
- Optional: `windowId` (UUID string). If omitted, app uses most-recent window.
- Optional: `durationMs` (int, default `10000`, minimum effective `500`)

Example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "window": {
    "action": "video",
    "path": "~/Desktop/window.mov",
    "durationMs": 3000
  }
}
```

Terminal example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "status": "processing",
  "window": {
    "action": "terminal",
    "title": "Build Logs",
    "command": "swift",
    "args": ["test", "--parallel"],
    "cwd": "/Users/jon/@soederpop/apps/command-launcher",
    "env": {
      "TERM": "xterm-256color"
    },
    "cols": 160,
    "rows": 50,
    "width": 1200,
    "height": 800
  }
}
```

### 7.1 Window Ack (app -> Bun)

After each window command, app sends an acknowledgement on the same socket:

- `type`: `"windowAck"`
- `id`: original request id
- `status`: `"finished"`
- `success`: boolean
- `action`: window action
- `result`: object when `success=true`
- `error`: string when `success=false`
- `timestamp`: ISO-8601

Success example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "type": "windowAck",
  "status": "finished",
  "success": true,
  "action": "eval",
  "result": {
    "ok": true,
    "windowId": "74D5A3C6-26D0-4E60-84AA-17E0AC46D219",
    "value": "{\"title\":\"Hacker News\",\"href\":\"https://news.ycombinator.com/\"}",
    "json": {
      "title": "Hacker News",
      "href": "https://news.ycombinator.com/"
    }
  },
  "timestamp": "2026-02-20T05:07:15Z"
}
```

Failure example:

```json
{
  "id": "0f93ea18-2d5b-418f-93dd-04a42fcb95fc",
  "type": "windowAck",
  "status": "finished",
  "success": false,
  "action": "navigate",
  "error": "no target window",
  "timestamp": "2026-02-20T05:07:15Z"
}
```

### 7.2 Window lifecycle events (app -> Bun)

The app may also emit asynchronous lifecycle events on the window socket.
These are not correlated to a specific request id.

`windowClosed`:

- `type`: `"windowClosed"`
- `windowId`: closed window UUID
- `kind`: `"browser"` or `"terminal"`
- `timestamp`: ISO-8601

Example:

```json
{
  "type": "windowClosed",
  "windowId": "74D5A3C6-26D0-4E60-84AA-17E0AC46D219",
  "kind": "terminal",
  "timestamp": "2026-03-04T07:50:12Z"
}
```

`terminalExited`:

- `type`: `"terminalExited"`
- `windowId`: terminal window UUID
- `pid`: process id (optional)
- `exitCode`: integer termination status
- `timestamp`: ISO-8601

Example:

```json
{
  "type": "terminalExited",
  "windowId": "74D5A3C6-26D0-4E60-84AA-17E0AC46D219",
  "pid": 28471,
  "exitCode": 0,
  "timestamp": "2026-03-04T07:50:10Z"
}
```

## 8. Timing expectations

- Send `processing` quickly after command receipt (target: near-immediate).
- Send `finished` exactly once per command id.
- App marks commands stalled if no processing response is received within configured timeout (default 30s).

## 9. Error handling

- Unknown fields are ignored by app.
- Malformed JSON line is ignored by app; next lines continue parsing.
- Missing `id` prevents correlation and should be treated as protocol error on Bun side.
