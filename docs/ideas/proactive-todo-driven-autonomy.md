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

Create a play assigned to Chief whose job is to process one agreed-upon TODO at a time so Chief can safely follow through on authorized commitments between conversations.

A key use case is when Jon asks Chief to kick off async work during chat, the work continues in the background for minutes or hours, and Chief needs a durable reminder to check back later and notify Jon when the result is ready. In that model, chat remains the direct-response interface, while the TODO system becomes Chief's bounded operational memory.

The play should not become a general autonomous planner. Its role is to interpret Chief's authorized TODO list, decide whether one item is actionable, and then either create the appropriate task, perform the allowed follow-up action, or send the promised notification through a controlled path.

The source of truth for what Chief is allowed to act on should remain `docs/memories/TODO.md`, kept as a human-readable markdown checklist rather than introducing a new todo model immediately.

## Motivation

This gives Chief a bounded form of initiative without removing Jon from the authorization loop. The TODO list becomes the contract for what has been explicitly agreed to, while the play becomes a safe decision layer that can keep momentum going between conversations.

This is especially valuable for async orchestration. Without durable follow-up, Chief can start a report, research job, or implementation task, but then lose the obligation to circle back when the result is actually useful. A TODO-driven play closes that loop by making follow-up explicit and inspectable.

Keeping TODOs in markdown preserves a simple and inspectable source of truth. It also avoids premature schema work while still enabling automation through purpose-built tools.

## Proposed Shape

- Add a scheduled play assigned to Chief.
- On each run, the play reads Chief's TODOs and determines whether any agreed item is actionable.
- If no actionable TODO exists, the play should skip or error cleanly in the same spirit as existing guarded plays.
- If one actionable TODO exists, the play should handle exactly that one item.
- Depending on the TODO, handling may mean writing a task for another assistant, checking the status of background work, preparing a follow-up, or sending an approved notification.
- The play should create or execute at most one unit of work per run.
- The scheduler remains the system that repeatedly gives Chief chances to make bounded progress.

## Source Of Truth

Chief's TODOs should continue living in `docs/memories/TODO.md`.

Rather than replacing that file with a new model right away, keep the markdown checklist readable but support richer operational follow-up through tools such as:

1. `list todos`
2. `update todo(done: Boolean, description: string, remove: Boolean)`

These tools can parse the markdown TODO section as AST nodes and operate on GitHub-style checkbox items so the file stays readable while becoming safely editable by assistants.

Over time, TODO items may need lightweight structure embedded in markdown so Chief can reliably process async follow-up commitments, such as:

- what was kicked off
- what condition to check
- what counts as done
- whether Jon should be notified on success, failure, or both
- which channel to use for follow-up, including email
- whether a notification has already been sent

## Constraints

- Chief should only act on TODOs that Jon explicitly approved.
- If the TODO list is empty, nothing should happen.
- The play should not become a general autonomous planner.
- The play's job is bounded follow-through, not unconstrained self-direction.
- Work should flow through the existing task runner and scheduler protections when implementation is required.
- Notification behavior should be protected against duplicate sends or spam loops.
- Processing one TODO per run is a feature, not a limitation, because it keeps behavior legible and debuggable.

## Relationship To Message Threads

This idea is related to, but distinct from, the assistant inbox idea backed by `docs/messages/*.md` and the `MessageThread` model.

Message threads are the durable record of communication state. TODOs are the durable record of promised follow-up work.

A likely pattern is:

- an inbound message or chat leads Chief to start async work
- Chief records a TODO to check back later
- the play eventually sees the TODO is actionable
- Chief notifies Jon by email or another channel
- the related message thread can then be updated with the outbound follow-up

In other words, `docs/messages` can hold conversation history, while `docs/memories/TODO.md` holds explicit operational commitments.

## Example Behavior

One example is that Jon asks Chief to follow up on an idea when it becomes a project, and then later follow up again when the project is complete with a demo link.

Another example is that Jon asks Chief during chat to kick off a research report and email him when it is done. Chief starts the async work immediately, records a TODO describing what to check and how to notify Jon, and leaves the conversation responsive.

Later, when the triggering condition is true, the play notices it, writes the appropriate outbound or coordination task or sends the approved email follow-up, and then marks the TODO complete.

## Open Questions

- What minimum structure should each TODO include beyond checkbox text?
- Should async follow-up TODOs stay in markdown bullets, or eventually move to a dedicated follow-up model?
- How should the play determine actionability for a TODO in a way that is transparent and debuggable?
- Should some TODOs be one-time while others are repeatable follow-up instructions?
- How should priority be expressed if multiple TODOs are eligible at once?
- Should email notifications be sent directly by Chief, or only by creating a downstream task or message-queue item?
