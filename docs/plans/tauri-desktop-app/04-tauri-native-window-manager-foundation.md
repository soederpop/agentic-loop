---
status: approved
project: tauri-desktop-app
---

# Phase 4: Tauri-Native Window Manager Foundation

Create a `tauri-window-manager` foundation that preserves the important behavior of Luca’s existing `windowManager` while making the Tauri shell the native window authority.

The demoable outcome: Luca can trigger Tauri-managed overlay windows for the current voice UX path, including assistant picker and trigger overlays, without requiring the Swift launcher.

## Deliverables

1. **Tauri-side window backend service** — Add a Tauri-managed backend that owns native window creation, updates, focus, close, frame changes, and hotkey forwarding for app-managed windows.

2. **Luca `tauri-window-manager` feature skeleton** — Add a new Luca feature that mirrors the high-level contract of `windowManager` but talks to the Tauri backend rather than the Swift launcher/socket backend.

3. **Minimum compatibility API for overlays** — Implement the smallest complete slice required for current voice overlay behavior:
   - `listen()` / connect to backend
   - `spawn()` for HTML or URL-backed windows
   - `focus()`
   - `close()`
   - `setFrame()`
   - `eval()`
   - `windowStateSync`
   - `hotkeyTrigger`
   - `windowClosed` and focus events

4. **Overlay-safe window rendering path** — Ensure the Tauri shell can create transparent/always-on-top/decorations-none windows as needed for trigger overlays and assistant picker UX, with graceful degradation where platform differences exist.

5. **Voice-service migration switch** — Add a controlled way for `voiceService` to use the new `tauri-window-manager` path instead of the existing `windowManager` for overlay/picker flows, without forcing a full immediate replacement of every caller.

6. **State and event compatibility notes** — Document where the Tauri-native path intentionally matches the old API exactly and where it emulates behavior with a different backend implementation.

## References

- `features/window-manager.ts` — Existing behavior to preserve
- `features/voice-service.ts` — Overlay and assistant-picker callers
- `docs/reports/tauri-luca-desktop-shipping-report.md`

## Verification

- The app can create and close a Tauri-managed overlay window from Luca
- `voiceService` can show the trigger overlay using the Tauri-native path
- `voiceService` can show the assistant picker using the Tauri-native path
- Hotkey triggers can flow from the Tauri shell into Luca and reach the picker logic
- Window focus, close, and frame updates are reflected back into Luca state/events
- The overlay status updates that currently rely on `eval()` still work on the Tauri-managed windows
