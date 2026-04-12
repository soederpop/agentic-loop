---
goal: have-10-users-of-the-agentic-loop
tags:
  - messaging
  - inbox
  - outbound
  - chief
status: exploring
---

# Assistant Inbox And Outbound Scheduling

Create an `assistantInbox` capability that captures routed message threads for assistants, tracks whether they were replied to, and gives Chief enough context to decide when proactive follow-up is needed.

A likely storage layer is `docs/messages/*.md` with status metadata so message threads can be inspected, filtered, and acted on by assistants in a durable way.

This idea also includes the ability for Chief to schedule outgoing messages instead of only reacting to inbound ones.

## Motivation

If assistants only react to inbound messages, useful follow-up opportunities can be missed. A shared inbox model would make communication state durable and inspectable, and it would allow Chief to monitor threads, determine whether a response happened, and decide when a proactive outbound message is appropriate.

This could become an important coordination surface for keeping projects moving, closing loops with Jon, and eventually supporting more reliable assistant-led communication workflows.

## Proposed Shape

- Capture incoming routed assistant conversations in an inbox-like document model.
- Store threads in `docs/messages/*.md` with status metadata.
- Track whether a thread has been replied to.
- Track whether follow-up is needed.
- Allow Chief to read the thread and decide whether a proactive outbound message should be initiated.
- Support scheduled outgoing messages in addition to reactive replies.

## Safety Requirements

Outbound delivery should be gated or throttled.

The system should make it hard for Chief to spam Jon or get stuck in an automated follow-up loop. Scheduling a message and actually delivering it should be distinct steps unless we later decide otherwise.

Potential safeguards could include:

- rate limits
- approval thresholds for certain message classes
- per-thread cooldowns
- queue inspection before delivery
- deduplication or loop detection

## Relationship To The TODO Autonomy Idea

This should be treated as a separate idea from the TODO-driven autonomy play.

The TODO-driven play can provide a narrow first version of bounded initiative. The assistant inbox can later become a richer communication substrate that helps Chief detect, schedule, and manage follow-up opportunities.

## Example Behavior

An assistant receives a routed message thread about a project. The thread is stored durably with status showing whether anyone replied. Chief can inspect the thread, see that a follow-up should happen, schedule an outbound message, and rely on gating or throttling controls before final delivery.

## Open Questions

- What metadata should each message thread contain?
- Should `docs/messages/*.md` become its own formal content model?
- What events should mark a thread as needing follow-up?
- What should the throttle or approval policy be for outbound messages?
- Should scheduled outbound messages live inside the message thread doc or in a separate queue model?
