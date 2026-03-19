# OpenAIClient (clients.openai)

OpenAI client — wraps the OpenAI SDK for chat completions, responses API, embeddings, and image generation. Provides convenience methods for common operations while tracking token usage and request counts. Supports both the Chat Completions API and the newer Responses API.

## Usage

```ts
container.client('openai', {
  // Base URL for the client connection
  baseURL,
  // Whether to automatically parse responses as JSON
  json,
  // OpenAI API key (falls back to OPENAI_API_KEY env var)
  apiKey,
  // OpenAI organization ID
  organization,
  // OpenAI project ID
  project,
  // Allow usage in browser environments
  dangerouslyAllowBrowser,
  // Default model for completions (default: gpt-4o)
  defaultModel,
  // Request timeout in milliseconds
  timeout,
  // Maximum number of retries on failure
  maxRetries,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `baseURL` | `string` | Base URL for the client connection |
| `json` | `boolean` | Whether to automatically parse responses as JSON |
| `apiKey` | `string` | OpenAI API key (falls back to OPENAI_API_KEY env var) |
| `organization` | `string` | OpenAI organization ID |
| `project` | `string` | OpenAI project ID |
| `dangerouslyAllowBrowser` | `boolean` | Allow usage in browser environments |
| `defaultModel` | `string` | Default model for completions (default: gpt-4o) |
| `timeout` | `number` | Request timeout in milliseconds |
| `maxRetries` | `number` | Maximum number of retries on failure |

## Methods

### connect

Test the API connection by listing models.

**Returns:** `Promise<this>`

```ts
await openai.connect()
```



### createChatCompletion

Create a chat completion using the Chat Completions API.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `messages` | `OpenAI.Chat.Completions.ChatCompletionMessageParam[]` | ✓ | Array of chat messages |
| `options` | `Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>` |  | Additional parameters for the completion |

**Returns:** `Promise<OpenAI.Chat.Completions.ChatCompletion>`

```ts
const response = await openai.createChatCompletion([
 { role: 'system', content: 'You are a helpful assistant.' },
 { role: 'user', content: 'Hello!' }
])
console.log(response.choices[0]?.message?.content)
```



### createResponse

Create a response using the Responses API.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `OpenAI.Responses.ResponseInput | string` | ✓ | The input prompt or message array |
| `options` | `Partial<OpenAI.Responses.ResponseCreateParamsNonStreaming>` |  | Additional parameters for the response |

**Returns:** `Promise<OpenAI.Responses.Response>`

```ts
const response = await openai.createResponse('Explain quantum computing')
```



### streamResponse

Stream a response using the Responses API.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `OpenAI.Responses.ResponseInput | string` | ✓ | The input prompt or message array |
| `options` | `Partial<OpenAI.Responses.ResponseCreateParamsStreaming>` |  | Additional parameters for the streaming response |

**Returns:** `Promise<AsyncIterable<OpenAI.Responses.ResponseStreamEvent>>`

```ts
const stream = await openai.streamResponse('Write a poem')
for await (const event of stream) {
 if (event.type === 'response.output_text.delta') {
   process.stdout.write(event.delta)
 }
}
```



### createCompletion

Create a legacy text completion.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | ✓ | The text prompt to complete |
| `options` | `Partial<OpenAI.Completions.CompletionCreateParams>` |  | Additional parameters for the completion |

**Returns:** `Promise<OpenAI.Completions.Completion>`

```ts
const response = await openai.createCompletion('Once upon a time')
```



### createEmbedding

Create text embeddings for semantic search or similarity comparisons.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `input` | `string | string[]` | ✓ | A string or array of strings to embed |
| `options` | `Partial<OpenAI.Embeddings.EmbeddingCreateParams>` |  | Additional parameters (model, etc.) |

**Returns:** `Promise<OpenAI.Embeddings.CreateEmbeddingResponse>`

```ts
const response = await openai.createEmbedding('Hello world')
console.log(response.data[0].embedding.length)
```



### createImage

Generate an image from a text prompt using DALL-E.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | ✓ | Description of the image to generate |
| `options` | `Partial<OpenAI.Images.ImageGenerateParams>` |  | Additional parameters (size, n, etc.) |

**Returns:** `Promise<OpenAI.Images.ImagesResponse>`

```ts
const response = await openai.createImage('A sunset over mountains')
console.log(response.data[0].url)
```



### listModels

List all available models.

**Returns:** `Promise<OpenAI.Models.ModelsPage>`

```ts
const models = await openai.listModels()
```



### ask

Ask a single question and get a text response. Convenience wrapper around `createChatCompletion` for simple Q&A.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `question` | `string` | ✓ | The question to ask |
| `options` | `Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>` |  | Additional completion parameters |

**Returns:** `Promise<string>`

```ts
const answer = await openai.ask('What is 2 + 2?')
console.log(answer) // '4'
```



### chat

Send a multi-turn conversation and get a text response. Convenience wrapper around `createChatCompletion` that returns just the text.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `messages` | `OpenAI.Chat.Completions.ChatCompletionMessageParam[]` | ✓ | Array of chat messages |
| `options` | `Partial<OpenAI.Chat.Completions.ChatCompletionCreateParams>` |  | Additional completion parameters |

**Returns:** `Promise<string>`

```ts
const reply = await openai.chat([
 { role: 'system', content: 'You are a pirate.' },
 { role: 'user', content: 'Hello!' }
])
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `defaultModel` | `string` | The default model used for completions, from options or 'gpt-4o'. |
| `raw` | `OpenAI` | The underlying OpenAI SDK instance for advanced use cases. |

## Events (Zod v4 schema)

### connected

Emitted when the API connection is verified



### failure

Emitted when a request fails

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error object |



### completion

Emitted after a chat completion, legacy completion, or response is created

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The completion or response object |



### embedding

Emitted after embeddings are created

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The embedding response object |



### image

Emitted after an image is generated

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The image generation response object |



### models

Emitted after listing available models

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The models list response |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `connected` | `boolean` | Whether the client is currently connected |
| `requestCount` | `number` | Total number of API requests made |
| `lastRequestTime` | `any` | Timestamp of the last API request |
| `tokenUsage` | `object` | Cumulative token usage across all requests |

## Environment Variables

- `OPENAI_API_KEY`

## Examples

**clients.openai**

```ts
const openai = container.client('openai', { defaultModel: 'gpt-4o' })
const answer = await openai.ask('What is the meaning of life?')
console.log(answer)
```



**connect**

```ts
await openai.connect()
```



**createChatCompletion**

```ts
const response = await openai.createChatCompletion([
 { role: 'system', content: 'You are a helpful assistant.' },
 { role: 'user', content: 'Hello!' }
])
console.log(response.choices[0]?.message?.content)
```



**createResponse**

```ts
const response = await openai.createResponse('Explain quantum computing')
```



**streamResponse**

```ts
const stream = await openai.streamResponse('Write a poem')
for await (const event of stream) {
 if (event.type === 'response.output_text.delta') {
   process.stdout.write(event.delta)
 }
}
```



**createCompletion**

```ts
const response = await openai.createCompletion('Once upon a time')
```



**createEmbedding**

```ts
const response = await openai.createEmbedding('Hello world')
console.log(response.data[0].embedding.length)
```



**createImage**

```ts
const response = await openai.createImage('A sunset over mountains')
console.log(response.data[0].url)
```



**listModels**

```ts
const models = await openai.listModels()
```



**ask**

```ts
const answer = await openai.ask('What is 2 + 2?')
console.log(answer) // '4'
```



**chat**

```ts
const reply = await openai.chat([
 { role: 'system', content: 'You are a pirate.' },
 { role: 'user', content: 'Hello!' }
])
```

