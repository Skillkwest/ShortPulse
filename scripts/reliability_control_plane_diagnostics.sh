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

DB_HOST="$(
  python3 - <<'PY'
import os
from urllib.parse import urlparse

parsed = urlparse(os.environ.get("SUPABASE_DB_URL", ""))
print(parsed.hostname or "")
PY
)"

if [[ -n "$DB_HOST" && -n "$(command -v getent || true)" ]]; then
  DB_HOSTADDR="$(getent ahostsv4 "$DB_HOST" 2>/dev/null | awk 'NR == 1 { print $1 }' || true)"
  if [[ -n "$DB_HOSTADDR" ]]; then
    export PGHOSTADDR="$DB_HOSTADDR"
    echo "[reliability-diagnostics] Using IPv4 hostaddr for hosted DB connectivity."
  else
    echo "[reliability-diagnostics] IPv4 hostaddr lookup unavailable; using normal hostname resolution."
  fi
fi

if [[ "${GITHUB_ACTIONS:-}" == "true" && "$DB_HOST" == db.*.supabase.co && -z "${PGHOSTADDR:-}" ]]; then
  echo "[reliability-diagnostics] GitHub Actions cannot reach Supabase db.* hosts when they resolve to IPv6 only."
  echo "[reliability-diagnostics] Set the GitHub Environment SUPABASE_DB_URL to the Supavisor session pooler URL"
  echo "[reliability-diagnostics] (IPv4-compatible, port 5432), or enable the Supabase IPv4 add-on for this project."
  exit 1
fi

MODE="${RELIABILITY_DIAGNOSTICS_MODE:-warn}"
if [[ "$MODE" != "warn" && "$MODE" != "enforce" ]]; then
  echo "[reliability-diagnostics] Unknown mode '$MODE'. Allowed: warn, enforce."
  exit 1
fi

INCLUDE_ROW_DETAILS="${RELIABILITY_DIAGNOSTICS_INCLUDE_ROW_DETAILS:-false}"
if [[ "$INCLUDE_ROW_DETAILS" != "true" && "$INCLUDE_ROW_DETAILS" != "false" ]]; then
  echo "[reliability-diagnostics] Unknown RELIABILITY_DIAGNOSTICS_INCLUDE_ROW_DETAILS='$INCLUDE_ROW_DETAILS'. Allowed: true, false."
  exit 1
fi

SQL_FILES=(
  "$ROOT_DIR/sql/check_control_plane_scheduler_health.sql"
  "$ROOT_DIR/sql/check_pg_net_failure_taxonomy.sql"
  "$ROOT_DIR/sql/check_generation_queue_dispatch_latency.sql"
  "$ROOT_DIR/sql/check_generation_recovery_media_visible_latency.sql"
  "$ROOT_DIR/sql/check_generation_convergence_defect_classes.sql"
  "$ROOT_DIR/sql/check_runtime_sql_security_audit.sql"
  "$ROOT_DIR/sql/check_generation_settlement_integrity.sql"
  "$ROOT_DIR/sql/check_control_plane_enforce_gate.sql"
)

ROW_DETAIL_SQL_FILES=(
  "$ROOT_DIR/sql/check_generation_queue_dispatch_latency_row_details.sql"
  "$ROOT_DIR/sql/check_generation_recovery_media_visible_latency_row_details.sql"
)

mkdir -p "$LOG_DIR"
COMBINED_LOG="$LOG_DIR/combined.log"
: > "$COMBINED_LOG"

echo "[reliability-diagnostics] Writing logs to: $LOG_DIR"
echo "[reliability-diagnostics] Starting diagnostics run..."
echo "[reliability-diagnostics] Mode: $MODE"
echo "[reliability-diagnostics] Include row details: $INCLUDE_ROW_DETAILS"

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

if [[ "$INCLUDE_ROW_DETAILS" == "true" ]]; then
  echo "[reliability-diagnostics] Row-detail diagnostics are enabled; artifacts may include private row identifiers."
  for sql_file in "${ROW_DETAIL_SQL_FILES[@]}"; do
    run_sql_file "$sql_file"
  done
fi

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
    echo "- Include row details: \`$INCLUDE_ROW_DETAILS\`"
    echo "- Log directory: \`$LOG_DIR\`"
    echo "- Combined log: \`$COMBINED_LOG\`"
    echo "- SQL files:"
    echo "  - \`sql/check_control_plane_scheduler_health.sql\`"
    echo "  - \`sql/check_pg_net_failure_taxonomy.sql\`"
    echo "  - \`sql/check_generation_queue_dispatch_latency.sql\`"
    echo "  - \`sql/check_generation_recovery_media_visible_latency.sql\`"
    echo "  - \`sql/check_generation_convergence_defect_classes.sql\`"
    echo "  - \`sql/check_runtime_sql_security_audit.sql\`"
    echo "  - \`sql/check_generation_settlement_integrity.sql\`"
    echo "  - \`sql/check_control_plane_enforce_gate.sql\`"
    if [[ "$INCLUDE_ROW_DETAILS" == "true" ]]; then
      echo "  - \`sql/check_generation_queue_dispatch_latency_row_details.sql\`"
      echo "  - \`sql/check_generation_recovery_media_visible_latency_row_details.sql\`"
    fi
  } >> "$GITHUB_STEP_SUMMARY"
fi
