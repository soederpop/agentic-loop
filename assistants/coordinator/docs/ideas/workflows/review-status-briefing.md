---
goal: user-experience-improvements
tags:
  - workflow
  - dashboard
  - status
  - briefing
  - read-only
status: promoted
---

# Review / Status Briefing Workflow

A live read-only dashboard that shows the state of everything — goals, ideas, projects, plans, and recent activity. This is what Chief presents when you say "what's the status."

## Concept

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
