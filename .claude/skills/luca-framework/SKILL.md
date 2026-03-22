---
name: Using the luca framework
description: The @soederpop/luca framework, when you see a project with docs/ commands/ features/ luca.cli.ts endpoints/ folders, or @soederpop/luca is in the package.json, or the user is asking you to develop a new Luca feature, use this skill to learn about the APIs and how to learn the framework at runtime.  The luca cli bundles all of the documentation in a searchable, progressively learnable interface designed for students and AI assistants alike
---
# Luca: Learning the Container

The Luca framework `@soederpop/luca` ships a `luca` binary — a bun-based CLI for a dependency injection container. This project is based on it if this skill is present. The container auto-discovers modules in `commands/`, `clients/`, `servers/`, `features/`, and `endpoints/` folders.

The `luca` cli loads typescript modules in through its VM which injects a `container` global that is a singleton object from which you can learn about, and access all different kinds of utils and Helpers (features, clients, servers, commands, and compositions thereof)

There are three things to learn, in this order:

1. **Discover** what the container can do — `luca describe`
2. **Build** new helpers when your project needs them — `luca scaffold`
3. **Prototype** and debug with live code — `luca eval`
4. **Write Runnable Markdown** a great usecase is `luca run markdown.md` where the markdown codeblocks are executed inside the Luca VM.
---

## Phase 1: Discover with `luca describe`

This is your primary tool. Before reading source files, searching for APIs, or writing any code — ask describe. It outputs full documentation for any part of the container: methods, options, events, state, examples.

### See what's available

```shell
luca describe features     # index of all available features
luca describe clients      # index of all available clients
luca describe servers      # index of all available servers
```

You can even learn about features in the browser container, or a specific platform (server, node are the same, browser,web are the same)

```shell
luca describe features --platform=web 
luca describe features --platform=server
```

### Learn about specific helpers

```shell
luca describe fs           # full docs for the fs feature
luca describe git          # full docs for git
luca describe rest         # full docs for the rest client
luca describe express      # full docs for the express server
luca describe git fs proc  # multiple helpers in one shot
```

### Drill into a specific method or getter

Use dot notation to get docs for a single method or getter on any helper:

```shell
luca describe ui.banner            # docs for the banner() method on ui
luca describe fs.readFile          # docs for readFile() on fs
luca describe ui.colors            # docs for the colors getter on ui
luca describe git.branch           # docs for the branch getter on git
```

This shows the description, parameters, return type, and examples for just that member. If the member doesn't exist, it lists all available methods and getters on the helper.

### Get targeted documentation

You can filter to only the sections you need:

```shell
luca describe fs --methods          # just the methods
luca describe git --events          # just the events it emits
luca describe express --options     # just the constructor options
luca describe fs git --examples     # just examples for both
luca describe fs --usage --methods  # combine sections
```

### Describe the container itself

```shell
luca describe              # overview of the container
luca describe self         # same thing
```

### Get help on any command

```shell
luca                       # list all available commands
luca describe --help       # full flag reference for describe
luca help scaffold         # help for any command
```

**Use `luca describe` liberally.** It is the fastest, safest way to understand what the container provides. Every feature, client, and server is self-describing — if you know a name, describe will tell you everything about it. Use dot notation (`ui.banner`, `fs.readFile`) when you need docs on just one method or getter.

---

## Phase 2: Build with `luca scaffold`

When your project needs a new helper, scaffold it. The `scaffold` command generates correct boilerplate — you fill in the logic.

### Learn how to build each type

Before creating anything, read the tutorial for that helper type:

```shell
luca scaffold feature --tutorial    # how features work, full guide
luca scaffold command --tutorial    # how commands work
luca scaffold endpoint --tutorial   # how endpoints work
luca scaffold client --tutorial     # how clients work
luca scaffold server --tutorial     # how servers work
```

These tutorials are the authoritative reference for each helper type. They cover imports, schemas, class structure, registration, conventions, and complete examples.

### Generate a helper

```shell
luca scaffold <type> <name> --description "What it does"
```

The workflow after scaffolding:

```shell
luca scaffold command sync-data --description "Pull data from staging"
# edit commands/sync-data.ts — add your logic
luca describe sync-data            # verify it shows up and reads correctly
```

Every scaffolded helper is auto-discovered by the container at runtime.

### When to use each type

| You need to...                                     | Scaffold a...  | Example                                                        |
|----------------------------------------------------|----------------|----------------------------------------------------------------|
| Add a reusable local capability (caching, crypto)  | **feature**    | `luca scaffold feature disk-cache --description "File-backed key-value cache"` |
| Add a CLI task (build, deploy, generate)           | **command**    | `luca scaffold command deploy --description "Deploy to production"` |
| Talk to an external API or service                 | **client**     | `luca scaffold client github --description "GitHub API wrapper"` |
| Accept incoming connections (HTTP, WS)             | **server**     | `luca scaffold server mqtt --description "MQTT broker"` |
| Add a REST route to `luca serve`                   | **endpoint**   | `luca scaffold endpoint users --description "User management API"` |

### Scaffold options

```shell
luca scaffold command deploy --description "..."    # writes to commands/deploy.ts
luca scaffold endpoint users --print                # print to stdout instead of writing
luca scaffold feature cache --output lib/cache.ts   # override output path
```

---

## Phase 3: Prototype with `luca eval`

Once you know what's available (describe) and how to build things (scaffold), use `luca eval` to test ideas, verify behavior, and debug.

```shell
luca eval "container.features.available"
luca eval "container.feature('proc').exec('ls')"
luca eval "container.feature('fs').readFile('package.json')"
```

The eval command boots a full container with all helpers discovered and registered. Core features are available as top-level shortcuts:

```shell
luca eval "fs.readFile('package.json')"
luca eval "git.branch"
luca eval "proc.exec('ls')"
```

**Reach for eval when you're stuck.** It gives you full control of the container at runtime — you can test method calls, inspect state, verify event behavior, and debug issues that are hard to reason about from docs alone.

**Use eval as a testing tool.** Before wiring up a full command handler or feature, test your logic in eval first. Want to verify how `fs.moveAsync` behaves, or whether a watcher event fires the way you expect? Run it in eval. This is the fastest way to validate container code without the overhead of building the full command around it.

```shell
# Test file operations before building a command around them
luca eval "await fs.moveAsync('inbox/test.json', 'inbox/valid/test.json')"

# First: luca describe fileManager --events  (to learn what events exist)
# Then test the behavior:
luca eval "const fm = container.feature('fileManager'); fm.on('file:change', (e) => console.log(e)); await fm.watch({ paths: ['inbox'] })"
```

### The REPL

For interactive exploration, `luca console` opens a persistent REPL with the container in scope. Useful when you need to try multiple things in sequence.

---

## Key Concepts

### The Container

The container is a singleton that holds everything your application needs. It organizes components into **registries**: features, clients, servers, commands, and endpoints. Use the factory functions to get instances:

```js
const fs = container.feature('fs')
const rest = container.client('rest')
const server = container.server('express')
```

### State

Every helper and the container itself have observable state:

```js
const feature = container.feature('fs')

feature.state.current              // snapshot of all state
feature.state.get('someKey')       // single value
feature.state.set('key', 'value')  // update

// Watch for changes
feature.state.observe((changeType, key, value) => {
  // changeType: 'add' | 'update' | 'delete'
})
```

The container has state too: `container.state.current`, `container.state.observe()`.

### Events

Every helper and the container are event emitters — `on`, `once`, `emit`, `waitFor` all work as expected. Use `luca describe <name> --events` to see what a helper emits.

### Utilities

The container provides common utilities at `container.utils` — no external imports needed:

- `container.utils.uuid()` — v4 UUID
- `container.utils.hashObject(obj)` — deterministic hash
- `container.utils.stringUtils` — camelCase, kebabCase, pluralize, etc.
- `container.utils.lodash` — groupBy, keyBy, pick, omit, debounce, etc.
- `container.paths.resolve()` / `container.paths.join()` — path operations

### Programmatic introspection

Everything `luca describe` outputs is also available at runtime in code:

```js
container.features.describe('fs')   // markdown docs (same as the CLI)
feature.introspect()                // structured object: { methods, events, state, options }
container.inspectAsText()           // full container overview as markdown
```

This is useful inside commands and scripts where you need introspection data programmatically.

---

## Server development troubleshooting

- You can use `container.proc.findPidsByPort(3000)` which will return an array of numbers.
- You can use `container.proc.kill(pid)` to kill that process
- You can combine these two functions in `luca eval` if a server you're developing won't start because a previous instance is running (common inside e.g. claude code sessions )
- `luca serve --force` will also replace the running process with the current one
- `luca serve --any-port` will open on any port


## Reference

- `references/api-docs/` — full pre-generated API reference for every built-in feature, client, and server
- `references/examples/` — runnable example docs for each feature (e.g. `fs.md`, `git.md`, `proc.md`)
- `references/tutorials/` — step-by-step tutorials covering the container, helpers, commands, endpoints, and more
