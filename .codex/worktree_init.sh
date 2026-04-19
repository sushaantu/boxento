#!/usr/bin/env bash
set -euo pipefail

if ! command -v bun >/dev/null 2>&1; then
  echo "bun is required but was not found on PATH." >&2
  exit 1
fi

bun install --frozen-lockfile

