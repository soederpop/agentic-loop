---
goal: user-experience-improvements
status: parked 
---

# Web Chat Interface Improvements

## Architecture Changes

1) The web chat server should be started as part of luca main
2) If the luca main process isn't running, the web-chat should start its own server
3) If web chat is called while the main process authority is up, then it connects to that one

## Interface Changes

- If the main server process has the whisper tts capabilities, and eleven labs, then when audio is enabled in the UI it should use the speech streamer / voiceChat feature as the primary thing we're talking to.  This is because it has the prompting to be nicer to "talk to" with your voice.  It should use the same voice lister on the server side to capture audio.  

- If these capabilities are not present, use the WebContainer's features for tts and stt.  Build a browser equivalent of our SpeechStreamer 

- We may need to modify the voice-chat feature to let us pass an actual assistant object, so that the assistant's thread / state in the voice service is the same one in the backend websocket chat ( same uuid, object in memory ).  This will stop the voiceChat feature from creating its own instance of the assistant which won't be the same

- If I reach that assistant through `luca yo` or the audio trigger wake word, I should see the response in the web chat ui and the tool calls

## Motivation

The web chat is now working for basic streaming text and tool visibility, but it needs a tighter “daily driver” experience—especially a voice option—so it can replace ad-hoc terminal runs and make interacting with Chief feel more natural.
