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

The storage layer for this already has a starting point: `docs/messages/*.md` is backed by the existing `MessageThread` content model. That gives the system a durable thread record with frontmatter for routing and status plus markdown sections for summary, assessment, timeline, and notes.

This idea also includes the ability for Chief to schedule outgoing messages instead of only reacting to inbound ones.

## Motivation

If assistants only react to inbound messages, useful follow-up opportunities can be missed. A shared inbox model makes communication state durable and inspectable, and it allows Chief to monitor threads, determine whether a response happened, and decide when a proactive outbound message is appropriate.

This could become an important coordination surface for keeping projects moving, closing loops with Jon, and eventually supporting more reliable assistant-led communication workflows.

## Current Foundation

`docs/messages/*.md` already has a formal `MessageThread` model with:

- frontmatter fields for `channel`, `assistant`, `status`, `threadKey`, `participant`, and `tags`
- markdown sections for `Summary`, `Participants`, `Assessment`, `Timeline`, and `Notes`

That means this idea is no longer about whether message threads should exist as a content model. They already do. The real question is how far that model should go in supporting inbox operations, outbound scheduling, and follow-up coordination.

## Proposed Shape

- Capture incoming routed assistant conversations in `docs/messages/*.md`.
- Use `MessageThread` as the durable communication ledger for each thread.
- Track whether a thread has been replied to and whether it is waiting on the assistant, Jon, or an external async result.
- Allow Chief to read thread context and decide whether proactive follow-up is appropriate.
- Support scheduled outgoing messages in addition to reactive replies.
- Keep communication state in message threads and avoid turning them into a general-purpose operational task store.

## System Boundary And Ownership

This idea needs a clear boundary between the comms service, the assistant inbox capability, and the `docs/messages/*.md` documents so future implementation does not blur transport, reasoning, and storage.

### Comms Service

The comms service should be the transport and event-ingestion layer.

Its responsibilities are:

- receive and send messages for channels like Gmail, Telegram, and iMessage
- normalize provider-specific events into a common internal shape
- resolve or create the correct thread identity using `threadKey`
- write raw or meaningful inbound and outbound communication events into the related `MessageThread`
- keep provider and routing concerns out of Chief's higher-level reasoning loop

The comms service should not be the place where long-horizon follow-up strategy is decided. It should not own TODOs, general planning, or non-communication operational obligations.

### Assistant Inbox

The assistant inbox should be the reasoning and triage layer built on top of message threads.

Its responsibilities are:

- read `MessageThread` documents as the durable inbox state
- interpret communication posture such as `needs-reply`, `waiting`, `closed`, or `archived`
- refresh summaries, assessments, and assistant-readable notes
- decide when a thread implies proactive follow-up may be appropriate
- decide whether the next action is a direct reply, a queued outbound action, or creation of a TODO for later follow-up

The assistant inbox should not be treated as the low-level transport adapter. It consumes communication history and determines what it means.

### MessageThread Documents

`docs/messages/*.md` should be the durable communication ledger.

They are the persistent record of:

- who said what
- which assistant and participant the thread belongs to
- current communication posture
- meaningful inbound and outbound events over time
- summary and notes that help future-Chief understand the thread quickly

They should not become the general-purpose store for all async work state, scheduler bookkeeping, or operational follow-up obligations.

### Write Boundaries

The expected write boundary should be explicit:

- the comms service may create threads, resolve thread identity, and append inbound or outbound communication events
- the assistant inbox may update summary, assessment, notes, and communication status
- TODO plays or other async follow-up systems should update message threads only when communication state meaningfully changes, such as an outbound follow-up being sent or a blocked communication outcome that Jon would care about

Routine scheduler checks should not spam `MessageThread` timelines. A message thread should record communication truth, not every internal polling step.

## Relationship To TODO-Driven Follow-Up

This should be treated as related to, but distinct from, the TODO-driven autonomy idea.

A useful boundary is:

- `docs/messages/*.md` stores communication history and communication posture
- `docs/memories/TODO.md` stores explicit operational commitments and deferred follow-up obligations

That separation matters. A message thread can show that Chief is waiting on a report, but the TODO is what records the promise to check back later and notify Jon when the result is ready.

A likely pattern is:

- an inbound thread asks for something
- Chief starts async work
- Chief records a TODO to follow up later
- the TODO-driven play checks when the result is ready
- Chief sends or schedules the outbound update
- the related `MessageThread` timeline is updated with the meaningful communication event

This keeps `MessageThread.status` focused on communication posture rather than overloading it with the full lifecycle of async work.

## Outbound Scheduling Shape

There are at least three plausible outbound patterns:

1. store outbound intent inside the related message thread
2. create a TODO or follow-up item that eventually produces the outbound message
3. create a separate outbound queue model later if message volume or safety rules become more complex

The first version should probably stay conservative. Message threads should record communication state, while actual sending may still be gated through TODOs, downstream tasks, or another explicit approval step.

## Safety Requirements

Outbound delivery should be gated or throttled.

The system should make it hard for Chief to spam Jon or get stuck in an automated follow-up loop. Scheduling a message and actually delivering it should be distinct steps unless we later decide otherwise.

Potential safeguards could include:

- rate limits
- approval thresholds for certain message classes
- per-thread cooldowns
- queue inspection before delivery
- deduplication or loop detection
- idempotent send records so retries do not create duplicates

## Example Behavior

An assistant receives a routed message thread about a project. The thread is stored durably with status showing whether anyone replied and what the assistant is currently waiting on.

Chief can inspect the thread, see that follow-up should happen, and either:

- reply immediately
- schedule or queue an outbound message
- or create a TODO to follow up after async work completes

Later, when a meaningful outbound communication event occurs, the thread timeline is updated so the inbox remains the durable communication record.

## Open Questions

- What additional metadata or conventions should each `MessageThread` carry for inbox operations?
- What events should mark a thread as `needs-reply` versus `waiting`?
- Should outbound intent live inside the message thread doc, in TODOs, or in a separate queue model?
- What should the throttle or approval policy be for outbound messages?
- At what point does the inbox need a dedicated outbound queue rather than lightweight coordination through TODOs and tasks?
