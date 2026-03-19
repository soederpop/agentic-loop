# AGIContainer

AGI-specific container that extends NodeContainer with AI capabilities including OpenAI conversations, code generation, and self-modifying agent features.

## Container Properties

| Property | Description |
|----------|-------------|
| `container.cwd` | Current working directory |
| `container.paths` | Path utilities scoped to cwd: `resolve()`, `join()`, `relative()`, `dirname()`, `basename()`, `parse()` |
| `container.manifest` | Parsed `package.json` for the current directory (`name`, `version`, `dependencies`, etc.) |
| `container.argv` | Raw parsed CLI arguments (from minimist). Prefer `positionals` export for positional args in commands |
| `container.utils` | Common utilities: `uuid()`, `hashObject()`, `stringUtils`, `lodash` |

## Registries

### features (Feature)

- `assistant`
- `assistantsManager`
- `claudeCode`
- `containerLink`
- `contentDb`
- `conversation`
- `conversationHistory`
- `diskCache`
- `dns`
- `docker`
- `downloader`
- `esbuild`
- `fileManager`
- `fs`
- `git`
- `googleAuth`
- `googleCalendar`
- `googleDocs`
- `googleDrive`
- `googleSheets`
- `grep`
- `helpers`
- `ink`
- `introspectionScanner`
- `ipcSocket`
- `jsonTree`
- `networking`
- `nlp`
- `openaiCodex`
- `opener`
- `os`
- `packageFinder`
- `portExposer`
- `postgres`
- `proc`
- `processManager`
- `python`
- `repl`
- `runpod`
- `secureShell`
- `semanticSearch`
- `skillsLibrary`
- `sqlite`
- `telegram`
- `tts`
- `ui`
- `vault`
- `vm`
- `windowManager`
- `yaml`
- `yamlTree`

### clients (Client)

- `elevenlabs`
- `graph`
- `openai`
- `rest`
- `websocket`

### servers (Server)

- `express`
- `mcp`
- `websocket`

### commands (Command)

- `api-docs`
- `bootstrap`
- `chat`
- `console`
- `describe`
- `eval`
- `help`
- `introspect`
- `mcp`
- `prompt`
- `run`
- `sandbox-mcp`
- `scaffold`
- `select`
- `serve`

### endpoints (Endpoint)

_No members registered_

### selectors (Selector)

_No members registered_

## Factory Methods

- `feature()`
- `client()`
- `server()`
- `command()`
- `endpoint()`
- `select()`

## Methods

### subcontainer

Creates a new subcontainer instance of the same concrete Container subclass. The new instance is constructed with the same options as this container, shallow-merged with any overrides you provide. This preserves the runtime container type (e.g. NodeContainer, BrowserContainer, etc.).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `this` | `This` | ✓ | Parameter this |
| `options` | `ConstructorParameters<This['constructor']>[0]` | ✓ | Options to override for the new container instance. |

**Returns:** `This`



### addContext

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `keyOrContext` | `keyof ContainerContext | Partial<ContainerContext>` | ✓ | Parameter keyOrContext |
| `value` | `ContainerContext[keyof ContainerContext]` |  | Parameter value |

**Returns:** `this`



### setState

Sets the state of the container.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `newState` | `SetStateValue<ContainerState>` | ✓ | The new state of the container. |

**Returns:** `void`



### bus

Convenience method for creating a new event bus instance.

**Returns:** `void`



### newState

Convenience method for creating a new observable State object.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `initialState` | `T` |  | Parameter initialState |

**Returns:** `void`



### normalizeHelperOptions

Parse helper options through the helper's static options schema so defaults are materialized.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `BaseClass` | `any` | ✓ | Parameter BaseClass |
| `options` | `any` | ✓ | Parameter options |
| `fallbackName` | `string` |  | Parameter fallbackName |

**Returns:** `void`



### buildHelperCacheKey

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `string` | ✓ | Parameter type |
| `id` | `string` | ✓ | Parameter id |
| `options` | `any` | ✓ | Parameter options |
| `omitOptionKeys` | `string[]` |  | Parameter omitOptionKeys |

**Returns:** `void`



### createHelperInstance

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `{
    cache,
    type,
    id,
    BaseClass,
    options,
    fallbackName,
    omitOptionKeys = [],
    context,
  }` | `{
    cache: Map<string, any>
    type: string
    id: string
    BaseClass: any
    options?: any
    fallbackName?: string
    omitOptionKeys?: string[]
    context?: any
  }` | ✓ | Parameter {
    cache,
    type,
    id,
    BaseClass,
    options,
    fallbackName,
    omitOptionKeys = [],
    context,
  } |

**Returns:** `void`



### feature

Creates a new instance of a feature. If you pass the same arguments, it will return the same instance as last time you created that. If you need the ability to create fresh instances, it is up to you how you define your options to support that.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `T` | ✓ | The id of the feature to create. |
| `options` | `ConstructorParameters<Features[T]>[0]` |  | The options to pass to the feature constructor. |

**Returns:** `InstanceType<Features[T]>`



### start

TODO: A container should be able to container.use(plugin) and that plugin should be able to define an asynchronous method that will be run when the container is started.  Right now there's nothing to do with starting / stopping a container but that might be neat.

**Returns:** `void`



### emit

Emit an event on the container's event bus.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `event` | `string` | ✓ | Parameter event |
| `args` | `any[]` | ✓ | Parameter args |

**Returns:** `void`



### on

Subscribe to an event on the container's event bus.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `event` | `string` | ✓ | Parameter event |
| `listener` | `(...args: any[]) => void` | ✓ | Parameter listener |

**Returns:** `void`



### off

Unsubscribe a listener from an event on the container's event bus.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `event` | `string` | ✓ | Parameter event |
| `listener` | `(...args: any[]) => void` |  | Parameter listener |

**Returns:** `void`



### once

Subscribe to an event on the container's event bus, but only fire once.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `event` | `string` | ✓ | Parameter event |
| `listener` | `(...args: any[]) => void` | ✓ | Parameter listener |

**Returns:** `void`



### waitFor

Returns a promise that will resolve when the event is emitted

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `event` | `string` | ✓ | Parameter event |

**Returns:** `void`



### registerHelperType

Register a helper type (registry + factory pair) on this container. Called automatically by Helper.attach() methods (e.g. Client.attach, Server.attach).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `registryName` | `string` | ✓ | The plural name of the registry, e.g. "clients", "servers" |
| `factoryName` | `string` | ✓ | The singular factory method name, e.g. "client", "server" |

**Returns:** `void`



### inspect

Returns a full introspection object for this container, merging build-time AST data (JSDoc descriptions, methods, getters) with runtime data (registries, factories, state, environment).

**Returns:** `ContainerIntrospection`



### inspectAsText

Returns a human-readable markdown representation of this container's introspection data. Useful in REPLs, AI agent contexts, or documentation generation. The first argument can be a section name (`'methods'`, `'getters'`, etc.) to render only that section, or a number for the starting heading depth (backward compatible).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sectionOrDepth` | `IntrospectionSection | number` |  | Parameter sectionOrDepth |
| `startHeadingDepth` | `number` |  | Parameter startHeadingDepth |

**Returns:** `string`



### introspectAsText

Alias for inspectAsText

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sectionOrDepth` | `IntrospectionSection | number` |  | Parameter sectionOrDepth |
| `startHeadingDepth` | `number` |  | Parameter startHeadingDepth |

**Returns:** `string`



### introspectAsJSON

Alias for inspectAsJSON

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sectionOrDepth` | `IntrospectionSection | number` |  | Parameter sectionOrDepth |
| `startHeadingDepth` | `number` |  | Parameter startHeadingDepth |

**Returns:** `any`



### sleep

Sleep for the specified number of milliseconds. Useful for scripting and sequencing.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ms` | `any` |  | Parameter ms |

**Returns:** `void`



### use

Apply a plugin or enable a feature by string name. Plugins must have a static attach(container) method.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `plugin` | `Extension<T>` | ✓ | A feature name string, or a class/object with a static attach method |
| `options` | `any` |  | Options to pass to the plugin's attach method |

**Returns:** `this & T`



### conversation

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `ConversationFactoryOptions` |  | Parameter options |

`ConversationFactoryOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `tools` | `{
		handlers: Record<string, ConversationTool['handler']>
		schemas: Record<string, ZodType>
	}` |  |
| `systemPrompt` | `string` |  |
| `model` | `string` |  |
| `id` | `string` |  |
| `title` | `string` |  |
| `thread` | `string` |  |
| `tags` | `string[]` |  |
| `metadata` | `Record<string, any>` |  |

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `state` | `any` | The observable state object for this container instance. |
| `enabledFeatureIds` | `any` | Returns the list of shortcut IDs for all currently enabled features. |
| `enabledFeatures` | `Partial<AvailableInstanceTypes<Features>>` | Returns a map of enabled feature shortcut IDs to their instances. |
| `context` | `ContainerContext<Features> & Partial<AvailableInstanceTypes<AvailableFeatures>>` | The Container's context is an object that contains the enabled features, the container itself, and any additional context that has been added to the container. All helper instances that are created by the container will have access to the shared context. |
| `currentState` | `any` | The current state of the container. This is a snapshot of the container's state at the time this method is called. |
| `isBrowser` | `any` | Returns true if the container is running in a browser. |
| `isBun` | `any` | Returns true if the container is running in Bun. |
| `isNode` | `any` | Returns true if the container is running in Node. |
| `isElectron` | `any` | Returns true if the container is running in Electron. |
| `isDevelopment` | `any` | Returns true if the container is running in development mode. |
| `isProduction` | `any` | Returns true if the container is running in production mode. |
| `isCI` | `any` | Returns true if the container is running in a CI environment. |
| `registryNames` | `string[]` | Returns the names of all attached registries (e.g. ["features", "clients", "servers"]). |
| `factoryNames` | `string[]` | Returns the names of all available factory methods (e.g. ["feature", "client", "server"]). |
| `cwd` | `string` | Returns the current working directory, from options or process.cwd(). |
| `manifest` | `any` | Returns the parsed package.json manifest for the current working directory. |
| `argv` | `any` | Returns the parsed command-line arguments (from minimist). |
| `urlUtils` | `any` | Returns URL utility functions for parsing URIs. |
| `paths` | `any` | Returns path utility functions scoped to the current working directory (join, resolve, relative, dirname, parse). |

## Events

### started

Event emitted by Container



## State

| Property | Type | Description |
|----------|------|-------------|
| `started` | `boolean` | Whether the container has been started |
| `enabledFeatures` | `array` | List of currently enabled feature shortcut IDs |
| `registries` | `array` | Names of attached registries (e.g. features, clients, servers) |
| `factories` | `array` | Names of available factory methods (e.g. feature, client, server) |

## Enabled Features

- `fs`
- `proc`
- `git`
- `grep`
- `os`
- `networking`
- `ui`
- `vm`
- `esbuild`
- `helpers`

## Environment

| Flag | Value |
|------|-------|
| `isBrowser` | false |
| `isNode` | true |
| `isBun` | true |
| `isElectron` | false |
| `isDevelopment` | true |
| `isProduction` | false |
| `isCI` | false |