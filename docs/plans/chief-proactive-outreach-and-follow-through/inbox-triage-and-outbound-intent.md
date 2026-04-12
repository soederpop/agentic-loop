---
status: pending
project: chief-proactive-outreach-and-follow-through
costUsd: 0
turns: 0
toolCalls: 0
---

# Inbox Triage And Outbound Intent

## Goal

Define how Chief interprets message threads, determines communication posture, and decides the next bounded communication action without collapsing inbox reasoning into transport logic or TODO execution.

## Scope

- define inbox triage states and decision classes
- clarify when a thread is `needs-reply`, `waiting`, `closed`, or `archived`
- define the difference between replying now, recording TODO follow-up, and queuing outbound intent
- define how summary and assessment should help Chief reason about next action
- identify when outbound intent should remain inspectable rather than immediately delivered

## Deliverables

- a triage model for assistant inbox behavior
- decision rules for choosing reply, wait, TODO, or outbound queue
- conventions for meaningful thread updates triggered by inbox reasoning
- examples showing conservative inbox behavior on ambiguous or high-risk threads

## References

- [Assistant Inbox And Outbound Scheduling](../../../docs/ideas/assistant-inbox-and-outbound-scheduling.md)
- [Message Threads](../../../docs/messages/README.md)

## Test plan

- Confirm the plan makes it obvious how Chief should interpret a warm thread with no reply yet.
- Confirm the plan distinguishes direct reply, deferred follow-up, and outbound intent.
- Confirm ambiguous cases result in conservative behavior rather than guessed outreach.
