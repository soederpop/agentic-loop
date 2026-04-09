---
tags: []
---

# Onboarding Troubleshooting Log

1) It attempts to build rustpotter cli from rust, causing some issues.  In the `setup.sh` prompts to claude code we just told it to download the compiled binary for macs and that solved the issue

2) Users who don't have Intel mac can't use the Whisper MLX powered voice transcription.  We need to gracefully downgrade to the non voice powered workflow for these cases.

