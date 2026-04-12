---
status: draft
goal: user-experience-improvements
---

# Chief Proactive Outreach And Follow-Through

## Overview

Build a single communication and follow-through system that combines the assistant inbox, durable message threads, TODO-driven async follow-up, and safe proactive outreach.

The project should give Chief a reliable operational loop for three kinds of behavior:

1. react to inbound communication through a durable inbox
2. remember and complete explicit follow-up commitments over time
3. proactively surface or initiate the next useful outreach when ready ideas and obvious work begin to run low

This project combines the ideas captured in `ideas/assistant-inbox-and-outbound-scheduling` and `ideas/proactive-todo-driven-autonomy` because they depend on the same architecture boundaries and should be planned as one system.

The core design principle is that communication truth, operational obligations, and proactive opportunity scouting must remain distinct even though they work together:

- the comms service is the transport and event-ingestion layer
- the assistant inbox is the reasoning and triage layer over communication state
- `docs/messages/*.md` backed by `MessageThread` is the durable communication ledger
- `docs/memories/TODO.md` is the durable record of explicit follow-up commitments
- outbound delivery is policy-governed and inspectable

This boundary is critical. Message threads should record meaningful communication events and communication posture. TODOs should record promises, deferred obligations, and async follow-up logic. Chief should only update message threads from TODO processing when communication state meaningfully changes, not on every internal check.

The final desired behavior is not open-ended autonomy. It is bounded initiative. When ideas, approved work, or obvious next actions run low, Chief should be able to inspect goals, ideas, project state, and warm communication threads, then prepare a small number of safe outreach opportunities. Depending on policy, those opportunities may become drafts, queued outbound messages, TODOs, or low-risk direct follow-ups.

Success looks like a system where Chief can:

- maintain a durable assistant inbox across message channels
- understand whether a thread needs reply, is waiting, or is closed
- record explicit follow-up obligations in a machine-actionable but human-readable TODO list
- process exactly one authorized TODO at a time safely and auditably
- queue, draft, approve, or send outbound follow-up according to policy
- proactively look for useful work or outreach when the system is light on ready ideas, without becoming spammy or acting like a general autonomous planner

## Execution

- [Inbox Ledger And Thread Ownership](plans/chief-proactive-outreach-and-follow-through/inbox-ledger-and-thread-ownership)
- [Inbox Triage And Outbound Intent](plans/chief-proactive-outreach-and-follow-through/inbox-triage-and-outbound-intent)
- [TODO-Driven Async Follow-Through](plans/chief-proactive-outreach-and-follow-through/todo-driven-async-follow-through)
- [Safe Outbound Queue And Approval Policy](plans/chief-proactive-outreach-and-follow-through/safe-outbound-queue-and-approval-policy)
- [Opportunity Scouting When Ideas Run Low](plans/chief-proactive-outreach-and-follow-through/opportunity-scouting-when-ideas-run-low)
