#!/bin/sh
set -eu

if [ -z "${APP:-}" ]; then
	echo "error: APP environment variable is required. One of: ${APPS}" >&2
	exit 1
fi

export HOST="${HOST:-0.0.0.0}"

exec pnpm run "app:${APP}:serve"
