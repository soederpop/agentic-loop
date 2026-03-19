#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"
mkdir -p samples models

NUM_SAMPLES=5

# ============================================
# Helper: record samples and build one model
# ============================================
record_and_build() {
  local WAKEWORD="$1"
  local SLUG="${WAKEWORD// /_}"

  echo ""
  echo "  Wake word: \"$WAKEWORD\""
  echo "  Samples:   $NUM_SAMPLES"
  echo ""
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
  echo "Building wake word model..."
  rustpotter build --name "$WAKEWORD" --path "./models/${SLUG}.rpw" samples/${SLUG}_*.wav
  echo "Model saved to ./models/${SLUG}.rpw"
  echo ""

  echo "Quick test — say \"$WAKEWORD\" to verify detection. Press Ctrl-C when satisfied."
  echo ""
  rustpotter spot -t 0.35 "./models/${SLUG}.rpw"
}

# ============================================
# Single wake word mode (backwards compat)
# ============================================
if [ "${1:-}" != "" ]; then
  echo ""
  echo "  ╔══════════════════════════════════════╗"
  echo "  ║       Wake Word Setup                ║"
  echo "  ╚══════════════════════════════════════╝"
  record_and_build "$1"
  exit 0
fi

# ============================================
# Guided setup — walks through both required
# wake words when run with no arguments
# ============================================
echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║       Voice Mode Setup               ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
echo "  Voice mode needs two wake words:"
echo ""
echo "    1. \"yo chief\" or \"hey chief\"  — activates the Chief of Staff assistant"
echo "    2. Your choice                 — activates the general voice command router"
echo ""
echo "  You'll record $NUM_SAMPLES samples of each."
echo ""

# ---- Wake word 1: chief ----
echo "  ┌──────────────────────────────────────┐"
echo "  │  Wake Word 1: Chief of Staff         │"
echo "  └──────────────────────────────────────┘"
echo ""
echo "  Pick your chief wake word. It MUST contain the word \"chief\"."
echo "  Examples: \"yo chief\", \"hey chief\""
echo ""
read -p "  Enter wake word [yo chief]: " CHIEF_WORD
CHIEF_WORD="${CHIEF_WORD:-yo chief}"

# Validate it contains "chief"
if [[ ! "${CHIEF_WORD,,}" == *chief* ]]; then
  echo ""
  echo "  ⚠  \"$CHIEF_WORD\" doesn't contain 'chief'."
  echo "     The voice service routes based on detecting 'chief' in the wake word."
  echo "     Continuing anyway, but the Chief of Staff won't activate with this word."
  echo ""
fi

record_and_build "$CHIEF_WORD"

echo ""
echo "  ┌──────────────────────────────────────┐"
echo "  │  Wake Word 2: General Commands       │"
echo "  └──────────────────────────────────────┘"
echo ""
echo "  Pick any phrase you like for general voice commands."
echo "  Examples: \"hey friday\", \"hey computer\", \"yo boss\""
echo ""
read -p "  Enter wake word [hey friday]: " CUSTOM_WORD
CUSTOM_WORD="${CUSTOM_WORD:-hey friday}"

record_and_build "$CUSTOM_WORD"

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║       Setup Complete                 ║"
echo "  ╚══════════════════════════════════════╝"
echo ""
echo "  Models created:"
ls -1 models/*.rpw 2>/dev/null | sed 's/^/    /'
echo ""
echo "  You're ready to go. Start voice mode with:"
echo ""
echo "    luca voice"
echo ""
