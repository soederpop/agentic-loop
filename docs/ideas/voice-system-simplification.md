---
goal: user-experience-improvements
tags:
  - voice
  - simplification
  - infrastructure
  - onboarding
status: promoted
---

# Voice Input Mode Switching

Keep both voice input methods — wakeword (rustpotter) and continuous (dictate-loop) — and make it easy to switch between them. Each has real advantages depending on the user's situation and preferences.

## Why Keep Both

**Wakeword mode (rustpotter):**
- The transcription loop isn't always on — mic is only active after a wake word is detected
- Better for privacy-conscious users — no constant mic sampling
- No flashing mic light in the menu bar (the continuous polling of sox is visible and can feel aggressive)
- Acoustic model detection means zero transcription cost while idle

**Continuous mode (dictate-loop):**
- No rustpotter installation required
- No interactive wake word training (no recording 5 samples per phrase)
- More flexible trigger detection — any phrase pattern in the transcript, not just trained acoustic models
- Lower onboarding friction — just needs sox + mlx_whisper, both easy to install
- Better for users who don't mind the always-on mic and want the simplest setup

## Current State

Right now the system is hardcoded to wakeword mode. The `dictate-loop` script exists and the voice-listener already has a `listen()` method that parses its output, but there's no way to use it as the primary input source. If rustpotter isn't installed or models aren't trained, voice input is simply unavailable.

## The Plan

### 1. Add `inputMode` to VoiceListener

Add an `inputMode` option: `"wakeword" | "continuous"` (default: `"wakeword"` if rustpotter is available, otherwise `"continuous"` if STT is available).

The state schema already tracks `wakeWordAvailable` and `sttAvailable` separately — the mode just decides which path to take.

### 2. Add `startContinuousListening()` to VoiceListener

New method that spawns `scripts/dictate-loop`, parses the `---START_TRANSCRIPT---` / `---END_TRANSCRIPT---` delimited output, and checks each transcript for trigger phrases. When a trigger phrase is found at the start of a transcript, emit `triggerWord` with the matched phrase — same event the wakeword path emits. The rest of the transcript (after the trigger phrase) can be passed along as the initial command text, skipping the separate `listen()` step.

Trigger phrases to match (configurable, but sensible defaults): "hey chief", "yo chief", "hey friday", etc. These are already the wake word names — reuse them.

### 3. Update VoiceService.start()

Instead of only wiring up `waitForTriggerWord()` when wakeword is available, check the input mode and call either:
- `listener.waitForTriggerWord()` for wakeword mode
- `listener.startContinuousListening()` for continuous mode

The rest of the service (router, TTS chats, handler dispatch) stays exactly the same — both modes produce the same `triggerWord` event.

### 4. CLI flag for mode selection

Add `--voice-mode wakeword|continuous` to `luca main`. Falls back to auto-detection: wakeword if rustpotter is available, continuous if only STT is available, disabled if neither.

### 5. Sentinel file kill-switch

A simple file-based circuit breaker: if `~/.agentic-loop/voice-disabled` exists, the voice listener treats itself as disabled — continuous mode stops processing transcripts, wakeword mode ignores detections. The listener checks for this file on each cycle (before acting on a transcript or detection), so dropping or removing the file takes effect immediately without restarting anything.

This is intentionally low-tech. You can disable voice from another terminal, a script, a cron job, a voice command, or even a Shortcuts automation — anything that can `touch` or `rm` a file. No IPC, no sockets, no state sync.

The file can optionally contain a reason (e.g., "in a meeting") that gets logged when the listener skips input, but its mere presence is what matters.

### 6. Live mode switching (no restart)

The voice mode (`wakeword | continuous | off`) must be changeable while `luca main` is running. The mode is a piece of voice-service state, and changing it triggers a clean transition:

1. Stop the current listener (kill rustpotter processes or dictate-loop subprocess)
2. Update the mode state
3. Start the new listener (or do nothing for `off`)

This should be triggerable from multiple surfaces:
- **Voice command**: "switch to wakeword mode", "turn off voice", "go continuous"
- **Main loop keyboard shortcut**: a key combo that cycles through modes
- **API endpoint**: `POST /api/voice/mode` with `{ mode: "wakeword" | "continuous" | "off" }` — useful for the workflow UIs and external tooling
- **CLI**: `luca main --set voice-mode continuous` (sends to running instance via socket)

The `off` mode is important — it's distinct from the sentinel file. The sentinel is a hard external kill-switch (for automation, emergencies, "mute while in a meeting"). The `off` mode is the user's intentional choice within the app. Both disable voice input, but the sentinel overrides everything regardless of mode.

### 7. Update capability checks

Capability check logic already distinguishes wakeword vs STT availability. The change is that missing wakeword capabilities no longer means "voice unavailable" — it means "wakeword mode unavailable, continuous mode may still work."

Update the startup summary in voice-service to reflect which modes are available:
```
Wake word mode: available / UNAVAILABLE (reason)
Continuous mode: available / UNAVAILABLE (reason)
Active mode:     wakeword
```

## What Changes

**`features/voice-listener.ts`** — Add `inputMode` state (`wakeword | continuous | off`), `startContinuousListening()` method, trigger phrase matching, sentinel file check on each cycle. Keep all existing wakeword/rustpotter code as-is.

**`features/voice-service.ts`** — Branch on input mode in `start()`. Add `setMode(mode)` method that cleanly transitions between modes at runtime. Update capability summary logging. Update `stop()` to handle either listener mode.

**`commands/main.ts`** — Accept `--voice-mode` flag. Wire up keyboard shortcut for mode cycling. Pass mode changes to voice service.

**`commands/voice.ts`** — Update `--check` to show both modes' availability.

**`endpoints/` (or voice-service socket)** — Expose mode switching via API for workflow UIs and external tooling.

## What Stays the Same

- All rustpotter code, models, training scripts — untouched
- `scripts/dictate` (single-shot) — still used by `listen()` after wakeword triggers
- `scripts/dictate-loop` — becomes the engine for continuous mode
- Voice router and all voice command handlers — unchanged
- ElevenLabs TTS — unrelated to input detection
- The `yo` command for voice simulation — still useful for testing

## Architecture

```
                    ┌─────────────────────────────┐
                    │        VoiceService          │
                    │ (mode: wakeword|continuous|off)│
                    └──────────────┬──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                                         │
   ┌──────────▼──────────┐              ┌───────────────▼───────────┐
   │   Wakeword Mode     │              │    Continuous Mode        │
   │                      │              │                           │
   │  rustpotter (.rpw)   │              │  dictate-loop (sox +      │
   │  → triggerWord event │              │  mlx_whisper)             │
   │  → listen() for cmd  │              │  → parse transcript       │
   │                      │              │  → match trigger phrase    │
   └──────────┬──────────┘              │  → triggerWord event       │
              │                          └───────────────┬───────────┘
              │                                          │
              └──────────────────┬───────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │     Voice Router        │
                    │  (same for both modes)  │
                    └─────────────────────────┘
```

## Dependencies

- Wakeword mode: rustpotter binary + .rpw model files + sox + mlx_whisper
- Continuous mode: sox + mlx_whisper
- No new dependencies

## Cleanup: Rustpotter Installation

`scripts/install.sh` (lines 59-77) still installs the full Rust/Cargo toolchain and builds rustpotter from source via `cargo install rustpotter-cli`. This is slow, fragile, and pulls in a heavy dependency chain for a single binary. Replace with a pre-built binary download for the target OS/arch. The setup script troubleshooting notes already document that building from source caused issues — we shouldn't be doing it at all.

## Scope

- Add input mode concept (`wakeword | continuous | off`) to voice-listener and voice-service
- Add `--voice-mode` flag to main command
- Sentinel file kill-switch (`~/.agentic-loop/voice-disabled`)
- Live mode switching via voice command, keyboard shortcut, API, and CLI
- Auto-detect best available mode as fallback
- Update capability check output
- Keep all existing rustpotter code intact

## Success Criteria

- `luca main --voice-mode continuous` works without rustpotter installed
- `luca main --voice-mode wakeword` works exactly as it does today
- `luca main` auto-selects the best available mode
- Mode can be switched at runtime without restarting the process
- `touch ~/.agentic-loop/voice-disabled` immediately silences voice input; `rm` re-enables it
- `luca voice --check` shows availability of both modes and current active mode
