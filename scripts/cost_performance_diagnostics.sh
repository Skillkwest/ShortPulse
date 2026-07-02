#!/usr/bin/env bash
# Cost/performance diagnostics runner (read-only).
# Executes aggregate SQL checks against a hosted Supabase target.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${COST_PERFORMANCE_DIAGNOSTICS_LOG_DIR:-/tmp/cost_performance_diagnostics}"
PSQL_BIN="$(command -v psql || true)"

if [[ -z "$PSQL_BIN" && -x "/opt/homebrew/opt/libpq/bin/psql" ]]; then
  PSQL_BIN="/opt/homebrew/opt/libpq/bin/psql"
fi

if [[ -z "$PSQL_BIN" ]]; then
  echo "[cost-performance-diagnostics] psql is required but not found in PATH."
  echo "[cost-performance-diagnostics] On macOS with Homebrew:"
  echo "[cost-performance-diagnostics]   brew install libpq"
  echo "[cost-performance-diagnostics]   export PATH=\"/opt/homebrew/opt/libpq/bin:\$PATH\""
  exit 1
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "[cost-performance-diagnostics] SUPABASE_DB_URL is required."
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
    echo "[cost-performance-diagnostics] Using IPv4 hostaddr for hosted DB connectivity."
  else
    echo "[cost-performance-diagnostics] IPv4 hostaddr lookup unavailable; using normal hostname resolution."
  fi
fi

if [[ "${GITHUB_ACTIONS:-}" == "true" && "$DB_HOST" == db.*.supabase.co && -z "${PGHOSTADDR:-}" ]]; then
  echo "[cost-performance-diagnostics] GitHub Actions cannot reach Supabase db.* hosts when they resolve to IPv6 only."
  echo "[cost-performance-diagnostics] Set the GitHub Environment SUPABASE_DB_URL to the Supavisor session pooler URL"
  echo "[cost-performance-diagnostics] (IPv4-compatible, port 5432), or enable the Supabase IPv4 add-on for this project."
  exit 1
fi

MODE="${COST_PERFORMANCE_DIAGNOSTICS_MODE:-warn}"
if [[ "$MODE" != "warn" && "$MODE" != "enforce" ]]; then
  echo "[cost-performance-diagnostics] Unknown mode '$MODE'. Allowed: warn, enforce."
  exit 1
fi

SQL_FILES=(
  "$ROOT_DIR/sql/check_database_io_hotspots.sql"
  "$ROOT_DIR/sql/check_database_egress_query_stats.sql"
  "$ROOT_DIR/sql/check_postgrest_payload_projection_risk.sql"
  "$ROOT_DIR/sql/check_storage_object_egress_risk_breakdown.sql"
  "$ROOT_DIR/sql/check_media_storage_lifecycle_summary.sql"
  "$ROOT_DIR/sql/check_scheduler_egress_activity.sql"
  "$ROOT_DIR/sql/check_media_preview_variant_coverage_and_size.sql"
  "$ROOT_DIR/sql/check_media_derivative_processing_backlog.sql"
  "$ROOT_DIR/sql/check_media_derivative_terminal_failures.sql"
)

mkdir -p "$LOG_DIR"
COMBINED_LOG="$LOG_DIR/combined.log"
: > "$COMBINED_LOG"

echo "[cost-performance-diagnostics] Writing logs to: $LOG_DIR"
echo "[cost-performance-diagnostics] Starting diagnostics run..."
echo "[cost-performance-diagnostics] Mode: $MODE"
echo "[cost-performance-diagnostics] Cleanup manifests are intentionally excluded from hosted artifacts."

run_sql_file() {
  local sql_file="$1"
  local base_name
  base_name="$(basename "$sql_file" .sql)"
  local log_file="$LOG_DIR/${base_name}.log"

  if [[ ! -f "$sql_file" ]]; then
    echo "[cost-performance-diagnostics] Missing SQL file: $sql_file"
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

echo "[cost-performance-diagnostics] Completed successfully."
echo "[cost-performance-diagnostics] Combined log: $COMBINED_LOG"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  {
    echo "## Cost Performance Diagnostics"
    echo ""
    echo "- Status: PASS (SQL execution)"
    echo "- Mode: \`$MODE\`"
    echo "- Log directory: \`$LOG_DIR\`"
    echo "- Combined log: \`$COMBINED_LOG\`"
    echo "- Cleanup manifest: excluded from hosted artifacts"
    echo "- SQL files:"
    echo "  - \`sql/check_database_io_hotspots.sql\`"
    echo "  - \`sql/check_database_egress_query_stats.sql\`"
    echo "  - \`sql/check_postgrest_payload_projection_risk.sql\`"
    echo "  - \`sql/check_storage_object_egress_risk_breakdown.sql\`"
    echo "  - \`sql/check_media_storage_lifecycle_summary.sql\`"
    echo "  - \`sql/check_scheduler_egress_activity.sql\`"
    echo "  - \`sql/check_media_preview_variant_coverage_and_size.sql\`"
    echo "  - \`sql/check_media_derivative_processing_backlog.sql\`"
    echo "  - \`sql/check_media_derivative_terminal_failures.sql\`"
  } >> "$GITHUB_STEP_SUMMARY"
fi
