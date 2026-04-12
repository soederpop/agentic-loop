---
status: pending
project: chief-proactive-outreach-and-follow-through
costUsd: 0
turns: 0
toolCalls: 0
---

# Inbox Ledger And Thread Ownership

## Goal

Establish `MessageThread` as the durable communication ledger and define the ownership boundary between the comms service, assistant inbox, and message documents so future work does not blur transport, reasoning, and storage responsibilities.

## Scope

- define the authoritative role of `docs/messages/*.md`
- define what the comms service is allowed to write directly
- define what the assistant inbox is allowed to write directly
- define what TODO-driven or other background systems are allowed to write, and when
- clarify what belongs in thread frontmatter versus markdown body sections
- define what counts as a meaningful thread event versus internal operational noise

## Deliverables

- a documented thread lifecycle and ownership model
- a clear write-boundary contract for comms, inbox, and TODO systems
- conventions for `Summary`, `Assessment`, `Timeline`, and `Notes`
- explicit guidance that `MessageThread.status` reflects communication posture, not full async workflow state

## References

- [Assistant Inbox And Outbound Scheduling](../../../docs/ideas/assistant-inbox-and-outbound-scheduling.md)
- [Proactive TODO-Driven Autonomy](../../../docs/ideas/proactive-todo-driven-autonomy.md)
- [Message Threads](../../../docs/messages/README.md)

## Test plan

- Confirm a planner or implementer could read this plan and answer who owns transport, who owns triage, and who owns durable communication history.
- Confirm the design prevents routine scheduler checks from polluting thread timelines.
- Confirm the resulting guidance distinguishes communication posture from operational obligation state.
