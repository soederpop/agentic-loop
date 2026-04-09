---
tags: [workflow, migration, luca]
inputs:
  workflow:
    description: "Which workflow to migrate (e.g. dashboard, project-builder, review)"
    type: input
repeatable: true
---

# Migrate Workflow Frontend to Luca Feature

Migrate the **{{workflow}}** workflow's frontend (`workflows/{{workflow}}/public/index.html`) to use proper Luca browser features instead of raw fetch/DOM/global state. Your features can compose other features, clients, etc.

## Context

The prompt-studio workflow established a pattern for browser-side Luca features. You need to apply it to the {{workflow}} workflow.

## The Pattern

Every workflow frontend should:

1. **Import the Luca browser container singleton** (the default export):

```ts skip
const { default: container } = await import('https://esm.sh/@soederpop/luca@0.0.28/src/browser.ts')
```

2. **Get the Feature base class** from a built-in feature's prototype chain:

```ts skip
const Feature = Object.getPrototypeOf(container.feature('vm').constructor)
```

3. **Design multiple features with distinct responsibilities** — don't put everything in one class. Then define a central orchestrator feature that composes them.

4. **Boot the features via the container** after all UI event bindings are in place.

5. **Expose on window** for browser-use automation and debugging:
   - `window.app` = the central orchestrator feature instance
   - `window.luca` = the container

## Feature Architecture

### Separation of Concerns

Don't put everything in one feature. Break the workflow into distinct features by responsibility:

```
ApiClient feature     — wraps all fetch() calls to backend endpoints
DataStore feature     — manages loaded data, caching, filtering, sorting
QueueManager feature  — if the workflow has a queue/execution concept
StreamHandler feature — SSE/WebSocket streaming concerns
AppController feature — central orchestrator that composes the above
```

The number and shape of features depends on the workflow. A simple workflow might only need 2-3. The key principle: each feature should have one clear job.

### Defining Feature Schemas

Every feature MUST define Zod schemas for its **state**, **options**, and **events**. These schemas ARE the documentation — they make the feature introspectable by other features, by the server, and by assistants.

The Feature base class provides schema statics. Since we don't have direct Zod import in the browser, use the Feature's schema helpers or define schemas inline. Here's the full pattern:

```ts skip
class ProjectStore extends Feature {
  static shortcut = 'features.projectStore'

  // ── State Schema ──
  // State is observable. Changes emit events. Other features can watch it.
  // Define what your state keys are, their types, and what they mean.
  static stateSchema = {
    projects: { type: 'array', default: [], describe: 'All loaded project documents' },
    currentProject: { type: 'object', default: null, describe: 'Currently selected project' },
    loading: { type: 'boolean', default: false, describe: 'True while fetching from API' },
    filter: { type: 'string', default: 'all', describe: 'Active filter (all|draft|approved|building)' },
  }

  // ── Options Schema ──
  // Validated when the feature is created via container.feature('projectStore', options).
  // Use for configuration that doesn't change after init.
  static optionsSchema = {
    apiBase: { type: 'string', default: '', describe: 'Base URL for API calls (defaults to window.location.origin)' },
    pollInterval: { type: 'number', default: 0, describe: 'Auto-refresh interval in ms (0 = disabled)' },
  }

  // ── Events Schema ──
  // Each key is an event name. Describe when it fires and what the listener receives.
  // This is what makes the feature discoverable and toolable.
  static eventsSchema = {
    'projects:loaded':   { args: ['projects'],     describe: 'Fired after projects are fetched. Listener receives the array.' },
    'project:selected':  { args: ['project'],      describe: 'Fired when a project is selected. Listener receives the project object.' },
    'project:created':   { args: ['project'],      describe: 'Fired after a new project is created.' },
    'project:updated':   { args: ['project'],      describe: 'Fired after a project is updated.' },
    'error':             { args: ['error'],         describe: 'Fired on any API or processing error.' },
  }

  static { Feature.register(this, 'projectStore') }

  async start() {
    const apiBase = this.options?.apiBase || window.location.origin
    this.state.set('loading', true)
    // ... load data, set state, emit events
    this.state.set('loading', false)
  }
}
```

### The Central Orchestrator (AppController)

One feature must serve as the **central orchestrator**. This is the feature exposed on `window.app`. It:

- Composes the other features (accesses them via `container.feature('...')`)
- Provides high-level methods that coordinate across features
- Exposes a **toolable API** — every public method is a potential tool call for a server-side assistant

```ts skip
class AppController extends Feature {
  static shortcut = 'features.appController'

  static stateSchema = {
    ready: { type: 'boolean', default: false, describe: 'True after all sub-features have initialized' },
    activeView: { type: 'string', default: 'main', describe: 'Current UI view/tab name' },
  }

  static eventsSchema = {
    'ready':        { args: [],             describe: 'All features initialized and data loaded' },
    'view:changed': { args: ['viewName'],   describe: 'UI switched to a different view/tab' },
    'action:complete': { args: ['action', 'result'], describe: 'A high-level user action completed' },
  }

  static { Feature.register(this, 'appController') }

  // ── Composed features (lazy access) ──
  get store() { return this.container.feature('projectStore') }
  get queue() { return this.container.feature('queueManager') }
  get stream() { return this.container.feature('streamHandler') }

  // ── High-level methods (toolable API) ──
  // Each of these could be invoked by a server-side assistant as a tool.
  // Name them as clear verbs. Document with JSDoc.

  /**
   * Load all data and prepare the UI
   * @returns {Promise<void>}
   */
  async start() {
    await this.store.start()
    this.state.set('ready', true)
    this.emit('ready')
  }

  /**
   * Switch the active UI view
   * @param {string} viewName - The view to switch to
   */
  switchView(viewName) {
    this.state.set('activeView', viewName)
    this.emit('view:changed', viewName)
  }

  /**
   * Select an item and display it
   * @param {string} slug - The item slug to select
   */
  async selectItem(slug) {
    const item = await this.store.select(slug)
    this.emit('action:complete', 'selectItem', item)
    return item
  }

  /**
   * Get the full state snapshot (useful for assistants)
   * @returns {object} Current state across all features
   */
  snapshot() {
    return {
      ready: this.state.get('ready'),
      activeView: this.state.get('activeView'),
      store: this.store.state.current,
      queue: this.queue?.state?.current,
    }
  }

}
```

## What to Extract Into Features

Look at the existing `index.html` and identify:

- **All `fetch()` calls** to the workflow's API endpoints → an ApiClient or DataStore feature
- **All mutable state** (arrays, objects, flags) → state schemas on the appropriate feature
- **All business logic** (sorting, filtering, transforms) → methods on a DataStore or domain-specific feature
- **Event patterns** (SSE streams, WebSocket handlers, polling) → a StreamHandler feature
- **UI coordination** (tab switching, modal management, multi-step flows) → the AppController

The UI code (DOM rendering) should only:
- Listen to feature events (`app.store.on('projects:loaded', renderList)`)
- Call feature methods (`app.selectItem(slug)`)
- Read feature state (`app.store.state.get('projects')`)
- Render DOM based on the above

## What NOT to Change

- Don't change the CSS or HTML structure unless it's broken
- Don't change the backend endpoints or `luca.serve.ts`
- Don't change the ABOUT.md
- Keep all existing functionality working — this is a refactor, not a rewrite
- The `<script>` must remain `type="module"` for top-level await

## Steps

1. Read the current `workflows/{{workflow}}/public/index.html` fully
2. Read `workflows/{{workflow}}/luca.serve.ts` and the endpoints to understand the API surface
3. Read `workflows/{{workflow}}/ABOUT.md` for context
4. Identify all state, fetch calls, and business logic in the frontend JS
5. **Design the feature architecture** — what distinct features are needed? What are their responsibilities? What state/events does each own?
6. Define schemas for each feature (stateSchema, optionsSchema, eventsSchema)
7. Implement each feature class with clear JSDoc on public methods
8. Implement the AppController that composes them and provides the toolable API
9. Rewrite the `<script type="module">` section:
   - Import container, get Feature base
   - Define all feature classes (smallest/leaf features first, orchestrator last)
   - Register all features
   - Get instances via `container.feature('...')`
   - Bind UI event listeners to feature events
   - Call `app.start()` last
10. Test by starting the server and verifying in the browser:
    ```shell
    luca serve --setup workflows/{{workflow}}/luca.serve.ts --staticDir workflows/{{workflow}}/public --endpoints-dir workflows/{{workflow}}/endpoints --port 9320 --no-open --force
    ```

## Reference Implementation

See `workflows/prompt-studio/public/index.html` for a working reference. Note: prompt-studio currently puts everything in one feature — that was the first pass. The architecture described above (multiple features + orchestrator) is the target pattern going forward.

## Verification

After migration, confirm:
- `window.luca` is the browser container
- `window.luca.features.available` includes ALL your registered feature names
- `window.app` (the orchestrator) has `.snapshot()` and all high-level methods
- Each sub-feature has its own state, events, and methods
- `window.app.snapshot()` returns a meaningful state overview
- All existing functionality works as before
