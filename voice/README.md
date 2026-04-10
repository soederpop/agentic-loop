# Voice System

The voice system is driven by two components:

1) Whisper MLX for transcription — continuous listening with trigger phrase detection, or hotkey-based assistant picker

2) Elevenlabs for Text-To-Speech that sounds human and can have expressive elements

## Voice Snippet Generation

Because eleven labs happens over the wire, we can pre-generate phrases by running

```shell
luca voice --generate-sounds
```

This will go through each of the [assistants](../assistants) and look for a `voice.yaml` file with phrases:

```yml
voiceId: TTmUgRoiAUdn043OgRax 
conversationModePrefix: "[fast paced english narrator]"
voiceSettings:
  stability: 0.35
  similarityBoost: 0.8
  style: 0.6
  speed: 1.05
  useSpeakerBoost: true
aliases:
  - chief
phrases:
  greeting:
    - "Hello"
    - "Top of the morning"
  thinking:
    - "Let me think about that"
    - "Thinking..."
```

It will generate wav files for each of the phrases, so you can trigger these responses statically for more fluid interactions.
