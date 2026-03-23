---
title: Voice Designer
description: Design and configure voice assistant personas, wake words, and conversation styles
port: 9305
tags:
  - voice
  - configuration
  - assistants
---

# Voice Designer

An interface for designing and tuning voice assistant configurations. The user can browse voice-enabled assistants, edit their voice.yaml settings (voice ID, aliases, conversation mode, stability, style), and test phrases with ElevenLabs TTS to hear how they sound in real time.

## When to use

Use this when the user wants to customize how an assistant sounds, change wake words, adjust voice parameters, or audition different ElevenLabs voices for an assistant.

## Trigger signals

- "I want to change how [assistant] sounds"
- "Let me design a voice"
- "I want to pick a different voice"
- "Can I hear what [voice] sounds like?"
- "Change the wake word for [assistant]"
- "Let me tweak the voice settings"
- "I want to set up voice for [assistant]"
- The user created a new assistant and needs to configure its voice

## When NOT to use

- If the user is asking about whether voice tools are installed — use **System Setup** instead
- If the user wants to talk to an assistant, not configure it
