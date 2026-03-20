#!/usr/bin/env bash
set -euo pipefail

# Downloads luca and cnotes (contentbase) binaries from GitHub releases
# for the current platform and places them in ~/.local/bin

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
fail()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ---------- Detect platform ----------
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$OS" in
  linux)  OS="linux" ;;
  darwin) OS="darwin" ;;
  *)      fail "Unsupported OS: $OS" ;;
esac

case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  arm64|aarch64) ARCH="arm64" ;;
  *)             fail "Unsupported architecture: $ARCH" ;;
esac

info "Detected platform: ${OS}-${ARCH}"

# ---------- Determine install directory ----------
INSTALL_DIR="${INSTALL_DIR:-}"

if [[ -z "$INSTALL_DIR" ]]; then
  # Prefer ~/.local/bin (XDG standard, commonly in PATH)
  if [[ -d "$HOME/.local/bin" ]]; then
    INSTALL_DIR="$HOME/.local/bin"
  else
    # Create it — most modern shells include it in PATH
    INSTALL_DIR="$HOME/.local/bin"
    mkdir -p "$INSTALL_DIR"
    warn "Created $INSTALL_DIR — make sure it's in your PATH"
    warn "Add this to your shell profile:  export PATH=\"\$HOME/.local/bin:\$PATH\""
  fi
fi

info "Install directory: $INSTALL_DIR"

# ---------- Fetch latest release tags ----------
get_latest_version() {
  local repo="$1"
  # Use GitHub API to get latest release tag
  local tag
  tag=$(curl -sL "https://api.github.com/repos/${repo}/releases/latest" \
    | grep '"tag_name"' | head -1 | sed -E 's/.*"tag_name":\s*"([^"]+)".*/\1/')
  [[ -n "$tag" ]] || fail "Could not determine latest version for $repo"
  echo "$tag"
}

# ---------- Download a binary ----------
download_binary() {
  local repo="$1"
  local version="$2"
  local binary_name="$3"
  local dest="$4"

  local url="https://github.com/${repo}/releases/download/${version}/${binary_name}"

  echo -e "  Downloading ${binary_name} (${version})..."

  local http_code
  http_code=$(curl -sL -w "%{http_code}" -o "$dest" "$url")

  if [[ "$http_code" != "200" ]]; then
    rm -f "$dest"
    fail "Download failed (HTTP $http_code): $url"
  fi

  chmod +x "$dest"
}

# ---------- Download luca ----------
echo ""
echo -e "${GREEN}==>${NC} luca"

LUCA_VERSION="${LUCA_VERSION:-$(get_latest_version "soederpop/luca")}"
LUCA_BINARY="luca-${OS}-${ARCH}"
LUCA_DEST="${INSTALL_DIR}/luca"

if command -v luca >/dev/null 2>&1; then
  EXISTING="$(luca --version 2>&1 | head -1 || true)"
  info "luca already installed: ${EXISTING}"
  echo -e "  Reinstalling with ${LUCA_VERSION}..."
fi

download_binary "soederpop/luca" "$LUCA_VERSION" "$LUCA_BINARY" "$LUCA_DEST"
info "luca ${LUCA_VERSION} installed to ${LUCA_DEST}"

# ---------- Download cnotes (contentbase) ----------
echo ""
echo -e "${GREEN}==>${NC} cnotes (contentbase)"

CNOTES_VERSION="${CNOTES_VERSION:-$(get_latest_version "soederpop/contentbase")}"
CNOTES_BINARY="cnotes-${OS}-${ARCH}"
CNOTES_DEST="${INSTALL_DIR}/cnotes"

if command -v cnotes >/dev/null 2>&1; then
  EXISTING="$(cnotes --version 2>&1 | head -1 || true)"
  info "cnotes already installed: ${EXISTING}"
  echo -e "  Reinstalling with ${CNOTES_VERSION}..."
fi

download_binary "soederpop/contentbase" "$CNOTES_VERSION" "$CNOTES_BINARY" "$CNOTES_DEST"
info "cnotes ${CNOTES_VERSION} installed to ${CNOTES_DEST}"

# ---------- Verify ----------
echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Tools installed!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  luca   → ${LUCA_DEST}"
echo "  cnotes → ${CNOTES_DEST}"
echo ""

# Check if install dir is in PATH
if ! echo "$PATH" | tr ':' '\n' | grep -qx "$INSTALL_DIR"; then
  warn "$INSTALL_DIR is not in your PATH"
  echo "  Add this to your ~/.zshrc or ~/.bashrc:"
  echo ""
  echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
  echo ""
fi

echo "  Verify with:"
echo "    luca --version"
echo "    cnotes --version"
echo ""
