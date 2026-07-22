#!/usr/bin/env bash
# Simple version bump script for md
#
# Usage:
#   npm run version          # normal bump (patch)
#   npm run version -- --major  # major bump
#   npm run version -- --minor  # minor bump
#
# This script:
#   1. Bumps version in package.json and src-tauri/tauri.conf.json
#   2. Creates a conventional commit + lightweight tag
#   3. Pushes the tag
#   4. Triggers the "Release installers" workflow

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

CURRENT_VERSION=$(jq -r '.version' package.json)
echo "Current version: $CURRENT_VERSION"

# Parse arguments
BUMP_TYPE="patch"
if [[ "${1:-}" == "--major" || "${2:-}" == "--major" ]]; then
  BUMP_TYPE="major"
elif [[ "${1:-}" == "--minor" || "${2:-}" == "--minor" ]]; then
  BUMP_TYPE="minor"
fi

echo "Bumping version to $BUMP_TYPE..."

# Bump version using npm version (updates package.json and creates tag)
if [[ "$BUMP_TYPE" == "major" ]]; then
  npm version major --no-git-tag-version
elif [[ "$BUMP_TYPE" == "minor" ]]; then
  npm version minor --no-git-tag-version
else
  npm version patch --no-git-tag-version
fi

# Get new version
NEW_VERSION=$(jq -r '.version' package.json)

# Update tauri.conf.json
jq --arg v "$NEW_VERSION" '.version = $v' src-tauri/tauri.conf.json > /tmp/tauri.conf.json.tmp && mv /tmp/tauri.conf.json.tmp src-tauri/tauri.conf.json

# Commit and push
git add package.json src-tauri/tauri.conf.json
git commit -m "chore(release): bump version to $NEW_VERSION"
git tag -a "v$NEW_VERSION" -m "Release $NEW_VERSION"

# Push + trigger workflow
git push origin main
git push origin "v$NEW_VERSION"

# Trigger the release workflow (GitHub Actions will create the release with artifacts)
gh run run -F release.yml

echo "✅ Version $NEW_VERSION bumped, tagged, pushed and release workflow triggered!"