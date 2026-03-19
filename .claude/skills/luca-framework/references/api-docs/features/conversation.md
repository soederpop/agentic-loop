# Conversation (features.conversation)

A self-contained conversation with OpenAI that supports streaming, tool calling, and message state management.

## Usage

```ts
container.feature('conversation', {
  // A unique identifier for the conversation
  id,
  // A human-readable title for the conversation
  title,
  // A unique identifier for threads, an arbitrary grouping mechanism
  thread,
  // Any available OpenAI model
  model,
  // Initial message history to seed the conversation
  history,
  // Tools the model can call during conversation
  tools,
  // Remote MCP servers keyed by server label
  mcpServers,
  // Completion API mode. auto uses Responses unless local=true
  api,
  // Tags for categorizing and searching this conversation
  tags,
  // Arbitrary metadata to attach to this conversation
  metadata,
  // Options for the OpenAI client
  clientOptions,
  // Whether to use the local ollama models instead of the remote OpenAI models
  local,
  // Maximum number of output tokens per completion
  maxTokens,
  // Enable automatic compaction when input tokens approach the context limit
  autoCompact,
  // Fraction of context window at which auto-compact triggers (default 0.8)
  compactThreshold,
  // Override the inferred context window size for this model
  contextWindow,
  // Number of recent messages to preserve after compaction (default 4)
  compactKeepRecent,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `id` | `string` | A unique identifier for the conversation |
| `title` | `string` | A human-readable title for the conversation |
| `thread` | `string` | A unique identifier for threads, an arbitrary grouping mechanism |
| `model` | `string` | Any available OpenAI model |
| `history` | `array` | Initial message history to seed the conversation |
| `tools` | `object` | Tools the model can call during conversation |
| `mcpServers` | `object` | Remote MCP servers keyed by server label |
| `api` | `string` | Completion API mode. auto uses Responses unless local=true |
| `tags` | `array` | Tags for categorizing and searching this conversation |
| `metadata` | `object` | Arbitrary metadata to attach to this conversation |
| `clientOptions` | `object` | Options for the OpenAI client |
| `local` | `boolean` | Whether to use the local ollama models instead of the remote OpenAI models |
| `maxTokens` | `number` | Maximum number of output tokens per completion |
| `autoCompact` | `boolean` | Enable automatic compaction when input tokens approach the context limit |
| `compactThreshold` | `number` | Fraction of context window at which auto-compact triggers (default 0.8) |
| `contextWindow` | `number` | Override the inferred context window size for this model |
| `compactKeepRecent` | `number` | Number of recent messages to preserve after compaction (default 4) |

## Methods

### estimateTokens

Estimate the input token count for the current messages array using the js-tiktoken tokenizer. Updates state.

**Returns:** `number`



### summarize

Generate a summary of the conversation so far using the LLM. Read-only — does not modify messages.

**Returns:** `Promise<string>`



### compact

Compact the conversation by summarizing old messages and replacing them with a summary message. Keeps the system message (if any) and the most recent N messages.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ keepRecent?: number }` |  | Parameter options |

**Returns:** `Promise<{ summary: string; removedCount: number; estimatedTokens: number }>`



### ask

Send a message and get a streamed response. Automatically handles tool calls by invoking the registered handlers and feeding results back to the model until a final text response is produced.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `content` | `string | ContentPart[]` | ✓ | The user message, either a string or array of content parts (text + images) |
| `options` | `AskOptions` |  | Parameter options |

`AskOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `maxTokens` | `number` |  |

**Returns:** `Promise<string>`

```ts
const reply = await conversation.ask("What's the weather in SF?")
// With image:
const reply = await conversation.ask([
 { type: 'text', text: 'What is in this diagram?' },
 { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
])
```



### save

Persist this conversation to disk via conversationHistory. Creates a new record if this conversation hasn't been saved before, or updates the existing one.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `opts` | `{ title?: string; tags?: string[]; thread?: string; metadata?: Record<string, any> }` |  | Optional overrides for title, tags, thread, or metadata |

**Returns:** `void`



### pushMessage

Append a message to the conversation state.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `Message` | ✓ | The message to append |

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `tools` | `Record<string, any>` | Returns the registered tools available for the model to call. |
| `mcpServers` | `Record<string, ConversationMCPServer>` | Returns configured remote MCP servers keyed by server label. |
| `messages` | `Message[]` | Returns the full message history of the conversation. |
| `model` | `string` | Returns the OpenAI model name being used for completions. |
| `apiMode` | `'responses' | 'chat'` | Returns the active completion API mode after resolving auto/local behavior. |
| `isStreaming` | `boolean` | Whether a streaming response is currently in progress. |
| `contextWindow` | `number` | The context window size for the current model (from options override or auto-detected). |
| `isNearContextLimit` | `boolean` | Whether the conversation is approaching the context limit. |
| `openai` | `any` | Returns the OpenAI client instance from the container. |
| `history` | `ConversationHistory` | Returns the conversationHistory feature for persistence. |

## Events (Zod v4 schema)

### summarizeStart

Fired before generating a conversation summary



### summarizeEnd

Fired after the summary is generated

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The generated summary text |



### compactStart

Fired before compacting the conversation history

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `messageCount` | `number` |  |
| `keepRecent` | `number` |  |



### compactEnd

Fired after compaction completes

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `summary` | `string` |  |
| `removedCount` | `number` |  |
| `estimatedTokens` | `number` |  |
| `compactionCount` | `number` |  |



### autoCompactTriggered

Fired when auto-compact kicks in because tokens exceeded the threshold

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `estimated` | `number` |  |
| `limit` | `number` |  |
| `contextWindow` | `number` |  |



### userMessage

Fired when a user message is added to the conversation

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The user message content (string or ContentPart[]) |



### turnStart

Fired at the start of each completion turn

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `turn` | `number` |  |
| `isFollowUp` | `boolean` |  |



### rawEvent

Fired for every raw event from the Responses API stream

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | Raw stream event from the API |



### mcpEvent

Fired for MCP-related events from the Responses API

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | MCP-related stream event |



### chunk

Fired for each streaming text delta

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Text delta from the stream |



### preview

Fired after each chunk with the full accumulated text

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Accumulated text so far |



### responseCompleted

Fired when the Responses API stream completes

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The completed OpenAI Response object |



### toolCallsStart

Fired when the model begins a batch of tool calls

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | Array of tool call objects from the model |



### toolError

Fired when a tool handler throws or the tool is unknown

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Tool name |
| `arg1` | `any` | Error object or message |



### toolCall

Fired before invoking a single tool handler

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Tool name |
| `arg1` | `any` | Parsed arguments object |



### toolResult

Fired after a tool handler returns successfully

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Tool name |
| `arg1` | `string` | Serialized result |



### toolCallsEnd

Fired after all tool calls in a turn have been executed



### turnEnd

Fired at the end of each completion turn

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `turn` | `number` |  |
| `hasToolCalls` | `boolean` |  |



### response

Fired when the final text response is produced

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Final accumulated response text |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `id` | `string` | Unique identifier for this conversation instance |
| `thread` | `string` | Thread identifier for grouping conversations |
| `model` | `string` | The OpenAI model being used |
| `messages` | `array` | Full message history of the conversation |
| `streaming` | `boolean` | Whether a streaming response is currently in progress |
| `lastResponse` | `string` | The last assistant response text |
| `toolCalls` | `number` | Total number of tool calls made in this conversation |
| `api` | `string` | Which completion API is active for this conversation |
| `lastResponseId` | `any` | Most recent OpenAI Responses API response ID for continuing conversation state |
| `tokenUsage` | `object` | Cumulative token usage statistics |
| `estimatedInputTokens` | `number` | Estimated input token count for the current messages array |
| `compactionCount` | `number` | Number of times compact() has been called |
| `contextWindow` | `number` | The context window size for the current model |

## Examples

**features.conversation**

```ts
const conversation = container.feature('conversation', {
 model: 'gpt-4.1',
 tools: myToolMap,
 history: [{ role: 'system', content: 'You are a helpful assistant.' }]
})
const reply = await conversation.ask('What is the meaning of life?')
```



**ask**

```ts
const reply = await conversation.ask("What's the weather in SF?")
// With image:
const reply = await conversation.ask([
 { type: 'text', text: 'What is in this diagram?' },
 { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
])
```

