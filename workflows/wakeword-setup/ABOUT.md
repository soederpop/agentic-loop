# Wake Word Setup

Interactive workflow for creating and testing rustpotter wake word models.

## What It Does

Guides users through the full wake word setup process:
1. Check dependencies (rustpotter, sox, mlx_whisper)
2. Choose a wake word phrase
3. Record 5 voice samples (2 seconds each)
4. Build a `.rpw` model from the recordings
5. Test sensitivity with live detection scoring
6. Assign the wake word to a voice-enabled assistant
7. End-to-end test: say the wake word, hear the assistant respond

## When to Use

- First-time voice mode setup
- Adding a new wake word for an assistant
- Re-recording samples to improve detection accuracy
- Tuning wake word sensitivity thresholds

## When NOT to Use

- Voice design (tone, voice settings, TTS provider) — use **voice-designer** instead
- Managing VoiceBox profiles — use VoiceBox.sh desktop app
