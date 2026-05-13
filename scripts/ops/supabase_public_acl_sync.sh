#!/usr/bin/env bash
# Purpose: sync hosted public-schema grants/revokes from one Supabase database to another.
# Responsibilities: copy schema usage, table grants, sequence usage grants, and
# function execute grant/revoke posture for anon/authenticated/service_role.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/supabase_public_acl_sync.sh \
    --source-url <postgres-url> \
    --target-url <postgres-url> \
    [--source-label staging] \
    [--target-label development] \
    [--mode apply|emit] \
    [--output-file /tmp/public-acl-sync.sql]

Env fallbacks:
  SHORTPULSE_STAGING_DB_URL
  SHORTPULSE_DEVELOPMENT_DB_URL
  SHORTPULSE_PRODUCTION_DB_URL

Notes:
  - Copies grant posture for schema `public` only.
  - Includes schema usage, table grants, sequence usage, and function execute grants/revokes.
  - Exit code 0 means the SQL was emitted/applied successfully.
EOF
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

  echo "[nuclo-acl-sync] missing required command: psql" >&2
  exit 1
}

SOURCE_URL="${SHORTPULSE_STAGING_DB_URL:-}"
TARGET_URL="${SHORTPULSE_DEVELOPMENT_DB_URL:-${SHORTPULSE_PRODUCTION_DB_URL:-}}"
SOURCE_LABEL="source"
TARGET_LABEL="target"
MODE="apply"
OUTPUT_FILE=""

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
    --source-label)
      SOURCE_LABEL="${2:-}"
      shift 2
      ;;
    --target-label)
      TARGET_LABEL="${2:-}"
      shift 2
      ;;
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --output-file)
      OUTPUT_FILE="${2:-}"
      shift 2
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[nuclo-acl-sync] unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SOURCE_URL" || -z "$TARGET_URL" ]]; then
  echo "[nuclo-acl-sync] source and target URLs are required." >&2
  usage >&2
  exit 1
fi

if [[ "$MODE" != "apply" && "$MODE" != "emit" ]]; then
  echo "[nuclo-acl-sync] mode must be apply or emit." >&2
  exit 1
fi

PSQL_BIN="$(find_psql)"
TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

SQL_FILE="${OUTPUT_FILE:-$TMP_DIR/public-acl-sync.sql}"

"$PSQL_BIN" "$SOURCE_URL" -Atq <<'SQL' > "$SQL_FILE"
with schema_usage as (
  select format('GRANT USAGE ON SCHEMA public TO %I;', grantee) as stmt, 1 as ord
  from information_schema.usage_privileges
  where object_type = 'SCHEMA'
    and object_schema = 'public'
    and grantee in ('anon', 'authenticated', 'service_role')
  group by grantee
),
table_acl as (
  select format(
    'GRANT %s ON TABLE public.%I TO %I;',
    string_agg(distinct privilege_type, ', ' order by privilege_type),
    table_name,
    grantee
  ) as stmt,
  2 as ord
  from information_schema.role_table_grants
  where table_schema = 'public'
    and grantee in ('anon', 'authenticated', 'service_role')
  group by table_name, grantee
),
sequence_acl as (
  select format('GRANT USAGE ON SEQUENCE public.%I TO %I;', object_name, grantee) as stmt, 3 as ord
  from information_schema.usage_privileges
  where object_type = 'SEQUENCE'
    and object_schema = 'public'
    and grantee in ('anon', 'authenticated', 'service_role')
  group by object_name, grantee
),
function_public_revoke as (
  select format(
    'REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC;',
    p.proname,
    pg_get_function_identity_arguments(p.oid)
  ) as stmt,
  4 as ord
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and not has_function_privilege('public', p.oid, 'EXECUTE')
),
function_acl as (
  select format(
    'GRANT EXECUTE ON FUNCTION public.%I(%s) TO %I;',
    p.proname,
    pg_get_function_identity_arguments(p.oid),
    r.rolname
  ) as stmt,
  5 as ord
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_roles r on r.rolname in ('anon', 'authenticated', 'service_role')
  where n.nspname = 'public'
    and has_function_privilege(r.rolname, p.oid, 'EXECUTE')
)
select stmt
from (
  select * from schema_usage
  union all
  select * from table_acl
  union all
  select * from sequence_acl
  union all
  select * from function_public_revoke
  union all
  select * from function_acl
) q
order by ord, stmt;
SQL

statement_count="$(wc -l < "$SQL_FILE" | tr -d ' ')"
echo "[nuclo-acl-sync] source=$SOURCE_LABEL target=$TARGET_LABEL mode=$MODE statements=$statement_count file=$SQL_FILE"

if [[ "$MODE" == "emit" ]]; then
  exit 0
fi

"$PSQL_BIN" "$TARGET_URL" -v ON_ERROR_STOP=1 -f "$SQL_FILE" >/dev/null

echo "[nuclo-acl-sync] applied public ACL sync to $TARGET_LABEL"
