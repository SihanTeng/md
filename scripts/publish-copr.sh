#!/usr/bin/env bash
# Build an SRPM for TenLing and optionally submit it to Fedora COPR.
#
# Usage:
#   ./scripts/publish-copr.sh <version> <appimage-path> [--srpm-only]
#   ./scripts/publish-copr.sh <version> <appimage-path> [--project OWNER/NAME]
#
# Env:
#   DIST_COPR_CONFIG  — full contents of ~/.config/copr (see .github/SECRETS.md)
#   DIST_COPR_PROJECT — e.g. YourFedoraUser/tenling (or pass --project)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="${1:?usage: publish-copr.sh <version> <appimage-path> [--srpm-only] [--project OWNER/NAME]}"
APPIMAGE="${2:?usage: publish-copr.sh <version> <appimage-path> ...}"
shift 2

SRPM_ONLY=0
PROJECT="${DIST_COPR_PROJECT:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --srpm-only) SRPM_ONLY=1; shift ;;
    --project) PROJECT="${2:?}"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 1 ;;
  esac
done

[[ -f "$APPIMAGE" ]] || { echo "missing AppImage: $APPIMAGE" >&2; exit 1; }

command -v rpmbuild >/dev/null 2>&1 || {
  echo "rpmbuild required (dnf install rpm-build / apt install rpm)" >&2
  exit 1
}

"$ROOT/scripts/update-copr-spec.sh" "$VERSION"

SPEC="$ROOT/packaging/copr/tenling.spec"
DESKTOP="$ROOT/packaging/copr/tenling.desktop"
WORKDIR="${TMPDIR:-/tmp}/tenling-copr-$$"
mkdir -p "$WORKDIR"/{SOURCES,SPECS,SRPMS}
# shellcheck disable=SC2064
trap 'rm -rf "$WORKDIR"' EXIT

cp -f "$APPIMAGE" "$WORKDIR/SOURCES/tenling-${VERSION}-linux-x64.AppImage"
cp -f "$DESKTOP" "$WORKDIR/SOURCES/tenling.desktop"
cp -f "$SPEC" "$WORKDIR/SPECS/tenling.spec"

RPMSRC="$WORKDIR"
rpmbuild \
  --define "_topdir $RPMSRC" \
  --define "_sourcedir $RPMSRC/SOURCES" \
  --define "_specdir $RPMSRC/SPECS" \
  --define "_srcrpmdir $RPMSRC/SRPMS" \
  --define "_rpmdir $RPMSRC/RPMS" \
  --define "_builddir $RPMSRC/BUILD" \
  -bs "$RPMSRC/SPECS/tenling.spec"

SRPM="$(find "$RPMSRC/SRPMS" -name '*.src.rpm' | head -1)"
[[ -n "$SRPM" && -f "$SRPM" ]] || { echo "SRPM not produced" >&2; exit 1; }
echo "Built SRPM: $SRPM"

OUT_SRPM="$ROOT/packaging/copr/tenling-${VERSION}-1.src.rpm"
cp -f "$SRPM" "$OUT_SRPM"
echo "Copied to $OUT_SRPM"

if [[ "$SRPM_ONLY" -eq 1 ]]; then
  exit 0
fi

if [[ -z "$PROJECT" ]]; then
  echo "DIST_COPR_PROJECT not set and --project not passed; SRPM only." >&2
  exit 0
fi

if [[ -n "${DIST_COPR_CONFIG:-}" ]]; then
  mkdir -p "${HOME}/.config"
  printf '%s\n' "$DIST_COPR_CONFIG" > "${HOME}/.config/copr"
  chmod 600 "${HOME}/.config/copr"
fi

if [[ ! -f "${HOME}/.config/copr" ]]; then
  echo "missing ${HOME}/.config/copr — set DIST_COPR_CONFIG or create the file" >&2
  echo "Get a token at https://copr.fedorainfracloud.org/api/" >&2
  exit 1
fi

if ! command -v copr-cli >/dev/null 2>&1; then
  echo "copr-cli not found; install with: pip install copr-cli  OR  dnf install copr-cli" >&2
  exit 1
fi

echo "Submitting $SRPM to COPR project $PROJECT …"
copr-cli build "$PROJECT" "$SRPM"
echo "COPR build submitted for $PROJECT"
