---
status: draft
goal: user-experience-improvements
---

# Voice Input Mode Switching

The voice system currently only works if rustpotter is installed and wake word models are trained. This locks out users who don't have (or don't want) the full Rust/Cargo toolchain, and makes first-run onboarding harder than it needs to be.

This project adds a second input path — continuous mode — powered by the existing `dictate-loop` script (sox + mlx_whisper only, no rustpotter). Both modes produce the same `triggerWord` event, so everything downstream (voice router, handlers, TTS) stays untouched. The system auto-detects the best available mode, and users can switch between modes at runtime without restarting.

This directly supports the "progressive enhancement" principle in the UX goal: if you have rustpotter, you get wakeword mode. If you only have sox + mlx_whisper, you get continuous mode. If you have neither, voice is gracefully unavailable. No cliff edges.

## Overview

Three delivery phases, each demoable:

1. **Continuous listening + auto-detection** — The new `startContinuousListening()` method on VoiceListener, trigger phrase matching, and auto-detection logic. After this phase, `luca main` works for users who only have sox + mlx_whisper.
2. **Live mode switching + sentinel kill-switch** — Runtime mode transitions (`wakeword | continuous | off`) and the file-based circuit breaker. After this phase, users can change modes without restarting and mute voice instantly.
3. **Control surfaces** — CLI flag, API endpoint, voice commands, and keyboard shortcut for mode control. After this phase, mode switching is accessible from every interaction surface.

## Execution

- [Phase 1: Continuous Listening + Auto-Detection](../plans/voice-input-mode-switching/01-continuous-listening.md)
- [Phase 2: Live Mode Switching + Sentinel Kill-Switch](../plans/voice-input-mode-switching/02-live-mode-switching.md)
- [Phase 3: Control Surfaces](../plans/voice-input-mode-switching/03-control-surfaces.md)
