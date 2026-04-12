---
status: pending
project: chief-proactive-outreach-and-follow-through
costUsd: 0
turns: 0
toolCalls: 0
---

# Safe Outbound Queue And Approval Policy

## Goal

Define the control plane for deferred or proactive outbound communication so Chief can prepare and deliver messages safely, with inspectable policy boundaries instead of ad hoc sending.

## Scope

- define outbound action classes such as auto-send, draft-first, and approval-required
- define when outbound intent should live in a queue or other inspectable staging layer
- define rate limits, per-thread cooldowns, duplicate protection, and bounded retries
- define failure handling and escalation when outbound delivery cannot proceed safely
- define how successful or failed outbound events should be reflected back into message threads and TODO state

## Deliverables

- a policy model for outbound communication classes
- a recommended staging or queue approach for inspectable outbound intent
- safety rules for rate limiting, dedupe, cooldowns, and retry behavior
- worked examples showing low-risk direct follow-up versus approval-gated outreach

## References

- [Assistant Inbox And Outbound Scheduling](../../../docs/ideas/assistant-inbox-and-outbound-scheduling.md)
- [Proactive TODO-Driven Autonomy](../../../docs/ideas/proactive-todo-driven-autonomy.md)

## Test plan

- Confirm the plan makes it clear which outbound actions are safe to send directly.
- Confirm retries and failure handling cannot easily create duplicate sends or spam loops.
- Confirm outbound actions remain inspectable before delivery for higher-risk classes.
