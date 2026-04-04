# Creating Assistant Workflows

A workflow is a self-contained mini-application that pairs a backend (API endpoints) with a frontend (interactive HTML playground) to accomplish a specific task. Workflows are how assistants present interactive experiences to users — instead of chatting back and forth in text, the assistant spawns a purpose-built UI, the user interacts with it, and structured results flow back.

## The Big Idea

In a traditional assistant conversation, everything is text. The user describes what they want, the assistant responds, back and forth. This works, but it's a bottleneck for anything that involves:

- **Structured input** — filling out forms, making selections, tagging things
- **Visual context** — seeing the state of a system, comparing options side by side
- **Decisions** — approving, rejecting, prioritizing, ranking

Workflows solve this by giving assistants the ability to **materialize interactive UIs on demand**. The assistant doesn't just describe the state of your ideas — it spawns a visual dashboard. It doesn't ask you five questions one at a time — it presents a structured form and collects all the answers at once.

## Architecture

All workflows are served by a single **WorkflowService** feature (`features/workflow-service.ts`) — one Express + WebSocket server on port 7700 that:

- Discovers all workflows and serves each `public/` dir at `/workflows/<name>/`
- Loads ContentDB once and shares it across all workflows
- Mounts shared API endpoints (`/api/goals`, `/api/ideas`, `/api/projects`, `/api/status`, etc.)
- Attaches a ChatService WebSocket at `/ws`
- Loads each workflow's `hooks.ts` and calls `onSetup()` for custom per-workflow routes

A workflow is a folder under `workflows/` with this structure:

```
workflows/
  my-workflow/
    hooks.ts          ← optional: registers custom API routes and logic
    ABOUT.md          ← describes purpose, triggers, when NOT to use
    public/
      index.html      ← the playground UI (single self-contained HTML file)
```

**Minimum viable workflow:** just `public/index.html` and `ABOUT.md`. If the workflow only needs the shared API (goals, ideas, projects, status), no `hooks.ts` is needed.

### How it runs

The WorkflowService starts once and serves all workflows:

```shell
# Typically started by `luca main` or `luca workflow`
# For dev, you can start it directly:
luca serve --setup features/workflow-service.ts --port 7700 --no-open --force
```

Each workflow is then accessible at `http://localhost:7700/workflows/<name>/`.

### The hooks file

Workflows that need custom API routes export an `onSetup` function in `hooks.ts`:

```ts
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

export async function onSetup({ app, chatService, docs, container, broadcast, wss }: WorkflowHooksSetupContext) {
  // `app` — the express app (shared across all workflows)
  // `chatService` — the shared ChatService instance for WebSocket chat
  // `docs` — the shared ContentDB instance (already loaded)
  // `container` — the full luca AGI container
  // `broadcast` — send JSON events to all WebSocket clients
  // `wss` — raw WebSocketServer for custom message routing

  app.get('/api/workflows/my-workflow/data', async (_req, res) => {
    const items = await docs.query(docs.models.Idea).fetchAll()
    res.json({ items: items.map(i => ({ id: i.id, title: i.title })) })
  })

  app.post('/api/workflows/my-workflow/action', async (req, res) => {
    // Process submissions, write docs, return results
    await docs.reload() // Pick up changes after writes
    res.json({ ok: true })
  })

  console.log('[my-workflow] hooks loaded')
}

// Optional: cleanup when the service shuts down
export async function onTeardown() {
  // close connections, stop timers, etc.
}
```

**Important:** Namespace your custom routes under `/api/workflows/<name>/` to avoid conflicts with other workflows and the shared API.

### The shared API

All workflows automatically have access to these endpoints (no hooks.ts needed):

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/goals` | GET | All goals |
| `/api/goals` | POST | Create a goal |
| `/api/ideas` | GET | All ideas |
| `/api/ideas` | POST | Create an idea |
| `/api/vision` | GET | Current vision |
| `/api/vision` | POST | Update vision |
| `/api/projects` | GET | All projects |
| `/api/projects` | POST | Create a project |
| `/api/project/:slug` | GET/PUT | Single project |
| `/api/plans` | POST | Create a plan |
| `/api/plan/:planId` | GET/PUT | Single plan |
| `/api/status` | GET | Full status (goals, ideas, projects, plans, git, recent docs) |
| `/api/assistants` | GET | All assistants |
| `/api/config` | GET | System config (WebSocket URLs, etc.) |
| `/api/workflows` | GET | Workflow index |

### The playground HTML

A single, self-contained HTML file. All CSS and JS inline. The playground loads the **Luca browser container** from esm.sh and builds its UI logic as composable Features:

```html
<script type="module">
  // ── Load Luca browser container ──
  const { default: container } = await import('https://esm.sh/@soederpop/luca@0.0.28/src/browser.ts')
  const Feature = Object.getPrototypeOf(container.feature('vm').constructor)

  // ── Layer 1: API Client ──
  // Wraps all fetch() calls. Never touches DOM. Throws on errors.
  class MyApi extends Feature {
    static shortcut = 'features.myApi'
    static { Feature.register(this, 'myApi') }

    async fetchData() {
      const res = await fetch('/api/workflows/my-workflow/data')
      return (await res.json()).items
    }
  }

  // ── Layer 2: Store ──
  // Holds loaded data, manages derived state. Emits semantic events.
  class MyStore extends Feature {
    static shortcut = 'features.myStore'
    static { Feature.register(this, 'myStore') }

    _items = []
    get items() { return this._items }

    async loadData() {
      const api = this.container.feature('myApi')
      this._items = await api.fetchData()
      this.emit('data:loaded', this._items)
    }
  }

  // ── Layer 3: App Orchestrator ──
  // Composes API + Store. Implements high-level user actions.
  // Manages view-level state. Exposed as window.app for debugging.
  class MyApp extends Feature {
    static shortcut = 'features.myApp'
    static { Feature.register(this, 'myApp') }

    get store() { return this.container.feature('myStore') }

    async start() {
      await this.store.loadData()
      this.state.set('ready', true)
      this.emit('ready')
    }
  }

  // ── Boot ──
  const app = container.feature('myApp')
  window.app = app       // for devtools
  window.luca = container // for devtools

  // ── UI Bindings ──
  // Wire DOM events → feature calls, feature events → DOM mutations.
  // The UI has no logic — all logic lives in features.
  app.store.on('data:loaded', (items) => {
    document.getElementById('list').innerHTML = items
      .map(i => `<div>${i.title}</div>`).join('')
  })

  app.start()
</script>
```

This **three-layer Feature pattern** (ApiClient → Store → App) is the standard across all workflows. Each feature:
- Inherits from the framework `Feature` base class
- Has a reactive `state` map that emits change events
- Has an event bus (`this.emit`, `this.on`, `this.off`)
- Is registered globally into the container under a name
- Composes other features via `this.container.feature('otherFeature')`

### Communication protocols

Workflows use different backend communication depending on complexity:

**REST only** — Simple data workflows (capture, blank-slate, review, setup). Just `fetch()` calls.

**REST + SSE** — Chat and streaming workflows (assistant-designer, ideas, prompt-studio). SSE is consumed by manually reading the response body stream (not `EventSource`), which allows POST:

```js
const res = await fetch('/api/workflows/my-workflow/chat', { method: 'POST', body: ... })
const reader = res.body.getReader()
const decoder = new TextDecoder()
while (true) {
  const { done, value } = await reader.read()
  if (done) break
  // parse SSE frames: 'event: chunk\ndata: {"text":"..."}\n\n'
}
```

**REST + WebSocket** — Build/execution workflows (project-builder, playbook-designer, dashboard). The ChatService WebSocket protocol: client sends `{ type: 'init', sessionId, assistantId }`, server responds with `init_ok`, then `user_message` / `chunk` / `tool_start` / `tool_end` / `build_event` messages flow.

### CSS design tokens

All workflows share a consistent dark-theme design language. A shared CSS file exists at `workflows/shared/base.css` (served at `/shared/base.css`):

```html
<link rel="stylesheet" href="/shared/base.css">
```

Key tokens: `--bg: #151520`, `--surface: #1c1c28`, `--accent: #00fff7`, `--success: #39ff14`, `--error: #ff003c`, `--assistant: #c084fc`. Monospace font stack: `'SF Mono', 'Fira Code', 'JetBrains Mono', monospace`.

Currently most workflows still inline these tokens. New workflows should use the shared CSS.

## How Assistants Use Workflows

### Via the presenter

The Chief of Staff (and any assistant with the `present` tool) can spawn a workflow in a native window:

```
present({ url: 'http://localhost:7700/workflows/capture/', title: 'Capture Idea', mode: 'input' })
```

This opens the workflow in a native WebKit window via the launcher app. In `input` mode, the user's interaction (submit/close) flows back to the assistant as structured feedback.

### Via voice commands

A voice handler can spawn the workflow window directly:

```ts
const handler: VoiceHandler = {
  name: 'idea',
  description: 'Capture a new idea',
  keywords: ['idea', 'new idea', 'have an idea'],

  match(ctx) {
    return ctx.normalizedText.includes('idea') ||
           ctx.normalizedText.includes('have an idea')
  },

  async execute(ctx) {
    const { cmd, windowManager } = ctx
    ctx.playPhrase('generic-ack')
    cmd.ack()

    await windowManager.spawn({
      url: 'http://localhost:7700/workflows/capture/',
      title: 'Capture Idea',
      width: 600,
      height: 700,
    })

    cmd.finish({ result: { action: 'completed' } })
  },
}
```

Now you can literally say "I have an idea" and a native form appears to capture it.

### Via the web chat

The web-chat assistant can include a link or trigger a presenter window during a conversation. "Let me show you the status" → spawns the review workflow.

## The Feedback Loop

Workflows aren't just display surfaces. They close the loop:

1. **Assistant decides** a workflow is needed (voice command, user request, or assistant initiative)
2. **Workflow spawns** — the backend serves live data from contentDb, the frontend renders it
3. **User interacts** — fills forms, makes decisions, provides input
4. **Results flow back** via:
   - **API calls** — the playground POSTs to the workflow's endpoints, which write docs to contentDb
   - **Presenter feedback** — `postMessage` sends structured events back to the presenting assistant
   - **ContainerLink events** — if the browser container is connected, `emitToHost()` sends typed events to the main process
5. **Assistant processes** the results — updates docs, changes statuses, triggers next actions

## Existing Workflows

| Workflow | Purpose |
|----------|---------|
| `assistant-designer` | Interactive workbench for designing AI assistants (Monaco editor, tool builder, chat, REPL) |
| `blank-slate` | First-run onboarding: vision, goals, first ideas |
| `capture` | Quick idea capture: title, goal, tags, description |
| `dashboard` | Live system monitoring of `luca main` (WebSocket to authority process) |
| `ideas` | Browse/filter all ideas, built-in assistant chat |
| `playbook-designer` | View plays in the agentic loop, grouped by schedule |
| `project-builder` | Project workspace with Monaco editor, AI chat, build execution |
| `prompt-studio` | Prompt authoring and execution (notebook-style, Monaco editor) |
| `review` | Status briefing dashboard (read-only overview) |
| `setup` | System diagnostic: dependencies, API keys, voice tools |
| `voice-designer` | ElevenLabs voice config and TTS preview |

All served at `http://localhost:7700/workflows/<name>/`.

## Generating Workflows On The Fly

Here's where it gets interesting. A workflow is just two files — a hooks file and an HTML page. Both follow clear patterns. Coding agents (Claude Code, luca-coder, Codex) already know how to build these.

This means an assistant can **generate a workflow at runtime**:

1. Chief identifies a need: "I need Jon to review these 3 ideas and pick one to promote"
2. Chief delegates to a coding agent: "Build a comparison workflow that shows these 3 ideas side by side with a 'promote' button on each"
3. The coding agent writes `workflows/compare/hooks.ts` and `workflows/compare/public/index.html`, tailored to the specific ideas
4. The WorkflowService discovers the new workflow on next restart (or the service is restarted)
5. Chief presents it: `present({ url: 'http://localhost:7700/workflows/compare/', mode: 'input' })`
6. Jon picks one, the feedback flows back, Chief processes it

The workflow didn't exist five minutes ago. It was built for this specific moment, with this specific data, for this specific decision. After the decision is made, the workflow could be kept for reuse or discarded.

### What makes this possible

- **The pattern is simple.** Two files, clear conventions, no framework boilerplate.
- **The container provides everything.** ContentDb, filesystem, networking — the hooks file doesn't need external dependencies.
- **The playground is self-contained.** Single HTML file, inline everything. No build step, no npm install.
- **The browser container is powerful.** The Luca Feature pattern gives you reactive state, event bus, and composability in vanilla JS.
- **Coding agents are fast.** Claude Code with the luca skill can generate a complete workflow in under a minute.
- **The presenter makes it native.** The generated workflow appears as a real application window, not a browser tab.

### The generation loop

```
Need arises → Agent builds workflow → Service restarts → Window spawns →
User interacts → Results captured → Docs updated → Workflow served its purpose
```

This is the agentic loop manifested as UI. The assistants don't just read and write documents — they create purpose-built interactive experiences, use them to collect human input, and process the results. The workflows are ephemeral tools generated by the system to serve the system.

## Creating a New Workflow

### 1. Create the directory

```shell
mkdir -p workflows/my-workflow/public
```

### 2. Write the ABOUT.md

Every workflow needs an `ABOUT.md` describing its purpose and when it should be triggered:

```markdown
# My Workflow

One-line description.

## When to use
- "Trigger phrase from user"
- Specific scenario

## When NOT to use
- Use X instead for Y
```

### 3. Write the playground

`workflows/my-workflow/public/index.html`:

- Single file, inline CSS/JS
- Load `@soederpop/luca` browser container from esm.sh
- Build UI logic as three-layer Features (ApiClient → Store → App)
- Wire DOM events to feature calls, feature events to DOM mutations
- Use shared CSS tokens (link `/shared/base.css` or inline the `:root` variables)
- Optionally post presenter events: `window.parent.postMessage({ type: '__PRESENTER_EVENT__', action: 'submitted', data: { ... } }, '*')`

### 4. Write hooks (if needed)

`workflows/my-workflow/hooks.ts` — only if the workflow needs custom API routes beyond the shared API:

```ts
import type { WorkflowHooksSetupContext } from '../../features/workflow-service'

export async function onSetup({ app, docs, container }: WorkflowHooksSetupContext) {
  app.get('/api/workflows/my-workflow/custom', async (_req, res) => {
    res.json({ data: 'hello' })
  })
}
```

### 5. Test it

Restart the WorkflowService and navigate to `http://localhost:7700/workflows/my-workflow/`.

### 6. Wire it up

Add a voice handler, teach an assistant to present it, or just open it in a browser. The workflow is a URL — anything that can open a URL can use it.

## Design Principles

- **One workflow, one job.** Don't build a mega-dashboard. Build a focused tool that does one thing well.
- **The backend is thin.** Mount routes in hooks, read/write contentDb, return JSON. No business logic in the server.
- **The frontend is self-contained.** Single HTML file. No build step. The browser container gives you everything.
- **Use the Feature pattern.** ApiClient → Store → App orchestrator. Logic in features, not in DOM handlers.
- **Write real docs.** Workflows should write valid contentbase documents — proper frontmatter, proper sections, proper file paths. Run `cnotes validate` to verify.
- **Close the loop.** Every workflow should result in a concrete artifact — a new doc, an updated status, a recorded decision. If the user interacts and nothing persists, the workflow failed.
- **Assume ephemerality.** Workflows may be generated for a single use. Don't over-engineer. The right amount of code is the minimum that serves the current need.
