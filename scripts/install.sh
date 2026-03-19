#!/usr/bin/env bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
fail()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }
step()  { echo -e "\n${GREEN}==>${NC} $*"; }

# ---------- Pre-checks ----------
[[ "$(uname)" == "Darwin" ]] || fail "This script is macOS-only (requires Apple Silicon for mlx-whisper)"
[[ "$(uname -m)" == "arm64" ]] || fail "Apple Silicon (arm64) required for mlx-whisper"
command -v brew >/dev/null 2>&1 || fail "Homebrew is required. Install from https://brew.sh"

# ---------- sox ----------
step "Checking sox (audio recording)"
if command -v sox >/dev/null 2>&1; then
  info "sox already installed ($(sox --version 2>&1 | head -1))"
else
  warn "Installing sox..."
  brew install sox
  info "sox installed"
fi

# ---------- Python / pipx ----------
step "Checking Python & pipx"
if command -v python3 >/dev/null 2>&1; then
  info "python3 found ($(python3 --version))"
else
  warn "Installing python3..."
  brew install python@3.12
  info "python3 installed"
fi

if command -v pipx >/dev/null 2>&1; then
  info "pipx already installed"
else
  warn "Installing pipx..."
  brew install pipx
  pipx ensurepath
  info "pipx installed"
fi

# ---------- mlx-whisper ----------
step "Checking mlx-whisper (speech-to-text)"
if command -v mlx_whisper >/dev/null 2>&1; then
  info "mlx_whisper already installed"
else
  warn "Installing mlx-whisper via pipx..."
  pipx install mlx-whisper
  info "mlx-whisper installed"
fi

# ---------- Rust / Cargo ----------
step "Checking Rust toolchain"
if command -v cargo >/dev/null 2>&1; then
  info "cargo already installed ($(cargo --version))"
else
  warn "Installing Rust via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
  info "Rust installed ($(cargo --version))"
fi

# ---------- rustpotter ----------
step "Checking rustpotter (wake word detection)"
if command -v rustpotter >/dev/null 2>&1; then
  info "rustpotter already installed ($(rustpotter --version))"
else
  warn "Installing rustpotter via cargo (this may take a few minutes)..."
  cargo install rustpotter-cli
  info "rustpotter installed ($(rustpotter --version))"
fi

# ---------- Swift toolchain ----------
step "Checking Swift toolchain (needed for presenter-windows app)"
if command -v swift >/dev/null 2>&1; then
  info "swift already installed ($(swift --version 2>&1 | head -1))"
else
  warn "Xcode Command Line Tools required for Swift..."
  xcode-select --install 2>/dev/null || true
  fail "Please complete the Xcode Command Line Tools installation and re-run this script."
fi

# ---------- Build presenter-windows app ----------
step "Building presenter-windows (LucaVoiceLauncher) app"
PRESENTER_DIR="$(dirname "$0")/../apps/presenter-windows"
if [[ -d "$PRESENTER_DIR" ]]; then
  bash "$PRESENTER_DIR/scripts/build-app.sh"
  info "LucaVoiceLauncher.app built successfully"
else
  warn "apps/presenter-windows not found — skipping native app build"
fi

# ---------- bun ----------
step "Checking bun (JavaScript runtime)"
if command -v bun >/dev/null 2>&1; then
  info "bun already installed ($(bun --version))"
else
  warn "Installing bun..."
  brew install oven-sh/bun/bun
  info "bun installed"
fi

# ---------- Node dependencies ----------
step "Installing project dependencies"
cd "$(dirname "$0")/.."
bun install
info "Dependencies installed"

# ---------- Pre-download whisper model ----------
step "Pre-downloading whisper model (this may take a minute on first run)"
python3 -c "
from huggingface_hub import snapshot_download
snapshot_download('mlx-community/whisper-large-v3-mlx', local_files_only=False)
print('Model cached.')
" 2>/dev/null && info "Whisper model cached" || warn "Model will download on first use (requires internet)"

# ---------- Google Workspace CLI (optional) ----------
step "Checking Google Workspace CLI (optional — for Gmail, Drive, Sheets, Calendar access)"
if command -v gws >/dev/null 2>&1; then
  info "gws already installed ($(gws --version 2>&1 | head -1))"
elif [[ "${INSTALL_GWS:-}" == "1" ]]; then
  warn "Installing @googleworkspace/cli globally..."
  bun add -g @googleworkspace/cli
  info "gws installed ($(gws --version 2>&1 | head -1))"
else
  warn "Skipping — set INSTALL_GWS=1 or run: bun add -g @googleworkspace/cli"
fi

# ---------- Done ----------
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Installation complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  Installed:"
echo "    - sox                (audio recording)"
echo "    - mlx-whisper        (speech-to-text, Apple Silicon)"
echo "    - rustpotter         (wake word detection)"
echo "    - bun                (JavaScript runtime)"
echo "    - LucaVoiceLauncher  (presenter-windows app)"
echo "    - gws (optional)     (Google Workspace CLI)"
echo ""
echo "  To verify, run:"
echo "    sox --version"
echo "    mlx_whisper --help"
echo "    rustpotter --version"
echo "    bun --version"
echo ""
