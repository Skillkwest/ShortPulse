#!/usr/bin/env bash
# Reliability control-plane diagnostics runner (read-only).
# Executes canonical SQL checks against a hosted Supabase target.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${RELIABILITY_DIAGNOSTICS_LOG_DIR:-/tmp/reliability_control_plane_diagnostics}"
PSQL_BIN="$(command -v psql || true)"

if [[ -z "$PSQL_BIN" && -x "/opt/homebrew/opt/libpq/bin/psql" ]]; then
  PSQL_BIN="/opt/homebrew/opt/libpq/bin/psql"
fi

if [[ -z "$PSQL_BIN" ]]; then
  echo "[reliability-diagnostics] psql is required but not found in PATH."
  echo "[reliability-diagnostics] On macOS with Homebrew:"
  echo "[reliability-diagnostics]   brew install libpq"
  echo "[reliability-diagnostics]   export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\""
  exit 1
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "[reliability-diagnostics] SUPABASE_DB_URL is required."
  exit 1
fi

MODE="${RELIABILITY_DIAGNOSTICS_MODE:-warn}"
if [[ "$MODE" != "warn" && "$MODE" != "enforce" ]]; then
  echo "[reliability-diagnostics] Unknown mode '$MODE'. Allowed: warn, enforce."
  exit 1
fi

SQL_FILES=(
  "$ROOT_DIR/sql/check_control_plane_scheduler_health.sql"
  "$ROOT_DIR/sql/check_pg_net_failure_taxonomy.sql"
  "$ROOT_DIR/sql/check_runtime_sql_security_audit.sql"
  "$ROOT_DIR/sql/check_generation_settlement_integrity.sql"
  "$ROOT_DIR/sql/check_control_plane_enforce_gate.sql"
)

mkdir -p "$LOG_DIR"
COMBINED_LOG="$LOG_DIR/combined.log"
: > "$COMBINED_LOG"

echo "[reliability-diagnostics] Writing logs to: $LOG_DIR"
echo "[reliability-diagnostics] Starting diagnostics run..."
echo "[reliability-diagnostics] Mode: $MODE"

run_sql_file() {
  local sql_file="$1"
  local base_name
  base_name="$(basename "$sql_file" .sql)"
  local log_file="$LOG_DIR/${base_name}.log"

  if [[ ! -f "$sql_file" ]]; then
    echo "[reliability-diagnostics] Missing SQL file: $sql_file"
    exit 1
  fi

  {
    echo "===== BEGIN ${base_name}.sql ====="
    "$PSQL_BIN" "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$sql_file"
    echo "===== END ${base_name}.sql ====="
  } 2>&1 | tee "$log_file" | tee -a "$COMBINED_LOG"
}

for sql_file in "${SQL_FILES[@]}"; do
  run_sql_file "$sql_file"
done

if [[ "$MODE" == "enforce" ]]; then
  ENFORCE_LOG="$LOG_DIR/check_control_plane_enforce_gate_enforce.log"
  enforce_output="$(
    "$PSQL_BIN" "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -At \
      -f "$ROOT_DIR/sql/check_control_plane_enforce_gate.sql" \
      2>&1 | tee "$ENFORCE_LOG" | tee -a "$COMBINED_LOG"
  )"
  failing_count="$(
    printf '%s\n' "$enforce_output" \
      | awk '/^[0-9]+$/ { value=$1 } END { if (value != "") print value }'
  )"

  if [[ ! "$failing_count" =~ ^[0-9]+$ ]]; then
    echo "[reliability-diagnostics] Unable to parse enforce gate failure count."
    exit 1
  fi

  if (( failing_count > 0 )); then
    echo "[reliability-diagnostics] Enforce gate failed with failing_check_count=$failing_count"
    exit 1
  fi
fi

echo "[reliability-diagnostics] Completed successfully."
echo "[reliability-diagnostics] Combined log: $COMBINED_LOG"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "## Reliability Diagnostics"
    echo ""
    echo "- Status: PASS (SQL execution)"
    echo "- Mode: \`$MODE\`"
    echo "- Log directory: \`$LOG_DIR\`"
    echo "- Combined log: \`$COMBINED_LOG\`"
    echo "- SQL files:"
    echo "  - \`sql/check_control_plane_scheduler_health.sql\`"
    echo "  - \`sql/check_pg_net_failure_taxonomy.sql\`"
    echo "  - \`sql/check_runtime_sql_security_audit.sql\`"
    echo "  - \`sql/check_generation_settlement_integrity.sql\`"
    echo "  - \`sql/check_control_plane_enforce_gate.sql\`"
  } >> "$GITHUB_STEP_SUMMARY"
fi
