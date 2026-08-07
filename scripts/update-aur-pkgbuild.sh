#!/usr/bin/env bash
# Update packaging/aur/tenling-bin/PKGBUILD (+ .SRCINFO) for a released version.
#
# Usage:
#   ./scripts/update-aur-pkgbuild.sh <version> <appimage-path> [pkgbuild-dir]
#
# Computes sha256 of the AppImage, rewrites pkgver/sha256sums, and regenerates
# .SRCINFO when makepkg is available (otherwise writes a minimal .SRCINFO).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:?usage: update-aur-pkgbuild.sh <version> <appimage-path> [pkgbuild-dir]}"
APPIMAGE="${2:?usage: update-aur-pkgbuild.sh <version> <appimage-path> [pkgbuild-dir]}"
DIR="${3:-$ROOT/packaging/aur/tenling-bin}"
PKGBUILD="$DIR/PKGBUILD"
DESKTOP="$DIR/tenling.desktop"

[[ -f "$PKGBUILD" ]] || { echo "missing $PKGBUILD" >&2; exit 1; }
[[ -f "$APPIMAGE" ]] || { echo "missing $APPIMAGE" >&2; exit 1; }
[[ -f "$DESKTOP" ]] || { echo "missing $DESKTOP" >&2; exit 1; }

SHA_APP="$(sha256sum "$APPIMAGE" | cut -d' ' -f1)"
SHA_DESK="$(sha256sum "$DESKTOP" | cut -d' ' -f1)"

# Rewrite pkgver
sed -i -E "s/^pkgver=.*/pkgver=${VERSION}/" "$PKGBUILD"

# Rewrite sha256sums block (two entries: AppImage, desktop)
python3 - "$PKGBUILD" "$SHA_APP" "$SHA_DESK" <<'PY'
import pathlib, re, sys
path, sha_app, sha_desk = pathlib.Path(sys.argv[1]), sys.argv[2], sys.argv[3]
text = path.read_text(encoding="utf-8")
block = f"sha256sums=(\n  '{sha_app}'\n  '{sha_desk}'\n)"
text2, n = re.subn(r"sha256sums=\([\s\S]*?\)", block, text, count=1)
if n != 1:
    raise SystemExit("could not find sha256sums=(...) in PKGBUILD")
path.write_text(text2, encoding="utf-8")
print(f"updated {path} pkgver + sha256sums")
PY

# .SRCINFO
if command -v makepkg >/dev/null 2>&1; then
  (cd "$DIR" && makepkg --printsrcinfo > .SRCINFO)
else
  cat > "$DIR/.SRCINFO" <<EOF
pkgbase = tenling-bin
	pkgdesc = Calm, cross-platform Markdown viewer and editor
	pkgver = ${VERSION}
	pkgrel = 1
	url = https://github.com/SihanTeng/tenling
	arch = x86_64
	license = LicenseRef-Unknown
	depends = webkit2gtk-4.1
	depends = gtk3
	depends = libayatana-appindicator
	optdepends = xdg-utils: open links and file paths
	provides = tenling
	conflicts = tenling
	options = !strip
	options = !debug
	source = tenling-${VERSION}-linux-x64.AppImage::https://github.com/SihanTeng/tenling/releases/download/v${VERSION}/tenling-${VERSION}-linux-x64.AppImage
	source = tenling.desktop
	sha256sums = ${SHA_APP}
	sha256sums = ${SHA_DESK}

pkgname = tenling-bin
EOF
  echo "wrote $DIR/.SRCINFO (makepkg not installed; used template)"
fi

echo "AUR package ready at $DIR (tenling-bin ${VERSION})"
