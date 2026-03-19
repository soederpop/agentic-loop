# FS (features.fs)

The FS feature provides methods for interacting with the file system, relative to the container's cwd.

## Usage

```ts
container.feature('fs')
```

## Methods

### readFile

Synchronously reads a file and returns its contents as a string.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path relative to the container's working directory |
| `encoding` | `BufferEncoding | null` |  | The encoding to use. Pass null to get a raw Buffer. |

**Returns:** `string | Buffer`

```ts
const content = fs.readFile('README.md')
const buffer = fs.readFile('image.png', null)
```



### readFileAsync

Asynchronously reads a file and returns its contents as a string.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path relative to the container's working directory |
| `encoding` | `BufferEncoding | null` |  | The encoding to use. Pass null to get a raw Buffer. |

**Returns:** `Promise<string | Buffer>`

```ts
const content = await fs.readFileAsync('data.txt')
const buffer = await fs.readFileAsync('image.png', null)
```



### readJson

Synchronously reads and parses a JSON file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to the JSON file |

**Returns:** `void`

```ts
const config = fs.readJson('config.json')
console.log(config.version)
```



### readJsonAsync

Asynchronously reads and parses a JSON file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to the JSON file |

**Returns:** `void`

```ts
const config = await fs.readJsonAsync('config.json')
console.log(config.version)
```



### readdirSync

Synchronously reads the contents of a directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The directory path relative to the container's working directory |

**Returns:** `void`

```ts
const entries = fs.readdirSync('src')
console.log(entries) // ['index.ts', 'utils.ts', 'components']
```



### readdir

Asynchronously reads the contents of a directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The directory path relative to the container's working directory |

**Returns:** `void`

```ts
const entries = await fs.readdir('src')
console.log(entries) // ['index.ts', 'utils.ts', 'components']
```



### writeFile

Synchronously writes content to a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path where content should be written |
| `content` | `Buffer | string` | ✓ | The content to write to the file |

**Returns:** `void`

```ts
fs.writeFile('output.txt', 'Hello World')
fs.writeFile('data.bin', Buffer.from([1, 2, 3, 4]))
```



### writeFileAsync

Asynchronously writes content to a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path where content should be written |
| `content` | `Buffer | string` | ✓ | The content to write to the file |

**Returns:** `void`

```ts
await fs.writeFileAsync('output.txt', 'Hello World')
await fs.writeFileAsync('data.bin', Buffer.from([1, 2, 3, 4]))
```



### writeJson

Synchronously writes an object to a file as JSON.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path where the JSON should be written |
| `data` | `any` | ✓ | The data to serialize as JSON |
| `indent` | `number` |  | The number of spaces to use for indentation |

**Returns:** `void`

```ts
fs.writeJson('config.json', { version: '1.0.0', debug: false })
```



### writeJsonAsync

Asynchronously writes an object to a file as JSON.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path where the JSON should be written |
| `data` | `any` | ✓ | The data to serialize as JSON |
| `indent` | `number` |  | The number of spaces to use for indentation |

**Returns:** `void`

```ts
await fs.writeJsonAsync('config.json', { version: '1.0.0', debug: false })
```



### appendFile

Synchronously appends content to a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path to append to |
| `content` | `Buffer | string` | ✓ | The content to append |

**Returns:** `void`

```ts
fs.appendFile('log.txt', 'New line\n')
```



### appendFileAsync

Asynchronously appends content to a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path to append to |
| `content` | `Buffer | string` | ✓ | The content to append |

**Returns:** `void`

```ts
await fs.appendFileAsync('log.txt', 'New line\n')
```



### ensureFile

Synchronously ensures a file exists with the specified content, creating directories as needed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path where the file should be created |
| `content` | `string` | ✓ | The content to write to the file |
| `overwrite` | `any` |  | Whether to overwrite the file if it already exists |

**Returns:** `void`

```ts
fs.ensureFile('logs/app.log', '', false)
```



### ensureFileAsync

Asynchronously ensures a file exists with the specified content, creating directories as needed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path where the file should be created |
| `content` | `string` | ✓ | The content to write to the file |
| `overwrite` | `any` |  | Whether to overwrite the file if it already exists |

**Returns:** `void`

```ts
await fs.ensureFileAsync('config/settings.json', '{}', true)
```



### ensureFolder

Synchronously ensures a directory exists, creating parent directories as needed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The directory path to create |

**Returns:** `void`

```ts
fs.ensureFolder('logs/debug')
```



### ensureFolderAsync

Asynchronously ensures a directory exists, creating parent directories as needed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The directory path to create |

**Returns:** `void`

```ts
await fs.ensureFolderAsync('logs/debug')
```



### mkdirp

Alias for ensureFolder. Synchronously creates a directory and all parent directories.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `folder` | `string` | ✓ | The directory path to create |

**Returns:** `void`

```ts
fs.mkdirp('deep/nested/path')
```



### exists

Synchronously checks if a file or directory exists.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check for existence |

**Returns:** `boolean`

```ts
if (fs.exists('config.json')) {
 console.log('Config file exists!')
}
```



### existsSync

Alias for exists. Synchronously checks if a file or directory exists.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check for existence |

**Returns:** `boolean`

```ts
if (fs.existsSync('config.json')) {
 console.log('Config file exists!')
}
```



### existsAsync

Asynchronously checks if a file or directory exists.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check for existence |

**Returns:** `void`

```ts
if (await fs.existsAsync('config.json')) {
 console.log('Config file exists!')
}
```



### stat

Synchronously returns the stat object for a file or directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to stat |

**Returns:** `void`

```ts
const info = fs.stat('package.json')
console.log(info.size, info.mtime)
```



### statAsync

Asynchronously returns the stat object for a file or directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to stat |

**Returns:** `void`

```ts
const info = await fs.statAsync('package.json')
console.log(info.size, info.mtime)
```



### isFile

Synchronously checks if a path is a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check |

**Returns:** `boolean`

```ts
if (fs.isFile('package.json')) {
 console.log('It is a file')
}
```



### isFileAsync

Asynchronously checks if a path is a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check |

**Returns:** `Promise<boolean>`

```ts
if (await fs.isFileAsync('package.json')) {
 console.log('It is a file')
}
```



### isDirectory

Synchronously checks if a path is a directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check |

**Returns:** `boolean`

```ts
if (fs.isDirectory('src')) {
 console.log('It is a directory')
}
```



### isDirectoryAsync

Asynchronously checks if a path is a directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check |

**Returns:** `Promise<boolean>`

```ts
if (await fs.isDirectoryAsync('src')) {
 console.log('It is a directory')
}
```



### rmSync

Synchronously removes a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path of the file to remove |

**Returns:** `void`

```ts
fs.rmSync('temp/cache.tmp')
```



### rm

Asynchronously removes a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path of the file to remove |

**Returns:** `void`

```ts
await fs.rm('temp/cache.tmp')
```



### rmdirSync

Synchronously removes a directory and all its contents.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `dirPath` | `string` | ✓ | The path of the directory to remove |

**Returns:** `void`

```ts
fs.rmdirSync('temp/cache')
```



### rmdir

Asynchronously removes a directory and all its contents.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `dirPath` | `string` | ✓ | The path of the directory to remove |

**Returns:** `void`

```ts
await fs.rmdir('temp/cache')
```



### copy

Synchronously copies a file or directory. Auto-detects whether the source is a file or directory and handles each appropriately (recursive for directories).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | The source path to copy from |
| `dest` | `string` | ✓ | The destination path to copy to |
| `options` | `{ overwrite?: boolean }` |  | Copy options |

`{ overwrite?: boolean }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `overwrite` | `any` | Whether to overwrite existing files at the destination |

**Returns:** `void`

```ts
fs.copy('src/config.json', 'backup/config.json')
fs.copy('src', 'backup/src')
```



### copyAsync

Asynchronously copies a file or directory. Auto-detects whether the source is a file or directory and handles each appropriately (recursive for directories).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | The source path to copy from |
| `dest` | `string` | ✓ | The destination path to copy to |
| `options` | `{ overwrite?: boolean }` |  | Copy options |

`{ overwrite?: boolean }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `overwrite` | `any` | Whether to overwrite existing files at the destination |

**Returns:** `void`

```ts
await fs.copyAsync('src/config.json', 'backup/config.json')
await fs.copyAsync('src', 'backup/src')
```



### move

Synchronously moves (renames) a file or directory. Falls back to copy + delete for cross-device moves.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | The source path to move from |
| `dest` | `string` | ✓ | The destination path to move to |

**Returns:** `void`

```ts
fs.move('temp/draft.txt', 'final/document.txt')
fs.move('old-dir', 'new-dir')
```



### moveAsync

Asynchronously moves (renames) a file or directory. Falls back to copy + delete for cross-device moves.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | The source path to move from |
| `dest` | `string` | ✓ | The destination path to move to |

**Returns:** `void`

```ts
await fs.moveAsync('temp/draft.txt', 'final/document.txt')
await fs.moveAsync('old-dir', 'new-dir')
```



### walk

Recursively walks a directory and returns arrays of file and directory paths. By default paths are absolute. Pass `relative: true` to get paths relative to `basePath`. Supports filtering with exclude and include glob patterns.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `basePath` | `string` | ✓ | The base directory path to start walking from |
| `options` | `WalkOptions` |  | Options to configure the walk behavior |

`WalkOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `directories` | `boolean` | Whether to include directories in results |
| `files` | `boolean` | Whether to include files in results |
| `exclude` | `string | string[]` | ] - Glob patterns to exclude (e.g. 'node_modules', '*.log') |
| `include` | `string | string[]` | ] - Glob patterns to include (only matching paths are returned) |
| `relative` | `boolean` | When true, returned paths are relative to `baseDir` instead of absolute. |

**Returns:** `void`

```ts
const result = fs.walk('src', { files: true, directories: false })
const filtered = fs.walk('.', { exclude: ['node_modules', '.git'], include: ['*.ts'] })
const relative = fs.walk('inbox', { relative: true }) // => { files: ['contact-1.json', ...] }
```



### walkAsync

Asynchronously and recursively walks a directory and returns arrays of file and directory paths. By default paths are absolute. Pass `relative: true` to get paths relative to `baseDir`. Supports filtering with exclude and include glob patterns.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `baseDir` | `string` | ✓ | The base directory path to start walking from |
| `options` | `WalkOptions` |  | Options to configure the walk behavior |

`WalkOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `directories` | `boolean` | Whether to include directories in results |
| `files` | `boolean` | Whether to include files in results |
| `exclude` | `string | string[]` | ] - Glob patterns to exclude (e.g. 'node_modules', '.git') |
| `include` | `string | string[]` | ] - Glob patterns to include (only matching paths are returned) |
| `relative` | `boolean` | When true, returned paths are relative to `baseDir` instead of absolute. |

**Returns:** `void`

```ts
const result = await fs.walkAsync('src', { exclude: ['node_modules'] })
const files = await fs.walkAsync('inbox', { relative: true })
// files.files => ['contact-1.json', 'subfolder/file.txt', ...]
```



### findUp

Synchronously finds a file by walking up the directory tree from the current working directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileName` | `string` | ✓ | The name of the file to search for |
| `options` | `{ cwd?: string }` |  | Options for the search |

`{ cwd?: string }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `cwd` | `any` | The directory to start searching from (defaults to container.cwd) |

**Returns:** `string | null`

```ts
const packageJson = fs.findUp('package.json')
if (packageJson) {
 console.log(`Found package.json at: ${packageJson}`)
}
```



### findUpAsync

Asynchronously finds a file by walking up the directory tree.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileName` | `string` | ✓ | The name of the file to search for |
| `options` | `{ cwd?: string; multiple?: boolean }` |  | Options for the search |

`{ cwd?: string; multiple?: boolean }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `cwd` | `any` | The directory to start searching from (defaults to container.cwd) |
| `multiple` | `any` | Whether to find multiple instances of the file |

**Returns:** `Promise<string | string[] | null>`

```ts
const packageJson = await fs.findUpAsync('package.json')
const allPackageJsons = await fs.findUpAsync('package.json', { multiple: true })
```



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.fs**

```ts
const fs = container.feature('fs')
const content = fs.readFile('package.json')
const exists = fs.exists('tsconfig.json')
await fs.writeFileAsync('output.txt', 'Hello World')
fs.writeFile('sync-output.txt', 'Hello Sync')
fs.copy('src', 'backup/src')
```



**readFile**

```ts
const content = fs.readFile('README.md')
const buffer = fs.readFile('image.png', null)
```



**readFileAsync**

```ts
const content = await fs.readFileAsync('data.txt')
const buffer = await fs.readFileAsync('image.png', null)
```



**readJson**

```ts
const config = fs.readJson('config.json')
console.log(config.version)
```



**readJsonAsync**

```ts
const config = await fs.readJsonAsync('config.json')
console.log(config.version)
```



**readdirSync**

```ts
const entries = fs.readdirSync('src')
console.log(entries) // ['index.ts', 'utils.ts', 'components']
```



**readdir**

```ts
const entries = await fs.readdir('src')
console.log(entries) // ['index.ts', 'utils.ts', 'components']
```



**writeFile**

```ts
fs.writeFile('output.txt', 'Hello World')
fs.writeFile('data.bin', Buffer.from([1, 2, 3, 4]))
```



**writeFileAsync**

```ts
await fs.writeFileAsync('output.txt', 'Hello World')
await fs.writeFileAsync('data.bin', Buffer.from([1, 2, 3, 4]))
```



**writeJson**

```ts
fs.writeJson('config.json', { version: '1.0.0', debug: false })
```



**writeJsonAsync**

```ts
await fs.writeJsonAsync('config.json', { version: '1.0.0', debug: false })
```



**appendFile**

```ts
fs.appendFile('log.txt', 'New line\n')
```



**appendFileAsync**

```ts
await fs.appendFileAsync('log.txt', 'New line\n')
```



**ensureFile**

```ts
fs.ensureFile('logs/app.log', '', false)
```



**ensureFileAsync**

```ts
await fs.ensureFileAsync('config/settings.json', '{}', true)
```



**ensureFolder**

```ts
fs.ensureFolder('logs/debug')
```



**ensureFolderAsync**

```ts
await fs.ensureFolderAsync('logs/debug')
```



**mkdirp**

```ts
fs.mkdirp('deep/nested/path')
```



**exists**

```ts
if (fs.exists('config.json')) {
 console.log('Config file exists!')
}
```



**existsSync**

```ts
if (fs.existsSync('config.json')) {
 console.log('Config file exists!')
}
```



**existsAsync**

```ts
if (await fs.existsAsync('config.json')) {
 console.log('Config file exists!')
}
```



**stat**

```ts
const info = fs.stat('package.json')
console.log(info.size, info.mtime)
```



**statAsync**

```ts
const info = await fs.statAsync('package.json')
console.log(info.size, info.mtime)
```



**isFile**

```ts
if (fs.isFile('package.json')) {
 console.log('It is a file')
}
```



**isFileAsync**

```ts
if (await fs.isFileAsync('package.json')) {
 console.log('It is a file')
}
```



**isDirectory**

```ts
if (fs.isDirectory('src')) {
 console.log('It is a directory')
}
```



**isDirectoryAsync**

```ts
if (await fs.isDirectoryAsync('src')) {
 console.log('It is a directory')
}
```



**rmSync**

```ts
fs.rmSync('temp/cache.tmp')
```



**rm**

```ts
await fs.rm('temp/cache.tmp')
```



**rmdirSync**

```ts
fs.rmdirSync('temp/cache')
```



**rmdir**

```ts
await fs.rmdir('temp/cache')
```



**copy**

```ts
fs.copy('src/config.json', 'backup/config.json')
fs.copy('src', 'backup/src')
```



**copyAsync**

```ts
await fs.copyAsync('src/config.json', 'backup/config.json')
await fs.copyAsync('src', 'backup/src')
```



**move**

```ts
fs.move('temp/draft.txt', 'final/document.txt')
fs.move('old-dir', 'new-dir')
```



**moveAsync**

```ts
await fs.moveAsync('temp/draft.txt', 'final/document.txt')
await fs.moveAsync('old-dir', 'new-dir')
```



**walk**

```ts
const result = fs.walk('src', { files: true, directories: false })
const filtered = fs.walk('.', { exclude: ['node_modules', '.git'], include: ['*.ts'] })
const relative = fs.walk('inbox', { relative: true }) // => { files: ['contact-1.json', ...] }
```



**walkAsync**

```ts
const result = await fs.walkAsync('src', { exclude: ['node_modules'] })
const files = await fs.walkAsync('inbox', { relative: true })
// files.files => ['contact-1.json', 'subfolder/file.txt', ...]
```



**findUp**

```ts
const packageJson = fs.findUp('package.json')
if (packageJson) {
 console.log(`Found package.json at: ${packageJson}`)
}
```



**findUpAsync**

```ts
const packageJson = await fs.findUpAsync('package.json')
const allPackageJsons = await fs.findUpAsync('package.json', { multiple: true })
```

