#!/usr/bin/env bash
# Generation pipeline Lane 2 baseline runner (read-only).
# Executes the fixed historical backfill baseline SQL against a hosted Supabase target.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${GENERATION_BACKFILL_BASELINE_LOG_DIR:-/tmp/generation_pipeline_backfill_baseline}"
PSQL_BIN="$(command -v psql || true)"

if [[ -z "$PSQL_BIN" && -x "/opt/homebrew/opt/libpq/bin/psql" ]]; then
  PSQL_BIN="/opt/homebrew/opt/libpq/bin/psql"
fi

if [[ -z "$PSQL_BIN" ]]; then
  echo "[generation-backfill-baseline] psql is required but not found in PATH."
  echo "[generation-backfill-baseline] On macOS with Homebrew:"
  echo "[generation-backfill-baseline]   brew install libpq"
  echo "[generation-backfill-baseline]   export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\""
  exit 1
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "[generation-backfill-baseline] SUPABASE_DB_URL is required."
  exit 1
fi

SQL_FILE="$ROOT_DIR/sql/check_generation_pipeline_backfill_baseline.sql"

if [[ ! -f "$SQL_FILE" ]]; then
  echo "[generation-backfill-baseline] Missing SQL file: $SQL_FILE"
  exit 1
fi

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/check_generation_pipeline_backfill_baseline.log"

echo "[generation-backfill-baseline] Writing logs to: $LOG_DIR"
echo "[generation-backfill-baseline] Starting baseline run..."

{
  echo "===== BEGIN check_generation_pipeline_backfill_baseline.sql ====="
  "$PSQL_BIN" "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE"
  echo "===== END check_generation_pipeline_backfill_baseline.sql ====="
} 2>&1 | tee "$LOG_FILE"

echo "[generation-backfill-baseline] Completed successfully."
echo "[generation-backfill-baseline] Log file: $LOG_FILE"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "## Generation Pipeline Backfill Baseline"
    echo ""
    echo "- Status: PASS"
    echo "- Log directory: \`$LOG_DIR\`"
    echo "- Log file: \`$LOG_FILE\`"
    echo "- SQL file: \`sql/check_generation_pipeline_backfill_baseline.sql\`"
  } >> "$GITHUB_STEP_SUMMARY"
fi
