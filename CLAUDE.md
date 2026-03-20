# The Agentic Loop

## The Contentbase Collection [docs](./docs)

Contentbase is an ORM for organized collections of structured markdown files with YAML frontmatter. 

This project installs the [contentbase](https://npmjs.com/package/contentbase) library and the `cnotes` CLI tool for working with it.

You also have the [Contentbase](./.claude/skills/contentbase/SKILL.md) that teaches you how to work with it.

The folder organization, file naming, and heading patterns are all meaningful and important.  The `cnotes validate` utility will tell you if your documents don't conform.

The structure of the documents allow us to turn them into data structures which we can feed into automation workflows.  

The compromise between the author, and the structure, is that this minimum level of structural discipline can serve as a 100x lever when it comes to steering a swarm of AI assistants in a desirable direction, for a sustained enough period of time, to achieve success in our efforts and be able to reliably measure its progress toward our real world goals.  

For full help on the CLI

```shell
cnotes --help
```

For information on this particular project's content model:

```shell
cnotes inspect
```


## The Luca Framework 

This project uses the [Luca framework](https://github.com/soederpop/luca) — Lightweight Universal Conversational Architecture.

It can be used to build any kind of server, process, script, daemon on the server, and any kind of stateful, reactive web application on the frontend.

For a deep dive into the framework internals, see the [Luca GitHub repository](https://github.com/soederpop/luca).

You also have the [Luca Framework Skill](.claude/skils/luca-framework/SKILL.md)

### Runtime

The runtime is **bun**. Use `bun run` for scripts, `bun test` for tests.

### The `luca` CLI

The `luca` binary is available in the path. Key commands:

- `luca` — list available commands (built-in + project commands)
- `luca eval "expression"` — evaluate JS with the container in scope
- `luca describe <name>` — full docs for any feature, client, or server (e.g. `luca describe fs`)
- `luca describe features` — index of all available features (also: `clients`, `servers`)
- `luca serve` — start a local server using `endpoints/` folder
- `luca run script.ts` — run a script with the container
- `luca scaffold <type> <name>` — generate boilerplate for a new helper (run `luca scaffold` for full help)

### Container Rules

- **NEVER import from `fs`, `path`, or other Node builtins.** Use `container.feature('fs')` for file operations, `container.paths` for path operations.
- The container should provide everything you need. If something is missing, raise the concern rather than pulling in external dependencies.
- Use `container.utils` for common utilities (uuid, lodash helpers, string utils).

### Learning the Framework

1. **Discover** — Run `luca describe features`, `luca describe clients`, `luca describe servers` to see what's available. Then `luca describe <name>` for full docs on any helper. This is your first move, always. (See `.claude/skills/luca-framework/SKILL.md` for the full mental model.)
2. **Build** — Run `luca scaffold <type> --tutorial` before creating a new helper. It covers the full guide for that type.
3. **Prototype** — Use `luca eval "expression"` to test container code before wiring up full handlers. Reach for eval when you're stuck — it gives you full runtime access.
4. **Reference** — Browse `.claude/skills/luca-framework/references/api-docs/` for pre-generated API docs

### Project Structure

- `commands/` — custom CLI commands, run via `luca <commandName>` (auto-discovered)
- `endpoints/` — file-based HTTP routes, served via `luca serve` (auto-discovered)
- `features/` — custom container features, discovered via `container.helpers.discoverAll()` (auto-discovered)
- `docs/` — content documents managed by the `contentDb` feature (`container.docs`). See [contentbase](https://github.com/soederpop/contentbase) for the document model system.
- `luca.cli.ts` — optional project-level CLI customization (runs before any command)

### Command Arguments

Command handlers receive `(options, context)`. The `options` object contains:
- **Named flags** from `argsSchema`: `--verbose` → `options.verbose`
- **Positional args** mapped via `positionals` export: `luca cmd ./src` → `options.target`
- **Raw positionals** in `options._`: array where `_[0]` is the command name, `_[1+]` are positional args

To accept positional arguments, export a `positionals` array that maps them to named fields in `argsSchema`:

```ts
export const positionals = ['target']  // luca myCmd ./src => options.target === './src'
export const argsSchema = z.object({
  target: z.string().optional().describe('The target to operate on'),
  verbose: z.boolean().default(false).describe('Enable verbose output'),
})
```

### What's Available

The container provides more than you might expect. Before importing anything external, check here:

- **YAML** — `container.feature('yaml')` wraps `js-yaml`. Use `.parse(str)` and `.stringify(obj)`.
- **SQLite** — `container.feature('sqlite')` for databases. Parameterized queries, tagged templates.
- **REST client** — `container.client('rest', { baseURL })`. Methods (`get`, `post`, etc.) return **parsed JSON directly**, not `{ data, status, headers }`. On HTTP errors, the error is returned (not thrown).
- **Content DB** — `container.docs` (alias for `container.feature('contentDb')`) manages markdown documents with frontmatter. Query with `docs.query(docs.models.MyModel).fetchAll()`.
- **Grep** — `container.feature('grep')` has `search()` and `codeAnnotations()` for finding TODOs/FIXMEs/etc.
- **chalk** — available as `container.feature('ui').colors`, not via `import('chalk')`.
- **figlet** — available as `container.feature('ui').asciiArt(text)`.
- **uuid** — `container.utils.uuid()`
- **lodash** — `container.utils.lodash` (groupBy, keyBy, pick, omit, debounce, etc.)
- **string utils** — `container.utils.stringUtils` (camelCase, kebabCase, pluralize, etc.)

### Known Gotchas

- **For DELETE endpoint handlers, use `export { del as delete }`** — `delete` is a JS reserved word. Define your function with any name, then re-export it as `delete`.
- **Bun globals (`Bun.spawn`, `Bun.serve`) are unavailable** in command/endpoint handlers. Use Node's `child_process` for spawning processes, or use `container.feature('proc').exec()`.
- **`ui.print.*` writes to stdout** — if your command supports `--json`, gate UI output behind `if (!options.json)`.
- **VM contexts start empty** — when using `container.feature('vm')`, inject globals explicitly (`console`, `Date`, `Promise`, `crypto`, `TextEncoder`, `setTimeout`).
- **Long-running commands** (servers, watchers) need `await new Promise(() => {})` at the end with a `process.on('SIGINT', ...)` handler for cleanup.
- **Shared state between endpoints**: use `ctx.request.app.locals` to share data across endpoint files.
- **Database init**: use `luca.cli.ts` `main()` hook for table creation and seeding — it runs before any command or server starts.

### Extending the Container

Use `luca scaffold` to generate new helpers:

```sh
luca scaffold command myTask --description "Automate something"
luca scaffold feature myCache --description "Custom caching layer"
luca scaffold endpoint users --description "User management API"
```

Run `luca scaffold` with no arguments for full usage and examples.

## Extending the Agentic Loop

- See the guide [Extending the Agentic Loop](./docs/guides/extending-the-agentic-loop.md)

## Git Strategy

Roll on main. Commit with good messages that explain why, not just what.
