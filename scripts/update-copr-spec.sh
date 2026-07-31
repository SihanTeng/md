#!/usr/bin/env bash
# Rewrite packaging/copr/md.spec Version (and changelog bump) for a release.
#
# Usage:
#   ./scripts/update-copr-spec.sh <version> [spec-file]

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:?usage: update-copr-spec.sh <version> [spec-file]}"
SPEC="${2:-$ROOT/packaging/copr/md.spec}"

[[ -f "$SPEC" ]] || { echo "missing $SPEC" >&2; exit 1; }

sed -i -E "s/^Version:[[:space:]]+.*/Version:        ${VERSION}/" "$SPEC"

# Prepend a changelog entry if this version is not already the top entry.
if ! head -40 "$SPEC" | grep -q -- "- ${VERSION}-1"; then
  DATE="$(date -u '+%a %b %d %Y')"
  ENTRY="* ${DATE} md contributors <noreply@users.noreply.github.com> - ${VERSION}-1
- Release ${VERSION} (AppImage from GitHub Releases)
"
  # Insert after %changelog
  python3 - "$SPEC" "$ENTRY" <<'PY'
from pathlib import Path
import sys
path, entry = Path(sys.argv[1]), sys.argv[2]
text = path.read_text(encoding="utf-8")
marker = "%changelog\n"
if marker not in text:
    raise SystemExit("no %changelog in spec")
text = text.replace(marker, marker + entry + "\n", 1)
path.write_text(text, encoding="utf-8")
print(f"updated changelog in {path}")
PY
fi

echo "COPR spec ready: Version ${VERSION} ($SPEC)"
