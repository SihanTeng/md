#!/usr/bin/env bash
# Render the Homebrew cask for md with a released version and DMG SHA-256.
#
# Usage:
#   ./scripts/update-homebrew-cask.sh <version> <dmg-sha256> [cask-file]
#
# cask-file defaults to Casks/md.rb in this repo. The Release workflow points
# it at a checkout of the SihanTeng/homebrew-md tap repository instead.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

VERSION="${1:?usage: update-homebrew-cask.sh <version> <dmg-sha256> [cask-file]}"
SHA256="${2:?usage: update-homebrew-cask.sh <version> <dmg-sha256> [cask-file]}"
CASK_FILE="${3:-$ROOT/Casks/md.rb}"

if [[ ! -f "$CASK_FILE" ]]; then
  echo "Cask file not found: $CASK_FILE" >&2
  exit 1
fi

sed -i \
  -e "s/^  version \".*\"/  version \"$VERSION\"/" \
  -e "s/^  sha256 \".*\"/  sha256 \"$SHA256\"/" \
  "$CASK_FILE"

grep -q "version \"$VERSION\"" "$CASK_FILE"
grep -q "sha256 \"$SHA256\"" "$CASK_FILE"

echo "Updated $CASK_FILE to md $VERSION (sha256: $SHA256)"
