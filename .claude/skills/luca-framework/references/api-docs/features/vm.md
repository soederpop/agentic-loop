# VM (features.vm)

The VM feature provides Node.js virtual machine capabilities for executing JavaScript code. This feature wraps Node.js's built-in `vm` module to provide secure code execution in isolated contexts. It's useful for running untrusted code, creating sandboxed environments, or dynamically executing code with controlled access to variables and modules.

## Usage

```ts
container.feature('vm', {
  // Default context object to inject into the VM execution environment
  context,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `context` | `any` | Default context object to inject into the VM execution environment |

## Methods

### defineModule

Register a virtual module that will be available to `require()` inside VM-executed code. Modules registered here take precedence over Node's native resolution.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✓ | The module specifier (e.g. `'@soederpop/luca'`, `'zod'`) |
| `exports` | `any` | ✓ | The module's exports object |

**Returns:** `void`

```ts
const vm = container.feature('vm')
vm.defineModule('@soederpop/luca', { Container, Feature, fs, proc })
vm.defineModule('zod', { z })

// Now loadModule can resolve these in user code:
// import { Container } from '@soederpop/luca'  → works
```



### createRequireFor

Build a require function that resolves from the virtual modules map first, falling back to Node's native `createRequire` for everything else.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | ✓ | The file path to scope native require resolution to |

**Returns:** `void`



### createScript

Creates a new VM script from the provided code. This method compiles JavaScript code into a VM script that can be executed multiple times in different contexts. The script is pre-compiled for better performance when executing the same code repeatedly.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The JavaScript code to compile into a script |
| `options` | `vm.ScriptOptions` |  | Options for script compilation |

**Returns:** `void`

```ts
const script = vm.createScript('Math.max(a, b)')

// Execute the script multiple times with different contexts
const result1 = script.runInContext(vm.createContext({ a: 5, b: 3 }))
const result2 = script.runInContext(vm.createContext({ a: 10, b: 20 }))
```



### isContext

Check whether an object has already been contextified by `vm.createContext()`. Useful to avoid double-contextifying when you're not sure if the caller passed a plain object or an existing context.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ctx` | `unknown` | ✓ | The object to check |

**Returns:** `ctx is vm.Context`

```ts
const ctx = vm.createContext({ x: 1 })
vm.isContext(ctx)   // true
vm.isContext({ x: 1 }) // false
```



### createContext

Create an isolated JavaScript execution context. Combines the container's context with any additional variables provided. If the input is already a VM context, it is returned as-is.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ctx` | `any` |  | Additional context variables to include |

**Returns:** `void`

```ts
const context = vm.createContext({ user: { name: 'John' } })
const result = vm.runSync('user.name', context)
```



### wrapTopLevelAwait

Wrap code containing top-level `await` in an async IIFE, injecting `return` before the last expression so the value is not lost. If the code does not contain `await`, or is already wrapped in an async function/arrow, it is returned unchanged.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | Parameter code |

**Returns:** `string`



### run

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | Parameter code |
| `ctx` | `any` |  | Parameter ctx |

**Returns:** `Promise<T>`



### runSync

Execute JavaScript code synchronously in a controlled environment.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The JavaScript code to execute |
| `ctx` | `any` |  | Context variables to make available to the executing code |

**Returns:** `T`

```ts
const sum = vm.runSync('a + b', { a: 2, b: 3 })
console.log(sum) // 5
```



### perform

Execute code asynchronously and return both the result and the execution context. Unlike `run`, this method also returns the context object, allowing you to inspect variables set during execution.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The JavaScript code to execute |
| `ctx` | `any` |  | Context variables to make available to the executing code |

**Returns:** `Promise<{ result: T, context: vm.Context }>`

```ts
const { result, context } = await vm.perform('x = 42; x * 2', { x: 0 })
console.log(result)     // 84
console.log(context.x)  // 42
```



### performSync

Executes JavaScript code synchronously and returns both the result and the execution context. Unlike `runSync`, this method also returns the context object, allowing you to inspect variables set during execution (e.g. `module.exports`). This is the synchronous equivalent of `perform()`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `code` | `string` | ✓ | The JavaScript code to execute |
| `ctx` | `any` |  | Context variables to make available to the executing code |

**Returns:** `{ result: T, context: vm.Context }`

```ts
const { result, context } = vm.performSync(code, {
 exports: {},
 module: { exports: {} },
})
const moduleExports = context.module?.exports || context.exports
```



### loadModule

Synchronously loads a JavaScript/TypeScript module from a file path, executing it in an isolated VM context and returning its exports. The module gets `require`, `exports`, and `module` globals automatically, plus any additional context you provide.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | ✓ | Absolute path to the module file to load |
| `ctx` | `any` |  | Additional context variables to inject into the module's execution environment |

**Returns:** `Record<string, any>`

```ts
const vm = container.feature('vm')

// Load a tools module, injecting the container
const tools = vm.loadModule('/path/to/tools.ts', { container, me: assistant })
// tools.myFunction, tools.schemas, etc.
```



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.vm**

```ts
const vm = container.feature('vm')

// Execute simple code
const result = vm.run('1 + 2 + 3')
console.log(result) // 6

// Execute code with custom context
const result2 = vm.run('greeting + " " + name', { 
 greeting: 'Hello', 
 name: 'World' 
})
console.log(result2) // 'Hello World'
```



**defineModule**

```ts
const vm = container.feature('vm')
vm.defineModule('@soederpop/luca', { Container, Feature, fs, proc })
vm.defineModule('zod', { z })

// Now loadModule can resolve these in user code:
// import { Container } from '@soederpop/luca'  → works
```



**createScript**

```ts
const script = vm.createScript('Math.max(a, b)')

// Execute the script multiple times with different contexts
const result1 = script.runInContext(vm.createContext({ a: 5, b: 3 }))
const result2 = script.runInContext(vm.createContext({ a: 10, b: 20 }))
```



**isContext**

```ts
const ctx = vm.createContext({ x: 1 })
vm.isContext(ctx)   // true
vm.isContext({ x: 1 }) // false
```



**createContext**

```ts
const context = vm.createContext({ user: { name: 'John' } })
const result = vm.runSync('user.name', context)
```



**runSync**

```ts
const sum = vm.runSync('a + b', { a: 2, b: 3 })
console.log(sum) // 5
```



**perform**

```ts
const { result, context } = await vm.perform('x = 42; x * 2', { x: 0 })
console.log(result)     // 84
console.log(context.x)  // 42
```



**performSync**

```ts
const { result, context } = vm.performSync(code, {
 exports: {},
 module: { exports: {} },
})
const moduleExports = context.module?.exports || context.exports
```



**loadModule**

```ts
const vm = container.feature('vm')

// Load a tools module, injecting the container
const tools = vm.loadModule('/path/to/tools.ts', { container, me: assistant })
// tools.myFunction, tools.schemas, etc.
```

