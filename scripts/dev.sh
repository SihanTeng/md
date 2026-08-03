#!/usr/bin/env bash
# Desktop dev app: `tauri dev` (native window + Vite hot reloading) with
# graceful shutdown. Usage: bun run dev:desktop   (or: bash scripts/dev.sh)
set -euo pipefail

cd "$(dirname "$0")/.."

cli_pid=""
shutting_down=""

# All PIDs below $1, deepest-first
descendants() {
  local kid
  for kid in $(pgrep -P "$1" 2>/dev/null); do
    descendants "$kid"
    echo "$kid"
  done
}

shutdown() {
  local sig="${1:-TERM}"
  [[ -n "$shutting_down" ]] && return
  shutting_down=1
  trap '' INT TERM
  if [[ -n "$cli_pid" ]] && kill -0 "$cli_pid" 2>/dev/null; then
    printf '\nShutting down desktop app…\n'
    # The CLI alone manages its app child, but only if it gets to clean up —
    # signal the whole tree (CLI, Vite, cargo, app) so nothing is orphaned
    local tree="$cli_pid $(descendants "$cli_pid")"
    kill -"$sig" $tree 2>/dev/null || true
    for _ in {1..50}; do
      kill -0 "$cli_pid" 2>/dev/null || break
      sleep 0.1
    done
    kill -KILL $tree 2>/dev/null || true
    wait "$cli_pid" 2>/dev/null || true
  fi
  exit 0
}

trap 'shutdown INT' INT
trap 'shutdown TERM' TERM

printf 'Starting md desktop app (tauri dev)… (Ctrl+C to stop)\n'

# The Tauri CLI runs in-process inside Node (NAPI), so signals to this PID
# reach the real CLI. It spawns Vite (beforeDevCommand) and cargo itself.
node_modules/.bin/tauri dev &
cli_pid=$!

# CLI exited on its own (build error, window closed): propagate its exit code
wait "$cli_pid"
