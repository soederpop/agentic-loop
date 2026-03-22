---
status: approved
project: initial-assistant-workflows
---

# Setup / System Onboarding Workflow

Technical onboarding that gets the system's dependencies, API keys, wake words, and native app configured. Separate from the blank-slate vision/goals workflow — this is about making the machine work, not defining what to build. Detects what's installed and what's missing, walks the user through each setup step.

Runs as a standalone workflow at `workflows/setup/` on port 9304. Single scrollable page with collapsible capability cards. Feels like a system diagnostic / preflight check that also fixes what it finds.

## Capability Checks

**Required:**
- `bun` runtime (version)
- `OPENAI_API_KEY` env var
- Content model (`docs/models.ts` present, `cnotes validate` passes)

**Optional — Voice:**
- `rustpotter` binary (wake word detection)
- `.rpw` wake word model files in `voice/wakeword/models/`
- `sox` binary (audio recording for STT)
- `mlx_whisper` binary (speech-to-text, Apple Silicon only)
- `ELEVENLABS_API_KEY` env var (TTS)
- Voice assistant configs (which assistants have `voice.yaml`)

**Optional — Native App:**
- `apps/presenter-windows/dist/LucaVoiceLauncher.app` built
- Xcode CLI tools (`xcode-select -p`)

**Authority Process:**
- Is `luca main` running (port 4410 check)

## UI Layout

- Summary at top: "3 of 7 capabilities ready" with progress bar
- Grouped sections: Required / Optional (Voice) / Optional (Native App)
- Each capability card: status indicator (green/yellow/red), title, description, current state, action if missing
- Configured cards start collapsed, needs-attention cards start expanded
- Env key inputs are password fields with reveal-on-focus, green check after save
- Terminal commands get a copy button
- Auto-recheck after any action

## API Surface

- `GET /api/system-status` — full diagnostic: array of `{ capability, status: ok|missing|warning, details, action? }`
- `GET /api/wake-words` — `{ models: [{ file, name }], rustpotterAvailable }`
- `GET /api/voice-assistants` — `{ assistants: [{ name, hasVoice, voiceId?, aliases? }] }`
- `POST /api/env` — accepts `{ key, value }`, appends to `.env` (allowlist: OPENAI_API_KEY, ELEVENLABS_API_KEY)

## Events

- `emit('setupProgress', { ready, total, capabilities })` on load and after changes
- Presenter event with ready/total counts

## References

- Original idea: `docs/ideas/workflows/setup-system-onboarding.md`
- System capabilities and their detection methods

## Verification

- Running `luca serve` in `workflows/setup/` starts on port 9304
- Each capability check correctly detects installed/missing state
- Setting an env key via the UI persists to `.env` and the card rechecks green
- Progress bar accurately reflects ready/total count

## Handoff Notes from Blank Slate

- The `luca.serve.ts` + `public/index.html` pattern is proven. Copy the blank-slate structure as a starting point.
- `container.feature('fs')` gives you `readFileSync`, `writeFile` (sync), `existsSync`. For the `.env` writing, use these directly.
- `container.feature('proc').exec()` is how you run system commands (checking for binaries, ports, etc.) — avoid importing child_process directly.
- `container.paths.resolve()` for all path operations — don't import `path`.
- The dark theme CSS variables and design system are consistent across all workflows. Copy the `:root` block from blank-slate for visual consistency.
- Event emission pattern: check `window.luca` for containerLink, plus `postMessage` for presenter. Both are fire-and-forget wrapped in try/catch.

## Handoff Notes from Shape Workflow

- **ContentDb has no `.content` field on document objects.** To read document body text, use `fs.readFileSync()` on the file directly and strip frontmatter. The `.size` field gives the file byte size which is useful as a proxy.
- **Frontmatter updates** — the shape workflow rebuilds YAML frontmatter line-by-line (read → parse → modify → write back). If the setup workflow needs to update any document frontmatter (unlikely for a read-mostly diagnostic tool, but possible), the pattern is in `workflows/shape/luca.serve.ts` POST handler.
- **The `luca serve` command format** is: `luca serve --setup workflows/<name>/luca.serve.ts --staticDir workflows/<name>/public --port <port> --no-open`. All four workflows follow the same invocation pattern.

## Handoff Notes from Review Dashboard

- **`container.feature('proc').exec()` for system checks** — the review workflow used this for `git log` and it works well. For your capability checks (bun version, binary detection, port checks), this is the right tool. The output comes back as `{ stdout, stderr, exitCode }` or sometimes just the string — check both patterns. Wrap each check in try/catch since missing binaries will throw.
- **Parallel data fetching** — the review workflow fetches all content models in `Promise.all()` which is noticeably faster. For your system diagnostic, consider running independent checks in parallel too (bun version, env vars, binary detection can all run concurrently).
- **The workflow command (`commands/workflow.ts`)** auto-discovers workflows in the `workflows/` directory. Your workflow at `workflows/setup/` on port 9304 will be picked up automatically — no registration needed.
- **CSS/design patterns are fully stable** across all 4 prior workflows. The `:root` variables, card styles, status badges, progress bars, and scrollbar styles are all reusable. The review workflow added a progress bar component (`.progress-bar-track` / `.progress-bar-fill`) that maps directly to your "3 of 7 capabilities ready" summary bar.
- **POST endpoints for env vars** — the capture workflow has the pattern for writing files via `container.feature('fs').writeFile()`. For your `.env` writing, the same approach works. Remember `writeFile` is synchronous, and you'll want to validate the allowlist server-side before writing.
