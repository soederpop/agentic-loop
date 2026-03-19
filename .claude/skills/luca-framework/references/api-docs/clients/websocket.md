# WebSocketClient (clients.websocket)

WebSocket client that bridges raw WebSocket events to Luca's Helper event bus, providing a clean interface for sending/receiving messages, tracking connection state, and optional auto-reconnection with exponential backoff. Events emitted: - `open` — connection established - `message` — message received (JSON-parsed when possible) - `close` — connection closed (with code and reason) - `error` — connection error - `reconnecting` — attempting reconnection (with attempt number)

## Usage

```ts
container.client('websocket', {
  // Base URL for the client connection
  baseURL,
  // Whether to automatically parse responses as JSON
  json,
  // Whether to automatically reconnect on disconnection
  reconnect,
  // Base interval in milliseconds between reconnection attempts
  reconnectInterval,
  // Maximum number of reconnection attempts before giving up
  maxReconnectAttempts,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `baseURL` | `string` | Base URL for the client connection |
| `json` | `boolean` | Whether to automatically parse responses as JSON |
| `reconnect` | `boolean` | Whether to automatically reconnect on disconnection |
| `reconnectInterval` | `number` | Base interval in milliseconds between reconnection attempts |
| `maxReconnectAttempts` | `number` | Maximum number of reconnection attempts before giving up |

## Methods

### connect

Establish a WebSocket connection to the configured baseURL. Wires all raw WebSocket events (open, message, close, error) to the Helper event bus and updates connection state accordingly. Resolves once the connection is open; rejects on error.

**Returns:** `Promise<this>`



### send

Send data over the WebSocket connection. Automatically JSON-serializes the payload. If not currently connected, attempts to connect first.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `any` | ✓ | The data to send (will be JSON.stringify'd) |

**Returns:** `Promise<void>`



### disconnect

Gracefully close the WebSocket connection. Suppresses auto-reconnect and updates connection state to disconnected.

**Returns:** `Promise<this>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `hasError` | `any` | Whether the client is in an error state. |

## Events (Zod v4 schema)

### open

Emitted when the WebSocket connection is established



### error

Emitted when a WebSocket error occurs

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error |



### message

Emitted when a message is received

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The parsed message data |



### close

Emitted when the WebSocket connection is closed

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `number` | Close code |
| `arg1` | `string` | Close reason |



### reconnecting

Emitted when attempting to reconnect

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `number` | Attempt number |



### failure

Emitted when a request fails

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error object |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `connected` | `boolean` | Whether the client is currently connected |
| `connectionError` | `any` | The last connection error, if any |
| `reconnectAttempts` | `number` | Number of reconnection attempts made |

## Examples

**clients.websocket**

```ts
const ws = container.client('websocket', {
 baseURL: 'ws://localhost:8080',
 reconnect: true,
 maxReconnectAttempts: 5
})
ws.on('message', (data) => console.log('Received:', data))
await ws.connect()
await ws.send({ type: 'hello' })
```

