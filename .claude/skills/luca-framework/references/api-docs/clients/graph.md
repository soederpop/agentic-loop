# GraphClient (clients.graph)

GraphQL client that wraps RestClient with convenience methods for executing queries and mutations. Automatically handles the GraphQL request envelope (query/variables/operationName) and unwraps responses, extracting the `data` field and emitting events for GraphQL-level errors.

## Usage

```ts
container.client('graph', {
  // Base URL for the client connection
  baseURL,
  // Whether to automatically parse responses as JSON
  json,
  // The GraphQL endpoint path, defaults to /graphql
  endpoint,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `baseURL` | `string` | Base URL for the client connection |
| `json` | `boolean` | Whether to automatically parse responses as JSON |
| `endpoint` | `string` | The GraphQL endpoint path, defaults to /graphql |

## Methods

### query

Execute a GraphQL query and return the unwrapped data.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | ✓ | The GraphQL query string |
| `variables` | `Record<string, any>` |  | Optional variables for the query |
| `operationName` | `string` |  | Optional operation name when the query contains multiple operations |

**Returns:** `Promise<R>`



### mutate

Execute a GraphQL mutation and return the unwrapped data. Semantically identical to query() but named for clarity when performing mutations.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `mutation` | `string` | ✓ | The GraphQL mutation string |
| `variables` | `Record<string, any>` |  | Optional variables for the mutation |
| `operationName` | `string` |  | Optional operation name when the mutation contains multiple operations |

**Returns:** `Promise<R>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `endpoint` | `any` | The GraphQL endpoint path. Defaults to '/graphql'. |

## Events (Zod v4 schema)

### graphqlError

Emitted when GraphQL-level errors are present in the response

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `array` | Array of GraphQL errors |



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

**clients.graph**

```ts
const gql = container.client('graph', { baseURL: 'https://api.example.com' })
const data = await gql.query(`{ users { id name } }`)
await gql.mutate(`mutation($name: String!) { createUser(name: $name) { id } }`, { name: 'Alice' })
```

