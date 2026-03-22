---
status: completed
project: initial-assistant-workflows
completedAt: '2026-03-22T20:45:00.000Z'
---

# Review / Status Briefing Workflow

A live read-only dashboard that shows the state of everything — goals, ideas, projects, plans, and recent activity. This is what Chief presents when you say "what's the status."

Runs as a standalone workflow at `workflows/review/` on port 9302. Single-page dashboard, no tabs — scroll if needed. Auto-refreshes every 30 seconds or on focus.

## Layout Sections

- **Header bar** — "STATUS BRIEFING" + date + total doc count
- **Goals strip** — Horizontal row of goal cards showing title, horizon badge, and count of aligned ideas
- **Idea funnel** — Ideas grouped by status in columns: spark | exploring | ready | parked | promoted. Each card shows title, goal alignment dot, tags, relative timestamp. Counts per column make bottlenecks visually obvious.
- **Projects** — Cards with status badge, plan count, progress bar (completed/total plans). Expandable to see individual plans.
- **Activity** — Recent git commits (last 10) and recently modified docs by mtime
- **Empty states** — Clear guidance when sections have no data ("No goals defined — run the onboarding workflow")

## API Surface

- `GET /api/status` — single call returning `{ goals, ideas (grouped by status), projects (with plans), recentCommits, recentDocs, counts }`
- `GET /api/ideas` — all ideas with full meta
- `GET /api/projects` — projects with their plans

## UI Notes

- Read-only. No forms, no editing. It's a briefing, not a workspace.
- Information density over whitespace — compact cards
- Status color coding: spark=dim, exploring=accent, ready=success, parked=warning, promoted=purple
- Should look good in presenter window (800x900) and full-screen
- Listen for containerLink `stateChange` events for automatic refresh

## References

- Original idea: `docs/ideas/workflows/review-status-briefing.md`
- Existing content model for goals, ideas, projects, plans

## Verification

- Running `luca serve` in `workflows/review/` starts on port 9302
- Dashboard renders all existing goals, ideas, projects with correct grouping
- Empty sections show helpful guidance instead of blank space
- Auto-refresh works on window focus

## Handoff Notes from Blank Slate

- The `luca.serve.ts` + `public/index.html` pattern is proven. Copy the blank-slate or capture workflow as a starting point.
- `container.feature('fs').writeFile()` is synchronous. `docs.reload()` is async.
- ContentDb queries: `docs.query(docs.models.Goal).fetchAll()`, same for Idea, Project, Plan. Each doc has `.id`, `.title`, `.meta`, `.content`.
- For the `/api/status` endpoint, you can aggregate all models in a single handler. The blank-slate `/api/status` shows how to combine goal/idea counts.
- The review dashboard is read-only, so you only need GET endpoints. No POST/write logic needed.
- For recent git commits, use `container.feature('proc').exec('git log --oneline -10')` or similar — the proc feature wraps child_process.
- The dark theme CSS variables and design system from blank-slate/capture are reusable. Copy the `:root` block and card styles for visual consistency across workflows.

## Handoff Notes from Shape Workflow

- **ContentDb has no `.content` field.** Document objects have `.id`, `.title`, `.meta`, `.sections`, `.size` — but no raw body. To display document content, read the file with `fs.readFileSync()` and strip frontmatter with a regex: `raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)[1]`. The `.size` field (byte size of the file) works well as a content-length proxy for readiness heuristics.
- **Markdown rendering in the browser** — the shape workflow includes a lightweight regex-based renderer for headers, lists, code blocks, tables, bold/italic. Feel free to copy it if the review dashboard needs to display idea descriptions or plan content inline.
- **CSS design system is stable** — the shape workflow reuses the exact same `:root` variables from blank-slate. The pattern holds across workflows: `--accent` for primary, `--success` for ready/done, `--warning` for spark/attention, `--assistant` (purple) for goals.
- **Status badge pattern** — `.status-badge` with modifier classes (`.spark`, `.exploring`, `.ready`, etc.) is reusable for the idea funnel columns.

## Retrospective

The review dashboard came together quickly because the pattern was well-established by previous workflows. The `luca.serve.ts` + `public/index.html` architecture is clean and predictable — setup hook mounts Express routes, single HTML file handles everything client-side. No build step, no framework overhead.

The most useful part of the implementation was the `/api/status` aggregation endpoint. Fetching all four content models (Goal, Idea, Project, Plan) in parallel and reshaping them into a single response keeps the frontend simple — one fetch, full render. The `relationships.plans.fetchAll()` API on Project documents worked as expected for linking plans to their parent projects, with a fallback to manual filtering by project slug for robustness.

Git commit history via `container.feature('proc').exec()` works but the output format needed careful parsing — splitting on `|` with a custom `--format` flag was more reliable than trying to parse the default oneline format. The `updatedAt` field on contentDb documents provided recent docs sorting without needing to stat files manually, though the fallback path using `fs.statSync()` is there if needed.

One thing to note: the dashboard is fully read-only and stateless. There's no POST/write logic, no WebSocket, no assistant integration. This makes it the simplest workflow in the set, which is appropriate — it's a briefing, not a workspace. Auto-refresh on visibility change and a 30-second interval keep the data fresh without polling overhead.
