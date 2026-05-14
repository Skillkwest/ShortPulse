#!/usr/bin/env bash
# Purpose: compare public-schema object presence between two hosted Supabase databases.
# Responsibilities: report table, column, routine, policy, and index parity by name so I can
# quickly detect whether a target hosted project is missing staged schema objects.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/supabase_public_schema_parity.sh \
    --source-url <postgres-url> \
    --target-url <postgres-url> \
    [--schema public] \
    [--source-label staging] \
    [--target-label production]

Env fallbacks:
  SHORTPULSE_STAGING_DB_URL
  SHORTPULSE_PRODUCTION_DB_URL

Notes:
  - Compares object presence only, not full DDL text.
  - Columns are compared by table, column, and data type.
  - Indexes are compared by table and index name.
  - Exit code 0 means parity by name. Exit code 1 means drift was found.
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[nuclo-schema-parity] missing required command: $1" >&2
    exit 1
  }
}

find_psql() {
  if command -v psql >/dev/null 2>&1; then
    command -v psql
    return
  fi

  local fallback="/opt/homebrew/opt/libpq/bin/psql"
  if [[ -x "$fallback" ]]; then
    printf '%s\n' "$fallback"
    return
  fi

  echo "[nuclo-schema-parity] missing required command: psql" >&2
  exit 1
}

SOURCE_URL="${SHORTPULSE_STAGING_DB_URL:-}"
TARGET_URL="${SHORTPULSE_PRODUCTION_DB_URL:-}"
SCHEMA_NAME="public"
SOURCE_LABEL="source"
TARGET_LABEL="target"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-url)
      SOURCE_URL="${2:-}"
      shift 2
      ;;
    --target-url)
      TARGET_URL="${2:-}"
      shift 2
      ;;
    --schema)
      SCHEMA_NAME="${2:-}"
      shift 2
      ;;
    --source-label)
      SOURCE_LABEL="${2:-}"
      shift 2
      ;;
    --target-label)
      TARGET_LABEL="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[nuclo-schema-parity] unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SOURCE_URL" || -z "$TARGET_URL" ]]; then
  echo "[nuclo-schema-parity] source and target URLs are required." >&2
  usage >&2
  exit 1
fi

if [[ ! "$SCHEMA_NAME" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
  echo "[nuclo-schema-parity] schema must be a simple SQL identifier." >&2
  exit 1
fi

require_command comm
require_command sort
PSQL_BIN="$(find_psql)"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

run_list_query() {
  local url="$1"
  local sql="$2"
  local outfile="$3"
  "$PSQL_BIN" "$url" \
    -v ON_ERROR_STOP=1 \
    -Atq \
    -F $'\t' \
    -c "$sql" | sort -u > "$outfile"
}

TABLE_QUERY=$(cat <<SQL
select table_name
from information_schema.tables
where table_schema = '${SCHEMA_NAME}'
  and table_type = 'BASE TABLE'
order by 1;
SQL
)
ROUTINE_QUERY=$(cat <<SQL
select format('%s(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = '${SCHEMA_NAME}'
order by 1;
SQL
)
POLICY_QUERY=$(cat <<SQL
select format('%s:%s', tablename, policyname)
from pg_policies
where schemaname = '${SCHEMA_NAME}'
order by 1;
SQL
)
COLUMN_QUERY=$(cat <<SQL
select format('%s:%s:%s', table_name, column_name, data_type)
from information_schema.columns
where table_schema = '${SCHEMA_NAME}'
order by 1;
SQL
)
INDEX_QUERY=$(cat <<SQL
select format('%s:%s', tablename, indexname)
from pg_indexes
where schemaname = '${SCHEMA_NAME}'
order by 1;
SQL
)

run_list_query "$SOURCE_URL" "$TABLE_QUERY" "$TMP_DIR/source_tables.txt"
run_list_query "$TARGET_URL" "$TABLE_QUERY" "$TMP_DIR/target_tables.txt"
run_list_query "$SOURCE_URL" "$COLUMN_QUERY" "$TMP_DIR/source_columns.txt"
run_list_query "$TARGET_URL" "$COLUMN_QUERY" "$TMP_DIR/target_columns.txt"
run_list_query "$SOURCE_URL" "$ROUTINE_QUERY" "$TMP_DIR/source_routines.txt"
run_list_query "$TARGET_URL" "$ROUTINE_QUERY" "$TMP_DIR/target_routines.txt"
run_list_query "$SOURCE_URL" "$POLICY_QUERY" "$TMP_DIR/source_policies.txt"
run_list_query "$TARGET_URL" "$POLICY_QUERY" "$TMP_DIR/target_policies.txt"
run_list_query "$SOURCE_URL" "$INDEX_QUERY" "$TMP_DIR/source_indexes.txt"
run_list_query "$TARGET_URL" "$INDEX_QUERY" "$TMP_DIR/target_indexes.txt"

compare_lane() {
  local type_label="$1"
  local source_file="$2"
  local target_file="$3"
  local missing_file="$TMP_DIR/${type_label}_missing.txt"
  local extra_file="$TMP_DIR/${type_label}_extra.txt"

  comm -23 "$source_file" "$target_file" > "$missing_file"
  comm -13 "$source_file" "$target_file" > "$extra_file"

  local source_count target_count missing_count extra_count
  source_count="$(wc -l < "$source_file" | tr -d ' ')"
  target_count="$(wc -l < "$target_file" | tr -d ' ')"
  missing_count="$(wc -l < "$missing_file" | tr -d ' ')"
  extra_count="$(wc -l < "$extra_file" | tr -d ' ')"

  printf '%s: %s=%s %s=%s missing_in_%s=%s extra_in_%s=%s\n' \
    "$type_label" \
    "$SOURCE_LABEL" "$source_count" \
    "$TARGET_LABEL" "$target_count" \
    "$TARGET_LABEL" "$missing_count" \
    "$TARGET_LABEL" "$extra_count"

  if [[ "$missing_count" -gt 0 ]]; then
    echo "  Missing in $TARGET_LABEL:"
    sed 's/^/    - /' "$missing_file"
  fi
  if [[ "$extra_count" -gt 0 ]]; then
    echo "  Extra in $TARGET_LABEL:"
    sed 's/^/    - /' "$extra_file"
  fi

  if [[ "$missing_count" -gt 0 || "$extra_count" -gt 0 ]]; then
    return 1
  fi
  return 0
}

echo "[nuclo-schema-parity] schema=$SCHEMA_NAME source=$SOURCE_LABEL target=$TARGET_LABEL"
overall_status=0

compare_lane "tables" "$TMP_DIR/source_tables.txt" "$TMP_DIR/target_tables.txt" || overall_status=1
compare_lane "columns" "$TMP_DIR/source_columns.txt" "$TMP_DIR/target_columns.txt" || overall_status=1
compare_lane "routines" "$TMP_DIR/source_routines.txt" "$TMP_DIR/target_routines.txt" || overall_status=1
compare_lane "policies" "$TMP_DIR/source_policies.txt" "$TMP_DIR/target_policies.txt" || overall_status=1
compare_lane "indexes" "$TMP_DIR/source_indexes.txt" "$TMP_DIR/target_indexes.txt" || overall_status=1

if [[ "$overall_status" -eq 0 ]]; then
  echo "[nuclo-schema-parity] PASS"
else
  echo "[nuclo-schema-parity] FAIL"
fi

exit "$overall_status"
