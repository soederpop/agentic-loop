---
status: pending
project: voice-input-mode-switching
---

# Phase 1: Continuous Listening + Auto-Detection

Add continuous listening as a second input path in VoiceListener, wire it into VoiceService, and auto-detect the best available mode at startup. After this phase, `luca main` works for users who only have sox + mlx_whisper installed — no rustpotter required.

The demoable outcome: run `luca main` on a machine without rustpotter and voice input works. Say "hey chief, what time is it" and the system picks up the trigger phrase from the transcript and routes the command exactly like wakeword mode does today.

## Deliverables

1. **`inputMode` state on VoiceListener** — New state field: `"wakeword" | "continuous" | "off"`. Defaults based on capability detection: wakeword if rustpotter is available, continuous if only STT is available, off if neither.

2. **`startContinuousListening()` method on VoiceListener** — Spawns `scripts/dictate-loop` as a child process, parses `---START_TRANSCRIPT---` / `---END_TRANSCRIPT---` delimited output, runs each transcript through trigger phrase matching. When a trigger phrase is found at the start of a transcript, emits `triggerWord` with the matched phrase. The remainder of the transcript (after the trigger phrase) is available as initial command text.

3. **Trigger phrase matching** — Configurable list of trigger phrases (defaults: "hey chief", "yo chief", "hey friday", etc. — reuse the existing wake word names). Case-insensitive prefix match against normalized transcript text. Extract the command portion after the trigger phrase.

4. **Auto-detection in VoiceService.start()** — Instead of only calling `listener.waitForTriggerWord()` when wakeword is available, check `listener.inputMode` and call the appropriate method. If wakeword is unavailable but STT is available, automatically use continuous mode.

5. **Updated capability summary** — VoiceService startup logs now show:
   ```
   Wake word mode: available / UNAVAILABLE (reason)
   Continuous mode: available / UNAVAILABLE (reason)
   Active mode:     continuous
   ```

## References

- `features/voice-listener.ts` — Add `inputMode` state, `startContinuousListening()`, trigger phrase matching
- `features/voice-service.ts` — Branch on input mode in `start()`, update capability summary
- `scripts/dictate-loop` — Existing script, used as-is for continuous mode engine
- Idea doc: `docs/ideas/voice-system-simplification.md`

## Verification

- On a machine with rustpotter + sox + mlx_whisper: `luca main` defaults to wakeword mode, behaves identically to today
- On a machine with only sox + mlx_whisper (no rustpotter): `luca main` defaults to continuous mode, voice input works
- On a machine with neither: `luca main` starts with voice gracefully disabled, no errors
- In continuous mode, saying "hey chief [command]" triggers the voice router with the command text
- In continuous mode, speech without a trigger phrase prefix is ignored (no false triggers)
- Startup logs correctly reflect which modes are available and which is active
