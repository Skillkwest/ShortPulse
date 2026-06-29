#!/usr/bin/env bash
# Purpose: provide a supported bulk object transfer path between Supabase projects via S3.
# Responsibilities: build a temporary rclone config from local operator env, then run
# bucket-level copy/check/size commands without storing long-lived S3 credentials in-repo.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/supabase_storage_rclone_sync.sh --bucket <bucket> [options]

Options:
  --bucket <name>             Bucket to operate on. Required for copy/check/size.
  --mode <copy|check|size>    Default: size
  --transfers <n>             Default: 4
  --checkers <n>              Default: 8
  --timeout <duration>        Default: 30m
  --size-only                 Use size-only verification for `check` (default on).
  --full-check                Disable --size-only for `check`.
  --dry-run                   Pass --dry-run to rclone.
  --apply                     Required for mutating copy operations unless --dry-run is set.
  --help                      Show this message.

Required env:
  SHORTPULSE_STAGING_S3_ENDPOINT
  SHORTPULSE_STAGING_S3_REGION
  SHORTPULSE_STAGING_S3_ACCESS_KEY_ID
  SHORTPULSE_STAGING_S3_SECRET_ACCESS_KEY
  SHORTPULSE_PRODUCTION_S3_ENDPOINT
  SHORTPULSE_PRODUCTION_S3_REGION
  SHORTPULSE_PRODUCTION_S3_ACCESS_KEY_ID
  SHORTPULSE_PRODUCTION_S3_SECRET_ACCESS_KEY

Notes:
  - Use the direct storage hostname endpoints ending in `/storage/v1/s3`.
  - This wrapper keeps credentials in a temp rclone config and removes it on exit.
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[nuclo-rclone-sync] missing required command: $1" >&2
    exit 1
  }
}

require_env() {
  local name="$1"
  if [[ -z "${!name:-}" ]]; then
    echo "[nuclo-rclone-sync] missing required env: $name" >&2
    exit 1
  fi
}

BUCKET=""
MODE="size"
TRANSFERS="4"
CHECKERS="8"
TIMEOUT="30m"
DRY_RUN="false"
SIZE_ONLY="true"
APPLY="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bucket)
      BUCKET="${2:-}"
      shift 2
      ;;
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --transfers)
      TRANSFERS="${2:-}"
      shift 2
      ;;
    --checkers)
      CHECKERS="${2:-}"
      shift 2
      ;;
    --timeout)
      TIMEOUT="${2:-}"
      shift 2
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --apply)
      APPLY="true"
      shift
      ;;
    --size-only)
      SIZE_ONLY="true"
      shift
      ;;
    --full-check)
      SIZE_ONLY="false"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[nuclo-rclone-sync] unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

case "$MODE" in
  copy|check|size) ;;
  *)
    echo "[nuclo-rclone-sync] unsupported mode: $MODE" >&2
    exit 1
    ;;
esac

if [[ -z "$BUCKET" ]]; then
  echo "[nuclo-rclone-sync] --bucket is required." >&2
  exit 1
fi

if [[ "$MODE" == "copy" && "$DRY_RUN" != "true" && "$APPLY" != "true" ]]; then
  echo "[nuclo-rclone-sync] refusing to copy objects without explicit --apply or --dry-run." >&2
  usage >&2
  exit 1
fi

require_command rclone

for key in \
  SHORTPULSE_STAGING_S3_ENDPOINT \
  SHORTPULSE_STAGING_S3_REGION \
  SHORTPULSE_STAGING_S3_ACCESS_KEY_ID \
  SHORTPULSE_STAGING_S3_SECRET_ACCESS_KEY \
  SHORTPULSE_PRODUCTION_S3_ENDPOINT \
  SHORTPULSE_PRODUCTION_S3_REGION \
  SHORTPULSE_PRODUCTION_S3_ACCESS_KEY_ID \
  SHORTPULSE_PRODUCTION_S3_SECRET_ACCESS_KEY
do
  require_env "$key"
done

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

RCLONE_CONFIG_PATH="$TMP_DIR/rclone.conf"
cat > "$RCLONE_CONFIG_PATH" <<EOF
[staging]
type = s3
provider = Other
access_key_id = ${SHORTPULSE_STAGING_S3_ACCESS_KEY_ID}
secret_access_key = ${SHORTPULSE_STAGING_S3_SECRET_ACCESS_KEY}
endpoint = ${SHORTPULSE_STAGING_S3_ENDPOINT}
region = ${SHORTPULSE_STAGING_S3_REGION}
force_path_style = true
env_auth = false

[production]
type = s3
provider = Other
access_key_id = ${SHORTPULSE_PRODUCTION_S3_ACCESS_KEY_ID}
secret_access_key = ${SHORTPULSE_PRODUCTION_S3_SECRET_ACCESS_KEY}
endpoint = ${SHORTPULSE_PRODUCTION_S3_ENDPOINT}
region = ${SHORTPULSE_PRODUCTION_S3_REGION}
force_path_style = true
env_auth = false
EOF

COMMON_ARGS=(--config "$RCLONE_CONFIG_PATH" --progress --transfers "$TRANSFERS" --checkers "$CHECKERS" --timeout "$TIMEOUT")
if [[ "$DRY_RUN" == "true" ]]; then
  COMMON_ARGS+=(--dry-run)
fi

SOURCE_REMOTE="staging:${BUCKET}"
TARGET_REMOTE="production:${BUCKET}"

echo "[nuclo-rclone-sync] mode=$MODE bucket=$BUCKET transfers=$TRANSFERS checkers=$CHECKERS timeout=$TIMEOUT dry_run=$DRY_RUN apply=$APPLY"
echo "[nuclo-rclone-sync] source=staging target=production"

case "$MODE" in
  copy)
    exec rclone copy "$SOURCE_REMOTE" "$TARGET_REMOTE" "${COMMON_ARGS[@]}"
    ;;
  check)
    CHECK_ARGS=("${COMMON_ARGS[@]}")
    if [[ "$SIZE_ONLY" == "true" ]]; then
      CHECK_ARGS+=(--size-only)
    fi
    exec rclone check "$SOURCE_REMOTE" "$TARGET_REMOTE" "${CHECK_ARGS[@]}"
    ;;
  size)
    echo "[nuclo-rclone-sync] staging size"
    rclone size "$SOURCE_REMOTE" --config "$RCLONE_CONFIG_PATH"
    echo "[nuclo-rclone-sync] production size"
    exec rclone size "$TARGET_REMOTE" --config "$RCLONE_CONFIG_PATH"
    ;;
esac
