#!/usr/bin/env bash
# Pack and push the Chocolatey package for md.
#
# Usage:
#   ./scripts/publish-chocolatey.sh <version> <msi-path> [--pack-only]
#
# Env:
#   DIST_CHOCOLATEY_API_KEY — required for push (see .github/SECRETS.md)
#   CHOCOLATEY_SOURCE       — default https://push.chocolatey.org/
#
# Release workflow runs this on windows-latest (native choco).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:?usage: publish-chocolatey.sh <version> <msi-path> [--pack-only]}"
MSI="${2:?usage: publish-chocolatey.sh <version> <msi-path> [--pack-only]}"
PACK_ONLY=0
[[ "${3:-}" == "--pack-only" ]] && PACK_ONLY=1

"$ROOT/scripts/update-chocolatey-package.sh" "$VERSION" "$MSI"

PKG_DIR="$ROOT/packaging/chocolatey/md"
SOURCE="${CHOCOLATEY_SOURCE:-https://push.chocolatey.org/}"

if ! command -v choco >/dev/null 2>&1; then
  echo "choco CLI not found on PATH" >&2
  exit 1
fi

(
  cd "$PKG_DIR"
  choco pack md.nuspec --output-directory "$PKG_DIR"
)

NUPKG="$PKG_DIR/md.${VERSION}.nupkg"
if [[ ! -f "$NUPKG" ]]; then
  NUPKG="$(find "$PKG_DIR" -maxdepth 1 -name "md*.nupkg" | head -1)"
fi
[[ -f "$NUPKG" ]] || { echo "nupkg not found after pack" >&2; exit 1; }
echo "Packed $NUPKG"

if [[ "$PACK_ONLY" -eq 1 ]]; then
  exit 0
fi

if [[ -z "${DIST_CHOCOLATEY_API_KEY:-}" ]]; then
  echo "DIST_CHOCOLATEY_API_KEY not set — pack only" >&2
  exit 0
fi

choco push "$NUPKG" --source "$SOURCE" --api-key "$DIST_CHOCOLATEY_API_KEY" --force
echo "Pushed $NUPKG to $SOURCE"
