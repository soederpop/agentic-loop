---
goal: user-experience-improvements
tags:
  - workflow
  - onboarding
  - wizard
  - vision
  - goals
status: promoted
---

# Blank Slate Onboarding Workflow

A first-run wizard experience for new users who clone the agentic loop and have no vision, goals, or ideas yet. The workflow detects what's missing and walks them through each foundation step in sequence.

## Concept

Runs as a standalone workflow at `workflows/blank-slate/` on port 9301, following the same `luca.serve.ts` + `public/index.html` pattern as the capture workflow.

## Steps

1. **Vision** — Check if `docs/VISION.md` is still the default (hash comparison). If so, prompt the user to write their vision in a generous textarea. If already customized, show it with an edit option.
2. **Goals** — Show existing goals (if any), provide a form to create new ones (title, horizon, success criteria, motivation). Allow multiple. Require at least one before proceeding.
3. **First Ideas** — Show the goals just created as context. Simplified idea capture form (title, goal picker, description). Each idea gets `status: exploring`. Allow multiple.
4. **Complete** — Summary of what was created. Suggest next steps like `luca chat chiefOfStaff`.

## API Surface

- `GET /api/status` — returns `{ hasVision, visionHash, goalCount, ideaCount }` so the UI knows which step to start on
- `GET/POST /api/vision` — read/write vision text
- `GET/POST /api/goals` — list/create goal docs
- `GET/POST /api/ideas` — list/create idea docs

## UI Notes

- Wizard layout: centered card with step indicator (1 → 2 → 3 → 4)
- Steps slide in, completed steps show a green checkmark
- Vision textarea should be generous — most important thing the user writes
- Goal creation should feel lightweight, not bureaucratic
- Complete step should feel celebratory but not cheesy

## Events

- `emit('onboardingComplete', { visionWritten, goalsCreated, ideasCreated })` when done
- Presenter event on completion for feedback
