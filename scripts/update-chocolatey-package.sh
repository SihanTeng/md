#!/usr/bin/env bash
# Update packaging/chocolatey/tenling for a released version.
#
# Usage:
#   ./scripts/update-chocolatey-package.sh <version> <msi-path> [package-dir]
#
# Rewrites nuspec version + chocolateyInstall.ps1 version/checksum.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:?usage: update-chocolatey-package.sh <version> <msi-path> [package-dir]}"
MSI="${2:?usage: update-chocolatey-package.sh <version> <msi-path> [package-dir]}"
DIR="${3:-$ROOT/packaging/chocolatey/tenling}"

[[ -f "$MSI" ]] || { echo "missing MSI: $MSI" >&2; exit 1; }
[[ -f "$DIR/tenling.nuspec" ]] || { echo "missing $DIR/tenling.nuspec" >&2; exit 1; }
[[ -f "$DIR/tools/chocolateyInstall.ps1" ]] || { echo "missing install script" >&2; exit 1; }

SHA="$(sha256sum "$MSI" | cut -d' ' -f1)"
# PowerShell / Windows also accept uppercase; keep lowercase for consistency.
SHA_LOWER="$(printf '%s' "$SHA" | tr '[:upper:]' '[:lower:]')"

# nuspec <version>
sed -i -E "s#<version>[^<]+</version>#<version>${VERSION}</version>#" "$DIR/tenling.nuspec"

# install script version + checksum
python3 - "$DIR/tools/chocolateyInstall.ps1" "$VERSION" "$SHA_LOWER" <<'PY'
from pathlib import Path
import re, sys
path, version, sha = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
text = path.read_text(encoding="utf-8")
text, n1 = re.subn(
    r"\$softwareVersion\s*=\s*'[^']*'",
    f"$softwareVersion = '{version}'",
    text,
    count=1,
)
text, n2 = re.subn(
    r"\$checksum64\s*=\s*'[^']*'",
    f"$checksum64      = '{sha}'",
    text,
    count=1,
)
if n1 != 1 or n2 != 1:
    raise SystemExit(f"rewrite failed (version={n1}, checksum={n2})")
path.write_text(text, encoding="utf-8")
print(f"updated {path}")
PY

# VERIFICATION note
if [[ -f "$DIR/tools/VERIFICATION.txt" ]]; then
  cat > "$DIR/tools/VERIFICATION.txt" <<EOF
VERIFICATION
Verification is intended to assist the Chocolatey moderators and community
in verifying that this package's contents are trustworthy.

The installer is downloaded from the official GitHub Releases page for TenLing:

  https://github.com/SihanTeng/tenling/releases/download/v${VERSION}/tenling-${VERSION}-windows-x64.msi

File: tenling-${VERSION}-windows-x64.msi
Checksum type: sha256
Checksum: ${SHA_LOWER}

Computed by scripts/update-chocolatey-package.sh during the Release workflow.
EOF
fi

echo "Chocolatey package ready: tenling ${VERSION} (sha256 ${SHA_LOWER})"
