---
status: approved
project: tauri-desktop-app
---

# Phase 3: External CLI Installation + Repair Flows

Add optional installation of the same Luca binary for terminal use, along with version checks, path visibility, repair actions, and update prompts. This phase should also cover installation, verification, and repair of the desktop app’s non-Luca runtime dependencies and the shared Agentic Loop helper pack under `~/.luca/agentic-loop`.

The demoable outcome: from onboarding or settings, the user can install Luca for terminal use into a user-managed location, verify that installation, repair or refresh it later if the external CLI is missing or outdated, and inspect/fix required support dependencies such as `sox`, `mlx_whisper`/`mlx-whisper`, `rustpotter`, Bun, and other app-managed setup prerequisites.

## Deliverables

1. **CLI install settings surface** — Add a desktop UI section that shows:
   - bundled Luca version
   - external CLI installation state
   - external install path
   - whether the install location appears to be in PATH
   - last verification result

2. **User-space installation flow** — Implement an install action that copies the Luca binary into a user-managed location appropriate for the platform. Prefer copy-based installation over symlink-based installation for V1 unless there is a strong demonstrated reason otherwise.

3. **Verification flow** — Add verification logic that checks:
   - file exists
   - executable permissions where relevant
   - `luca --version` or equivalent succeeds
   - the installed binary matches or is compatible with the bundled version

4. **Repair/reinstall flow** — Add actions to:
   - reinstall the external CLI
   - repair permissions if possible
   - replace a stale installed binary after confirmation

5. **PATH guidance UX** — If the install directory is not in PATH, provide exact platform-appropriate guidance rather than silently mutating shell configuration by default.

6. **Shared helper-pack installation + repair** — Add install/verify/repair flows for the shared Agentic Loop content under `~/.luca/agentic-loop`, including:
   - helper directories such as `commands/`, `features/`, and any shipped templates/support files
   - version/manifest tracking for the shared helper pack
   - reseed/repair behavior if the shared install is missing, partial, or incompatible with the bundled app version

7. **Dependency health checks + repair actions** — Add a dependency section in onboarding/settings that reports the presence and health of important machine/runtime dependencies already used by the project’s setup scripts, including at minimum:
   - `sox`
   - `mlx_whisper` / `mlx-whisper`
   - `rustpotter`
   - Bun
   - Python/pipx where required for `mlx-whisper`
   - optional tools such as `gws`
   The desktop app does not need to auto-install every dependency on every platform in V1, but it should detect missing pieces, show why they matter, and offer either an app-managed install flow or exact repair guidance.

8. **Version drift detection** — When the bundled Luca version changes after an app update, the app should detect that the external CLI install may be stale and offer a refresh action. It should also detect drift between the bundled app version and the installed shared helper pack in `~/.luca/agentic-loop`.

## References

- `docs/reports/tauri-desktop-app-research.md`
- `docs/reports/tauri-luca-desktop-shipping-report.md`
- Tauri app shell from Phase 1
- `setup.sh` — current guided setup expectations
- `scripts/install.sh` — current dependency installation script
- `scripts/download-tools.sh` — current CLI install/download assumptions
- `features/voice-listener.ts` — current voice dependency detection (`rustpotter`, `sox`, `mlx_whisper`)

## Verification

- A user can install the bundled Luca binary to a user-managed CLI location from the app
- The app can verify the installed CLI without manual shell work
- The app correctly reports whether the install directory appears to be in PATH
- The app can install, verify, or repair the shared Agentic Loop helper-pack home at `~/.luca/agentic-loop`
- The app reports dependency health for voice/native prerequisites such as `sox`, `mlx_whisper`, `rustpotter`, Bun, and optional tools like `gws`
- Repair actions work when the external CLI, shared helper pack, or supported dependencies are missing or outdated
- After simulating a bundled-version change, the app detects drift and offers to refresh the installed CLI and shared helper pack
