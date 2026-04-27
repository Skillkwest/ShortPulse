#!/usr/bin/env bash
# Guarded media derivative backlog replay runner.
# Runs optional before/after SQL diagnostics and repeatedly invokes
# /api/internal/media-derivatives/run until claims drain or a cycle cap is hit.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${MEDIA_DERIVATIVE_REPLAY_LOG_DIR:-/tmp/media_derivative_backlog_replay}"
MAX_CYCLES="${MEDIA_DERIVATIVE_REPLAY_MAX_CYCLES:-12}"
SLEEP_SECONDS="${MEDIA_DERIVATIVE_REPLAY_SLEEP_SECONDS:-1}"
RUN_URL="${SHORTPULSE_MEDIA_DERIVATIVES_RUN_URL:-}"
BASE_URL="${SHORTPULSE_BASE_URL:-}"
CRON_SECRET="${SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET:-${CRON_SECRET:-}}"
VERCEL_BYPASS_TOKEN="${SHORTPULSE_VERCEL_PROTECTION_BYPASS_TOKEN:-${VERCEL_AUTOMATION_BYPASS_TOKEN:-}}"
SUPABASE_DB_URL_VALUE="${SUPABASE_DB_URL:-}"
PSQL_BIN="$(command -v psql || true)"

if [[ -z "$PSQL_BIN" && -x "/opt/homebrew/opt/libpq/bin/psql" ]]; then
  PSQL_BIN="/opt/homebrew/opt/libpq/bin/psql"
fi

if [[ -z "$RUN_URL" ]]; then
  if [[ -z "$BASE_URL" ]]; then
    echo "[media-derivative-replay] Set SHORTPULSE_MEDIA_DERIVATIVES_RUN_URL or SHORTPULSE_BASE_URL."
    exit 1
  fi
  RUN_URL="${BASE_URL%/}/api/internal/media-derivatives/run"
fi

if [[ -z "$CRON_SECRET" ]]; then
  echo "[media-derivative-replay] SHORTPULSE_MEDIA_DERIVATIVES_CRON_SECRET or CRON_SECRET is required."
  exit 1
fi

if ! [[ "$MAX_CYCLES" =~ ^[0-9]+$ ]] || (( MAX_CYCLES < 1 )); then
  echo "[media-derivative-replay] MEDIA_DERIVATIVE_REPLAY_MAX_CYCLES must be a positive integer."
  exit 1
fi

if ! [[ "$SLEEP_SECONDS" =~ ^[0-9]+$ ]] || (( SLEEP_SECONDS < 0 )); then
  echo "[media-derivative-replay] MEDIA_DERIVATIVE_REPLAY_SLEEP_SECONDS must be a non-negative integer."
  exit 1
fi

if [[ -n "$SUPABASE_DB_URL_VALUE" && -z "$PSQL_BIN" ]]; then
  echo "[media-derivative-replay] SUPABASE_DB_URL is set but psql is unavailable."
  echo "[media-derivative-replay] Install libpq or unset SUPABASE_DB_URL to skip SQL diagnostics."
  exit 1
fi

mkdir -p "$LOG_DIR"
COMBINED_LOG="$LOG_DIR/combined.log"
: > "$COMBINED_LOG"

DIAGNOSTIC_SQL_FILES=(
  "$ROOT_DIR/sql/check_media_derivative_processing_backlog.sql"
  "$ROOT_DIR/sql/check_media_derivative_terminal_failures.sql"
)

run_sql_file() {
  local sql_file="$1"
  local phase="$2"
  local base_name
  base_name="$(basename "$sql_file" .sql)"
  local log_file="$LOG_DIR/${phase}_${base_name}.log"

  if [[ ! -f "$sql_file" ]]; then
    echo "[media-derivative-replay] Missing SQL file: $sql_file"
    exit 1
  fi

  {
    echo "===== BEGIN ${phase}:${base_name}.sql ====="
    "$PSQL_BIN" "$SUPABASE_DB_URL_VALUE" -v ON_ERROR_STOP=1 -f "$sql_file"
    echo "===== END ${phase}:${base_name}.sql ====="
  } 2>&1 | tee "$log_file" | tee -a "$COMBINED_LOG"
}

run_diagnostics() {
  local phase="$1"
  if [[ -z "$SUPABASE_DB_URL_VALUE" ]]; then
    echo "[media-derivative-replay] Skipping ${phase} SQL diagnostics (SUPABASE_DB_URL not set)." \
      | tee -a "$COMBINED_LOG"
    return
  fi

  for sql_file in "${DIAGNOSTIC_SQL_FILES[@]}"; do
    run_sql_file "$sql_file" "$phase"
  done
}

build_run_url() {
  if [[ -z "$VERCEL_BYPASS_TOKEN" ]]; then
    printf '%s' "$RUN_URL"
    return
  fi

  node -e '
    const runUrl = process.argv[1];
    const bypassToken = process.argv[2];
    const url = new URL(runUrl);
    url.searchParams.set("x-vercel-protection-bypass", bypassToken);
    process.stdout.write(url.toString());
  ' "$RUN_URL" "$VERCEL_BYPASS_TOKEN"
}

invoke_worker() {
  local cycle="$1"
  local request_url
  request_url="$(build_run_url)"
  local response_file="$LOG_DIR/run_cycle_${cycle}.json"
  local status_file="$LOG_DIR/run_cycle_${cycle}.status"

  echo "[media-derivative-replay] Triggering cycle ${cycle}/${MAX_CYCLES}..." | tee -a "$COMBINED_LOG"

  curl \
    --silent \
    --show-error \
    --output "$response_file" \
    --write-out '%{http_code}' \
    -X POST \
    -H "x-shortpulse-cron-secret: ${CRON_SECRET}" \
    -H "x-shortpulse-trigger-source: manual" \
    "$request_url" > "$status_file"

  local http_status
  http_status="$(cat "$status_file")"
  local response_body
  response_body="$(cat "$response_file")"

  echo "===== BEGIN run_cycle_${cycle}.json (HTTP ${http_status}) =====" | tee -a "$COMBINED_LOG"
  cat "$response_file" | tee -a "$COMBINED_LOG"
  printf '\n' | tee -a "$COMBINED_LOG"
  echo "===== END run_cycle_${cycle}.json =====" | tee -a "$COMBINED_LOG"

  if [[ "$http_status" != "200" ]]; then
    echo "[media-derivative-replay] Worker run failed with HTTP ${http_status}." | tee -a "$COMBINED_LOG"
    exit 1
  fi

  node -e '
    const payload = JSON.parse(process.argv[1]);
    if (!payload || payload.ok !== true) {
      throw new Error("Worker response did not return ok=true.");
    }
    const claimed = Number(payload.claimed ?? 0);
    const processed = Number(payload.processed ?? 0);
    const ready = Number(payload.ready ?? 0);
    const failed = Number(payload.failed ?? 0);
    const retryScheduled = Number(payload.retryScheduled ?? 0);
    const exhausted = Number(payload.exhausted ?? 0);
    const errors = Number(payload.errors ?? 0);
    const summary = [
      `claimed=${claimed}`,
      `processed=${processed}`,
      `ready=${ready}`,
      `failed=${failed}`,
      `retryScheduled=${retryScheduled}`,
      `exhausted=${exhausted}`,
      `errors=${errors}`,
    ];
    if (typeof payload.triggerSource === "string" && payload.triggerSource.trim().length > 0) {
      summary.unshift(`triggerSource=${payload.triggerSource.trim()}`);
    }
    if (typeof payload.durationMs === "number" && Number.isFinite(payload.durationMs)) {
      summary.unshift(`durationMs=${payload.durationMs}`);
    }
    console.log(summary.join(" "));
    process.stdout.write(JSON.stringify({ claimed, processed }));
  ' "$response_body" > "$LOG_DIR/run_cycle_${cycle}.parsed"

  local summary_line
  summary_line="$(head -n 1 "$LOG_DIR/run_cycle_${cycle}.parsed")"
  echo "[media-derivative-replay] ${summary_line}" | tee -a "$COMBINED_LOG"

  local control_json
  control_json="$(tail -n 1 "$LOG_DIR/run_cycle_${cycle}.parsed")"
  local claimed
  claimed="$(node -e 'const parsed = JSON.parse(process.argv[1]); process.stdout.write(String(parsed.claimed));' "$control_json")"
  local processed
  processed="$(node -e 'const parsed = JSON.parse(process.argv[1]); process.stdout.write(String(parsed.processed));' "$control_json")"

  if (( claimed == 0 )) || (( processed == 0 )); then
    echo "[media-derivative-replay] Drain condition met after cycle ${cycle}." | tee -a "$COMBINED_LOG"
    return 1
  fi

  return 0
}

echo "[media-derivative-replay] Writing logs to: $LOG_DIR"
echo "[media-derivative-replay] Run URL: $RUN_URL"
echo "[media-derivative-replay] Max cycles: $MAX_CYCLES"
echo "[media-derivative-replay] Sleep seconds: $SLEEP_SECONDS"
echo "[media-derivative-replay] SQL diagnostics: $([[ -n "$SUPABASE_DB_URL_VALUE" ]] && echo enabled || echo skipped)"

run_diagnostics "before"

for (( cycle=1; cycle<=MAX_CYCLES; cycle++ )); do
  if ! invoke_worker "$cycle"; then
    break
  fi
  if (( cycle < MAX_CYCLES && SLEEP_SECONDS > 0 )); then
    sleep "$SLEEP_SECONDS"
  fi
done

run_diagnostics "after"

echo "[media-derivative-replay] Completed."
echo "[media-derivative-replay] Combined log: $COMBINED_LOG"
