#!/bin/sh

set -eu

PROJECT_ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

if ! command -v watchman >/dev/null 2>&1; then
    echo "Watchman is required to run Metro for MusicFree." >&2
    echo "Install it with: brew install watchman" >&2
    exit 1
fi

# Give Metro enough descriptors when the shell inherited macOS's default limit.
CURRENT_FD_LIMIT=$(ulimit -n)
if [ "$CURRENT_FD_LIMIT" -lt 65536 ] 2>/dev/null; then
    ulimit -n 65536 2>/dev/null || true
fi

# Recreate the project watch so stale fsevents roots do not force Metro onto NodeWatcher.
watchman watch-del "$PROJECT_ROOT" >/dev/null 2>&1 || true
watchman watch-project "$PROJECT_ROOT" >/dev/null

cd "$PROJECT_ROOT"
exec npx react-native start "$@"
