---
status: draft
goal: user-experience-improvements
---

# Playbook Designer

A workflow UI for visualizing, creating, editing, and testing the agentic loop's plays — the scheduled prompts that drive autonomous behavior. Right now managing plays means hand-editing markdown files. This project gives users a visual interface to understand the loop's cadence, author new plays with validated frontmatter, test condition blocks against the live container, and review execution history.

Built as a workflow (`workflows/playbook-designer/`) following the shared workflow service pattern: a `public/` directory with static HTML/CSS/JS calling shared and custom API endpoints.

## Overview

The Playbook Designer directly serves two goals: making the agentic loop's behavior transparent and lowerable-barrier for new users (UX improvements), and making customization accessible enough to support a broader user base (10 users goal). Plays are the heartbeat of the loop — this UI makes that heartbeat visible and controllable.

Key capabilities:
- **Timeline view** — plays grouped by schedule, with status, last run, and next estimated run
- **Play editor** — markdown editor with live preview, frontmatter controls as form fields
- **Condition tester** — run condition blocks against the live container before deploying
- **Play creator** — guided form for new plays with schedule picker, agent selector, and validation
- **Execution history** — per-play logs with timestamps, duration, token usage, and pass/fail

## Execution

- [Phase 1: Read-Only Timeline](../plans/playbook-designer/01-read-only-timeline.md)
- [Phase 2: Play Editor and Creator](../plans/playbook-designer/02-play-editor-and-creator.md)
- [Phase 3: Condition Tester](../plans/playbook-designer/03-condition-tester.md)
- [Phase 4: History, Logs, and Live Status](../plans/playbook-designer/04-history-and-live-status.md)
