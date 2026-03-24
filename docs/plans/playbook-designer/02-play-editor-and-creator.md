---
status: completed
project: playbook-designer
costUsd: 1.8362333499999999
turns: 31
toolCalls: 64
completedAt: '2026-03-24T09:42:12.198Z'
---


# Phase 2: Play Editor and Creator

Add the ability to edit existing plays and create new ones from the UI. This is the "bicycle" — users can now author and modify plays without touching markdown files or knowing the frontmatter schema.

The demoable outcome: click a play card to open a split-pane editor with markdown on the left and live preview on the right. Frontmatter fields (schedule, agent, tags) rendered as form controls. A "New Play" button opens a guided creation form. Save writes valid markdown back to `docs/plays/`.

## Deliverables

1. **Play editor view** in `public/index.html` (or split into `editor.html`)
   - Split-pane layout: markdown textarea on the left, rendered preview on the right
   - Top bar with frontmatter controls: schedule dropdown (populated from `/api/schedules`), agent picker (`claude` / `codex`), tags input
   - Save button that PUTs the updated play back to the API
   - Back button to return to the timeline
   - Visual diff or "unsaved changes" indicator

2. **Create new play form**
   - Triggered by a "+ New Play" button on the timeline
   - Step-by-step form: title → schedule picker → agent picker → prompt body editor → optional tags
   - Slug auto-generated from title (kebab-case)
   - Preview of the generated markdown before saving
   - Save calls `POST /api/plays` to create the file

3. **API endpoint: `PUT /api/plays/:slug`** — update an existing play
   - Accepts JSON with body, schedule, agent, tags
   - Reconstructs the markdown with proper frontmatter and writes to `docs/plays/:slug.md`
   - Runs `cnotes validate` equivalent check before writing (reject invalid frontmatter)

4. **API endpoint: `POST /api/plays`** — create a new play
   - Accepts JSON with title, body, schedule, agent, tags
   - Generates slug from title
   - Creates `docs/plays/:slug.md` with proper frontmatter
   - Returns 409 if slug already exists

5. **API endpoint: `GET /api/plays/:slug`** — get a single play with full body content

## References

- Phase 1 deliverables (timeline view, `/api/plays`, `/api/schedules`)
- Capture workflow (document creation pattern): `workflows/capture/`
- Prompt Studio (markdown editing pattern): `workflows/prompt-studio/`
- Play template: `docs/templates/play.md`
- ContentDB document creation API

## Verification

- Click a play card and confirm the editor opens with the correct markdown body and frontmatter values
- Change the schedule dropdown and save — confirm the file on disk has the updated schedule
- Edit the prompt body and save — confirm the markdown file reflects the changes
- Create a new play via the form — confirm a new file appears in `docs/plays/` with valid frontmatter
- Run `cnotes validate` after creating/editing — confirm no validation errors
- Attempt to create a play with a duplicate slug — confirm 409 error
- Confirm the timeline view updates to show the newly created play
