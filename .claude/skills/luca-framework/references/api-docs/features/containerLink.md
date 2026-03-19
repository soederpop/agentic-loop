# ContainerLink (features.containerLink)

ContainerLink (Node-side) — WebSocket host for remote web containers. Creates a WebSocket server that web containers connect to. The host can evaluate code in connected web containers and receive structured events back. Trust is strictly one-way: the node side can eval in web containers, but web containers can NEVER eval in the node container.

## Usage

```ts
container.feature('containerLink', {
  // Port for the WebSocket server
  port,
  // Interval in ms between heartbeat pings
  heartbeatInterval,
  // Max missed pongs before disconnecting a client
  maxMissedHeartbeats,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `port` | `number` | Port for the WebSocket server |
| `heartbeatInterval` | `number` | Interval in ms between heartbeat pings |
| `maxMissedHeartbeats` | `number` | Max missed pongs before disconnecting a client |

## Methods

### start

Start the WebSocket server and begin accepting connections.

**Returns:** `Promise<this>`



### stop

Stop the WebSocket server and disconnect all clients.

**Returns:** `Promise<this>`



### eval

Evaluate code in a specific connected web container.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `containerId` | `string` | ✓ | UUID of the target web container |
| `code` | `string` | ✓ | JavaScript code to evaluate |
| `context` | `Record<string, any>` |  | Optional context variables to inject |
| `timeout` | `any` |  | Timeout in ms (default 10000) |

**Returns:** `Promise<T>`



### broadcast

Evaluate code in all connected web containers.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | JavaScript code to evaluate |
| `context` | `Record<string, any>` |  | Optional context variables to inject |
| `timeout` | `any` |  | Timeout in ms (default 10000) |

**Returns:** `Promise<Map<string, T | Error>>`



### getConnections

Get metadata of all connected containers.

**Returns:** `Array<Omit<ConnectedContainer, 'ws' | 'token'>>`



### disconnect

Disconnect a specific web container.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `containerId` | `string` | ✓ | UUID of the container to disconnect |
| `reason` | `string` |  | Optional reason string |

**Returns:** `void`



### generateToken

Generate a cryptographically random token for connection auth.

**Returns:** `string`



### sendTo

Send a message to a specific connected container by UUID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `containerId` | `string` | ✓ | UUID of the target container |
| `msg` | `LinkMessage` | ✓ | The message to send |

`LinkMessage` properties:

| Property | Type | Description |
|----------|------|-------------|
| `type` | `MessageType` |  |
| `id` | `string` |  |
| `timestamp` | `number` |  |
| `token` | `string` |  |
| `data` | `T` |  |

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `isListening` | `boolean` | Whether the WebSocket server is currently listening. |
| `connectionCount` | `number` | Number of currently connected web containers. |

## Events (Zod v4 schema)

### disconnection

Emitted when a web container disconnects

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Container UUID |
| `arg1` | `string` | Reason |



### error

Event emitted by ContainerLink



### connection

Emitted when a web container connects and registers

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Container UUID |
| `arg1` | `any` | Connection metadata |



### evalResult

Emitted when an eval result is received

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Request ID |
| `arg1` | `any` | Result or error |



### event

Emitted when a web container sends a structured event

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Container UUID |
| `arg1` | `string` | Event name |
| `arg2` | `any` | Event data |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `connectionCount` | `number` | Number of currently connected web containers |
| `port` | `number` | Port the WebSocket server is listening on |
| `listening` | `boolean` | Whether the WebSocket server is listening |

## Examples

**features.containerLink**

```ts
const link = container.feature('containerLink', { enable: true, port: 8089 })
await link.start()

// When a web container connects:
link.on('connection', (uuid, meta) => {
 console.log('Connected:', uuid)
})

// Eval code in a specific web container
const result = await link.eval(uuid, 'document.title')

// Broadcast eval to all connected containers
const results = await link.broadcast('navigator.userAgent')

// Listen for events from web containers
link.on('event', (uuid, eventName, data) => {
 console.log(`Event from ${uuid}: ${eventName}`, data)
})
```

