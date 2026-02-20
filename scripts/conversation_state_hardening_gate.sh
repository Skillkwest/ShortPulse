#!/usr/bin/env bash
# Conversation-state hardening deploy gate for migration 028.
# Verifies grants, constraint/definer posture, and bounded retention behavior.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECK_SQL_FILE="$ROOT_DIR/sql/check_conversation_state_hardening_028.sql"

if ! command -v psql >/dev/null 2>&1; then
  echo "[conversation-state-gate] psql is required but not found in PATH."
  exit 1
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "[conversation-state-gate] SUPABASE_DB_URL is required."
  exit 1
fi

if [[ ! -f "$CHECK_SQL_FILE" ]]; then
  echo "[conversation-state-gate] Missing SQL file: $CHECK_SQL_FILE"
  exit 1
fi

echo "[conversation-state-gate] Running 028 hardening diagnostics..."
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$CHECK_SQL_FILE"

echo "[conversation-state-gate] PASS: 028 hardening diagnostics completed."
