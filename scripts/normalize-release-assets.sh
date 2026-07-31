#!/usr/bin/env bash
# Normalize Tauri installer filenames to a single scheme, then (optionally)
# rewrite a release's assets and latest.json so names stay consistent.
#
# Canonical name:
#   md-{version}-{os}-{arch}.{ext}
#   md-{version}-{os}-{arch}.{ext}.sig
#
# Examples:
#   md-0.2.0-macos-universal.dmg
#   md-0.2.0-linux-x64.AppImage
#   md-0.2.0-linux-x64.deb
#   md-0.2.0-linux-x64.rpm
#   md-0.2.0-windows-x64.msi
#   md-0.2.0-macos-universal.app.tar.gz   (OTA updater payload)
#
# Usage:
#   # Rename files in a directory (prints mapping old→new):
#   ./scripts/normalize-release-assets.sh rename <version> <dir>
#
#   # Download a GitHub release, rename, re-upload, drop old names, fix latest.json:
#   ./scripts/normalize-release-assets.sh publish <tag> [repo]
#
# Env:
#   GH_TOKEN / GITHUB_TOKEN  — required for publish mode
#   DRY_RUN=1                — print actions without mutating the release

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRY_RUN="${DRY_RUN:-0}"

log()  { printf ':: %s\n' "$*" >&2; }
warn() { printf '!! %s\n' "$*" >&2; }
die()  { printf 'error: %s\n' "$*" >&2; exit 1; }

# Map a single Tauri-produced filename → canonical name.
# Prints the new basename, or nothing if the file should be left alone.
canonical_name() {
  local version="$1" base="$2"
  local lower
  lower="$(printf '%s' "$base" | tr '[:upper:]' '[:lower:]')"

  # Already canonical?
  if [[ "$base" =~ ^md-${version//./\.}-((macos|linux|windows)-[a-z0-9_]+)\.(dmg|appimage|deb|rpm|msi|app\.tar\.gz)(\.sig)?$ ]]; then
    # Preserve original casing for .AppImage extension
    case "$lower" in
      *.appimage|*.appimage.sig)
        if [[ "$base" == *".AppImage"* ]]; then
          printf '%s\n' "$base"
          return 0
        fi
        ;;
      *)
        printf '%s\n' "$base"
        return 0
        ;;
    esac
  fi

  local sig="" stem="$base"
  if [[ "$base" == *.sig ]]; then
    sig=".sig"
    stem="${base%.sig}"
  fi

  local os="" arch="" ext=""

  # macOS DMG: md_0.2.0_universal.dmg  |  md_0.2.0_aarch64.dmg  |  md_0.2.0_x64.dmg
  if [[ "$stem" =~ ^md[_-]${version//./\.}[_-](universal|aarch64|x64|x86_64)\.dmg$ ]]; then
    os="macos"
    arch="${BASH_REMATCH[1]}"
    [[ "$arch" == "x86_64" ]] && arch="x64"
    ext="dmg"

  # macOS updater tarball: md_0.2.0_universal.app.tar.gz
  elif [[ "$stem" =~ ^md[_-]${version//./\.}[_-](universal|aarch64|x64|x86_64)\.app\.tar\.gz$ ]]; then
    os="macos"
    arch="${BASH_REMATCH[1]}"
    [[ "$arch" == "x86_64" ]] && arch="x64"
    ext="app.tar.gz"

  # AppImage: md_0.2.0_amd64.AppImage
  elif [[ "$stem" =~ ^md[_-]${version//./\.}[_-](amd64|x86_64|x64|aarch64|arm64)\.[Aa]pp[Ii]mage$ ]]; then
    os="linux"
    arch="${BASH_REMATCH[1]}"
    case "$arch" in
      amd64|x86_64) arch="x64" ;;
      arm64) arch="aarch64" ;;
    esac
    ext="AppImage"

  # deb: md_0.2.0_amd64.deb
  elif [[ "$stem" =~ ^md[_-]${version//./\.}[_-](amd64|x86_64|x64|aarch64|arm64)\.deb$ ]]; then
    os="linux"
    arch="${BASH_REMATCH[1]}"
    case "$arch" in
      amd64|x86_64) arch="x64" ;;
      arm64) arch="aarch64" ;;
    esac
    ext="deb"

  # rpm: md-0.2.0-1.x86_64.rpm  (release number may vary)
  elif [[ "$stem" =~ ^md-${version//./\.}-[0-9]+\.(x86_64|aarch64|arm64)\.rpm$ ]]; then
    os="linux"
    arch="${BASH_REMATCH[1]}"
    case "$arch" in
      x86_64) arch="x64" ;;
      arm64) arch="aarch64" ;;
    esac
    ext="rpm"

  # MSI: md_0.2.0_x64_en-US.msi  |  md_0.2.0_x64.msi
  elif [[ "$stem" =~ ^md[_-]${version//./\.}[_-](x64|x86_64|arm64|aarch64)([_-][A-Za-z]{2}[-_][A-Za-z]{2})?\.msi$ ]]; then
    os="windows"
    arch="${BASH_REMATCH[1]}"
    case "$arch" in
      x86_64) arch="x64" ;;
      arm64) arch="aarch64" ;;
    esac
    ext="msi"

  else
    return 1
  fi

  printf 'md-%s-%s-%s.%s%s\n' "$version" "$os" "$arch" "$ext" "$sig"
}

# Rename every recognized installer in dir. Writes mapping to stdout as: old<TAB>new
rename_dir() {
  local version="$1" dir="$2"
  [[ -d "$dir" ]] || die "not a directory: $dir"

  local f base new
  # Process installers before .sig so we can rename sigs against the new base.
  local -a files=()
  while IFS= read -r -d '' f; do
    files+=("$f")
  done < <(find "$dir" -maxdepth 1 -type f -print0 | sort -z)

  # First pass: non-sig installers
  declare -A renamed=()
  for f in "${files[@]}"; do
    base="$(basename "$f")"
    [[ "$base" == *.sig ]] && continue
    [[ "$base" == "latest.json" ]] && continue
    if new="$(canonical_name "$version" "$base")"; then
      if [[ "$base" != "$new" ]]; then
        if [[ -e "$dir/$new" && "$base" != "$new" ]]; then
          die "target already exists: $dir/$new"
        fi
        log "rename  $base  →  $new"
        if [[ "$DRY_RUN" != "1" ]]; then
          mv "$f" "$dir/$new"
        fi
        printf '%s\t%s\n' "$base" "$new"
        renamed["$base"]="$new"
      else
        log "keep    $base"
        renamed["$base"]="$base"
        printf '%s\t%s\n' "$base" "$base"
      fi
    else
      warn "skip unrecognized: $base"
    fi
  done

  # Second pass: .sig files — rename to match their installer
  for f in "${files[@]}"; do
    base="$(basename "$f")"
    [[ "$base" == *.sig ]] || continue
    # Prefer mapping via stem if we renamed the installer
    local stem="${base%.sig}"
    if [[ -n "${renamed[$stem]+x}" ]]; then
      new="${renamed[$stem]}.sig"
    elif new="$(canonical_name "$version" "$base")"; then
      :
    else
      warn "skip unrecognized: $base"
      continue
    fi
    # Re-resolve path if first pass already moved things (sig still at old path)
    local src="$dir/$base"
    [[ -f "$src" ]] || src="$f"
    if [[ "$(basename "$src")" != "$new" ]]; then
      if [[ -e "$dir/$new" && "$(basename "$src")" != "$new" ]]; then
        die "target already exists: $dir/$new"
      fi
      log "rename  $base  →  $new"
      if [[ "$DRY_RUN" != "1" ]]; then
        mv "$src" "$dir/$new"
      fi
      printf '%s\t%s\n' "$base" "$new"
    else
      log "keep    $base"
      printf '%s\t%s\n' "$base" "$new"
    fi
  done
}

# Rewrite latest.json download URLs to the canonical filenames on this tag.
# Signatures are left intact (content-bound; trusted-comment filename is advisory).
rewrite_latest_json() {
  local version="$1" tag="$2" repo="$3" json_path="$4" assets_dir="$5"
  [[ -f "$json_path" ]] || { warn "no latest.json at $json_path — skipping rewrite"; return 0; }

  local base_url="https://github.com/${repo}/releases/download/${tag}"

  # Prefer AppImage for generic linux-x86_64 (OTA installs replace the binary).
  local linux_x64_appimage="md-${version}-linux-x64.AppImage"
  local linux_x64_rpm="md-${version}-linux-x64.rpm"
  local linux_x64_deb="md-${version}-linux-x64.deb"
  local win_x64_msi="md-${version}-windows-x64.msi"
  local mac_uni_app="md-${version}-macos-universal.app.tar.gz"
  local mac_uni_dmg="md-${version}-macos-universal.dmg"

  python3 - "$json_path" "$base_url" "$assets_dir" \
    "$linux_x64_appimage" "$linux_x64_rpm" "$linux_x64_deb" \
    "$win_x64_msi" "$mac_uni_app" "$mac_uni_dmg" <<'PY'
import json, os, sys

json_path, base_url, assets_dir = sys.argv[1:4]
linux_app, linux_rpm, linux_deb, win_msi, mac_app, mac_dmg = sys.argv[4:10]

with open(json_path, encoding="utf-8") as f:
    data = json.load(f)

platforms = data.get("platforms") or {}

def has(name: str) -> bool:
    return os.path.isfile(os.path.join(assets_dir, name))

def set_url(key: str, filename: str) -> None:
    if key not in platforms:
        return
    if not has(filename):
        return
    platforms[key]["url"] = f"{base_url}/{filename}"

# Generic keys first (used by the plugin), then typed keys.
set_url("linux-x86_64", linux_app)
set_url("linux-x86_64-appimage", linux_app)
set_url("linux-x86_64-rpm", linux_rpm)
set_url("linux-x86_64-deb", linux_deb)
set_url("windows-x86_64", win_msi)
set_url("windows-x86_64-msi", win_msi)
set_url("darwin-aarch64", mac_app if has(mac_app) else mac_dmg)
set_url("darwin-x86_64", mac_app if has(mac_app) else mac_dmg)
set_url("darwin-universal", mac_app if has(mac_app) else mac_dmg)

data["platforms"] = platforms
with open(json_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
print(f"rewrote {json_path}")
PY
}

publish_release() {
  local tag="$1"
  local repo="${2:-${GITHUB_REPOSITORY:-}}"
  [[ -n "$repo" ]] || die "repo required (arg 2 or GITHUB_REPOSITORY)"
  command -v gh >/dev/null 2>&1 || die "gh CLI required"
  command -v python3 >/dev/null 2>&1 || die "python3 required"

  local version="${tag#v}"
  [[ "$version" != "$tag" ]] || version="$tag"

  local work
  work="$(mktemp -d "${TMPDIR:-/tmp}/md-normalize.XXXXXX")"
  # shellcheck disable=SC2064
  trap "rm -rf '$work'" EXIT

  log "download release $tag from $repo → $work"
  if [[ "$DRY_RUN" == "1" ]]; then
    gh release download "$tag" --repo "$repo" --dir "$work" --clobber || true
  else
    gh release download "$tag" --repo "$repo" --dir "$work" --clobber
  fi

  log "normalize filenames for version $version"
  rename_dir "$version" "$work" >/tmp/md-rename-map.txt || true
  if [[ -f "$work/latest.json" ]]; then
    rewrite_latest_json "$version" "$tag" "$repo" "$work/latest.json" "$work"
  fi

  # Collect files to upload (installers + sigs + latest.json)
  local -a upload=()
  local f base
  while IFS= read -r -d '' f; do
    base="$(basename "$f")"
    case "$base" in
      md-"$version"-*) upload+=("$f") ;;
      latest.json) upload+=("$f") ;;
    esac
  done < <(find "$work" -maxdepth 1 -type f -print0)

  [[ ${#upload[@]} -gt 0 ]] || die "nothing to upload after normalize"

  log "upload ${#upload[@]} asset(s) to $tag"
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '  %s\n' "${upload[@]}"
  else
    gh release upload "$tag" --repo "$repo" --clobber "${upload[@]}"
  fi

  # Delete legacy-named installer assets still on the release.
  # Canonical: md-{version}-{macos|linux|windows}-{arch}.{ext}[.sig]
  log "prune legacy-named assets"
  local name
  local canon_re="^md-${version//./\.}-(macos|linux|windows)-[a-z0-9_]+\\.(dmg|AppImage|deb|rpm|msi|app\\.tar\\.gz)(\\.sig)?$"
  while IFS= read -r name; do
    [[ -n "$name" ]] || continue
    [[ "$name" == "latest.json" ]] && continue
    # Keep already-canonical names
    if [[ "$name" =~ $canon_re ]]; then
      continue
    fi
    # Drop anything that maps to a known Tauri installer pattern for this version
    if canonical_name "$version" "$name" >/dev/null 2>&1; then
      log "delete  $name"
      if [[ "$DRY_RUN" != "1" ]]; then
        gh release delete-asset "$tag" "$name" --repo "$repo" --yes
      fi
    fi
  done < <(gh api "repos/${repo}/releases/tags/${tag}" --jq '.assets[].name')

  log "done — assets on $tag now use md-${version}-{os}-{arch}.{ext}"
}

usage() {
  sed -n '2,30p' "$0" | sed 's/^# \?//'
}

main() {
  local cmd="${1:-}"
  case "$cmd" in
    rename)
      [[ $# -ge 3 ]] || die "usage: $0 rename <version> <dir>"
      rename_dir "$2" "$3"
      ;;
    publish)
      [[ $# -ge 2 ]] || die "usage: $0 publish <tag> [repo]"
      publish_release "$2" "${3:-}"
      ;;
    -h|--help|"")
      usage
      exit 0
      ;;
    *)
      die "unknown command: $cmd (try rename|publish)"
      ;;
  esac
}

main "$@"
