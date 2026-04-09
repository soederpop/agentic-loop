---
status: pending
project: voice-input-mode-switching
---

# Phase 2: Live Mode Switching + Sentinel Kill-Switch

Add runtime mode transitions and a file-based circuit breaker. After this phase, the voice mode can be changed while `luca main` is running (no restart needed), and dropping a sentinel file instantly silences all voice input.

The demoable outcome: start `luca main` in continuous mode, then programmatically switch to wakeword mode (or off) without restarting the process. Touch `~/.agentic-loop/voice-disabled` and voice input stops immediately; remove it and input resumes.

## Deliverables

1. **`setMode(mode)` method on VoiceService** — Cleanly transitions between modes at runtime:
   - Stop the current listener (kill rustpotter processes or dictate-loop subprocess)
   - Update the mode state
   - Start the new listener (or do nothing for `off`)
   - Emit a `mode:changed` event so other components can react
   - Validate the requested mode is actually available before switching (e.g., can't switch to wakeword if rustpotter isn't installed)

2. **Sentinel file check** — On each cycle (before acting on a transcript or detection), the listener checks for `~/.agentic-loop/voice-disabled`. If present, input is suppressed. If the file contains text, it's logged as the reason (e.g., "in a meeting"). Removing the file re-enables input on the next cycle. No restart, no IPC, no state sync.

3. **`stopContinuousListening()` method on VoiceListener** — Cleanly kills the dictate-loop subprocess and resets state. Mirrors the existing teardown pattern for rustpotter processes in `waitForTriggerWord`.

4. **Mode state persistence** — The current mode is stored in VoiceService state so it survives internal restarts and is visible to status endpoints. The sentinel file state is also reflected in the status.

## References

- `features/voice-listener.ts` — Add sentinel file check, `stopContinuousListening()`
- `features/voice-service.ts` — Add `setMode()`, mode transition logic, sentinel awareness
- Sentinel file path: `~/.agentic-loop/voice-disabled`

## Verification

- Start `luca main` in wakeword mode; call `setMode('continuous')` — listener switches without restart, continuous mode works
- Start in continuous mode; call `setMode('off')` — voice input stops, no errors, process continues running
- Call `setMode('wakeword')` on a machine without rustpotter — returns error, mode doesn't change
- `touch ~/.agentic-loop/voice-disabled` while voice is active — input stops within one cycle
- `rm ~/.agentic-loop/voice-disabled` — input resumes on next cycle
- `echo "in a meeting" > ~/.agentic-loop/voice-disabled` — reason appears in logs
- Mode transitions don't leak child processes (no orphaned rustpotter or dictate-loop processes)
- Status endpoint reflects current mode and sentinel state
