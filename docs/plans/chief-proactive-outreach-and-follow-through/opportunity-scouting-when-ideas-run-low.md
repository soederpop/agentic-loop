---
status: pending
project: chief-proactive-outreach-and-follow-through
costUsd: 0
turns: 0
toolCalls: 0
---

# Opportunity Scouting When Ideas Run Low

## Goal

Define how Chief can proactively look for useful work and outreach opportunities when the system is light on ready ideas, approved plans, or obvious next actions, without turning into an unconstrained autonomous planner.

## Scope

- define signals that indicate ideas or ready work are running low
- define the bounded set of opportunity classes Chief may scout for
- clarify the difference between suggesting outreach, drafting outreach, queueing outreach, and direct outreach
- constrain proactive behavior to warm contacts, known threads, current goals, recent context, and explicit policy
- define how opportunity candidates become TODOs, queue items, drafts, or approved direct actions

## Deliverables

- a low-ideas detection model
- an opportunity taxonomy for safe proactive behavior
- safeguards that prevent random or spammy outreach
- examples showing Chief surfacing the next useful moves when idea flow is low

## References

- [Assistant Inbox And Outbound Scheduling](../../../docs/ideas/assistant-inbox-and-outbound-scheduling.md)
- [Proactive TODO-Driven Autonomy](../../../docs/ideas/proactive-todo-driven-autonomy.md)
- [Have 10 Users of the Agentic Loop](../../../docs/goals/have-10-users-of-the-agentic-loop.md)
- [User Experience Improvements](../../../docs/goals/user-experience-improvements.md)

## Test plan

- Confirm the plan defines what "ideas running low" means in terms of observable system state.
- Confirm proactive behavior is bounded to legitimate, goal-aligned, low-risk opportunities.
- Confirm the design defaults to suggesting, drafting, or queueing outreach before direct sending unless policy explicitly allows otherwise.
