#!/bin/bash
set -euo pipefail

# ============================================
# Configure your wake word here
# ============================================
WAKEWORD="${1:-hey friday}"
NUM_SAMPLES=5
# ============================================

SLUG="${WAKEWORD// /_}"
cd "$(dirname "$0")"
mkdir -p samples models

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║       Wake Word Setup                ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
echo "  Wake word: \"$WAKEWORD\""
echo "  Samples:   $NUM_SAMPLES"
echo ""

# ---- Step 1: Record samples ----
echo "Recording $NUM_SAMPLES samples of '$WAKEWORD'"
echo "Each recording is 2 seconds. Say '$WAKEWORD' after the prompt."
echo ""

for i in $(seq 1 $NUM_SAMPLES); do
  echo "--- Sample $i of $NUM_SAMPLES ---"
  echo "Press ENTER when ready, then say '$WAKEWORD'..."
  read
  rustpotter record --ms 2000 "samples/${SLUG}_$i.wav"
  echo "Saved: samples/${SLUG}_$i.wav"
  echo ""
done

echo "Done recording!"
echo ""

# ---- Step 2: Build the model ----
echo "Building wake word model..."
rustpotter build --name "$WAKEWORD" --path "./models/${SLUG}.rpw" samples/${SLUG}_*.wav
echo "Model saved to ./models/${SLUG}.rpw"
echo ""

# ---- Step 3: Test it ----
echo "Let's test it! Say \"$WAKEWORD\" — you should see it detect."
echo "Press Ctrl-C to stop."
echo ""
rustpotter spot -t 0.35 "./models/${SLUG}.rpw"
