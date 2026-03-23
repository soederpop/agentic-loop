# Creating Assistant Workflows

A workflow is a self-contained mini-application that pairs a backend (API endpoints) with a frontend (interactive HTML playground) to accomplish a specific task. Workflows are how assistants present interactive experiences to users — instead of chatting back and forth in text, the assistant spawns a purpose-built UI, the user interacts with it, and structured results flow back.

## The Big Idea

In a traditional assistant conversation, everything is text. The user describes what they want, the assistant responds, back and forth. This works, but it's a bottleneck for anything that involves:

- **Structured input** — filling out forms, making selections, tagging things
- **Visual context** — seeing the state of a system, comparing options side by side
- **Decisions** — approving, rejecting, prioritizing, ranking

Workflows solve this by giving assistants the ability to **materialize interactive UIs on demand**. The assistant doesn't just describe the state of your ideas — it spawns a visual dashboard. It doesn't ask you five questions one at a time — it presents a structured form and collects all the answers at once.

## Architecture

A workflow is a folder under `workflows/` that follows luca conventions:

```
workflows/
  capture/
    luca.serve.ts       ← setup hook: mounts API routes on the express server
    public/
      index.html        ← the playground UI (single self-contained HTML file)
```

**That's it.** Two files minimum. The setup hook provides the backend, the HTML file provides the frontend.

### Running a workflow

```shell
luca serve --setup workflows/capture/luca.serve.ts \
           --staticDir workflows/capture/public \
           --port 9300
```

This starts an express server that:
1. Serves the playground HTML as the static root
2. Runs the setup hook, which mounts API endpoints on the same server
3. The playground calls those endpoints to read/write data

### The setup hook

The setup hook is a TypeScript module whose default export receives the express server instance:

```ts
export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  // Load contentDb for reading/writing docs
  const docs = container.feature('contentDb', {
    rootPath: container.paths.resolve('docs'),
  })
  await docs.load()

  // Mount API endpoints
  app.get('/api/goals', async (_req, res) => {
    const goals = await docs.query(docs.models.Goal).fetchAll()
    res.json({ goals: goals.map(g => ({ id: g.id, title: g.title })) })
  })

  app.post('/api/ideas', async (req, res) => {
    // Validate, write the doc, reload contentDb
    // Return the created document's ID
  })
}
```

The server is a luca ExpressServer helper. Access the container via `server.container`, the express app via `server.app`. You have full access to contentDb, the filesystem, networking — everything the container provides.

### The playground HTML

A single, self-contained HTML file. All CSS and JS inline. No external dependencies required (though you can optionally load the luca browser container from esm.sh for containerLink support).

The playground calls the workflow's own API endpoints for data:

```js
const goals = await fetch('/api/goals').then(r => r.json())
const result = await fetch('/api/ideas', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ title: 'My Idea', goal: 'ux-improvements' }),
})
```

## How Assistants Use Workflows

### Via the presenter

The Chief of Staff (and any assistant with the `present` tool) can spawn a workflow in a native window:

```
present({ url: 'http://localhost:9300', title: 'Capture Idea', mode: 'input' })
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
      url: 'http://localhost:9300',
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

| Workflow | Port | Purpose |
|----------|------|---------|
| `capture` | 9300 | Record a new idea with title, goal, tags, description |
| `blank-slate` | 9301 | First-run onboarding: vision, goals, first ideas |
| `review` | 9302 | Status briefing dashboard (read-only) |
| `shape` | 9303 | Interview/grill an idea to move it toward ready |
| `setup` | 9304 | System diagnostic: dependencies, API keys, wake words |

## Generating Workflows On The Fly

Here's where it gets interesting. A workflow is just two files — a setup hook and an HTML page. Both follow clear patterns. Coding agents (Claude Code, luca-coder, Codex) already know how to build these.

This means an assistant can **generate a workflow at runtime**:

1. Chief identifies a need: "I need Jon to review these 3 ideas and pick one to promote"
2. Chief delegates to a coding agent: "Build a comparison workflow that shows these 3 ideas side by side with a 'promote' button on each"
3. The coding agent writes `workflows/compare/luca.serve.ts` and `workflows/compare/public/index.html`, tailored to the specific ideas
4. Chief spawns the server: `luca serve --setup workflows/compare/luca.serve.ts ...`
5. Chief presents it: `present({ url: 'http://localhost:9305', mode: 'input' })`
6. Jon picks one, the feedback flows back, Chief processes it

The workflow didn't exist five minutes ago. It was built for this specific moment, with this specific data, for this specific decision. After the decision is made, the workflow could be kept for reuse or discarded.

### What makes this possible

- **The pattern is simple.** Two files, clear conventions, no framework boilerplate.
- **The container provides everything.** ContentDb, filesystem, networking — the setup hook doesn't need external dependencies.
- **The playground is self-contained.** Single HTML file, inline everything. No build step, no npm install.
- **Coding agents are fast.** Claude Code with the playground plugin can generate a complete workflow in under a minute.
- **The presenter makes it native.** The generated workflow appears as a real application window, not a browser tab.

### The generation loop

```
Need arises → Agent builds workflow → Server starts → Window spawns →
User interacts → Results captured → Docs updated → Workflow served its purpose
```

This is the agentic loop manifested as UI. The assistants don't just read and write documents — they create purpose-built interactive experiences, use them to collect human input, and process the results. The workflows are ephemeral tools generated by the system to serve the system.

## Creating a New Workflow

### 1. Create the directory

```shell
mkdir -p workflows/my-workflow/public
```

### 2. Write the setup hook

`workflows/my-workflow/luca.serve.ts`:

```ts
export default async function setup(server: any) {
  const container = server.container
  const app = server.app

  const docs = container.feature('contentDb', {
    rootPath: container.paths.resolve('docs'),
  })
  await docs.load()

  app.get('/api/data', async (_req, res) => {
    // Serve whatever the playground needs
  })

  app.post('/api/action', async (req, res) => {
    // Process submissions, write docs, return results
    await docs.reload() // Pick up changes after writes
  })

  console.log('[my-workflow] ready')
}
```

### 3. Write the playground

`workflows/my-workflow/public/index.html`:

- Single file, inline CSS/JS
- Calls `/api/data` to load state on boot
- Submits to `/api/action` on user interaction
- Optionally posts presenter events: `window.parent.postMessage({ type: '__PRESENTER_EVENT__', action: 'submitted', data: { ... } }, '*')`
- Optionally loads `@soederpop/luca` from esm.sh for containerLink

### 4. Test it

```shell
luca serve --setup workflows/my-workflow/luca.serve.ts \
           --staticDir workflows/my-workflow/public \
           --port 9300 --force
```

### 5. Wire it up

Add a voice handler, teach an assistant to present it, or just open it in a browser. The workflow is a URL — anything that can open a URL can use it.

## Design Principles

- **One workflow, one job.** Don't build a mega-dashboard. Build a focused tool that does one thing well.
- **The backend is thin.** Mount routes, read/write contentDb, return JSON. No business logic in the server.
- **The frontend is self-contained.** Single HTML file. No build step. If a CDN goes down, only optional features (containerLink) are affected.
- **Write real docs.** Workflows should write valid contentbase documents — proper frontmatter, proper sections, proper file paths. Run `cnotes validate` to verify.
- **Close the loop.** Every workflow should result in a concrete artifact — a new doc, an updated status, a recorded decision. If the user interacts and nothing persists, the workflow failed.
- **Assume ephemerality.** Workflows may be generated for a single use. Don't over-engineer. The right amount of code is the minimum that serves the current need.
