#!/usr/bin/env bash
# Repo sweep runner.
# Executes major CI-aligned checks in one pass and summarizes required/advisory failures.

set -u
set -o pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$ROOT_DIR/frontend"
LOG_DIR="${SWEEP_LOG_DIR:-$ROOT_DIR/.tmp/repo-sweep-$(date +%Y%m%d-%H%M%S)}"

# Optional gates (off by default to keep sweep focused on major local breakpoints).
RUN_ADAPTIVE_GATE="${RUN_ADAPTIVE_GATE:-1}"
RUN_SQL_LINT="${RUN_SQL_LINT:-0}"
RUN_E2E="${RUN_E2E:-0}"
RUN_AI_STUDIO_PERF_AUDIT="${RUN_AI_STUDIO_PERF_AUDIT:-0}"

if [[ ! -d "$FRONTEND_DIR" ]]; then
  echo "Missing frontend directory: $FRONTEND_DIR"
  exit 1
fi

mkdir -p "$LOG_DIR"

declare -a PASSED_STEPS=()
declare -a FAILED_STEPS=()
declare -a ADVISORY_FAILED_STEPS=()
declare -a SKIPPED_STEPS=()

STEP_INDEX=0

run_step() {
  local step_name="$1"
  local severity="$2"
  local cmd="$3"
  local log_file
  local start_ts
  local end_ts
  local elapsed
  local status

  STEP_INDEX=$((STEP_INDEX + 1))
  log_file="$LOG_DIR/$(printf '%02d' "$STEP_INDEX")-${step_name}.log"

  echo
  echo "[$STEP_INDEX] ${step_name} (${severity})"
  echo "cmd: $cmd"

  start_ts="$(date +%s)"
  (
    cd "$FRONTEND_DIR"
    bash -lc "$cmd"
  ) > >(tee "$log_file") 2>&1
  status="${PIPESTATUS[0]}"
  end_ts="$(date +%s)"
  elapsed="$((end_ts - start_ts))"

  if [[ "$status" -eq 0 ]]; then
    PASSED_STEPS+=("${step_name} (${elapsed}s)")
    echo "result: PASS (${elapsed}s)"
    return 0
  fi

  if [[ "$severity" == "advisory" ]]; then
    ADVISORY_FAILED_STEPS+=("${step_name} (exit ${status}, ${elapsed}s, log: ${log_file})")
    echo "result: ADVISORY FAIL (${elapsed}s)"
    return 0
  fi

  FAILED_STEPS+=("${step_name} (exit ${status}, ${elapsed}s, log: ${log_file})")
  echo "result: REQUIRED FAIL (${elapsed}s)"
  return 0
}

skip_step() {
  local step_name="$1"
  local reason="$2"
  STEP_INDEX=$((STEP_INDEX + 1))
  SKIPPED_STEPS+=("${step_name} (${reason})")
  echo
  echo "[$STEP_INDEX] ${step_name} (skipped)"
  echo "reason: ${reason}"
}

echo "Repo sweep root: $ROOT_DIR"
echo "Frontend dir: $FRONTEND_DIR"
echo "Logs dir: $LOG_DIR"
echo "Optional gates: RUN_ADAPTIVE_GATE=$RUN_ADAPTIVE_GATE RUN_SQL_LINT=$RUN_SQL_LINT RUN_E2E=$RUN_E2E RUN_AI_STUDIO_PERF_AUDIT=$RUN_AI_STUDIO_PERF_AUDIT"

if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
  run_step "install_dependencies" "required" "npm install"
fi

run_step "lint" "required" "npm run lint"
run_step "docs_check" "required" "SHORTPULSE_MODEL_CATALOG_STALE_MODE=enforce npm run docs:check"
run_step "type_check" "required" "npm run type-check"
run_step "unit_fast_lane" "required" "npm run test -- auth-helper proxy-internal-utils auth-guarded-ai-routes fal-status.auth-context fal-status.ownership auth-latency-benchmark"
run_step "unit_full" "required" "npm run test"
run_step "build" "required" "npm run build"
run_step "deadcode_check" "required" "npm run deadcode:check"
run_step "architecture_boundary" "required" "npm run check:architecture-boundary"
run_step "size_budget" "required" "npm run check:size-budget"
run_step "agent_contract_tests" "required" "npm run test:agent:contract"
run_step "agent_disable_continuity" "required" "npm run test:agent:disable-continuity"
run_step "security_audit_prod" "required" "npm audit --omit=dev --audit-level=moderate"
run_step "security_audit_full" "advisory" "npm audit --audit-level=moderate"

if [[ "$RUN_ADAPTIVE_GATE" == "1" ]]; then
  run_step "adaptive_media_gate" "required" "npm run test:adaptive-media-runtime"
else
  skip_step "adaptive_media_gate" "RUN_ADAPTIVE_GATE is not 1"
fi

if [[ "$RUN_SQL_LINT" == "1" ]]; then
  run_step "sql_lint" "required" "if [[ -z \"\${SUPABASE_DB_URL:-}\" ]]; then echo 'SUPABASE_DB_URL is required when RUN_SQL_LINT=1.'; exit 1; fi; npx supabase db lint --db-url \"\$SUPABASE_DB_URL\" --schema public --fail-on warning"
else
  skip_step "sql_lint" "RUN_SQL_LINT is not 1"
fi

if [[ "$RUN_E2E" == "1" ]]; then
  run_step "e2e_playwright" "required" "npm run test:e2e"
else
  skip_step "e2e_playwright" "RUN_E2E is not 1"
fi

if [[ "$RUN_AI_STUDIO_PERF_AUDIT" == "1" ]]; then
  if [[ -z "${PLAYWRIGHT_AUDIT_EMAIL:-}" || -z "${PLAYWRIGHT_AUDIT_PASSWORD:-}" ]]; then
    skip_step "ai_studio_perf_audit" "PLAYWRIGHT_AUDIT_EMAIL/PLAYWRIGHT_AUDIT_PASSWORD not set"
  else
    run_step "ai_studio_perf_audit" "required" "npm run perf:ai-studio:release-check"
  fi
else
  skip_step "ai_studio_perf_audit" "RUN_AI_STUDIO_PERF_AUDIT is not 1"
fi

echo
echo "===== Repo Sweep Summary ====="
echo "required_failed: ${#FAILED_STEPS[@]}"
echo "advisory_failed: ${#ADVISORY_FAILED_STEPS[@]}"
echo "passed: ${#PASSED_STEPS[@]}"
echo "skipped: ${#SKIPPED_STEPS[@]}"
echo "logs_dir: $LOG_DIR"

if [[ "${#FAILED_STEPS[@]}" -gt 0 ]]; then
  echo
  echo "Required failures:"
  printf ' - %s\n' "${FAILED_STEPS[@]}"
fi

if [[ "${#ADVISORY_FAILED_STEPS[@]}" -gt 0 ]]; then
  echo
  echo "Advisory failures:"
  printf ' - %s\n' "${ADVISORY_FAILED_STEPS[@]}"
fi

if [[ "${#SKIPPED_STEPS[@]}" -gt 0 ]]; then
  echo
  echo "Skipped steps:"
  printf ' - %s\n' "${SKIPPED_STEPS[@]}"
fi

if [[ "${#FAILED_STEPS[@]}" -gt 0 ]]; then
  exit 1
fi

exit 0
