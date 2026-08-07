#!/usr/bin/env bash
# Build platform installers for TenLing using Tauri.
#
# Usage:
#   ./scripts/build-installers.sh              # current host OS only
#   ./scripts/build-installers.sh --all-hint   # print how to get all three packages
#   ./scripts/build-installers.sh linux        # force AppImage + deb + RPM (Linux host)
#   ./scripts/build-installers.sh macos        # force DMG (macOS host required)
#   ./scripts/build-installers.sh windows      # force MSI (Windows host required)
#   ./scripts/build-installers.sh --list       # list artifacts from last build
#
# Cross-OS note: Tauri cannot cross-compile these bundles. Use GitHub Actions
# (.github/workflows/release.yml) to produce every package from one tag.
# Release assets are renamed to: tenling-{version}-{os}-{arch}.{ext}

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
CYAN=$'\033[0;36m'
DIM=$'\033[2m'
RESET=$'\033[0m'

log()  { printf '%s%s%s\n' "$CYAN" "$*" "$RESET"; }
ok()   { printf '%s%s%s\n' "$GREEN" "$*" "$RESET"; }
err()  { printf '%s%s%s\n' "$RED" "$*" "$RESET" >&2; }

detect_os() {
  case "$(uname -s)" in
    Darwin) echo macos ;;
    Linux)  echo linux ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT) echo windows ;;
    *) echo unknown ;;
  esac
}

usage() {
  sed -n '2,16p' "$0" | sed 's/^# \?//'
}

list_artifacts() {
  log "Looking for installers under src-tauri/target …"
  local found=0
  while IFS= read -r -d '' f; do
    found=1
    ls -lh "$f"
  done < <(find src-tauri/target -type f \( \
      -name '*.dmg' -o -name '*.AppImage' -o -name '*.msi' \
      -o -name '*.rpm' -o -name '*.deb' \
    \) -print0 2>/dev/null || true)

  if [[ "$found" -eq 0 ]]; then
    err "No installer artifacts found. Run a build first."
    return 1
  fi
}

print_all_hint() {
  cat <<EOF
${CYAN}Building all installers (DMG + AppImage + deb + RPM + MSI)${RESET}

Tauri must build each package on its native OS:

  macOS   →  .dmg                         (this machine must be macOS, or use CI)
  Linux   →  .AppImage + .deb + .rpm      (this machine must be Linux, or use CI)
  Windows →  .msi                         (this machine must be Windows, or use CI)

Release filenames (after CI normalize): tenling-{version}-{os}-{arch}.{ext}

Recommended: push a version tag and let GitHub Actions build everything:

  git tag v0.1.0
  git push origin v0.1.0

Or run the workflow manually:
  GitHub → Actions → "Release installers" → Run workflow

Local single-platform build:

  ./scripts/build-installers.sh
  # or: bun run build:installers
EOF
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Missing required command: $1"
    exit 1
  fi
}

ensure_deps() {
  require_cmd bun
  require_cmd cargo
  require_cmd rustc

  if [[ ! -d node_modules ]]; then
    log "Installing dependencies…"
    bun install --frozen-lockfile 2>/dev/null || bun install
  fi

  # Bundling updater artifacts (createUpdaterArtifacts) requires the signing
  # key. Fall back to the default key location when env vars are not set.
  if [[ -z "${TAURI_SIGNING_PRIVATE_KEY:-}" && -z "${TAURI_SIGNING_PRIVATE_KEY_PATH:-}" && -f "$HOME/.tauri/tenling.key" ]]; then
    export TAURI_SIGNING_PRIVATE_KEY_PATH="$HOME/.tauri/tenling.key"
  fi
}

build_linux() {
  log "Building Linux AppImage + deb + RPM…"
  # AppImage tooling often needs these at runtime of the bundler
  if command -v apt-get >/dev/null 2>&1; then
    if ! pkg-config --exists webkit2gtk-4.1 2>/dev/null; then
      err "webkit2gtk-4.1 not found. Install Tauri Linux deps:"
      err "  sudo apt-get install libwebkit2gtk-4.1-dev librsvg2-dev patchelf libssl-dev rpm"
      exit 1
    fi
  fi
  # RPM bundling needs rpmbuild (Debian/Ubuntu: sudo apt-get install rpm)
  require_cmd rpmbuild
  bun run tauri -- build --bundles appimage,deb,rpm
  ok "Linux bundle build finished."
  find src-tauri/target/release/bundle/appimage -name '*.AppImage' -print 2>/dev/null || true
  find src-tauri/target/release/bundle/deb -name '*.deb' -print 2>/dev/null || true
  find src-tauri/target/release/bundle/rpm -name '*.rpm' -print 2>/dev/null || true
}

build_macos() {
  log "Building macOS DMG (universal if both targets available)…"
  local targets=()
  if rustup target list --installed 2>/dev/null | grep -q 'aarch64-apple-darwin'; then
    targets+=("aarch64-apple-darwin")
  fi
  if rustup target list --installed 2>/dev/null | grep -q 'x86_64-apple-darwin'; then
    targets+=("x86_64-apple-darwin")
  fi

  if [[ ${#targets[@]} -eq 2 ]]; then
    bun run tauri -- build --target universal-apple-darwin --bundles dmg
  else
    log "${DIM}Universal target incomplete; building host architecture only.${RESET}"
    bun run tauri -- build --bundles dmg
  fi
  ok "DMG build finished."
  find src-tauri/target -path '*/bundle/dmg/*.dmg' -print 2>/dev/null || true
}

build_windows() {
  log "Building Windows MSI (requires WiX Toolset on PATH)…"
  bun run tauri -- build --bundles msi
  ok "MSI build finished."
  find src-tauri/target/release/bundle/msi -name '*.msi' -print 2>/dev/null || true
}

main() {
  local arg="${1:-}"
  case "$arg" in
    -h|--help) usage; exit 0 ;;
    --list) list_artifacts; exit $? ;;
    --all-hint) print_all_hint; exit 0 ;;
  esac

  ensure_deps

  local target="$arg"
  if [[ -z "$target" ]]; then
    target="$(detect_os)"
  fi

  case "$target" in
    linux|appimage)
      if [[ "$(detect_os)" != "linux" ]]; then
        err "AppImage must be built on Linux. Use CI or --all-hint."
        exit 1
      fi
      build_linux
      ;;
    macos|darwin|dmg)
      if [[ "$(detect_os)" != "macos" ]]; then
        err "DMG must be built on macOS. Use CI or --all-hint."
        exit 1
      fi
      build_macos
      ;;
    windows|win|msi)
      if [[ "$(detect_os)" != "windows" ]]; then
        err "MSI must be built on Windows. Use CI or --all-hint."
        exit 1
      fi
      build_windows
      ;;
    all)
      print_all_hint
      err "Cannot build all three packages on a single host. See above."
      exit 2
      ;;
    *)
      err "Unknown target: $target"
      usage
      exit 1
      ;;
  esac

  echo
  list_artifacts || true
  ok "Done."
}

main "$@"
