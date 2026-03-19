# LucaVoiceLauncher

macOS native window-manager host app for spawning and controlling browser/terminal windows over a Unix socket.

## Implemented

- Regular macOS app lifecycle (`NSApplication.ActivationPolicy.regular`) so it appears in Dock/Alt+Tab (`Sources/App/AppDelegate.swift`)
- App window + settings window (no status-item-only mode) (`Sources/App/LauncherPanelController.swift`, `Sources/App/SettingsWindowController.swift`)
- Unix domain socket IPC client using NDJSON and reconnect backoff (`Sources/Managers/IPCClient.swift`)
- Window command handling (`open`, `spawn`, `terminal`, `focus`, `close`, `navigate`, `eval`, `screengrab`, `video`) via `window` payloads (`Sources/Managers/BrowserWindowManager.swift`)
- Browser windows and PTY-backed terminal windows (`Sources/Managers/BrowserWindowController.swift`, `Sources/Managers/TerminalWindowController.swift`)
- Window lifecycle notifications (`windowClosed`, `terminalExited`) and `windowAck` responses over IPC (`Sources/App/AppController.swift`)
- Unit tests for core data/state and IPC parsing (`Tests/`)

## Removed from runtime flow

- Global hotkey trigger path
- Voice transcription path
- Command dispatch/event queue path
- Menu bar status-item workflow

## Build and test

```bash
swift build
swift test
```

## Build and install as a macOS app

```bash
./scripts/build-app.sh
./scripts/install-app.sh
```

- App bundle output: `dist/LucaVoiceLauncher.app`
- Installed location: `/Applications/LucaVoiceLauncher.app`

## Notes

- This is a SwiftPM macOS executable with a `.app` wrapper built by `scripts/build-app.sh`.
- `Run at login` is currently a persisted setting toggle placeholder and not yet wired to `SMAppService`.
- Socket protocol uses newline-delimited JSON (`NDJSON`) with `id` correlation.
- Runtime diagnostics are written to `~/Library/Application Support/LucaVoiceLauncher/launcher.log`.
