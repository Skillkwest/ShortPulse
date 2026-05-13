#!/usr/bin/env bash
# Purpose: provide a convenient Nuclo entrypoint for the shared Vercel env contract audit.
# Responsibilities: run the existing node-based contract check with sane ShortPulse defaults
# for development, staging preview, and production, while still allowing explicit environment overrides.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/vercel_env_audit.sh [options]

Options:
  --token <token>             Optional Vercel token override.
                              Not required when the local `vercel` CLI session is already authenticated.
  --environment <name>        Repeatable. development | preview | production
  --preview-branch <name>     Preview branch to audit when preview is included.
                              Default: staging-preview
  --development-only          Shortcut for --environment development
  --preview-only              Shortcut for --environment preview
  --production-only           Shortcut for --environment production
  --help                      Show this message.

Env fallbacks:
  SHORTPULSE_VERCEL_API_TOKEN
  VERCEL_API_TOKEN
  SHORTPULSE_VERCEL_PREVIEW_BRANCH (default staging-preview)

Default environments:
  development + preview + production
EOF
}

TOKEN_ARG=""
PREVIEW_BRANCH="${SHORTPULSE_VERCEL_PREVIEW_BRANCH:-staging-preview}"
ENVIRONMENTS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --token)
      TOKEN_ARG="--token ${2:-}"
      shift 2
      ;;
    --environment)
      ENVIRONMENTS+=("${2:-}")
      shift 2
      ;;
    --preview-branch)
      PREVIEW_BRANCH="${2:-}"
      shift 2
      ;;
    --development-only)
      ENVIRONMENTS=("development")
      shift
      ;;
    --preview-only)
      ENVIRONMENTS=("preview")
      shift
      ;;
    --production-only)
      ENVIRONMENTS=("production")
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[nuclo-vercel-audit] unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "${#ENVIRONMENTS[@]}" -eq 0 ]]; then
  ENVIRONMENTS=("development" "preview" "production")
fi

ARGS=()
for environment in "${ENVIRONMENTS[@]}"; do
  ARGS+=(--environment "$environment")
done
if [[ " ${ENVIRONMENTS[*]} " == *" preview "* ]]; then
  ARGS+=(--git-branch "$PREVIEW_BRANCH")
fi
if [[ -n "$TOKEN_ARG" ]]; then
  # shellcheck disable=SC2206
  token_parts=($TOKEN_ARG)
  ARGS+=("${token_parts[@]}")
fi

echo "[nuclo-vercel-audit] environments=${ENVIRONMENTS[*]} preview_branch=$PREVIEW_BRANCH"
node scripts/check_vercel_env_contract.mjs "${ARGS[@]}"
