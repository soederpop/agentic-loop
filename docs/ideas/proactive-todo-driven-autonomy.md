---
goal: user-experience-improvements
tags:
  - autonomy
  - plays
  - todos
  - chief
status: exploring
---

# Proactive TODO-Driven Autonomy

Create a play assigned to Chief whose job is to complete one agreed-upon TODO by turning it into a task for the appropriate assistant.

The play should not directly implement work itself. Its role is to interpret Chief's authorized TODO list, decide whether one item is actionable, and if so write exactly one task for the right assistant so the existing scheduler executes it safely.

The source of truth for what Chief is allowed to act on should remain `docs/memories/TODO.md`, kept as a human-readable markdown checklist rather than introducing a new todo model immediately.

## Motivation

This gives Chief a bounded form of initiative without removing Jon from the authorization loop. The TODO list becomes the contract for what has been explicitly agreed to, while the play becomes a safe decision layer that can keep momentum going between conversations.

Keeping TODOs in markdown preserves a simple and inspectable source of truth. It also avoids premature schema work while still enabling automation through purpose-built tools.

## Proposed Shape

- Add a scheduled play assigned to Chief.
- On each run, the play reads Chief's TODOs and determines whether any agreed item is actionable.
- If no actionable TODO exists, the play should skip or error cleanly in the same spirit as existing guarded plays.
- If one actionable TODO exists, the play should write a task and assign it to the appropriate assistant, including Chief when appropriate.
- The play should create at most one task per run.
- The scheduler remains the system that actually executes work.

## Source Of Truth

Chief's TODOs should continue living in `docs/memories/TODO.md`.

Rather than replacing that file with a new model right away, add two tools:

1. `list todos`
2. `update todo(done: Boolean, description: string, remove: Boolean)`

These tools can parse the markdown TODO section as AST nodes and operate on GitHub-style checkbox items so the file stays readable while becoming safely editable by assistants.

## Constraints

- Chief should only act on TODOs that Jon explicitly approved.
- If the TODO list is empty, nothing should happen.
- The play should not become a general autonomous planner.
- The play's job is task creation and routing, not direct implementation.
- Work should flow through the existing task runner and scheduler protections.

## Example Behavior

One example is that Jon asks Chief to follow up on an idea when it becomes a project, and then later follow up again when the project is complete with a demo link.

That follow-up request becomes a TODO. Later, when the triggering condition is true, the play notices it, writes the appropriate outbound or coordination task, and lets the scheduler execute it.

## Open Questions

- What minimum structure should each TODO include beyond checkbox text?
- How should the play determine actionability for a TODO in a way that is transparent and debuggable?
- Should some TODOs be one-time while others are repeatable follow-up instructions?
- How should priority be expressed if multiple TODOs are eligible at once?
