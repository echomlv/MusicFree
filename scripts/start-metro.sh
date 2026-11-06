#!/bin/sh

set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$PROJECT_ROOT"

# The npm package includes Intel/Apple Silicon binaries and needs no Homebrew.
# Catch skipped optional dependencies before Metro falls back to NodeWatcher,
# which can exhaust macOS file descriptors on a large dependency tree.
if [ "$(uname -s)" = "Darwin" ] && ! node -e 'require("fsevents")' >/dev/null 2>&1; then
    echo "Metro needs the npm fsevents package on macOS (Watchman is not required)." >&2
    echo "Run: npm install --include=optional" >&2
    exit 1
fi

# Metro uses its built-in watcher (see metro.config.js). NodeWatcher needs more
# descriptors than older macOS shells provide by default. Raise only the soft
# limit, trying smaller values if the OS/hard limit rejects the first choice.
CURRENT_FD_LIMIT=$(ulimit -S -n)
case "$CURRENT_FD_LIMIT" in
    unlimited) ;;
    *)
        for METRO_FD_LIMIT in 65536 32768 16384 8192 4096 2048 1024; do
            [ "$CURRENT_FD_LIMIT" -ge "$METRO_FD_LIMIT" ] && break
            if ulimit -S -n "$METRO_FD_LIMIT" 2>/dev/null; then
                break
            fi
        done
        ;;
esac

exec npx react-native start "$@"
