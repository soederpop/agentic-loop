#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="LucaVoiceLauncher.app"
SOURCE_APP="$ROOT_DIR/dist/$APP_NAME"
TARGET_APP="/Applications/$APP_NAME"

if [[ ! -d "$SOURCE_APP" ]]; then
  echo "App bundle not found at $SOURCE_APP"
  echo "Run scripts/build-app.sh first."
  exit 1
fi

rm -rf "$TARGET_APP"
cp -R "$SOURCE_APP" "$TARGET_APP"

xattr -dr com.apple.quarantine "$TARGET_APP" 2>/dev/null || true

echo "Installed: $TARGET_APP"
