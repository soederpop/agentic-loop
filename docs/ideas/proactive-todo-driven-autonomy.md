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
- Notification actions must be idempotent and auditable so Chief does not send duplicate updates or get stuck in a spam loop.
- Processing one TODO per run is a feature, not a limitation, because it keeps behavior legible and debuggable.
- If a TODO is ambiguous, under-specified, or appears unauthorized, the safe behavior is to skip direct action and surface the item as blocked.

## Selection And Execution Semantics

The play should follow a deterministic lifecycle on each run:

1. Read the TODO source of truth.
2. Select at most one eligible item using a stable rule.
3. Claim that item for the current run.
4. Perform one bounded action only.
5. Record the result durably.
6. Exit without looping.

If multiple TODOs are actionable at once, the first version should prefer a simple deterministic rule such as explicit priority first, then oldest or file order. The important property is that selection remains predictable and debuggable.

Claiming, acting, and completion should be treated as distinct moments even if they are represented in lightweight markdown. That separation reduces the risk of duplicate handling when the scheduler overlaps, a run fails midway through, or a notification succeeds but the final TODO update does not.

## Minimum Actionable TODO Shape

Even if TODOs remain markdown checklist items, machine-actionable follow-up probably requires more than freeform prose.

The minimum conceptual shape should include:

- a human-readable description
- evidence of explicit authorization from Jon
- the responsible assistant
- the type of action to perform
- the target artifact, thread, or subject to inspect
- the trigger or due condition
- the success condition
- the follow-up behavior when complete
- the notification policy, including channel and whether to notify on success, failure, or both
- enough state to prevent duplicate sends
- timestamps such as created at and last checked at when useful

The markdown representation can stay simple at first, but the idea should assume that some TODOs will need lightweight structure if they are expected to drive reliable async follow-up.

## Operational Safety Guarantees

The play should only act on TODOs that contain enough explicit structure to evaluate safely.

If the next action is obvious and authorized, the play may proceed through an allowed path. If intent, authorization, destination, or completion criteria are unclear, the play should avoid improvising and instead leave the item pending or blocked for review.

Outbound actions should be treated as higher-risk than internal coordination. For some classes of TODO, the right action may be to create a downstream task or queue item rather than sending a message directly.

Every run should leave a durable audit trail describing what TODO was inspected, whether it was actionable, what action was taken, and whether a notification was attempted, sent, failed, or intentionally skipped.

Retries should be bounded. Repeated failure should surface for review rather than letting the play retry forever.

## Relationship To Message Threads

This idea is related to, but distinct from, the assistant inbox idea backed by `docs/messages/*.md` and the existing `MessageThread` model.

Message threads are the durable record of communication state. TODOs are the durable record of promised follow-up work.

`MessageThread.status` should represent communication posture, not the full state of TODO execution. For example, a thread may be `waiting` while async work is underway or `needs-reply` when user-facing follow-up is now required, but the TODO itself still carries the operational obligation and completion logic.

A likely pattern is:

- an inbound message or chat leads Chief to start async work
- Chief records a TODO to check back later
- if the TODO originated from a conversation, it should reference the related message thread when possible
- the play eventually sees the TODO is actionable
- Chief notifies Jon by email or another channel
- the related message thread is updated when communication state meaningfully changes

In other words, `docs/messages` can hold conversation history and communication posture, while `docs/memories/TODO.md` holds explicit operational commitments.

The thread timeline should be updated for meaningful events such as inbound requests, async kickoff, outbound follow-up, or blocked outcomes that matter to Jon. It should not become a noisy scheduler log for every routine check.

## Example Behavior

One example is that Jon asks Chief to follow up on an idea when it becomes a project, and then later follow up again when the project is complete with a demo link. That TODO is not just a reminder. It is an operational commitment tied to a domain-state change.

Another example is that Jon asks Chief during chat to kick off a research report and email him when it is done. Chief starts the async work immediately, records a TODO describing what to check and how to notify Jon, and leaves the conversation responsive. The related message thread, if there is one, can be marked as waiting while the research runs.

Later, when the triggering condition is true, the play notices it, writes the appropriate outbound or coordination task or sends the approved email follow-up, updates the related message thread with the meaningful outbound event, and then marks the TODO complete.

A failure example is also important: if completion is detected but the notification target, approval level, or destination thread is ambiguous, the play should not guess. It should leave the TODO blocked or create a downstream coordination task instead of sending an unsafe message.

## Edge Cases And Failure Modes

- multiple TODOs become actionable at once
- a TODO remains incomplete for a long-running job and needs backoff rather than constant re-checks
- a notification is sent successfully but the TODO is not marked complete
- a TODO is claimed but the notification send fails
- the referenced report, task, or message thread no longer exists
- the TODO is edited by a human while the play is processing it
- a TODO becomes actionable repeatedly and needs to be one-shot or explicitly repeatable
- the play cannot confidently interpret the item's authorization or completion condition

These cases should be treated as first-class design concerns rather than implementation details, because they determine whether bounded autonomy remains safe in practice.

## Open Questions

- What explicit trigger types should the first version support: time-based, artifact-state-based, task-status-based, or message-state-based?
- Should the first version support only one-shot TODOs, with recurring behavior deferred or represented as newly scheduled one-shots?
- Should async follow-up TODOs stay in markdown bullets, or eventually move to a dedicated follow-up model?
- What deterministic selection rule should be used when multiple TODOs are eligible at once?
- Which outbound actions are safe for Chief to send directly, and which should always require a downstream task or queue item?
