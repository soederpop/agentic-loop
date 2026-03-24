---
goal: user-experience-improvements
tags:
  - workflow
  - plays
  - scheduling
  - notebook
  - agentic-loop
  - authoring
status: ready
---

# Playbook Designer Workflow

The Agentic Loop plays are what run on a scheduled interval. I would like a workflow for visualizing the plays that will run, adding a new play, being able to evaluate the blocks like in the prompt studio, pick from the valid scheduling options etc.

## Why This Matters

Plays are the heartbeat of the agentic loop — they're what make it autonomous. But right now, managing them means hand-editing markdown files and hoping you got the frontmatter right. There's no way to see the schedule at a glance, no way to test conditions before deploying them, and no way for a new user to understand the cadence of the loop without reading every play file.

This directly serves both goals:
- **User Experience Improvements**: Plays should be easy to understand, create, and customize. A visual designer removes the "surprising" factor — you can see exactly what will run and when.
- **Have 10 Users**: A visual playbook designer dramatically lowers the barrier to entry. New users can understand and customize the loop's behavior without learning the document model first.

## What Already Exists

### The Play Model

Plays live in `docs/plays/*.md` with this structure:

| Field | Type | Description |
|---|---|---|
| `agent` | string | Which agent executes the play (`claude`, `codex`) |
| `schedule` | string | How often it runs (see valid values below) |
| `tags` | string[] | Categorization |
| `lastRanAt` | number | Epoch ms timestamp of last execution |
| `running` | boolean | Lock flag to prevent concurrent execution |
| `durationMs` | number | How long the last run took |
| `outputTokens` | number | Token usage from last run |

The body is a prompt — the literal instructions the agent receives. The optional **Conditions** section contains TypeScript code blocks that gate execution (if any block throws or returns false, the play is skipped).

### Valid Schedule Options

The `TaskScheduler` (`features/task-scheduler.ts`) recognizes these schedule strings:

| Schedule | Interval |
|---|---|
| `every-five-minutes` | 5 min |
| `every-ten-minutes` | 10 min |
| `every-half-hour` | 30 min |
| `hourly` | 1 hour |
| `daily` | 24 hours |
| `beginning-of-day` | 24 hours |
| `end-of-day` | 24 hours |
| `weekly` | 7 days |
| Time-of-day (e.g., `4pm`) | 24 hours |

### Execution Infrastructure

- **TaskScheduler** (`features/task-scheduler.ts`): Discovers plays, evaluates conditions, manages the `running` lock, tracks `lastRanAt`
- **Agentic Loop** (`commands/agentic-loop.ts`): The daemon that polls for due tasks. Configurable concurrency limits (default 2 for plays). Spawns `luca prompt <agent> <taskId>` for each execution
- **Condition evaluation**: Uses the `vm` feature to run TypeScript blocks with `container` in scope

### Existing Patterns to Follow

- **Prompt Studio** (`workflows/prompt-studio/`): The closest analog — it lets you browse prompt documents, edit them, run code blocks notebook-style in a server-side VM, and execute prompts with streaming output. The Playbook Designer would reuse this notebook-style block execution for testing play conditions.
- **Capture** (`workflows/capture/`): Simple form-based document creation. Good reference for the "create new play" UX.
- **Dashboard** (`workflows/dashboard/`): Displays system status. Good reference for timeline/status visualization.

### Shared Workflow Service

The `shared-workflow-service` idea (now promoted to a project) is consolidating all workflows behind a single Express server. The Playbook Designer should be built as a simple `public/` + optional `hooks.ts` workflow that relies on shared API endpoints where possible.

## Core Features

### 1. Play Timeline Visualization

A visual timeline showing the play schedule — what has run, what's running now, what's coming up next. Each play as a card with its schedule interval, last run time, duration, and status.

```
┌─────────────────────────────────────────────────┐
│  Playbook Timeline                    [+ New Play]│
│                                                   │
│  ⏱ every-ten-minutes                              │
│  ┌──────────────────────────────────────────┐     │
│  │ 🟢 Begin Exploring Spark Ideas           │     │
│  │    Last: 2 min ago (5m 23s) · 517 tokens │     │
│  │    Next: ~8 min · agent: claude           │     │
│  └──────────────────────────────────────────┘     │
│  ┌──────────────────────────────────────────┐     │
│  │ 🟡 Turn Ideas into Project Plans         │     │
│  │    Last: 6 min ago (4m 11s) · 892 tokens │     │
│  │    Next: ~4 min · agent: claude           │     │
│  └──────────────────────────────────────────┘     │
│                                                   │
│  ⏱ hourly                                         │
│  ┌──────────────────────────────────────────┐     │
│  │ ⚪ (empty — no hourly plays yet)          │     │
│  └──────────────────────────────────────────┘     │
└───────────────────────────────────────────────────┘
```

Plays grouped by schedule frequency. Status indicators: running (🔵), recently ran (🟢), conditions failed/skipped (🟡), errored (🔴), never run (⚪).

### 2. Play Editor

Click a play to open a split-pane editor:
- **Left**: Markdown editor with the play's prompt body
- **Right**: Live preview of rendered markdown
- **Top bar**: Frontmatter fields as form controls — schedule dropdown, agent picker, tags input
- **Conditions panel**: Code blocks from the Conditions section, each with a "Run" button that evaluates the block against the live container (like Prompt Studio's notebook execution)

### 3. Condition Tester

The killer feature. Before deploying a play, you can test whether its conditions would pass right now:

- Each condition block has a ▶ Run button
- Execution happens server-side via the `vm` feature with the real container in scope
- Green check if the block passes, red X with the error message if it throws
- Shows the return value (useful for conditions that return counts or status)

This reuses the exact pattern from Prompt Studio's block execution.

### 4. Create New Play

A guided form:
1. Pick a schedule from a dropdown of valid options
2. Pick an agent (`claude` or `codex`)
3. Write the prompt body (with markdown preview)
4. Optionally add condition blocks
5. Test conditions before saving
6. Save → generates the file in `docs/plays/` with proper frontmatter

### 5. Play History / Logs

For each play, show recent execution history:
- Timestamp, duration, token usage
- Whether conditions passed or were skipped
- Link to the output log (from `logs/prompt-outputs/`)

## Architecture

```
┌───────────────────────────────────────────────────┐
│  Browser (Playbook Designer UI)                    │
│                                                    │
│  ┌──────────────────────────────────────────────┐  │
│  │  Timeline View                               │  │
│  │  - Plays grouped by schedule                 │  │
│  │  - Status badges, last run, next run         │  │
│  │  - Click to open editor                      │  │
│  ├──────────────────────────────────────────────┤  │
│  │  Play Editor (split pane)                    │  │
│  │  - Markdown editor + live preview            │  │
│  │  - Frontmatter controls (schedule, agent)    │  │
│  │  - Condition blocks with ▶ Run buttons       │  │
│  ├──────────────────────────────────────────────┤  │
│  │  Create New Play (form)                      │  │
│  │  - Schedule picker, agent picker, body       │  │
│  │  - Condition builder                         │  │
│  └──────────────┬───────────────────────────────┘  │
│                 │ HTTP API                          │
└─────────────────┼──────────────────────────────────┘
                  │
┌─────────────────┼──────────────────────────────────┐
│  Server                                            │
│                 │                                   │
│  ┌──────────────┴───────────────────────────────┐  │
│  │  API Endpoints                               │  │
│  │  GET  /api/plays         → list all plays    │  │
│  │  GET  /api/plays/:slug   → single play       │  │
│  │  POST /api/plays         → create new play   │  │
│  │  PUT  /api/plays/:slug   → update play       │  │
│  │  POST /api/plays/:slug/eval-condition        │  │
│  │       → run a condition block in VM          │  │
│  │  GET  /api/plays/:slug/history               │  │
│  │       → recent execution logs                │  │
│  │  GET  /api/schedules     → valid options     │  │
│  └──────────────┬───────────────────────────────┘  │
│                 │                                   │
│  ┌──────────────┴───────────────────────────────┐  │
│  │  ContentDB (docs) + VM feature               │  │
│  │  - Query/create/update Play documents        │  │
│  │  - Evaluate condition blocks server-side     │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

## Delivery Roadmap (Skateboard → Car)

### Skateboard: Read-Only Timeline

- Workflow directory: `workflows/playbook-designer/`
- `ABOUT.md` with metadata and trigger signals
- `public/index.html` — single-page app showing all plays as cards grouped by schedule
- API: `GET /api/plays` returns all play documents with metadata
- API: `GET /api/schedules` returns the list of valid schedule options
- Shows: name, schedule, agent, lastRanAt, running status, next estimated run
- **Immediately useful for understanding what the loop is doing**

### Bicycle: Play Editor + Creator

- Click a play card to open the editor view
- Markdown editor for the prompt body with live preview
- Frontmatter fields as form controls (schedule dropdown, agent picker, tags)
- "New Play" button opens a creation form
- `PUT /api/plays/:slug` and `POST /api/plays` for save/create
- `cnotes validate` integration to catch structural errors before save

### Motorcycle: Condition Tester + Block Execution

- Condition blocks parsed and displayed with ▶ Run buttons
- `POST /api/plays/:slug/eval-condition` evaluates a block server-side via `vm` feature
- Pass/fail indicators with error messages and return values
- Reuses the Prompt Studio's VM execution pattern
- Test all conditions at once with a "Check All" button

### Car: History, Logs, and Live Status

- Execution history panel per play (timestamp, duration, tokens, pass/fail)
- Integration with `logs/prompt-outputs/` for log viewing
- WebSocket connection for live status updates (play started, completed, failed)
- Real-time timeline that updates as plays execute
- Ability to manually trigger a play from the UI

## Related Ideas

- **Shared Workflow Service** (promoted): The Playbook Designer should be built to work with the shared service architecture — static `public/` directory + `hooks.ts` for the condition evaluation endpoint
- **Prompt Studio**: Direct sibling — same notebook-style block execution pattern, same markdown editing UX. Could share frontend components for the editor

## References

- Play model definition: `docs/models.ts`
- Task Scheduler: `features/task-scheduler.ts` (schedule parsing at `_scheduleToMs()`)
- Agentic Loop command: `commands/agentic-loop.ts`
- Play template: `docs/templates/play.md`
- Prompt Studio workflow: `workflows/prompt-studio/` (notebook execution pattern)
- Capture workflow: `workflows/capture/` (document creation pattern)
- Dashboard workflow: `workflows/dashboard/` (status visualization pattern)
- Existing plays: `docs/plays/begin-exploring-one-of-the-spark-ideas.md`, `docs/plays/turn-one-of-my-ideas-into-a-project-plan.md`
