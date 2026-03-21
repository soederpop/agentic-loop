---
goal: user-experience-improvements
tags:
  - communications
  - channels
  - telegram
  - imessage
  - gmail
  - events
  - subprocess
status: exploring
---

# Communications Feature (Channel Inbox)

A `communications` feature that runs as a subprocess spawned by the `luca main` process. It listens on one or more communication channels and emits a unified event stream whenever a new message arrives.

## Concept

- `luca main` spawns a **communications subprocess** (owned/managed by main)
- The communications subsystem can **activate** individual channels at runtime
- Each channel has a small adapter/subfeature responsible for connecting to that provider
- When any channel receives a message, the communications feature emits an event with a normalized shape

## Channels (initial)

- Telegram (stub initially; eventually use Luca’s core telegram feature)
- iMessage (use our local `imsg` feature)
- Gmail (stub initially; eventually use `gws`)

## Proposed API

```ts
type Channel = 'telegram' | 'imessage' | 'gmail'

type ChannelConfig = {
  trustedSenders: string[]
}

communications.activateChannel(channel: Channel, config: ChannelConfig): Promise<void>
communications.deactivateChannel(channel: Channel): Promise<void>

communications.on('message', (evt) => {
  // evt: normalized message event
})
```

### Normalized message event (draft)

```ts
type CommunicationsMessageEvent = {
  channel: 'telegram' | 'imessage' | 'gmail'
  from: string
  trusted: boolean
  text: string
  receivedAt: string // ISO
  raw?: unknown // provider-specific payload (optional)
}
```

## Activation Behavior

Calling `activateChannel(channel, config)`:

- Creates/initializes the channel adapter responsible for that provider
  - Gmail: (future) `gws` adapter
  - Telegram: (future) luca telegram adapter
  - iMessage: `imsg` adapter
- Passes config such as `trustedSenders`
- Starts listening/streaming updates
- Emits `message` events when new messages arrive

## Motivation

Unify inbound comms so Chief can react to messages from multiple sources consistently. This creates a single event stream that other features can subscribe to (notifications, triage, “reply with Chief”, logging, etc.) without each consumer needing to know channel-specific APIs.

## Notes / Scope Guards (for now)

- Start with **iMessage real integration** (since we already have it)
- Stub Telegram + Gmail with mocked adapters that emit fake events for development/testing
- Keep this as an event source only (no sending/reply) until the inbound plumbing is stable
