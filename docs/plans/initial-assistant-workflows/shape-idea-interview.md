---
status: completed
project: initial-assistant-workflows
costUsd: 1.90002435
turns: 43
toolCalls: 64
completedAt: '2026-03-22T23:35:13.752Z'
---


# Shape / Idea Interview Workflow

A structured interview workflow that takes a specific idea and helps the user flesh it out. Chief's primary tool for moving ideas from `exploring` to `ready`. The UI presents the idea's current state and guides through key questions that determine readiness.

Runs as a standalone workflow at `workflows/shape/` on port 9303. Two-panel layout: left shows the idea document, right shows the interview form.

## Flow

1. **Idea picker** — Show all ideas with `spark` or `exploring` status. User clicks one to start. Can skip picker with `?idea=slug` query param.
2. **Current state** — Display the idea's title, goal, tags, status, and full description as-is (left panel).
3. **Interview questions** (right panel):
   - **Problem** — "What specific problem does this solve? Who has this problem?"
   - **Scope** — "What's the minimum version that would be useful? What's explicitly out of scope?"
   - **Dependencies** — "What does this need that doesn't exist yet? What existing pieces does it build on?"
   - **Success** — "How would you know this worked? What would you measure or observe?"
   - **Effort** — trivial / small / medium / large dropdown
   - **Priority** — now / soon / someday dropdown
   - **Decision** — buttons: Mark as Ready / Keep Exploring / Park It
4. **Save** — Update the idea's description with new info as structured H2 sections. Update status based on decision. Optionally add tags.

## API Surface

- `GET /api/ideas` — list ideas with full content for spark/exploring
- `GET /api/idea/:slug` — single idea's full content (frontmatter + body)
- `POST /api/idea/:slug` — update idea: `{ status, description, tags, appendSections }`
- `GET /api/goals` — for context display

## UI Notes

- Two-panel: left shows idea doc (with H1/H2 structure), right shows interview form
- Idea picker shows a "readiness score" heuristic (description length, tags, goal alignment)
- Interview questions should feel conversational, not bureaucratic
- Decision buttons prominent: "Mark as Ready" is big green, "Park It" is muted
- After save, brief confirmation then return to picker for another round

## Events

- `emit('ideaShaped', { slug, oldStatus, newStatus, decision })` on save
- Presenter event with slug and decision

## References

- Original idea: `docs/ideas/workflows/shape-idea-interview.md`
- Content model: Idea model with status enum (spark, exploring, ready, parked, promoted)

## Verification

- Running `luca serve` in `workflows/shape/` starts on port 9303
- Ideas with `spark` or `exploring` status appear in the picker
- Completing the interview updates the idea's frontmatter status and appends structured sections
- `cnotes validate` passes on all modified documents
