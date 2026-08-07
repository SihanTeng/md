#!/usr/bin/env bash
# TenLing — one-line installer (macOS / Linux)
#
#   curl -fsSL https://raw.githubusercontent.com/SihanTeng/tenling/main/install.sh | bash
#
# Downloads the latest GitHub Release for your platform and installs it.
# Optional env:
#   TENLING_VERSION=v0.3.0   pin a release tag (default: latest)
#   TENLING_PREFIX=~/.local  AppImage install prefix (Linux)
#   TENLING_FORCE=1          reinstall even if tenling is already present

set -euo pipefail

REPO="SihanTeng/tenling"
API="https://api.github.com/repos/${REPO}"
DOWNLOADS="https://github.com/${REPO}/releases/download"

TENLING_VERSION="${TENLING_VERSION:-}"
TENLING_PREFIX="${TENLING_PREFIX:-}"
TENLING_FORCE="${TENLING_FORCE:-}"
TENLING_USE_DEB="${TENLING_USE_DEB:-}"
TENLING_USE_RPM="${TENLING_USE_RPM:-}"

RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
NC=$'\033[0m'

info()  { printf '%s[INFO]%s %s\n' "$GREEN" "$NC" "$*"; }
warn()  { printf '%s[WARN]%s %s\n' "$YELLOW" "$NC" "$*"; }
error() { printf '%s[ERROR]%s %s\n' "$RED" "$NC" "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || error "missing required command: $1"
}

# --- platform ---------------------------------------------------------------

detect_platform() {
  local os arch
  os="$(uname -s | tr '[:upper:]' '[:lower:]')"
  arch="$(uname -m)"

  case "$os" in
    linux)  OS=linux ;;
    darwin) OS=macos ;;
    *) error "unsupported OS: $(uname -s) (use install.ps1 on Windows)" ;;
  esac

  case "$arch" in
    x86_64|amd64) ARCH=x64 ;;
    aarch64|arm64)
      ARCH=aarch64
      if [[ "$OS" == "linux" ]]; then
        error "Linux arm64 builds are not published yet (need x86_64)"
      fi
      ;;
    *) error "unsupported architecture: $arch" ;;
  esac

  info "detected ${OS}/${ARCH}"
}

# --- release metadata -------------------------------------------------------

json_get() {
  local key="$1"
  sed -nE "s/.*\"${key}\"[[:space:]]*:[[:space:]]*\"([^\"]+)\".*/\1/p" | head -1
}

get_release() {
  local url json
  if [[ -n "${TENLING_VERSION}" ]]; then
    local tag="${TENLING_VERSION#v}"
    tag="v${tag}"
    info "using pinned version ${tag}"
    url="${API}/releases/tags/${tag}"
  else
    info "fetching latest release…"
    url="${API}/releases/latest"
  fi

  json="$(curl -fsSL \
    -H "Accept: application/vnd.github+json" \
    -H "User-Agent: tenling-install" \
    "$url")" || error "failed to query GitHub releases (check network / rate limit)"

  TAG="$(printf '%s' "$json" | json_get tag_name)"
  [[ -n "$TAG" ]] || error "could not parse release tag"
  VERSION="${TAG#v}"
  RELEASE_JSON="$json"
  info "release ${TAG}"
}

# Stable GitHub release download URL (do not scrape API asset JSON — minified
# payloads and nested https:// fields made the old parser pick API/user URLs).
asset_url() {
  local want="$1"
  printf '%s' "${DOWNLOADS}/${TAG}/${want}"
}

# True if the remote URL exists (HTTP 2xx/3xx after redirects).
url_ok() {
  local code
  code="$(curl -fsSIL -o /dev/null -w '%{http_code}' -A 'tenling-install' "$1" 2>/dev/null || true)"
  [[ "$code" =~ ^[23][0-9][0-9]$ ]]
}

# Resolve the first existing asset name from a candidate list; prints name\turl.
resolve_asset() {
  local name url
  for name in "$@"; do
    url="$(asset_url "$name")"
    if url_ok "$url"; then
      printf '%s\t%s\n' "$name" "$url"
      return 0
    fi
  done
  return 1
}

download() {
  local url="$1" out="$2"
  local min_bytes="${3:-1024}"
  [[ -n "$url" ]] || error "no download URL for this platform"
  info "downloading $(basename "$out")…"
  curl -fsSL --retry 3 --retry-delay 1 -A 'tenling-install' -o "$out" "$url" \
    || error "download failed: $url"

  local size
  size="$(wc -c < "$out" | tr -d ' ')"
  if [[ "$size" -lt "$min_bytes" ]]; then
    error "download too small (${size} bytes) — expected a release asset from ${url}. Got: $(head -c 120 "$out" | tr '\n' ' ')"
  fi
}

# --- installers -------------------------------------------------------------

install_macos() {
  need_cmd hdiutil
  need_cmd curl

  local name url resolved
  resolved="$(resolve_asset \
    "tenling-${VERSION}-macos-universal.dmg" \
    "tenling_${VERSION}_universal.dmg")" \
    || error "no macOS DMG found for ${TAG}"
  name="${resolved%%$'\t'*}"
  url="${resolved#*$'\t'}"

  local tmp dmg mount
  tmp="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT
  dmg="${tmp}/${name}"
  download "$url" "$dmg" 1000000

  info "mounting DMG…"
  mount="$(hdiutil attach -nobrowse -readonly "$dmg" | awk 'END{print $NF}')"
  [[ -d "$mount" ]] || error "failed to mount DMG"

  local app
  app="$(find "$mount" -maxdepth 2 \( -name 'TenLing.app' -o -name 'tenling.app' \) -type d | head -1)"
  [[ -n "$app" ]] || {
    hdiutil detach "$mount" >/dev/null 2>&1 || true
    error "TenLing.app not found inside DMG"
  }

  info "installing to /Applications/TenLing.app…"
  if [[ -d /Applications/TenLing.app ]]; then
    if [[ -z "${TENLING_FORCE}" ]]; then
      warn "/Applications/TenLing.app already exists (set TENLING_FORCE=1 to replace)"
    fi
    rm -rf /Applications/TenLing.app
  fi
  cp -R "$app" /Applications/TenLing.app
  hdiutil detach "$mount" >/dev/null 2>&1 || true

  if command -v xattr >/dev/null 2>&1; then
    xattr -dr com.apple.quarantine /Applications/TenLing.app 2>/dev/null || true
  fi

  info "installed /Applications/TenLing.app"
  printf '\n%sOpen TenLing from Applications, or run:%s\n  open -a TenLing\n\n' "$CYAN" "$NC"
  printf '%sIf macOS blocks the app:%s System Settings → Privacy & Security → Open Anyway\n\n' "$YELLOW" "$NC"
}

install_linux() {
  need_cmd curl

  local prefix="${TENLING_PREFIX:-$HOME/.local}"
  local bindir="${prefix}/bin"
  mkdir -p "$bindir"

  if command -v dpkg >/dev/null 2>&1 && [[ "$(id -u)" -eq 0 || -n "${TENLING_USE_DEB}" ]]; then
    install_linux_deb
    return
  fi
  if command -v rpm >/dev/null 2>&1 && [[ "$(id -u)" -eq 0 || -n "${TENLING_USE_RPM}" ]]; then
    install_linux_rpm
    return
  fi

  install_linux_appimage "$bindir"
}

install_linux_appimage() {
  local bindir="$1"
  local name url resolved
  resolved="$(resolve_asset \
    "tenling-${VERSION}-linux-x64.AppImage" \
    "tenling_${VERSION}_amd64.AppImage")" \
    || error "no Linux AppImage found for ${TAG}"
  name="${resolved%%$'\t'*}"
  url="${resolved#*$'\t'}"

  local tmp out
  tmp="$(mktemp -d)"
  # shellcheck disable=SC2064
  trap "rm -rf '$tmp'" EXIT
  out="${tmp}/${name}"
  # AppImages are tens of MB; reject tiny/corrupt payloads (was a JSON scrape bug).
  download "$url" "$out" 1000000
  # ELF magic (AppImage is an ELF executable)
  if ! head -c 4 "$out" | grep -q $'\x7fELF'; then
    error "downloaded file is not an AppImage/ELF binary (got $(file -b "$out"))"
  fi
  chmod +x "$out"

  local dest="${bindir}/tenling"
  if [[ -e "$dest" && -z "${TENLING_FORCE}" ]]; then
    warn "${dest} already exists (set TENLING_FORCE=1 to replace)"
  fi
  mv -f "$out" "$dest"
  info "installed ${dest}"

  if ! command -v tenling >/dev/null 2>&1; then
    warn "add to PATH:  export PATH=\"${bindir}:\$PATH\""
    if [[ -f "$HOME/.bashrc" ]] && ! grep -qF "${bindir}" "$HOME/.bashrc" 2>/dev/null; then
      printf '\n# TenLing markdown editor\nexport PATH="%s:$PATH"\n' "$bindir" >> "$HOME/.bashrc"
      info "appended PATH export to ~/.bashrc (open a new shell)"
    fi
  fi

  local apps="${XDG_DATA_HOME:-$HOME/.local/share}/applications"
  mkdir -p "$apps"
  cat > "${apps}/tenling.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=TenLing
GenericName=Markdown Editor
Comment=Calm Markdown viewer and editor
Exec=${dest} %F
Icon=tenling
Terminal=false
Categories=Office;TextEditor;Utility;
MimeType=text/markdown;text/x-markdown;
StartupWMClass=tenling
Keywords=markdown;editor;notes;tenling;
EOF
  info "desktop entry: ${apps}/tenling.desktop"

  printf '\n%sRun:%s\n  tenling\n\n' "$CYAN" "$NC"
}

install_linux_deb() {
  local name="tenling-${VERSION}-linux-x64.deb"
  local url
  url="$(asset_url "$name")"
  local tmp="${TMPDIR:-/tmp}/tenling-install-$$.deb"
  download "$url" "$tmp" 100000
  info "installing deb (needs root)…"
  if [[ "$(id -u)" -eq 0 ]]; then
    dpkg -i "$tmp" || apt-get install -f -y
  else
    sudo dpkg -i "$tmp" || sudo apt-get install -f -y
  fi
  rm -f "$tmp"
  info "installed via dpkg"
  printf '\n%sRun:%s\n  tenling\n\n' "$CYAN" "$NC"
}

install_linux_rpm() {
  local name="tenling-${VERSION}-linux-x64.rpm"
  local url
  url="$(asset_url "$name")"
  local tmp="${TMPDIR:-/tmp}/tenling-install-$$.rpm"
  download "$url" "$tmp" 100000
  info "installing rpm (needs root)…"
  if command -v dnf >/dev/null 2>&1; then
    if [[ "$(id -u)" -eq 0 ]]; then dnf install -y "$tmp"; else sudo dnf install -y "$tmp"; fi
  else
    if [[ "$(id -u)" -eq 0 ]]; then rpm -Uvh "$tmp"; else sudo rpm -Uvh "$tmp"; fi
  fi
  rm -f "$tmp"
  info "installed via rpm/dnf"
  printf '\n%sRun:%s\n  tenling\n\n' "$CYAN" "$NC"
}

# --- main -------------------------------------------------------------------

main() {
  printf '\n%s TenLing%s — Markdown editor installer\n\n' "$CYAN" "$NC"
  need_cmd curl
  need_cmd uname
  detect_platform
  get_release

  case "$OS" in
    macos) install_macos ;;
    linux) install_linux ;;
  esac
}

main "$@"
