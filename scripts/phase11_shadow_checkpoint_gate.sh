#!/usr/bin/env bash
# Phase 11 shadow/canary checkpoint gate helper.
# Runs canonical Fal no-regression checks, then prints the SQL/evidence checklist to complete.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:---quick}"

case "$MODE" in
  --quick)
    CHECK_CMD=(npm -C "$ROOT_DIR/frontend" run test:phase11:fal-regression)
    ;;
  --full)
    CHECK_CMD=(npm -C "$ROOT_DIR/frontend" run validate:phase11:fal-regression)
    ;;
  *)
    echo "[phase11-checkpoint-gate] Unknown mode: $MODE"
    echo "[phase11-checkpoint-gate] Usage: bash scripts/phase11_shadow_checkpoint_gate.sh [--quick|--full]"
    exit 1
    ;;
esac

echo "[phase11-checkpoint-gate] start_utc=$(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "[phase11-checkpoint-gate] mode=$MODE"
echo "[phase11-checkpoint-gate] running: ${CHECK_CMD[*]}"
"${CHECK_CMD[@]}"

echo "[phase11-checkpoint-gate] no-regression gate passed."
echo "[phase11-checkpoint-gate] Next manual checkpoint steps:"
echo "1) Run one-row gate summary from: sql/check_phase11_shadow_canary_gate_summary_windowed.sql"
echo "   (set explicit start_at/end_at for the active shadow/canary checkpoint window)"
echo "2) Paste the one-row summary into:"
echo "   - docs/planning/evidence/unified-buildout/phase-11/2026-02-27-phase-11-shadow-window-1-live-log.md (or active canary log)"
echo "   - docs/planning/evidence/unified-buildout/phase-11/2026-02-27-phase-11-slice-a-shadow-canary-readiness-and-threshold-template.md"
echo "3) Record decision as pass/fail/N-A (N-A only when recovery_success_sample_size=0)."
