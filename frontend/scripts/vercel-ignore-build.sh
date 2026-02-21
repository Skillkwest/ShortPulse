#!/usr/bin/env bash
set -euo pipefail

echo "[vercel-ignore] env=${VERCEL_ENV:-unknown} ref=${VERCEL_GIT_COMMIT_REF:-unknown}"

# Always build production deployments.
if [[ "${VERCEL_ENV:-}" == "production" ]]; then
  echo "[vercel-ignore] production deployment detected; continue build."
  exit 1
fi

# Build when git metadata is unavailable (fail-open to avoid false skips).
if ! git rev-parse --verify HEAD >/dev/null 2>&1; then
  echo "[vercel-ignore] missing git HEAD; continue build."
  exit 1
fi

# Build on first-commit/shallow states where parent is not available.
if ! git rev-parse --verify HEAD^ >/dev/null 2>&1; then
  echo "[vercel-ignore] missing parent commit; continue build."
  exit 1
fi

# Run build only when files inside the Vercel project root (frontend/) changed.
# Script runs from frontend/ as project root.
if git diff --quiet HEAD^ HEAD -- .; then
  echo "[vercel-ignore] no frontend changes detected; skip deployment."
  exit 0
fi

echo "[vercel-ignore] frontend changes detected; continue build."
exit 1
