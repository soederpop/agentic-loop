---
status: completed
goal: user-experience-improvements
---



# Initial Assistant Workflows

## Overview

A suite of standalone web workflows that give the agentic loop its core interactive experiences — onboarding new users, shaping ideas, reviewing status, and diagnosing the system. Each workflow runs as an independent `luca.serve.ts` app on its own port, following the same pattern established by the capture workflow.

These four workflows cover the essential lifecycle: setup the machine, define your vision/goals, shape raw ideas into actionable plans, and review the state of everything.

## Execution

- [Blank Slate Onboarding](../plans/initial-assistant-workflows/blank-slate-onboarding.md) — First-run wizard for new users: vision, goals, first ideas
- [Shape / Idea Interview](../plans/initial-assistant-workflows/shape-idea-interview.md) — Structured interview to flesh out ideas from exploring to ready
- [Review / Status Briefing](../plans/initial-assistant-workflows/review-status-briefing.md) — Live read-only dashboard of goals, ideas, projects, and activity
- [Setup / System Onboarding](../plans/initial-assistant-workflows/setup-system-onboarding.md) — Technical preflight: dependencies, API keys, voice, native app
