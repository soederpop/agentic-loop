---
status: pending
project: tauri-desktop-app
---

# Phase 3: External CLI Installation + Repair Flows

Add optional installation of the same Luca binary for terminal use, along with version checks, path visibility, repair actions, and update prompts.

The demoable outcome: from onboarding or settings, the user can install Luca for terminal use into a user-managed location, verify that installation, and repair or refresh it later if the external CLI is missing or outdated.

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

6. **Version drift detection** — When the bundled Luca version changes after an app update, the app should detect that the external CLI install may be stale and offer a refresh action.

## References

- `docs/reports/tauri-desktop-app-research.md`
- `docs/reports/tauri-luca-desktop-shipping-report.md`
- Tauri app shell from Phase 1

## Verification

- A user can install the bundled Luca binary to a user-managed CLI location from the app
- The app can verify the installed CLI without manual shell work
- The app correctly reports whether the install directory appears to be in PATH
- Reinstall/repair actions work when the external CLI is missing or outdated
- After simulating a bundled-version change, the app detects drift and offers to refresh the installed CLI
