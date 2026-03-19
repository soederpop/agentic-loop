# OpenAICodex (features.openaiCodex)

OpenAI Codex CLI wrapper feature. Spawns and manages Codex sessions as subprocesses, streaming structured JSON events back through the container's event system. Mirrors the ClaudeCode feature pattern: each call to `run()` spawns a `codex exec --json` process, parses NDJSON from stdout line-by-line, and emits typed events on the feature's event bus.

## Usage

```ts
container.feature('openaiCodex', {
  // Path to the codex CLI binary
  codexPath,
  // Default model to use for sessions
  model,
  // Default working directory for sessions
  cwd,
  // Sandbox policy for shell commands
  sandbox,
  // Approval mode for codex operations
  approvalMode,
  // Path to additional project doc to include
  projectDoc,
  // Disable automatic codex.md inclusion
  noProjectDoc,
  // Do not truncate stdout/stderr from command outputs
  fullStdout,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `codexPath` | `string` | Path to the codex CLI binary |
| `model` | `string` | Default model to use for sessions |
| `cwd` | `string` | Default working directory for sessions |
| `sandbox` | `string` | Sandbox policy for shell commands |
| `approvalMode` | `string` | Approval mode for codex operations |
| `projectDoc` | `string` | Path to additional project doc to include |
| `noProjectDoc` | `boolean` | Disable automatic codex.md inclusion |
| `fullStdout` | `boolean` | Do not truncate stdout/stderr from command outputs |

## Methods

### checkAvailability

Check if the Codex CLI is available and capture its version.

**Returns:** `Promise<boolean>`



### run

Run a prompt in a new Codex session. Spawns a subprocess, streams NDJSON events, and resolves when the session completes.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | ✓ | The natural language instruction for the Codex agent |
| `options` | `CodexRunOptions` |  | Optional overrides for model, cwd, sandbox policy, etc. |

`CodexRunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` |  |
| `cwd` | `string` |  |
| `sandbox` | `'read-only' | 'workspace-write' | 'danger-full-access'` |  |
| `approvalMode` | `'suggest' | 'auto-edit' | 'full-auto'` |  |
| `projectDoc` | `string` |  |
| `noProjectDoc` | `boolean` |  |
| `fullStdout` | `boolean` |  |
| `images` | `string[]` |  |
| `fullAuto` | `boolean` |  |
| `resumeSessionId` | `string` | Resume a previous session by ID. |
| `resumeLast` | `boolean` | Resume the most recent session. |
| `dangerouslyAutoApproveEverything` | `boolean` | Skip all approvals and sandboxing. |
| `extraArgs` | `string[]` | Additional CLI flags. |

**Returns:** `Promise<CodexSession>`

```ts
const session = await codex.run('Fix the failing tests')
console.log(session.result)

const session = await codex.run('Refactor the auth module', {
 model: 'o4-mini',
 fullAuto: true,
 cwd: '/path/to/project'
})
```



### start

Run a prompt without waiting for completion. Returns the session ID immediately so you can subscribe to events.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | ✓ | The natural language instruction for the Codex agent |
| `options` | `CodexRunOptions` |  | Optional overrides for model, cwd, sandbox policy, etc. |

`CodexRunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` |  |
| `cwd` | `string` |  |
| `sandbox` | `'read-only' | 'workspace-write' | 'danger-full-access'` |  |
| `approvalMode` | `'suggest' | 'auto-edit' | 'full-auto'` |  |
| `projectDoc` | `string` |  |
| `noProjectDoc` | `boolean` |  |
| `fullStdout` | `boolean` |  |
| `images` | `string[]` |  |
| `fullAuto` | `boolean` |  |
| `resumeSessionId` | `string` | Resume a previous session by ID. |
| `resumeLast` | `boolean` | Resume the most recent session. |
| `dangerouslyAutoApproveEverything` | `boolean` | Skip all approvals and sandboxing. |
| `extraArgs` | `string[]` | Additional CLI flags. |

**Returns:** `string`

```ts
const sessionId = codex.start('Build a REST API for users')

codex.on('session:delta', ({ sessionId: sid, text }) => {
 if (sid === sessionId) process.stdout.write(text)
})
```



### abort

Kill a running session's subprocess.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The session ID to abort |

**Returns:** `void`



### getSession

Retrieve the current state of a session by its ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The session ID to look up |

**Returns:** `CodexSession | undefined`



### waitForSession

Wait for a running session to complete or error. Resolves immediately if the session is already in a terminal state.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The session ID to wait for |

**Returns:** `Promise<CodexSession>`



### enable

Enable the feature. Delegates to the base Feature enable() lifecycle.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `any` |  | Options to merge into the feature configuration |

**Returns:** `Promise<this>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `codexPath` | `string` |  |

## Events (Zod v4 schema)

### session:event

Fired for every parsed JSON event from the Codex CLI stream

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `event` | `any` |  |



### session:delta

Fired for each text delta from an agent message

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `text` | `string` |  |
| `role` | `string` |  |



### session:message

Fired when a complete agent message is received

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `message` | `any` |  |



### session:exec

Fired when a command execution item completes

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `exec` | `any` |  |



### session:reasoning

Fired when a reasoning item is received

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `text` | `string` |  |



### session:exec-start

Fired when a command execution item starts

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `command` | `string` |  |



### session:start

Fired when a new Codex session is spawned

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



### session:result

Fired when a session completes with a final result

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `result` | `string` |  |



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
| `sessions` | `object` | Map of session IDs to CodexSession objects |
| `activeSessions` | `array` | List of currently running session IDs |
| `codexAvailable` | `boolean` | Whether the codex CLI binary is available |
| `codexVersion` | `string` | Detected codex CLI version string |

## Examples

**features.openaiCodex**

```ts
const codex = container.feature('openaiCodex')

// Listen for events
codex.on('session:message', ({ sessionId, message }) => console.log(message))
codex.on('session:patch', ({ sessionId, patch }) => console.log('File changed:', patch.path))

// Run a prompt
const session = await codex.run('Fix the failing tests in src/')
console.log(session.result)
```



**run**

```ts
const session = await codex.run('Fix the failing tests')
console.log(session.result)

const session = await codex.run('Refactor the auth module', {
 model: 'o4-mini',
 fullAuto: true,
 cwd: '/path/to/project'
})
```



**start**

```ts
const sessionId = codex.start('Build a REST API for users')

codex.on('session:delta', ({ sessionId: sid, text }) => {
 if (sid === sessionId) process.stdout.write(text)
})
```

