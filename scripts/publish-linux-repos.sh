#!/usr/bin/env bash
# Build static APT + DNF repositories from release .deb / .rpm packages.
# Intended for GitHub Pages (no third-party account).
#
# Usage:
#   ./scripts/publish-linux-repos.sh <version> <assets-dir> <out-dir>
#
# Expects in assets-dir (canonical names):
#   tenling-{version}-linux-x64.deb
#   tenling-{version}-linux-x64.rpm
#
# Writes:
#   out-dir/apt/   — flat APT repo (Packages, Packages.gz, Release, *.deb)
#   out-dir/rpm/   — RPM repo (repodata/ + *.rpm)
#   out-dir/index.html — tiny landing page with enable instructions

set -euo pipefail

VERSION="${1:?usage: publish-linux-repos.sh <version> <assets-dir> <out-dir>}"
ASSETS="${2:?usage: publish-linux-repos.sh <version> <assets-dir> <out-dir>}"
OUT="${3:?usage: publish-linux-repos.sh <version> <assets-dir> <out-dir>}"

DEB="$ASSETS/tenling-${VERSION}-linux-x64.deb"
RPM="$ASSETS/tenling-${VERSION}-linux-x64.rpm"

[[ -d "$ASSETS" ]] || { echo "assets dir missing: $ASSETS" >&2; exit 1; }

mkdir -p "$OUT/apt" "$OUT/rpm"

if [[ -f "$DEB" ]]; then
  # Prefer Debian package name shape for apt clients; keep a stable copy name.
  cp -f "$DEB" "$OUT/apt/tenling_${VERSION}_amd64.deb"
  cp -f "$DEB" "$OUT/apt/tenling-${VERSION}-linux-x64.deb"
  (
    cd "$OUT/apt"
    if command -v dpkg-scanpackages >/dev/null 2>&1; then
      dpkg-scanpackages . /dev/null > Packages
    else
      # Minimal Packages stanza if dpkg-dev is unavailable (CI installs it).
      SIZE=$(stat -c%s "tenling_${VERSION}_amd64.deb")
      SHA256=$(sha256sum "tenling_${VERSION}_amd64.deb" | cut -d' ' -f1)
      MD5=$(md5sum "tenling_${VERSION}_amd64.deb" | cut -d' ' -f1)
      cat > Packages <<EOF
Package: tenling
Version: ${VERSION}
Architecture: amd64
Maintainer: TenLing contributors
Filename: ./tenling_${VERSION}_amd64.deb
Size: ${SIZE}
SHA256: ${SHA256}
MD5sum: ${MD5}
Section: editors
Priority: optional
Description: Calm Markdown viewer and editor
 A desktop Markdown viewer and editor with visual editing and present mode.
EOF
    fi
    gzip -9c Packages > Packages.gz
    # Unsigned repo — clients need [trusted=yes]
    cat > Release <<EOF
Origin: tenling
Label: tenling
Suite: stable
Codename: stable
Architectures: amd64
Components: main
Description: TenLing APT repository (GitHub Pages)
Date: $(date -Ru)
EOF
  )
  echo "APT repo ready: $OUT/apt"
else
  echo "warning: no deb at $DEB — APT tree will be empty/missing packages" >&2
fi

if [[ -f "$RPM" ]]; then
  cp -f "$RPM" "$OUT/rpm/tenling-${VERSION}-linux-x64.rpm"
  # Also a more DNF-friendly NEVRA-ish name
  cp -f "$RPM" "$OUT/rpm/tenling-${VERSION}-1.x86_64.rpm"
  if command -v createrepo_c >/dev/null 2>&1; then
    createrepo_c "$OUT/rpm"
  elif command -v createrepo >/dev/null 2>&1; then
    createrepo "$OUT/rpm"
  else
    echo "warning: createrepo(_c) not found — rpm/ lacks repodata (install createrepo_c in CI)" >&2
  fi
  echo "RPM repo ready: $OUT/rpm"
else
  echo "warning: no rpm at $RPM — RPM tree will be empty/missing packages" >&2
fi

PAGES_BASE="${PAGES_BASE:-https://sihanteng.github.io/tenling}"

# Use a delimiter that cannot appear inside the HTML (inner dnf snippet uses EOF).
cat > "$OUT/index.html" <<HTML_EOF
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>TenLing package repositories</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    code, pre { background: #f4f4f5; border-radius: 6px; }
    pre { padding: 0.75rem 1rem; overflow-x: auto; }
    code { padding: 0.1em 0.35em; }
    h1 { font-size: 1.5rem; }
  </style>
</head>
<body>
  <h1>TenLing package repositories</h1>
  <p>Static APT and DNF repos for <a href="https://github.com/SihanTeng/tenling">TenLing</a>, published from GitHub Releases (no third-party account). Current version: <strong>${VERSION}</strong>.</p>

  <h2>Debian / Ubuntu (APT)</h2>
  <pre>echo "deb [trusted=yes] ${PAGES_BASE}/apt ./" | sudo tee /etc/apt/sources.list.d/tenling.list
sudo apt update
sudo apt install tenling</pre>

  <h2>Fedora / RHEL (DNF)</h2>
  <pre>sudo tee /etc/yum.repos.d/tenling.repo &lt;&lt;'EOF'
[tenling]
name=TenLing
baseurl=${PAGES_BASE}/rpm
enabled=1
gpgcheck=0
EOF
sudo dnf install tenling</pre>

  <p><a href="${PAGES_BASE}/apt/">Browse APT</a> · <a href="${PAGES_BASE}/rpm/">Browse RPM</a> · <a href="https://github.com/SihanTeng/tenling/releases">All releases</a></p>
</body>
</html>
HTML_EOF

echo "Wrote $OUT/index.html"
