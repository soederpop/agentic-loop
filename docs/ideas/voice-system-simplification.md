---
goal: user-experience-improvements
tags:
  - voice
  - simplification
  - infrastructure
  - onboarding
status: exploring
---

# Voice System Simplification

Replace the rustpotter-based wakeword detection system with the new `scripts/dictate-loop` — a continuous speech detection and transcription loop that uses only `sox` and `mlx_whisper`. This eliminates the most fragile dependency in the voice stack (rustpotter + trained .rpw model files) and reduces the voice system from three moving parts to two.

## The Problem

The current voice system requires three components to work together:

1. **Rustpotter** (wakeword detection) — a Rust binary installed via Cargo, plus per-phrase `.rpw` model files that must be trained interactively by recording 5 voice samples per wake word
2. **Whisper MLX** (speech-to-text) — Apple Silicon optimized transcription
3. **ElevenLabs** (text-to-speech) — API-based voice output

Rustpotter is the weakest link:

- **Installation friction**: requires Rust/Cargo toolchain, or hunting down a pre-built binary (version 3.0.2 specifically). The troubleshooting log already documents that building from source caused issues and we had to switch to pre-built binaries.
- **Training friction**: each wake word requires an interactive recording session (`setup-wakeword.sh`) where you speak the phrase 5 times. You need at least two models (chief-of-staff + general commands). This is the most user-hostile part of onboarding.
- **Detection quality**: the soft detection confirmation logic in `voice-listener.ts` (sliding window, dual thresholds at 0.35 and 0.45) exists because rustpotter's raw detections aren't reliable enough to act on directly.
- **Maintenance surface**: rustpotter touches `install.sh`, `setup.sh`, `voice/wakeword/setup-wakeword.sh`, `features/voice-listener.ts`, `features/voice-service.ts`, `commands/voice.ts`, `workflows/setup/hooks.ts`, and multiple docs — a lot of code serving one function.

## The New Approach

`scripts/dictate-loop` already does continuous listening without rustpotter:

1. **Listen** — samples the mic in 0.5s chunks via `sox`, checking peak amplitude against a threshold (0.02)
2. **Record** — when speech is detected, records until 1.5s of silence
3. **Transcribe** — sends the WAV to `mlx_whisper`, outputs transcript wrapped in delimiter markers

The voice-listener feature can parse transcripts for command keywords instead of waiting for wakeword detections. This is actually more flexible — instead of training a model for "yo chief", the system can respond to any phrase pattern in the transcript. The `voice-router` already handles intent matching from transcribed text, so the wakeword layer was always just a gate before the real routing logic.

### What Changes

**`features/voice-listener.ts`** — Remove `waitForTriggerWord()` and all rustpotter process management. Replace with a mode that spawns `scripts/dictate-loop`, parses the `---START_TRANSCRIPT---` / `---END_TRANSCRIPT---` delimited output, and feeds transcripts directly to the voice router. The trigger word detection becomes a string match on the transcript (e.g., transcript starts with "hey chief" or "yo chief") rather than an acoustic model.

**`features/voice-service.ts`** — Remove rustpotter capability checks. The only requirements become `sox` and `mlx_whisper`. Simplify the `start()` flow since there's no wakeword/STT split — it's all one pipeline now.

**`commands/voice.ts`** — Remove rustpotter and `.rpw` model checks from `--check`. Update help text.

**`scripts/install.sh`** — Remove step 7 (rustpotter via Cargo). Remove Rust/Cargo as a prerequisite entirely if nothing else needs it.

**`setup.sh`** — Remove rustpotter troubleshooting notes from the Claude Code prompt. Remove the interactive wakeword training walkthrough. Voice setup becomes: confirm `sox` and `mlx_whisper` are installed, done.

**`voice/wakeword/setup-wakeword.sh`** — Delete entirely.

**`voice/wakeword/`** — Can be removed (models/ and samples/ are already gitignored).

**`workflows/setup/hooks.ts`** — Remove `checkRustpotter()` and `checkWakeWordModels()` from capability checks. Remove `/api/wake-words` endpoint.

**Documentation** — Update `voice/README.md`, `README.md`, onboarding docs, and any plans/ideas that reference rustpotter or wakeword training.

**`.gitignore`** — Remove `voice/wakeword/models/*.rpw` and `voice/wakeword/samples/*.wav` entries.

### What Stays the Same

- `scripts/dictate` (single-shot recording) — still useful as a standalone tool
- `scripts/dictate-loop` — becomes the engine for continuous voice listening
- Voice router and all voice command handlers — unchanged, they already work on transcribed text
- ElevenLabs TTS — unrelated to input detection
- The `yo` command for voice simulation — still useful for testing without a mic

## Architecture Before and After

**Before (3 components, rustpotter gating):**
```
Microphone
  → rustpotter (wakeword .rpw models)
    → [trigger detected]
      → sox + mlx_whisper (record + transcribe)
        → voice-router (intent matching)
          → handler
```

**After (2 components, continuous transcription):**
```
Microphone
  → dictate-loop (sox + mlx_whisper, continuous)
    → transcript text
      → voice-router (keyword + intent matching)
        → handler
```

## Dependencies

- `sox` (already required)
- `mlx_whisper` (already required)
- No new dependencies

## Scope

- Remove rustpotter from install, setup, capability checks, and voice-listener
- Rewire voice-listener to use dictate-loop as its input source
- Update all docs that reference rustpotter or wakeword training
- Run `cnotes validate --setDefaultMeta` and `cnotes summary` after doc changes

## Success Criteria

- `luca voice` works without rustpotter installed and without any .rpw model files
- `scripts/install.sh` and `setup.sh` no longer mention rustpotter or Cargo (for this purpose)
- Onboarding no longer requires interactive wakeword training
- Voice command detection works at least as reliably as the rustpotter-based system
- The voice-listener feature is simpler — fewer lines, fewer states, fewer processes to manage
