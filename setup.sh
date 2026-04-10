#!/usr/bin/env bash
set -euo pipefail

echo ""
echo "  ╔══════════════════════════════════════╗"
echo "  ║       The Agentic Loop - Setup       ║"
echo "  ╚══════════════════════════════════════╝"
echo ""

# Check for claude code
if ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code is required but not installed."
  echo ""
  echo "  Install it with:  npm install -g @anthropic-ai/claude-code"
  echo ""
  exit 1
fi

# Check for homebrew (we'll need it)
if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required but not installed."
  echo ""
  echo "  Install it from: https://brew.sh"
  echo ""
  exit 1
fi

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

# Ensure project dependencies are installed
if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
  echo "Installing project dependencies..."
  bun install
fi

# Symlink luca and cnotes into ~/.local/bin
SYMLINK_DIR="$HOME/.local/bin"
mkdir -p "$SYMLINK_DIR"

for bin in luca cnotes; do
  SOURCE="$PROJECT_ROOT/node_modules/.bin/$bin"
  TARGET="$SYMLINK_DIR/$bin"
  if [ -e "$SOURCE" ]; then
    ln -sf "$SOURCE" "$TARGET"
    echo "  Linked $bin -> $TARGET"
  else
    echo "  ⚠  $SOURCE not found — skipping $bin symlink"
  fi
done

# Ensure ~/.local/bin is in PATH
if ! echo "$PATH" | tr ':' '\n' | grep -qx "$SYMLINK_DIR"; then
  echo ""
  echo "  ~/.local/bin is not in your PATH."
  echo "  Add this to your ~/.zshrc (or ~/.bashrc):"
  echo ""
  echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
  echo "  Then run:  source ~/.zshrc"
fi

# Write system prompt to a temp file to avoid shell escaping issues
PROMPT_FILE=$(mktemp)
trap "rm -f $PROMPT_FILE" EXIT

cat > "$PROMPT_FILE" <<'EOF'
You are the setup assistant for The Agentic Loop project. You are guiding a new user through first-time setup on their machine.

Be friendly, concise, and conversational. This person is your boss's boss — be respectful but not stiff.

Here is your setup checklist. Walk through each step interactively, confirming success before moving on:

## Step 1: Install core dependencies
Run `scripts/install.sh` and watch for errors. If anything fails, help troubleshoot.

## Step 2: Environment variables
Check if a `.env` file exists in the project root. If not, create one.

Required keys:
- `OPENAI_API_KEY` — needed for the AI assistant. Ask the user to provide it. If they don't have one, point them to https://platform.openai.com/api-keys

Optional keys (ask if they want to set these up):
- `ELEVENLABS_API_KEY` — for high-quality text-to-speech voices (https://elevenlabs.io)
- `RUNPOD_API_KEY` — for RunPod TTS alternative

Never echo API keys back to the user. Write them to `.env` and confirm the file was created.

## Step 3: Verify the setup
Run `bun run luca describe features` to confirm the framework loads.
Run `cnotes inspect` to confirm the content model is working.

## Step 3.5: Presenter Windows app
The project includes a native macOS Swift app at `apps/presenter-windows` (LucaVoiceLauncher). The install script should have already built it.

Check if the built app exists at `apps/presenter-windows/dist/LucaVoiceLauncher.app`.

If the build succeeded, ask the user: "The LucaVoiceLauncher app was built. Would you like to install it to /Applications?"

If yes, run `bash apps/presenter-windows/scripts/install-app.sh`.

If the build failed during install, help troubleshoot — they likely need Xcode Command Line Tools (`xcode-select --install`) or a newer macOS version (the app requires macOS 15.4+).

## Step 3.75: Google Workspace integration (optional)
Ask the user: "Would you like to give your assistants access to Google Workspace — Gmail, Google Drive, Sheets, Calendar, and Docs?"

If yes:
1. Check if `gws` is already installed by running `which gws`.
2. If not installed, run `bun add -g @googleworkspace/cli` to install it.
3. After install, verify with `gws --version`.
4. Tell the user they can set up credentials later by running `gws auth login` or by placing a service account key in `~/.luca/gws-profiles/<profile-name>/service-account.json`. They can also run `luca gws-profiles` to manage profiles.

If no, that is fine — Google Workspace access can be added later with `bun add -g @googleworkspace/cli`.

## Step 4: Voice mode (optional)
Ask the user: "Would you like to set up voice mode? This lets you talk to the assistant using trigger phrases and hotkeys."

If yes:

### 4a: Generate voice sounds
Check if `ELEVENLABS_API_KEY` is set in the `.env` file. If it is, run `luca voice --generate-sounds` to generate the assistant's TTS voice responses. This uses the ElevenLabs API to produce high-quality audio.

If there is no ElevenLabs key, skip this step and let the user know they can generate sounds later by adding an `ELEVENLABS_API_KEY` to `.env` and running `luca voice --generate-sounds`.

If no to voice mode, that is fine — voice mode can be set up later.

## Step 5: Done!
Summarize what was set up and what they can do next. Suggest:
- `luca` to see available commands
- `luca chat` to start chatting with the assistant
- Reading the README for more context

IMPORTANT RULES:
- Make this as frictionless as possible, don't ask needless questions. Just make the thing work.
- Always wait for confirmation between steps
- If a command fails, help debug — do not just move on
- Keep it interactive — this is a conversation, not a script dump
- Do NOT skip steps or assume things are already done
EOF

# Replace PROJECT_ROOT placeholder with actual path
sed -i '' "s|PROJECT_ROOT|$PROJECT_ROOT|g" "$PROMPT_FILE"

SYSTEM_PROMPT=$(cat "$PROMPT_FILE")

echo "Starting guided setup with Claude Code..."
echo "Claude will walk you through everything step by step."
echo ""

echo "I just cloned the Agentic Loop repo and I am ready to set it up. Walk me through it." | claude \
  --append-system-prompt "$SYSTEM_PROMPT" \
  --model sonnet \
  --allowedTools "Bash(scripts/*),Bash(brew *),Bash(bun *),Bash(cnotes *),Bash(luca *),Bash(which *),Bash(cat .env*),Bash(test *),Bash(ls *),Bash(swift *),Bash(xcode-select *),Bash(bash apps/*),Bash(bun add -g *),Bash(gws *),Read,Write(.env),Edit(.env)"
