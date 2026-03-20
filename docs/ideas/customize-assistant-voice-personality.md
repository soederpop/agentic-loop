---
status: parked
goal: user-experience-improvements
---

# Customize The Voice Assistant Personality

Each assistant in the [assistants folder](../../assistants/) can have its own `voice.yaml` file.

## Example Voice YAML

```yaml
voiceId: sgk995upfe3tYLvoGcBN 
conversationModePrefix: "[thick irish accent]"
voiceSettings:
  stability: 0.35
  similarityBoost: 0.8
  style: 0.6
  speed: 1.05
  useSpeakerBoost: true
aliases:
  - Friday
phrases:
  generic-ack:
    - "Got it"
  generic-finish:
    - "Done"
  greeting:
    - "Hello"
  farewell:
    - "Check you later"
  thinking:
    - "Hold up, let me cook..."
    - "Thinking..."
```

- The `voiceId` refers to an eleven labs voice id.
- The `voiceSettings` get passed directly to the elevenlabs API call
- The `conversationModePrefix` is an `eleven_v3` voice direction tag that can control how the voice sounds
- The `phrases` object contains tags, that accept an array of strings.  In the voice command handlers `ctx.playPhrase('thinking')` will rotate through the list randomly to have some variety.  The values for the phrase can also contain `eleven_v3` voice `[direction]` tags.

## Luca Voice Sound Generation

The following shell command will generate wav files for all the phrases, so you can get snappy playback and not wait for eleven labs API calls to get sound

```shell
luca voice --generate-sounds
```

## What we can build 

We can write a command flag `--customize-personality` to the `luca voice` command, it should accept an assistant name.

This command flag should have claudeCode (the feature) customize the voiceYaml and add some more phrases.  

It should use the ui.askQuestion to get the voiceId from eleven labs.

Then it should run the `--generate-sounds` process, ideally just for the assistant we customized.


