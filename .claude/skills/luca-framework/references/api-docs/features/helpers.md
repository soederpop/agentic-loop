# Helpers (features.helpers)

The Helpers feature is a unified gateway for discovering and registering project-level helpers from conventional folder locations. It scans known folder names (features/, clients/, servers/, commands/, endpoints/, selectors/) and handles registration differently based on the helper type: - Class-based (features, clients, servers): Dynamic import, validate subclass, register - Config-based (commands, endpoints, selectors): Delegate to existing discovery mechanisms

## Usage

```ts
container.feature('helpers', {
  // Root directory to scan for helper folders. Defaults to container.cwd
  rootDir,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `rootDir` | `string` | Root directory to scan for helper folders. Defaults to container.cwd |

## Methods

### seedVirtualModules

Seeds the VM feature with virtual modules so that project-level files can `import` / `require('@soederpop/luca')`, `zod`, etc. without needing them in `node_modules`. Called automatically when `useNativeImport` is false. Can also be called externally (e.g. from the CLI) to pre-seed before discovery.

**Returns:** `void`



### discover

Discover and register project-level helpers of the given type. Idempotent: the first caller triggers the actual scan. Subsequent callers receive the cached results. If discovery is in-flight, callers await the same promise — no duplicate work.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `RegistryType` | ✓ | Which type of helpers to discover |
| `options` | `{ directory?: string }` |  | Optional overrides |

`{ directory?: string }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `directory` | `any` | Override the directory to scan |

**Returns:** `Promise<string[]>`

```ts
const names = await container.helpers.discover('features')
console.log(names) // ['myCustomFeature']
```



### discoverAll

Discover all helper types from their conventional folder locations. Idempotent: safe to call from multiple places (luca.cli.ts, commands, etc.). The first caller triggers discovery; all others receive the same results.

**Returns:** `Promise<Record<string, string[]>>`

```ts
const results = await container.helpers.discoverAll()
// { features: ['myFeature'], clients: [], servers: [], commands: ['deploy'], endpoints: [] }
```



### lookup

Look up a helper class by type and name.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `RegistryType` | ✓ | The registry type (features, clients, servers, commands, endpoints) |
| `name` | `string` | ✓ | The helper name within that registry |

**Returns:** `any`

```ts
const FsClass = container.helpers.lookup('features', 'fs')
```



### describe

Get the introspection description for a specific helper.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `RegistryType` | ✓ | The registry type |
| `name` | `string` | ✓ | The helper name |

**Returns:** `string`



### loadModuleExports

Load a module either via native `import()` or the VM's virtual module system. Uses the same `useNativeImport` check as discovery to decide the loading strategy.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `absPath` | `string` | ✓ | Absolute path to the module file |

**Returns:** `Promise<Record<string, any>>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `rootDir` | `string` | The root directory to scan for helper folders. |
| `useNativeImport` | `boolean` | Whether to use native `import()` for loading project helpers. True only if `@soederpop/luca` is actually resolvable in `node_modules`. Warns when `node_modules` exists but the package is missing. |
| `available` | `Record<string, string[]>` | Returns a unified view of all available helpers across all registries. Each key is a registry type, each value is the list of helper names in that registry. |

## Events (Zod v4 schema)

### discovered

Emitted after a registry type has been discovered

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Registry type that was discovered |
| `arg1` | `array` | Names of newly registered helpers |



### registered

Emitted when a single helper is registered

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Registry type |
| `arg1` | `string` | Helper name |
| `arg2` | `any` | The helper class or module |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `discovered` | `object` | Which registry types have been discovered |
| `registered` | `array` | Names of project-level helpers that were discovered (type.name) |

## Examples

**features.helpers**

```ts
const helpers = container.feature('helpers', { enable: true })

// Discover all helper types
await helpers.discoverAll()

// Discover a specific type
await helpers.discover('features')

// Unified view of all available helpers
console.log(helpers.available)
```



**discover**

```ts
const names = await container.helpers.discover('features')
console.log(names) // ['myCustomFeature']
```



**discoverAll**

```ts
const results = await container.helpers.discoverAll()
// { features: ['myFeature'], clients: [], servers: [], commands: ['deploy'], endpoints: [] }
```



**lookup**

```ts
const FsClass = container.helpers.lookup('features', 'fs')
```



**available**

```ts
container.helpers.available
// { features: ['fs', 'git', ...], clients: ['rest', 'websocket'], ... }
```

