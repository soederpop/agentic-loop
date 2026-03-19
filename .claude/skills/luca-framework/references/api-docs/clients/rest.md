# RestClient (clients.rest)

HTTP REST client built on top of axios. Provides convenience methods for GET, POST, PUT, PATCH, and DELETE requests with automatic JSON handling, configurable base URL, and error event emission.

## Usage

```ts
container.client('rest', {
  // Base URL for the client connection
  baseURL,
  // Whether to automatically parse responses as JSON
  json,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `baseURL` | `string` | Base URL for the client connection |
| `json` | `boolean` | Whether to automatically parse responses as JSON |

## Methods

### beforeRequest

**Returns:** `void`



### patch

Send a PATCH request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | Request path relative to baseURL |
| `data` | `any` |  | Request body |
| `options` | `AxiosRequestConfig` |  | Additional axios request config |

**Returns:** `void`



### put

Send a PUT request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | Request path relative to baseURL |
| `data` | `any` |  | Request body |
| `options` | `AxiosRequestConfig` |  | Additional axios request config |

**Returns:** `void`



### post

Send a POST request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | Request path relative to baseURL |
| `data` | `any` |  | Request body |
| `options` | `AxiosRequestConfig` |  | Additional axios request config |

**Returns:** `void`



### delete

Send a DELETE request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | Request path relative to baseURL |
| `params` | `any` |  | Query parameters |
| `options` | `AxiosRequestConfig` |  | Additional axios request config |

**Returns:** `void`



### get

Send a GET request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | Request path relative to baseURL |
| `params` | `any` |  | Query parameters |
| `options` | `AxiosRequestConfig` |  | Additional axios request config |

**Returns:** `void`



### handleError

Handle an axios error by emitting 'failure' and returning the error as JSON.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `error` | `AxiosError` | ✓ | Parameter error |

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `useJSON` | `any` | Whether JSON content-type headers should be set automatically. |
| `baseURL` | `any` |  |

## Events (Zod v4 schema)

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

## Examples

**clients.rest**

```ts
const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
const users = await api.get('/users')
await api.post('/users', { name: 'Alice' })
```

