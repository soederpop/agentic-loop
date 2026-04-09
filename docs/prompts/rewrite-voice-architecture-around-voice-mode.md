---
tags: [voice, architecture, voice-mode, assistants, web-chat]
repeatable: true
inputs:
  scope:
    description: "Optional implementation scope or target surface (e.g. voice-service, web-chat, all)"
    type: input
---

# Rewrite Voice Architecture Around Voice Mode

Rewrite the project's voice architecture so that **`voiceMode` is the single voice capability abstraction** attached directly to assistants via `assistant.use(voiceMode)`. Do **not** preserve `voice-chat` as a compatibility layer. `features/voice-chat.ts` may remain in the repository temporarily as a reference file only, but no live code should depend on it after this rewrite.

The goal is to replace the current `voice-chat` + `SpeechStreamer` architecture with an **assistant-native voice model** where:

- assistants remain the primary conversational unit
- `voiceMode` owns spoken-response behavior
- voice-specific convenience methods are exposed on `assistant.ext`
- callers stop depending on a special `VoiceChat` wrapper type
- disabling voice mode returns the assistant to normal markdown/text behavior

## Outcome

After this rewrite:

1. `voiceMode` is the authoritative voice feature.
2. `voice-chat` is not used by `voice-service`, `web-chat`, `chat-service`, or any other live path.
3. The old `SpeechStreamer` is not used in the main response-speech path.
4. Any assistant can become voice-capable by attaching `voiceMode`.
5. `assistant.ext.toggleVoiceMode(true | false)` exists and controls whether the assistant behaves as a voice-first assistant or a normal markdown-capable assistant.
6. Voice affordances formerly housed in `voice-chat` (phrase playback, tool phrases, voice completion helpers) are absorbed into `voiceMode` and surfaced through `assistant.ext`.

## Core Architectural Decision

Treat `voiceMode` as a **full assistant voice capability**, not just a TTS pipeline.

That means `voiceMode` is responsible for:

- injecting/removing voice-oriented prompt guidance
- streaming assistant chunks into TTS when enabled
- muting/unmuting audio output
- waiting for speech completion
- loading and playing assistant phrase manifests
- optional tool-call/result/error phrase playback
- exposing a clean `assistant.ext` voice API

It is **not** responsible for:

- assistant discovery
- wakeword routing
- window overlays
- orchestration of the overall voice service

Those remain the responsibility of `voice-service` and related orchestration code.

## Why This Rewrite Exists

The current `voice-chat` feature is a mixed abstraction that combines:

- assistant lifecycle
- voice prompt shaping
- TTS chunking/streaming
- playback completion coordination
- phrase manifest helpers
- tool phrase behavior

It does this via a dedicated wrapper object and the legacy `SpeechStreamer`. This has produced poor behavior and awkward coupling.

`voiceMode` is already the better foundation because it:

- attaches directly to assistants
- binds into the assistant lifecycle
- owns observable state and events
- has better chunking behavior
- supports summarization for speech
- more naturally fits the Luca architecture

This rewrite finishes that direction instead of preserving the old wrapper.

---

## Required Behavior

### 1. Assistant-Native Voice Capability

The canonical way to make an assistant voice-capable must be:

```ts
const assistant = assistantsManager.create('chiefOfStaff', { ... })
const voiceMode = container.feature('voiceMode', voiceOptions)
assistant.use(voiceMode)
```

No higher-level `voiceChat` wrapper should be required for voice output.

### 2. `assistant.ext` Voice Surface

When `voiceMode` is attached, it must expose assistant-local convenience methods on `assistant.ext`.

At minimum, expose:

- `assistant.ext.voiceMode`
- `assistant.ext.toggleVoiceMode(enabled: boolean)`
- `assistant.ext.enableVoiceMode()`
- `assistant.ext.disableVoiceMode()`
- `assistant.ext.mute()`
- `assistant.ext.unmute()`
- `assistant.ext.speak(text: string)`
- `assistant.ext.waitForSpeechDone()`
- `assistant.ext.playPhrase(tag: string)`
- `assistant.ext.playToolcallPhrase()`
- `assistant.ext.playToolResultPhrase()`
- `assistant.ext.playToolErrorPhrase()`

It is acceptable to expose additional helpers if they are coherent and voice-related.

### 3. True Voice Mode Toggle

`assistant.ext.toggleVoiceMode(true | false)` must be a **real behavior mode switch**, not a synonym for mute/unmute.

#### When enabled:

- voice prompt guidance is active
- the assistant writes for spoken delivery
- markdown suppression / speech-oriented formatting guidance is active
- TTS synthesis/playback is allowed
- tool phrases may play if configured

#### When disabled:

- voice prompt guidance is inactive
- the assistant returns to normal text-chat behavior
- markdown and structured formatting are allowed again
- no spoken-response pipeline should run for new turns
- no tool phrases should play

This toggle should affect **future turns**. It does not need to retroactively rewrite an in-progress response.

### 4. Distinguish Voice Mode vs Mute

Preserve a clear distinction between:

- **voice mode enabled/disabled** → changes assistant response behavior
- **mute/unmute** → changes whether audio is heard

That means these are different states:

- voice mode enabled + unmuted
- voice mode enabled + muted
- voice mode disabled

`mute()` must not imply that markdown/text behavior returns.

### 5. Phrase Manifest Absorption

Port the useful phrase-manifest behavior from `voice-chat` into `voiceMode`.

That includes:

- loading `assistant/generated/manifest.json`
- indexing entries by tag
- choosing random phrases by tag
- avoiding immediate repeats when possible
- playing phrase files with local playback

Phrase APIs should hang off the assistant via `assistant.ext` and be backed by `voiceMode`.

### 6. Tool Phrase Absorption

Absorb tool phrase behavior from `voice-chat` into `voiceMode`.

That includes optional:

- tool-call phrase playback
- tool-result phrase playback
- tool-error phrase playback
- time-window throttling to avoid spam

If tool phrase playback is configurable, the config should live in `voiceMode` options/state, not a wrapper abstraction.

### 7. Voice Completion API

`voiceMode` should be the authoritative way to wait for spoken output to finish.

Callers should rely on:

- `assistant.ext.waitForSpeechDone()`
- or `voiceMode.waitForSpeechDone()`

`voice-service` and any UI integrations should stop depending on `voice-chat`’s `finished` semantics.

---

## `voiceMode` Feature Requirements

Enhance `features/voice-mode.ts` so it can fully replace `voice-chat` in live paths.

### State

Ensure `voiceMode` state includes enough information for callers and overlays to observe what is happening.

It should include at least:

- `enabled`
- `muted`
- `speaking`
- `generating`
- `turnCount`
- `attached`
- `provider`

You may add additional state keys if useful, such as:

- `playPhrases`
- `ttsAvailable`
- `lastToolPhraseAt`
- `phraseManifestLoaded`

### Options

Support options for:

- TTS provider and provider-specific config
- conversation mode prefix
- chunk sizing
- summarization
- debug logging
- tool phrase playback policy
- phrase playback enablement

If `voiceMode` needs to accept phrase/tool settings previously housed on `voice-chat`, move them here.

### Prompt Guidance

Voice prompt guidance must be **toggleable**.

When voice mode is disabled, the assistant should not receive the speech-first prompt extension for future turns.

Implement this in a way that is robust and doesn’t leave stale behavior behind. It is acceptable to:

- dynamically enable/disable the extension’s output based on state
- or properly add/remove prompt extension behavior if the assistant API supports that cleanly

The key requirement is behavior, not a specific implementation technique.

### Event Binding

When attached to an assistant, `voiceMode` must bind to assistant lifecycle and response events so that it can:

- observe chunks
- stream text to TTS when enabled
- complete turns cleanly
- react to tool events for phrase playback

It must also clean up listeners appropriately when detached.

### Assistant Extension Contract

`voiceMode.setupToolsConsumer()` should mount the assistant extension methods described earlier and keep them authoritative.

### Playback and Temp Files

Use existing local playback behavior unless there is a clearly better project-native way already available. Keep cleanup of temp synthesis files intact.

---

## Call Site Rewrite Requirements

Update all live code paths that currently depend on `voice-chat` so they use **assistant + voiceMode** directly.

### 1. `features/voice-service.ts`

Rewrite `voice-service` so that it no longer creates `voiceChat` instances.

Instead, each discovered voice-enabled assistant entry should contain something equivalent to:

- assistant name
- aliases
- assistant instance
- attached voiceMode instance

`voice-service` should:

- create assistants directly via `assistantsManager`
- read `voice.yaml`
- construct `voiceMode` with the correct provider options
- attach `voiceMode` via `assistant.use(voiceMode)`
- ask the assistant directly
- wait for speech completion via `voiceMode`
- bind overlay/UI state transitions to `voiceMode` events

Do not continue to route through a `chat.ask()` wrapper.

### 2. `features/chat-service.ts`

Remove the concrete dependency on `VoiceChat` as the voice abstraction.

Refactor the chat service so it works with the assistant-native voice model. Depending on the service’s needs, it may hold:

- an assistant reference and a voiceMode reference
- or an equivalent minimal pair that does not depend on `voice-chat`

The important part is that the service no longer assumes a `VoiceChat` wrapper object exists.

Voice-on / voice-off behavior in chat service should use the new assistant-native voice controls.

### 3. `commands/web-chat.ts`

Stop creating `voiceChat` instances.

Instead:

- create or obtain the relevant assistant/session assistant
- create and attach `voiceMode`
- wire the web chat to that assistant-native voice capability

Do not preserve the old wrapper abstraction in this command.

### 4. Other Live Call Sites

Search all live code for references to:

- `voiceChat`
- `feature('voiceChat'`
- `VoiceChat`
- `SpeechStreamer`

Refactor all live paths away from them where they are part of the active assistant response-speech flow.

If a file is left only as reference, it must not remain on a live path.

---

## Voice Config Handling

The new architecture still needs a consistent way to derive `voiceMode` options from `voice.yaml`.

You may implement this as either:

- helper methods on `voiceMode`
- a shared helper utility near `voiceMode`
- or local helper functions in the callers if truly minimal

But the resulting behavior must preserve current support for:

- `provider`
- `voiceId`
- `modelId`
- `voiceSettings`
- `conversationModePrefix`
- `maxChunkLength`
- `voicebox.*`

Prefer one reusable source of truth over copy-pasted config assembly.

---

## Explicit Non-Goals

Do **not** do the following as the main solution:

- do not keep `voice-chat` as a live compatibility adapter
- do not route new code through `voice-chat`
- do not preserve `SpeechStreamer` in the main response path out of convenience
- do not conflate `mute()` with disabling voice mode
- do not move wakeword routing or overlay orchestration into `voiceMode`
- do not leave the assistant permanently stuck in speech-first prompt mode when voice mode is off

---

## Suggested Implementation Sequence

### Phase 1 — Expand `voiceMode`

Enhance `features/voice-mode.ts` until it can fully support:

- assistant-native toggle behavior
- phrase manifest loading and playback
- tool phrase hooks
- assistant extension methods
- completion semantics callers can rely on

### Phase 2 — Refactor `voice-service`

Replace `voiceChat` creation with assistant + voiceMode creation and update overlay/event wiring.

### Phase 3 — Refactor `chat-service`

Remove its dependency on a `VoiceChat` object and rewire it to the assistant-native model.

### Phase 4 — Refactor `web-chat`

Attach `voiceMode` directly instead of creating a voice wrapper.

### Phase 5 — Sweep and Verify

Remove all live references to `voice-chat` and `SpeechStreamer` from the active voice-response path. Leave `features/voice-chat.ts` only as a reference until explicit approval is given to delete it.

---

## Verification Requirements

After implementation, verify the following behaviors.

### Voice Service

- `luca main` still starts the voice system
- wakeword/trigger flow still resolves assistants correctly
- overlay/listening/generating/speaking/done transitions still work
- assistant responses are spoken through `voiceMode`
- phrase playback still works where intended

### Web Chat

- web chat can still produce voiced responses
- voice-on mode uses assistant-native voice mode rather than `voice-chat`
- voice-off mode returns to normal text behavior

### Toggle Behavior

On an assistant with `voiceMode` attached:

- `assistant.ext.toggleVoiceMode(true)` makes responses speech-oriented and non-markdown
- `assistant.ext.toggleVoiceMode(false)` makes responses normal markdown-capable assistant responses again
- `assistant.ext.mute()` suppresses audio but does not disable speech-first response shaping
- `assistant.ext.unmute()` restores audible output

### Phrase APIs

- `assistant.ext.playPhrase(tag)` works for assistants with generated phrase manifests
- immediate repeats are avoided when possible
- tool phrase playback does not spam excessively

### No Old Abstraction on Live Paths

Confirm there are no live-path dependencies on:

- `feature('voiceChat'...)`
- `VoiceChat` as the primary voice response abstraction
- `SpeechStreamer` in the assistant response path

Reference files may remain in the repo, but not in active execution paths.

---

## Files Likely In Scope

At minimum, inspect and update as needed:

- `features/voice-mode.ts`
- `features/voice-service.ts`
- `features/chat-service.ts`
- `commands/web-chat.ts`
- any helpers used to parse `voice.yaml`
- any live code still instantiating `voiceChat`

Reference-only files that may remain for now:

- `features/voice-chat.ts`
- `voice/speech-streamer.ts`

---

## Final Standard

The final architecture should feel like this:

- assistants are the primary conversational objects
- voice is an attachable assistant capability
- `assistant.ext` is the ergonomic voice control surface
- toggling voice mode changes how the assistant responds
- muting changes whether audio is heard
- there is no special wrapper object required to make assistants speak

If a caller wants spoken behavior, it should attach `voiceMode` to an assistant and use that assistant directly.
