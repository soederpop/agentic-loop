---
status: parked
goal: user-experience-improvements
---

# Web Based Streaming Chat Experience

For user's who don't have native voice transcription capabilities, or haven't yet set them up

We can have a `luca voice-chat` command that lives in the project can work similarly to [The core luca chat command](https://github.com/soederpop/luca/blob/main/src/commands/chat.ts) 

It should be a full featured web based Chat UI that uses websockets to display the output of the conversation with the assistant.

It should have a `microphone` button and a `voice` button that enable bi-directional.

The `microphone` needs to be powered by the luca WebContainer's `voice` feature. [Source Code Here](https://github.com/soederpop/luca/blob/main/src/web/features/voice-recognition.ts) for transcription.

## Requirements

Should work find without audio in our out.
Should render beautiful markdown
Should show tool call activity
