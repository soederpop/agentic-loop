# Voice System

The voice system is driven by three components:

1) A Wakeword system based on `rustpotter` -- purely offline, trained models, "Hey Siri" like experience.  There is a [setup-wakeword.sh](./setup-wakeword.sh) script you can use to train a model.  You will need one for the `chiefOfStaff` assistant, where you can free form chat by saying e.g. `Hey Chief` , waiting for them to tell you to speak.  You will need one for the `voice-assistant` who, while capable of free form chat, is designed to kick off processes within the portfolio.

2) Whisper MLX for transcription

3) Elevenlabs for Text-To-Speech that sounds human and can have expressive elements

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
