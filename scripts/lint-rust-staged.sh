#!/usr/bin/env bash
# Lint/format staged Rust files. Invoked by lint-staged with staged
# .rs paths (relative to repo root) as arguments.
set -euo pipefail

files=("$@")
[ ${#files[@]} -eq 0 ] && exit 0

# Format the staged files and re-stage any changes
rustfmt --edition 2021 "${files[@]}"
git add "${files[@]}"

# Clippy can't lint single files, so check the whole crate
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
