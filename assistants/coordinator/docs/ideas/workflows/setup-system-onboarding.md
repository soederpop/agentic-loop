---
goal: user-experience-improvements
tags:
  - workflow
  - setup
  - diagnostics
  - onboarding
  - voice
  - system
status: promoted
---

# Setup / System Onboarding Workflow

Technical onboarding that gets the system's dependencies, API keys, wake words, and native app configured. Separate from the blank-slate vision/goals workflow — this is about making the machine work, not defining what to build. Detects what's installed and what's missing, walks the user through each setup step.

## Concept

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
