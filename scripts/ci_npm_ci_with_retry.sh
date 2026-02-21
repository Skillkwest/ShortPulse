#!/usr/bin/env bash

set -euo pipefail

MAX_ATTEMPTS="${NPM_CI_MAX_ATTEMPTS:-3}"
if ! [[ "$MAX_ATTEMPTS" =~ ^[0-9]+$ ]] || [ "$MAX_ATTEMPTS" -lt 1 ]; then
  echo "NPM_CI_MAX_ATTEMPTS must be a positive integer; got '$MAX_ATTEMPTS'" >&2
  exit 2
fi

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  echo "npm ci attempt ${attempt}/${MAX_ATTEMPTS}"
  log_file="$(mktemp)"

  set +e
  npm ci 2>&1 | tee "$log_file"
  status="${PIPESTATUS[0]}"
  set -e

  if [ "$status" -eq 0 ]; then
    rm -f "$log_file"
    exit 0
  fi

  if ! grep -Eiq "502 Bad Gateway|Proxy Error|EAI_AGAIN|ECONNRESET|ETIMEDOUT|socket hang up|ENOTFOUND|EHOSTUNREACH|incorrect header check|Z_DATA_ERROR|ECONNREFUSED" "$log_file"; then
    echo "npm ci failed with a non-transient error; not retrying." >&2
    rm -f "$log_file"
    exit "$status"
  fi

  rm -f "$log_file"

  if [ "$attempt" -ge "$MAX_ATTEMPTS" ]; then
    echo "npm ci failed after ${MAX_ATTEMPTS} attempts." >&2
    exit "$status"
  fi

  echo "Transient npm ci failure detected; cleaning cache and retrying..."
  rm -rf node_modules
  npm cache clean --force >/dev/null 2>&1 || true
  sleep "$((attempt * 5))"
  attempt="$((attempt + 1))"
done
