# WindowManager (features.windowManager)

WindowManager Feature — Native window control via LucaVoiceLauncher Acts as an IPC server that the native macOS launcher app connects to. Communicates over a Unix domain socket using NDJSON (newline-delimited JSON). **Protocol:** - Bun listens on a Unix domain socket; the native app connects as a client - Window dispatch commands are sent as NDJSON with a `window` field - The app executes window commands and sends back `windowAck` messages - Any non-windowAck message from the app is emitted as a `message` event - Other features can use `send()` to write arbitrary NDJSON to the app **Capabilities:** - Spawn native browser windows with configurable chrome - Navigate, focus, close, and eval JavaScript in windows - Automatic socket file cleanup and fallback paths

## Usage

```ts
container.feature('windowManager', {
  // Path to the Unix domain socket the server listens on
  socketPath,
  // Automatically start listening when the feature is enabled
  autoListen,
  // Per-request timeout in milliseconds for window operations
  requestTimeoutMs,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `socketPath` | `string` | Path to the Unix domain socket the server listens on |
| `autoListen` | `boolean` | Automatically start listening when the feature is enabled |
| `requestTimeoutMs` | `number` | Per-request timeout in milliseconds for window operations |

## Methods

### enable

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `any` |  | Parameter options |

**Returns:** `Promise<this>`



### listen

Start listening on the Unix domain socket for the native app to connect. Fire-and-forget — binds the socket and returns immediately. Sits quietly until the native app connects; does nothing visible if it never does.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `socketPath` | `string` |  | Override the configured socket path |

**Returns:** `this`



### stop

Stop the IPC server and clean up all connections. Rejects any pending window operation requests.

**Returns:** `Promise<this>`



### spawn

Spawn a new native browser window. Sends a window dispatch to the app and waits for the ack.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `opts` | `SpawnOptions` |  | Window configuration (url, dimensions, chrome options) |

`SpawnOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `url` | `string` |  |
| `width` | `DimensionValue` |  |
| `height` | `DimensionValue` |  |
| `x` | `DimensionValue` |  |
| `y` | `DimensionValue` |  |
| `alwaysOnTop` | `boolean` |  |
| `window` | `{
    decorations?: 'normal' | 'hiddenTitleBar' | 'none'
    transparent?: boolean
    shadow?: boolean
    alwaysOnTop?: boolean
    opacity?: number
    clickThrough?: boolean
  }` |  |

**Returns:** `Promise<WindowHandle>`



### spawnTTY

Spawn a native terminal window running a command. The terminal is read-only — stdout/stderr are rendered with ANSI support. Closing the window terminates the process.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `opts` | `SpawnTTYOptions` | ✓ | Terminal configuration (command, args, cwd, dimensions, etc.) |

`SpawnTTYOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `command` | `string` | Executable name or path (required). |
| `args` | `string[]` | Arguments passed after the command. |
| `cwd` | `string` | Working directory for the process. |
| `env` | `Record<string, string>` | Environment variable overrides. |
| `cols` | `number` | Initial terminal columns. |
| `rows` | `number` | Initial terminal rows. |
| `title` | `string` | Window title. |
| `width` | `DimensionValue` | Window width in points. |
| `height` | `DimensionValue` | Window height in points. |
| `x` | `DimensionValue` | Window x position. |
| `y` | `DimensionValue` | Window y position. |
| `window` | `SpawnOptions['window']` | Chrome options (decorations, alwaysOnTop, etc.) |

**Returns:** `Promise<WindowHandle>`



### focus

Bring a window to the front.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `windowId` | `string` |  | The window ID. If omitted, the app uses the most recent window. |

**Returns:** `Promise<WindowAckResult>`



### close

Close a window.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `windowId` | `string` |  | The window ID. If omitted, the app closes the most recent window. |

**Returns:** `Promise<WindowAckResult>`



### navigate

Navigate a window to a new URL.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `windowId` | `string` | ✓ | The window ID |
| `url` | `string` | ✓ | The URL to navigate to |

**Returns:** `Promise<WindowAckResult>`



### eval

Evaluate JavaScript in a window's web view.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `windowId` | `string` | ✓ | The window ID |
| `code` | `string` | ✓ | JavaScript code to evaluate |
| `opts` | `{ timeoutMs?: number; returnJson?: boolean }` |  | timeoutMs (default 5000), returnJson (default true) |

**Returns:** `Promise<WindowAckResult>`



### screengrab

Capture a PNG screenshot from a window.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `opts` | `WindowScreenGrabOptions` | ✓ | Window target and output path |

`WindowScreenGrabOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `windowId` | `string` | Window ID. If omitted, the launcher uses the most recent window. |
| `path` | `string` | Output file path for the PNG image. |

**Returns:** `Promise<WindowAckResult>`



### video

Record a video from a window to disk.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `opts` | `WindowVideoOptions` | ✓ | Window target, output path, and optional duration |

`WindowVideoOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `windowId` | `string` | Window ID. If omitted, the launcher uses the most recent window. |
| `path` | `string` | Output file path for the video file. |
| `durationMs` | `number` | Recording duration in milliseconds. |

**Returns:** `Promise<WindowAckResult>`



### window

Get a WindowHandle for chainable operations on a specific window. Returns the tracked handle if one exists, otherwise creates a new one.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `windowId` | `string` | ✓ | The window ID |

**Returns:** `WindowHandle`



### spawnLayout

Spawn multiple windows in parallel from a layout configuration. Returns handles in the same order as the config entries.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `config` | `LayoutEntry[]` | ✓ | Array of layout entries (window or tty) |

**Returns:** `Promise<WindowHandle[]>`

```ts
const handles = await wm.spawnLayout([
 { type: 'window', url: 'https://google.com', width: 800, height: 600 },
 { type: 'tty', command: 'htop' },
 { url: 'https://github.com' }, // defaults to window
])
```



### spawnLayouts

Spawn multiple layouts sequentially. Each layout's windows spawn in parallel, but the next layout waits for the previous one to fully complete.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `configs` | `LayoutEntry[][]` | ✓ | Array of layout configurations |

**Returns:** `Promise<WindowHandle[][]>`

```ts
const [firstBatch, secondBatch] = await wm.spawnLayouts([
 [{ url: 'https://google.com' }, { url: 'https://github.com' }],
 [{ type: 'tty', command: 'htop' }],
])
```



### send

Write an NDJSON message to the connected app client. Public so other features can send arbitrary protocol messages over the same socket.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `msg` | `Record<string, any>` | ✓ | The message object to send (will be JSON-serialized + newline) |

**Returns:** `boolean`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `isListening` | `boolean` | Whether the IPC server is currently listening. |
| `isClientConnected` | `boolean` | Whether the native app client is currently connected. |

## Events (Zod v4 schema)

### listening

Emitted when the IPC server starts listening



### clientConnected

Emitted when the native app connects

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The client socket |



### clientDisconnected

Emitted when the native app disconnects



### windowAck

Emitted when a window ack is received from the app

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The window ack payload |



### windowClosed

Emitted when the native app reports a window closed event

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | Window lifecycle payload emitted when a window closes |



### terminalExited

Emitted when the native app reports a terminal process exit event

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | Terminal lifecycle payload emitted when a terminal process exits |



### message

Emitted for any incoming message that is not a windowAck

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The parsed message object |



### error

Emitted on error

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `listening` | `boolean` | Whether the IPC server is listening |
| `clientConnected` | `boolean` | Whether the native launcher app is connected |
| `socketPath` | `string` | The socket path in use |
| `windowCount` | `number` | Number of tracked windows |
| `lastError` | `string` | Last error message |

## Examples

**features.windowManager**

```ts
const wm = container.feature('windowManager', { enable: true, autoListen: true })

const handle = await wm.spawn({ url: 'https://google.com', width: 800, height: 600 })
handle.on('close', (msg) => console.log('window closed'))
await handle.navigate('https://news.ycombinator.com')
const title = await handle.eval('document.title')
await handle.close()

// Other features can listen for non-window messages
wm.on('message', (msg) => console.log('App says:', msg))

// Other features can write raw NDJSON to the app
wm.send({ id: 'abc', status: 'processing', speech: 'Working on it' })
```



**spawnLayout**

```ts
const handles = await wm.spawnLayout([
 { type: 'window', url: 'https://google.com', width: 800, height: 600 },
 { type: 'tty', command: 'htop' },
 { url: 'https://github.com' }, // defaults to window
])
```



**spawnLayouts**

```ts
const [firstBatch, secondBatch] = await wm.spawnLayouts([
 [{ url: 'https://google.com' }, { url: 'https://github.com' }],
 [{ type: 'tty', command: 'htop' }],
])
```

