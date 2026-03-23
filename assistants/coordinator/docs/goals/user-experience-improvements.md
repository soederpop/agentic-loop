---
horizon: short
---

# User Experience Improvements

My main goal is to make the Agentic Loop system a delight to work with, easy to understand, and not surprising at all.

## Progressive Enhancement

Upon cloning this repo, not everyone will have a machine powerful enough to do local on device whisper mlx transcription.  Not everyone will have the ability, or even desire, to have rustpotter running and listening for wake words.  Not everyone will have an elevenlabs API key.

The core `luca main` process should already degrade gracefully, but every feature we develop should follow this pattern.

The GWS feature has a `checkCapabilities` or equivalent method that detects if it is even possible to use.

## Should be easy to customize

It should be easy to customize the Agentic Loop and add your own features.