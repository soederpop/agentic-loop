# ESBuild (features.esbuild)

A Feature for compiling typescript / esm modules, etc to JavaScript that the container can run at runtime. Uses esbuild for fast, reliable TypeScript/ESM transformation with full format support (esm, cjs, iife).

## Usage

```ts
container.feature('esbuild')
```

## Methods

### transformSync

/** Transform code synchronously

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The code to transform |
| `options` | `esbuild.TransformOptions` |  | The options to pass to esbuild |

**Returns:** `void`



### transform

Transform code asynchronously

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The code to transform |
| `options` | `esbuild.TransformOptions` |  | The options to pass to esbuild |

**Returns:** `void`



### bundle

Bundle one or more entry points, resolving imports and requires into a single output. Supports Node platform by default so require() and Node builtins are handled. Returns in-memory output files unless write is enabled in options.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `entryPoints` | `string[]` | ✓ | File paths to bundle from |
| `options` | `esbuild.BuildOptions` |  | esbuild BuildOptions overrides |

**Returns:** `void`



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.esbuild**

```ts
const esbuild = container.feature('esbuild')
const result = esbuild.transformSync('const x: number = 1')
console.log(result.code) // 'const x = 1;\n'
```

