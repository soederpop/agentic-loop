# WebsocketServer (servers.websocket)

WebSocket server built on the `ws` library with optional JSON message framing. Manages WebSocket connections, tracks connected clients, and bridges messages to Luca's event bus. When `json` mode is enabled, incoming messages are automatically JSON-parsed (with `.toString()` for Buffer data) and outgoing messages via `send()` / `broadcast()` are JSON-stringified. When `json` mode is disabled, raw message data is emitted as-is and `send()` / `broadcast()` still JSON-stringify for safety.

## Usage

```ts
container.server('websocket', {
  // Port number to listen on
  port,
  // Hostname or IP address to bind to
  host,
  // When enabled, incoming messages are automatically JSON-parsed before emitting the message event, and outgoing send/broadcast calls JSON-stringify the payload
  json,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `port` | `number` | Port number to listen on |
| `host` | `string` | Hostname or IP address to bind to |
| `json` | `boolean` | When enabled, incoming messages are automatically JSON-parsed before emitting the message event, and outgoing send/broadcast calls JSON-stringify the payload |

## Methods

### broadcast

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `any` | ✓ | Parameter message |

**Returns:** `void`



### send

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ws` | `any` | ✓ | Parameter ws |
| `message` | `any` | ✓ | Parameter message |

**Returns:** `void`



### start

Start the WebSocket server. A runtime `port` overrides the constructor option and is written to state before the underlying `ws.Server` is created, so the server binds to the correct port.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `StartOptions` |  | Optional runtime overrides for port and host |

**Returns:** `void`



### stop

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `wss` | `any` |  |
| `port` | `any` | The port this server will bind to. Defaults to 8081 if not set via constructor options or start(). |

## Events (Zod v4 schema)

### connection

Fires when a new client connects

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The raw WebSocket client instance from the ws library |



### message

Fires when a message is received from a client. Handler signature: (data, ws)

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The message data (JSON-parsed object when json option is enabled, raw Buffer/string otherwise) |
| `arg1` | `any` | The WebSocket client that sent the message — use with server.send(ws, data) to reply |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `port` | `number` | The port the server is bound to |
| `listening` | `boolean` | Whether the server is actively listening for connections |
| `configured` | `boolean` | Whether the server has been configured |
| `stopped` | `boolean` | Whether the server has been stopped |

## Examples

**servers.websocket**

```ts
const ws = container.server('websocket', { json: true })
await ws.start({ port: 8080 })

ws.on('message', (data, client) => {
 console.log('Received:', data)
 ws.broadcast({ echo: data })
})
```

