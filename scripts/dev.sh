#!/usr/bin/env bash
# Desktop dev: native window + Vite HMR.
#
#   bun run dev          # preferred
#   bun run dev:desktop  # same
#   bash scripts/dev.sh
#
# Stack:
#   tauri dev
#     ├─ beforeDevCommand → `bun run dev:web` (Vite on http://localhost:1520, HMR)
#     └─ cargo run        → native shell loading that URL
#
# Frontend file changes hot-reload. Rust changes recompile and restart the app.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -x node_modules/.bin/tauri ]]; then
  echo "error: Tauri CLI missing — run: bun install" >&2
  exit 1
fi

cli_pid=""
shutting_down=""

descendants() {
  local kid
  for kid in $(pgrep -P "$1" 2>/dev/null || true); do
    descendants "$kid"
    echo "$kid"
  done
}

shutdown() {
  local sig="${1:-TERM}"
  [[ -n "$shutting_down" ]] && return 0
  shutting_down=1
  trap '' INT TERM
  if [[ -n "$cli_pid" ]] && kill -0 "$cli_pid" 2>/dev/null; then
    printf '\nShutting down desktop app…\n'
    local tree
    tree="$cli_pid $(descendants "$cli_pid")"
    # shellcheck disable=SC2086
    kill -"$sig" $tree 2>/dev/null || true
    for _ in {1..50}; do
      kill -0 "$cli_pid" 2>/dev/null || break
      sleep 0.1
    done
    # shellcheck disable=SC2086
    kill -KILL $tree 2>/dev/null || true
    wait "$cli_pid" 2>/dev/null || true
  fi
  exit 0
}

trap 'shutdown INT' INT
trap 'shutdown TERM' TERM

printf 'Starting TenLing desktop (tauri dev + Vite HMR on :1520)… Ctrl+C to stop\n'

# Run in background so this script owns the process tree for clean Ctrl+C.
# Do not use a subshell — we need the real CLI PID for descendants().
node_modules/.bin/tauri dev &
cli_pid=$!

set +e
wait "$cli_pid"
code=$?
set -e

# If we initiated shutdown, trap already exited 0.
[[ -n "$shutting_down" ]] && exit 0
exit "$code"
