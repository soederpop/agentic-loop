# ClaudeCode (features.claudeCode)

Claude Code CLI wrapper feature. Spawns and manages Claude Code sessions as subprocesses, streaming structured JSON events back through the container's event system. Sessions are long-lived: each call to `run()` spawns a `claude -p` process with `--output-format stream-json`, parses NDJSON from stdout line-by-line, and emits typed events on the feature's event bus.

## Usage

```ts
container.feature('claudeCode', {
  // Claude CLI session ID to resume by default
  session,
  // Path to the claude CLI binary
  claudePath,
  // Default model to use for sessions
  model,
  // Default working directory for sessions
  cwd,
  // Default system prompt prepended to all sessions
  systemPrompt,
  // Default append system prompt for all sessions
  appendSystemPrompt,
  // Default permission mode for Claude CLI sessions
  permissionMode,
  // Default allowed tools for sessions
  allowedTools,
  // Default disallowed tools for sessions
  disallowedTools,
  // Whether to stream partial messages token-by-token
  streaming,
  // MCP config file paths to pass to sessions
  mcpConfig,
  // MCP server configs keyed by name, injected into sessions via temp config file
  mcpServers,
  // Path to write a parseable NDJSON session log file
  fileLogPath,
  // Verbosity level for file logging. Defaults to "normal"
  fileLogLevel,
  // Default effort level for Claude reasoning
  effort,
  // Maximum cost budget in USD per session
  maxBudgetUsd,
  // Fallback model when the primary model is unavailable
  fallbackModel,
  // Default agent to use
  agent,
  // Disable session persistence across runs
  noSessionPersistence,
  // Default tools to make available
  tools,
  // Require strict MCP config validation
  strictMcpConfig,
  // Path to a custom settings file
  settingsFile,
  // Directories containing Claude Code skills to load into sessions
  skillsFolders,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `session` | `string` | Claude CLI session ID to resume by default |
| `claudePath` | `string` | Path to the claude CLI binary |
| `model` | `string` | Default model to use for sessions |
| `cwd` | `string` | Default working directory for sessions |
| `systemPrompt` | `string` | Default system prompt prepended to all sessions |
| `appendSystemPrompt` | `string` | Default append system prompt for all sessions |
| `permissionMode` | `string` | Default permission mode for Claude CLI sessions |
| `allowedTools` | `array` | Default allowed tools for sessions |
| `disallowedTools` | `array` | Default disallowed tools for sessions |
| `streaming` | `boolean` | Whether to stream partial messages token-by-token |
| `mcpConfig` | `array` | MCP config file paths to pass to sessions |
| `mcpServers` | `object` | MCP server configs keyed by name, injected into sessions via temp config file |
| `fileLogPath` | `string` | Path to write a parseable NDJSON session log file |
| `fileLogLevel` | `string` | Verbosity level for file logging. Defaults to "normal" |
| `effort` | `string` | Default effort level for Claude reasoning |
| `maxBudgetUsd` | `number` | Maximum cost budget in USD per session |
| `fallbackModel` | `string` | Fallback model when the primary model is unavailable |
| `agent` | `string` | Default agent to use |
| `noSessionPersistence` | `boolean` | Disable session persistence across runs |
| `tools` | `array` | Default tools to make available |
| `strictMcpConfig` | `boolean` | Require strict MCP config validation |
| `settingsFile` | `string` | Path to a custom settings file |
| `skillsFolders` | `array` | Directories containing Claude Code skills to load into sessions |

## Methods

### assertMinVersion

Assert that the detected CLI version meets a minimum major.minor requirement. Throws if the CLI version is below the specified minimum.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `major` | `number` | ✓ | Minimum major version |
| `minor` | `number` | ✓ | Minimum minor version |

**Returns:** `void`



### checkAvailability

Check if the Claude CLI is available and capture its version.

**Returns:** `Promise<boolean>`

```ts
const available = await cc.checkAvailability()
if (!available) throw new Error('Claude CLI not found')
```



### writeMcpConfig

Write an MCP server config map to a temp file suitable for `--mcp-config`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `servers` | `Record<string, McpServerConfig>` | ✓ | Server configs keyed by name |

**Returns:** `Promise<string>`

```ts
const configPath = await cc.writeMcpConfig({
 'my-api': { type: 'http', url: 'https://api.example.com/mcp' },
 'local-tool': { type: 'stdio', command: 'bun', args: ['run', 'server.ts'] }
})
```



### run

Run a prompt in a new Claude Code session. Spawns a subprocess, streams NDJSON events, and resolves when the session completes.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | ✓ | The instruction/prompt to send |
| `options` | `RunOptions` |  | Session configuration overrides |

`RunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` | Override model for this session. |
| `cwd` | `string` | Override working directory. |
| `systemPrompt` | `string` | System prompt for this session. |
| `appendSystemPrompt` | `string` | Append system prompt for this session. |
| `permissionMode` | `'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk'` | Permission mode override. |
| `allowedTools` | `string[]` | Allowed tools override. |
| `disallowedTools` | `string[]` | Disallowed tools override. |
| `streaming` | `boolean` | Whether to stream partial messages. |
| `resumeSessionId` | `string` | Resume a previous session by ID. |
| `continue` | `boolean` | Continue the most recent conversation. |
| `addDirs` | `string[]` | Additional directories to allow tool access to. |
| `skillsFolders` | `string[]` | Directories containing Claude Code skills (SKILL.md files) to load into sessions. Merged with addDirs as --add-dir. |
| `mcpConfig` | `string[]` | MCP config file paths. |
| `mcpServers` | `Record<string, McpServerConfig>` | MCP servers to inject, keyed by server name. |
| `dangerouslySkipPermissions` | `boolean` | Skip all permission checks (only for sandboxed environments). |
| `extraArgs` | `string[]` | Additional arbitrary CLI flags. |
| `fileLogPath` | `string` | Path to write a parseable NDJSON session log file. Overrides feature-level fileLogPath. |
| `fileLogLevel` | `FileLogLevel` | Verbosity level for file logging. Overrides feature-level fileLogLevel. |
| `effort` | `'low' | 'medium' | 'high'` | Effort level for Claude reasoning. |
| `maxBudgetUsd` | `number` | Maximum cost budget in USD. |
| `fallbackModel` | `string` | Fallback model when the primary is unavailable. |
| `jsonSchema` | `string | object` | JSON schema for structured output validation. |
| `agent` | `string` | Agent to use for this session. |
| `sessionId` | `string` | Resume or fork a specific Claude session by ID. |
| `noSessionPersistence` | `boolean` | Disable session persistence for this run. |
| `forkSession` | `boolean` | Fork from an existing session instead of resuming. |
| `tools` | `string[]` | Tools to make available. |
| `strictMcpConfig` | `boolean` | Require strict MCP config validation. |
| `debug` | `string | boolean` | Enable debug output. Pass a string for specific debug channels, or true for all. |
| `debugFile` | `string` | Path to write debug output to a file. |
| `settingsFile` | `string` | Path to a custom settings file. |

**Returns:** `Promise<ClaudeSession>`

```ts
// Simple one-shot
const session = await cc.run('What files are in this project?')
console.log(session.result)

// With options
const session = await cc.run('Refactor the auth module', {
 model: 'opus',
 cwd: '/path/to/project',
 permissionMode: 'acceptEdits',
 streaming: true
})

// With injected MCP servers
const session = await cc.run('Use the database tools to list tables', {
 mcpServers: {
   'db-tools': { type: 'stdio', command: 'bun', args: ['run', 'db-mcp.ts'] },
   'api': { type: 'http', url: 'https://api.example.com/mcp' }
 }
})

// Resume a previous session
const session = await cc.run('Now add tests for that', {
 resumeSessionId: previousSession.sessionId
})
```



### start

Run a prompt without waiting for completion. Returns the session ID immediately so you can subscribe to events.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | ✓ | The instruction/prompt to send |
| `options` | `RunOptions` |  | Session configuration overrides |

`RunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` | Override model for this session. |
| `cwd` | `string` | Override working directory. |
| `systemPrompt` | `string` | System prompt for this session. |
| `appendSystemPrompt` | `string` | Append system prompt for this session. |
| `permissionMode` | `'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk'` | Permission mode override. |
| `allowedTools` | `string[]` | Allowed tools override. |
| `disallowedTools` | `string[]` | Disallowed tools override. |
| `streaming` | `boolean` | Whether to stream partial messages. |
| `resumeSessionId` | `string` | Resume a previous session by ID. |
| `continue` | `boolean` | Continue the most recent conversation. |
| `addDirs` | `string[]` | Additional directories to allow tool access to. |
| `skillsFolders` | `string[]` | Directories containing Claude Code skills (SKILL.md files) to load into sessions. Merged with addDirs as --add-dir. |
| `mcpConfig` | `string[]` | MCP config file paths. |
| `mcpServers` | `Record<string, McpServerConfig>` | MCP servers to inject, keyed by server name. |
| `dangerouslySkipPermissions` | `boolean` | Skip all permission checks (only for sandboxed environments). |
| `extraArgs` | `string[]` | Additional arbitrary CLI flags. |
| `fileLogPath` | `string` | Path to write a parseable NDJSON session log file. Overrides feature-level fileLogPath. |
| `fileLogLevel` | `FileLogLevel` | Verbosity level for file logging. Overrides feature-level fileLogLevel. |
| `effort` | `'low' | 'medium' | 'high'` | Effort level for Claude reasoning. |
| `maxBudgetUsd` | `number` | Maximum cost budget in USD. |
| `fallbackModel` | `string` | Fallback model when the primary is unavailable. |
| `jsonSchema` | `string | object` | JSON schema for structured output validation. |
| `agent` | `string` | Agent to use for this session. |
| `sessionId` | `string` | Resume or fork a specific Claude session by ID. |
| `noSessionPersistence` | `boolean` | Disable session persistence for this run. |
| `forkSession` | `boolean` | Fork from an existing session instead of resuming. |
| `tools` | `string[]` | Tools to make available. |
| `strictMcpConfig` | `boolean` | Require strict MCP config validation. |
| `debug` | `string | boolean` | Enable debug output. Pass a string for specific debug channels, or true for all. |
| `debugFile` | `string` | Path to write debug output to a file. |
| `settingsFile` | `string` | Path to a custom settings file. |

**Returns:** `Promise<string>`

```ts
const sessionId = cc.start('Build a REST API for users')

cc.on('session:delta', ({ sessionId: sid, text }) => {
 if (sid === sessionId) process.stdout.write(text)
})

cc.on('session:result', ({ sessionId: sid, result }) => {
 if (sid === sessionId) console.log('\nDone:', result)
})
```



### abort

Kill a running session's subprocess.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The local session ID to abort |

**Returns:** `void`

```ts
const sessionId = cc.start('Do something long')
// ... later
cc.abort(sessionId)
```



### getSession

Get a session by its local ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The local session ID |

**Returns:** `ClaudeSession | undefined`

```ts
const session = cc.getSession(sessionId)
if (session?.status === 'completed') {
 console.log(session.result)
}
```



### waitForSession

Wait for a running session to complete.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The local session ID |

**Returns:** `Promise<ClaudeSession>`

```ts
const id = cc.start('Build something cool')
const session = await cc.waitForSession(id)
console.log(session.result)
```



### usage

Get aggregated usage statistics across all sessions, or for a specific session.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` |  | Optional session ID to get usage for a single session |

**Returns:** `void`

```ts
const stats = cc.usage()
console.log(`Total cost: $${stats.totalCostUsd.toFixed(4)}`)
console.log(`Tokens: ${stats.totalInputTokens} in / ${stats.totalOutputTokens} out`)

// Single session
const sessionStats = cc.usage(sessionId)
```



### sessionHistoryToMarkdown

Export session history as a readable markdown document. Reads from a raw JSONL file (Claude CLI session log or this feature's NDJSON log) so it works independently of in-memory state. Can also accept a local session ID to export from in-memory state as a fallback.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` |  | Path to a JSONL file, a local session ID, or omit for the most recent session |

**Returns:** `Promise<string>`

```ts
// From a JSONL file (works without any prior state)
const md = await cc.sessionHistoryToMarkdown('/path/to/session.jsonl')

// From the most recent in-memory session
const md = await cc.sessionHistoryToMarkdown()

// From a specific local session ID
const md = await cc.sessionHistoryToMarkdown(localSessionId)
```



### cleanupMcpTempFiles

Clean up any temp MCP config files created during sessions.

**Returns:** `Promise<void>`



### enable

Initialize the feature.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `any` |  | Enable options |

**Returns:** `Promise<this>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `claudePath` | `string` |  |
| `parsedVersion` | `{ major: number; minor: number; patch: number } | undefined` | Parsed semver components from the detected CLI version, or undefined if not yet checked. |
| `sessionId` | `string | undefined` | The Claude CLI session ID of the most recently initialized session, or the session set via the `session` option. Useful for resuming later. |

## Events (Zod v4 schema)

### session:warning

Fired when the log reader encounters a warning

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `message` | `string` |  |



### session:log-error

Fired when the log reader encounters an error

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `error` | `any` |  |



### session:event

Fired for every parsed JSON event from the CLI stream

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `event` | `any` |  |



### session:init

Fired when the CLI emits its init system event

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `init` | `any` |  |



### session:delta

Fired for each text delta from an assistant message

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `text` | `string` |  |
| `role` | `string` |  |



### session:stream

Fired for stream_event type events from the CLI

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `streamEvent` | `any` |  |



### session:message

Fired when a complete assistant message is received

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `message` | `any` |  |



### session:result

Fired when a session completes with a final result

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `result` | `string` |  |



### session:start

Fired when a new Claude Code session is spawned

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `prompt` | `string` |  |



### session:error

Fired when a session encounters an error

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `error` | `any` |  |
| `exitCode` | `number` |  |



### session:parse-error

Fired when a JSON line from the CLI cannot be parsed

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `line` | `string` |  |



### session:abort

Fired when a session is aborted by the user

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `sessions` | `object` | Map of session IDs to ClaudeSession objects |
| `activeSessions` | `array` | List of currently running session IDs |
| `claudeAvailable` | `boolean` | Whether the Claude CLI binary is available |
| `claudeVersion` | `string` | Detected Claude CLI version string |

## Environment Variables

- `TMPDIR`

## Examples

**features.claudeCode**

```ts
const cc = container.feature('claudeCode')

// Listen for events
cc.on('session:delta', ({ sessionId, text }) => process.stdout.write(text))
cc.on('session:result', ({ sessionId, result }) => console.log('Done:', result))

// Run a prompt
const session = await cc.run('Explain the architecture of this project')
console.log(session.result)
```



**checkAvailability**

```ts
const available = await cc.checkAvailability()
if (!available) throw new Error('Claude CLI not found')
```



**writeMcpConfig**

```ts
const configPath = await cc.writeMcpConfig({
 'my-api': { type: 'http', url: 'https://api.example.com/mcp' },
 'local-tool': { type: 'stdio', command: 'bun', args: ['run', 'server.ts'] }
})
```



**run**

```ts
// Simple one-shot
const session = await cc.run('What files are in this project?')
console.log(session.result)

// With options
const session = await cc.run('Refactor the auth module', {
 model: 'opus',
 cwd: '/path/to/project',
 permissionMode: 'acceptEdits',
 streaming: true
})

// With injected MCP servers
const session = await cc.run('Use the database tools to list tables', {
 mcpServers: {
   'db-tools': { type: 'stdio', command: 'bun', args: ['run', 'db-mcp.ts'] },
   'api': { type: 'http', url: 'https://api.example.com/mcp' }
 }
})

// Resume a previous session
const session = await cc.run('Now add tests for that', {
 resumeSessionId: previousSession.sessionId
})
```



**start**

```ts
const sessionId = cc.start('Build a REST API for users')

cc.on('session:delta', ({ sessionId: sid, text }) => {
 if (sid === sessionId) process.stdout.write(text)
})

cc.on('session:result', ({ sessionId: sid, result }) => {
 if (sid === sessionId) console.log('\nDone:', result)
})
```



**abort**

```ts
const sessionId = cc.start('Do something long')
// ... later
cc.abort(sessionId)
```



**getSession**

```ts
const session = cc.getSession(sessionId)
if (session?.status === 'completed') {
 console.log(session.result)
}
```



**waitForSession**

```ts
const id = cc.start('Build something cool')
const session = await cc.waitForSession(id)
console.log(session.result)
```



**usage**

```ts
const stats = cc.usage()
console.log(`Total cost: $${stats.totalCostUsd.toFixed(4)}`)
console.log(`Tokens: ${stats.totalInputTokens} in / ${stats.totalOutputTokens} out`)

// Single session
const sessionStats = cc.usage(sessionId)
```



**sessionHistoryToMarkdown**

```ts
// From a JSONL file (works without any prior state)
const md = await cc.sessionHistoryToMarkdown('/path/to/session.jsonl')

// From the most recent in-memory session
const md = await cc.sessionHistoryToMarkdown()

// From a specific local session ID
const md = await cc.sessionHistoryToMarkdown(localSessionId)
```



**sessionId**

```ts
const cc = container.feature('claudeCode')
await cc.run('Do something')
console.log(cc.sessionId) // the Claude CLI session ID
```

