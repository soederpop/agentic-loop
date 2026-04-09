---
status: pending
project: voice-input-mode-switching
---

# Phase 3: Control Surfaces

Expose mode switching from every interaction surface: CLI flag, API endpoint, voice commands, and keyboard shortcut. After this phase, users can control voice mode from whichever context they're in — terminal, browser UI, or voice itself.

The demoable outcome: say "switch to wakeword mode" and the system switches. Press a key in the main loop terminal and it cycles through modes. Hit the API endpoint from a workflow UI and the mode changes. Run `luca voice --check` and see both modes' availability and current state.

## Deliverables

1. **`--voice-mode` CLI flag on `luca main`** — Accepts `wakeword | continuous | off`. Overrides auto-detection. Falls back to auto-detection if not specified.

2. **Keyboard shortcut in main loop** — A key combo (e.g., `v` or `Ctrl+V`) that cycles through available modes: `wakeword → continuous → off → wakeword`. Displays the new mode briefly in the status line.

3. **Voice commands for mode switching** — New voice handler that matches phrases like "switch to wakeword mode", "go continuous", "turn off voice", "voice off", "voice on". Routes through the existing voice router and calls `voiceService.setMode()`.

4. **API endpoint** — `POST /api/voice/mode` with body `{ mode: "wakeword" | "continuous" | "off" }`. Returns current mode and available modes. Useful for workflow UIs and external tooling. Also `GET /api/voice/mode` to read current state.

5. **Updated `luca voice --check`** — Shows availability of both modes, current active mode, and sentinel file status:
   ```
   Voice Input Modes:
     Wake word:   available (rustpotter 0.13, 2 models trained)
     Continuous:  available (sox 14.4.2, mlx_whisper)
     Active mode: wakeword
     Sentinel:    not set
   ```

## References

- `commands/main.ts` — Add `--voice-mode` flag, keyboard shortcut handler
- `commands/voice.ts` — Update `--check` output
- `commands/voice/handlers/` — New handler for mode switching voice commands
- `endpoints/` or voice-service socket — API endpoint for mode control
- `features/voice-service.ts` — `setMode()` from Phase 2

## Verification

- `luca main --voice-mode continuous` starts in continuous mode regardless of rustpotter availability
- `luca main --voice-mode wakeword` on a machine without rustpotter prints a clear error and falls back
- Keyboard shortcut cycles through available modes; unavailable modes are skipped
- Saying "switch to wakeword mode" while in continuous mode triggers a mode switch
- Saying "voice off" stops voice input; saying "voice on" resumes with the previous mode
- `POST /api/voice/mode` with `{ "mode": "continuous" }` switches mode; response includes new state
- `GET /api/voice/mode` returns current mode, available modes, and sentinel status
- `luca voice --check` displays all mode availability info without starting the voice service
