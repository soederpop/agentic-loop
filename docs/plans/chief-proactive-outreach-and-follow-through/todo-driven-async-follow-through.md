---
status: pending
project: chief-proactive-outreach-and-follow-through
costUsd: 0
turns: 0
toolCalls: 0
---

# TODO-Driven Async Follow-Through

## Goal

Define a safe TODO-driven execution model so Chief can remember and complete explicit follow-up commitments over time, especially when async work was started during chat and needs to be checked later.

## Scope

- formalize the machine-actionable TODO conventions inside `docs/memories/TODO.md`
- define deterministic selection and one-item-per-run behavior
- define claiming, acting, completion, blocked, and retry semantics
- define how TODOs reference reports, ideas, projects, tasks, and message threads
- define when TODO processing may update a `MessageThread`
- defer recurring or open-ended autonomy in favor of one-shot follow-up first

## Deliverables

- a clear TODO lifecycle and actionability model
- a documented minimum actionable TODO shape
- safety rules for idempotent notifications and duplicate-send prevention
- examples covering successful follow-up, blocked follow-up, and missing-target scenarios

## References

- [Proactive TODO-Driven Autonomy](../../../docs/ideas/proactive-todo-driven-autonomy.md)
- [Chief of Staff Todo List](../../../docs/memories/TODO.md)
- [Assistant Inbox And Outbound Scheduling](../../../docs/ideas/assistant-inbox-and-outbound-scheduling.md)

## Test plan

- Confirm a planner could determine exactly how one TODO is selected and processed per run.
- Confirm the plan prevents ambiguous TODOs from triggering improvised action.
- Confirm TODO processing only updates message threads on meaningful communication changes.
