---
title: System Setup
description: Diagnostic preflight check — detects installed dependencies, API keys, voice tools, and native app status
port: 9304
tags:
  - setup
  - diagnostics
  - onboarding
  - system
---

# System Setup

Technical onboarding workflow that scans the system for required and optional capabilities. Shows what's installed, what's missing, and how to fix it.

- **Required**: bun runtime, OpenAI API key, content model validation
- **Voice**: rustpotter, wake word models, sox, mlx_whisper, ElevenLabs key, voice assistants
- **Native App**: LucaVoiceLauncher.app, Xcode CLI tools
- **Authority**: luca main process (port 4410)
