#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="LucaVoiceLauncher.app"
EXECUTABLE_NAME="LucaVoiceLauncher"
BUILD_CONFIG="release"
DIST_DIR="$ROOT_DIR/dist"
APP_DIR="$DIST_DIR/$APP_NAME"

cd "$ROOT_DIR"

swift build -c "$BUILD_CONFIG" --product "$EXECUTABLE_NAME"

rm -rf "$APP_DIR"
mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

cp "$ROOT_DIR/.build/arm64-apple-macosx/$BUILD_CONFIG/$EXECUTABLE_NAME" \
   "$APP_DIR/Contents/MacOS/$EXECUTABLE_NAME"
cp "$ROOT_DIR/packaging/Info.plist" "$APP_DIR/Contents/Info.plist"

chmod +x "$APP_DIR/Contents/MacOS/$EXECUTABLE_NAME"

# Ad-hoc sign so macOS treats the bundle as a proper local app bundle.
codesign --force --deep --sign - "$APP_DIR" >/dev/null

echo "Built app bundle: $APP_DIR"
