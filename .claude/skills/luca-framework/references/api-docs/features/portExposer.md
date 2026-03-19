# PortExposer (portExposer)

Port Exposer Feature Exposes local HTTP services via ngrok with SSL-enabled public URLs. Perfect for development, testing, and sharing local services securely. Features: - SSL-enabled public URLs for local services - Custom subdomains and domains (with paid plans) - Authentication options (basic auth, OAuth) - Regional endpoint selection - Connection state management

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `port` | `number` | Local port to expose |
| `authToken` | `string` | Ngrok auth token for premium features |
| `region` | `string` | Preferred ngrok region (us, eu, ap, au, sa, jp, in) |
| `subdomain` | `string` | Custom subdomain (requires paid plan) |
| `domain` | `string` | Domain to use (requires paid plan) |
| `basicAuth` | `string` | Basic auth credentials for the tunnel |
| `oauth` | `string` | OAuth provider for authentication |
| `config` | `any` | Additional ngrok configuration |

## Methods

### expose

Expose the local port via ngrok. Creates an ngrok tunnel to the specified local port and returns the SSL-enabled public URL. Emits `exposed` on success or `error` on failure.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `port` | `number` |  | Optional port override; falls back to `options.port` |

**Returns:** `Promise<string>`

```ts
const exposer = container.feature('portExposer', { port: 3000 })
const url = await exposer.expose()
console.log(`Public URL: ${url}`)

// Override port at call time
const url2 = await exposer.expose(8080)
```



### close

Stop exposing the port and close the ngrok tunnel. Tears down the ngrok listener, resets connection state, and emits `closed`. Safe to call when no tunnel is active (no-op).

**Returns:** `Promise<void>`

```ts
const exposer = container.feature('portExposer', { port: 3000 })
await exposer.expose()
// ... later
await exposer.close()
console.log(exposer.isConnected()) // false
```



### getPublicUrl

Get the current public URL if connected. Returns the live URL from the ngrok listener, or `undefined` if no tunnel is active.

**Returns:** `string | undefined`

```ts
const exposer = container.feature('portExposer', { port: 3000 })
await exposer.expose()
console.log(exposer.getPublicUrl()) // 'https://abc123.ngrok.io'
```



### isConnected

Check if the ngrok tunnel is currently connected.

**Returns:** `boolean`

```ts
const exposer = container.feature('portExposer', { port: 3000 })
console.log(exposer.isConnected()) // false
await exposer.expose()
console.log(exposer.isConnected()) // true
```



### getConnectionInfo

Get a snapshot of the current connection information. Returns an object with the tunnel's connected status, public URL, local port, connection timestamp, and session metadata.

**Returns:** `void`

```ts
const exposer = container.feature('portExposer', { port: 3000 })
await exposer.expose()
const info = exposer.getConnectionInfo()
console.log(info.publicUrl, info.localPort, info.connectedAt)
```



### reconnect

Close the existing tunnel and re-expose with optionally updated options. Calls `close()` first, merges any new options, then calls `expose()`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `newOptions` | `Partial<PortExposerOptions>` |  | Optional partial options to merge before reconnecting |

**Returns:** `Promise<string>`

```ts
const exposer = container.feature('portExposer', { port: 3000 })
await exposer.expose()
// Switch to a different port
const newUrl = await exposer.reconnect({ port: 8080 })
```



### disable

Disable the feature, ensuring the ngrok tunnel is closed first. Overrides the base `disable()` to guarantee that the tunnel is torn down before the feature is marked as disabled.

**Returns:** `Promise<this>`

```ts
const exposer = container.feature('portExposer', { port: 3000 })
await exposer.expose()
await exposer.disable()
```



## Events (Zod v4 schema)

### exposed

When a local port is successfully exposed via ngrok

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `publicUrl` | `string` | The public ngrok URL |
| `localPort` | `number` | The local port being exposed |



### error

When an ngrok operation fails

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error object |



### closed

When the ngrok tunnel is closed



## Examples

**portExposer**

```ts
// Basic usage
const exposer = container.feature('portExposer', { port: 3000 })
const url = await exposer.expose()
console.log(`Service available at: ${url}`)

// With custom subdomain
const exposer = container.feature('portExposer', {
 port: 8080,
 subdomain: 'my-app',
 authToken: 'your-ngrok-token'
})
```



**expose**

```ts
const exposer = container.feature('portExposer', { port: 3000 })
const url = await exposer.expose()
console.log(`Public URL: ${url}`)

// Override port at call time
const url2 = await exposer.expose(8080)
```



**close**

```ts
const exposer = container.feature('portExposer', { port: 3000 })
await exposer.expose()
// ... later
await exposer.close()
console.log(exposer.isConnected()) // false
```



**getPublicUrl**

```ts
const exposer = container.feature('portExposer', { port: 3000 })
await exposer.expose()
console.log(exposer.getPublicUrl()) // 'https://abc123.ngrok.io'
```



**isConnected**

```ts
const exposer = container.feature('portExposer', { port: 3000 })
console.log(exposer.isConnected()) // false
await exposer.expose()
console.log(exposer.isConnected()) // true
```



**getConnectionInfo**

```ts
const exposer = container.feature('portExposer', { port: 3000 })
await exposer.expose()
const info = exposer.getConnectionInfo()
console.log(info.publicUrl, info.localPort, info.connectedAt)
```



**reconnect**

```ts
const exposer = container.feature('portExposer', { port: 3000 })
await exposer.expose()
// Switch to a different port
const newUrl = await exposer.reconnect({ port: 8080 })
```



**disable**

```ts
const exposer = container.feature('portExposer', { port: 3000 })
await exposer.expose()
await exposer.disable()
```

