#!/usr/bin/env bash
# Purpose: run the standard post-rotation validation sequence for ShortPulse runtime secrets.
# Responsibilities: verify env contract, route parity, homepage reachability, and protected
# internal-route runtime posture after staging/production secret replacement.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/secret_rotation_validate.sh [options]

Options:
  --production-url <url>      Production base URL. Default: https://www.shortpulse.ai
  --preview-url <url>         Preview/staging URL. Default: SHORTPULSE_STAGING_BASE_URL
  --skip-docs-check           Skip npm -C frontend run docs:check
  --skip-env-contract         Skip node scripts/check_vercel_env_contract.mjs --environment development --environment preview --environment production
  --skip-preview-parity       Skip preview deployment route parity
  --skip-production-parity    Skip production deployment route parity
  --skip-runtime-probes       Skip preview/production internal runtime probes
  --help                      Show this message.

Notes:
  - Route parity uses authenticated vercel CLI state by default and still accepts token env overrides.
  - Preview parity defaults to SHORTPULSE_STAGING_BASE_URL; pass --skip-preview-parity only when preview validation is intentionally out of scope.
  - Internal runtime probes verify both fail-closed 401 without auth and 200 with the configured cron secrets.
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[secret-rotation-validate] missing required command: $1" >&2
    exit 1
  }
}

PRODUCTION_URL="https://www.shortpulse.ai"
PREVIEW_URL="${SHORTPULSE_STAGING_BASE_URL:-}"
RUN_DOCS_CHECK=1
RUN_ENV_CONTRACT=1
RUN_PREVIEW_PARITY=1
RUN_PRODUCTION_PARITY=1
RUN_RUNTIME_PROBES=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --production-url)
      PRODUCTION_URL="${2:-}"
      shift 2
      ;;
    --preview-url)
      PREVIEW_URL="${2:-}"
      shift 2
      ;;
    --skip-docs-check)
      RUN_DOCS_CHECK=0
      shift
      ;;
    --skip-env-contract)
      RUN_ENV_CONTRACT=0
      shift
      ;;
    --skip-preview-parity)
      RUN_PREVIEW_PARITY=0
      shift
      ;;
    --skip-production-parity)
      RUN_PRODUCTION_PARITY=0
      shift
      ;;
    --skip-runtime-probes)
      RUN_RUNTIME_PROBES=0
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[secret-rotation-validate] unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

require_command node
require_command curl

if [[ "$RUN_DOCS_CHECK" -eq 1 ]]; then
  echo "[secret-rotation-validate] docs check"
  npm -C frontend run docs:check
fi

if [[ "$RUN_ENV_CONTRACT" -eq 1 ]]; then
  echo "[secret-rotation-validate] env contract audit"
  node scripts/check_vercel_env_contract.mjs --environment development --environment preview --environment production
fi

if [[ "$RUN_PREVIEW_PARITY" -eq 1 ]]; then
  if [[ -z "$PREVIEW_URL" ]]; then
    echo "[secret-rotation-validate] preview parity requires --preview-url or SHORTPULSE_STAGING_BASE_URL, or use --skip-preview-parity intentionally" >&2
    exit 1
  fi
  echo "[secret-rotation-validate] preview deployment route parity"
  node scripts/verify_deployment_route_parity.mjs --base-url "$PREVIEW_URL"
fi

if [[ "$RUN_PRODUCTION_PARITY" -eq 1 ]]; then
  echo "[secret-rotation-validate] production deployment route parity"
  node scripts/verify_deployment_route_parity.mjs --base-url "$PRODUCTION_URL"
fi

if [[ "$RUN_RUNTIME_PROBES" -eq 1 ]]; then
  echo "[secret-rotation-validate] production runtime probes"

  homepage_code="$(curl -s -o /dev/null -w '%{http_code}' "$PRODUCTION_URL/")"
  if [[ "$homepage_code" != "200" ]]; then
    echo "[secret-rotation-validate] expected homepage 200, got $homepage_code" >&2
    exit 1
  fi
  echo "  homepage=$homepage_code"

  if [[ "$RUN_PREVIEW_PARITY" -eq 1 ]]; then
    echo "[secret-rotation-validate] preview protected-route runtime"
    node scripts/verify_internal_route_runtime.mjs --base-url "$PREVIEW_URL"
  fi

  echo "[secret-rotation-validate] production protected-route runtime"
  node scripts/verify_internal_route_runtime.mjs --base-url "$PRODUCTION_URL"
fi

echo "[secret-rotation-validate] PASS"
