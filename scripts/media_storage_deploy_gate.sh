#!/usr/bin/env bash
# Media storage deploy gate.
# Fails fast when storage-path drift exists or required constraints are missing/unvalidated.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DRIFT_SQL_FILE="$ROOT_DIR/sql/check_media_storage_scope_drift.sql"

if ! command -v psql >/dev/null 2>&1; then
  echo "[media-storage-gate] psql is required but not found in PATH."
  exit 1
fi

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "[media-storage-gate] SUPABASE_DB_URL is required."
  exit 1
fi

if [[ ! -f "$DRIFT_SQL_FILE" ]]; then
  echo "[media-storage-gate] Missing SQL file: $DRIFT_SQL_FILE"
  exit 1
fi

echo "[media-storage-gate] Running drift diagnostics..."
drift_rows="$(psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -At -f "$DRIFT_SQL_FILE")"

if [[ -z "$drift_rows" ]]; then
  echo "[media-storage-gate] Drift query returned no rows."
  exit 1
fi

drift_fail=0
while IFS='|' read -r check_name mismatch_count; do
  [[ -z "${check_name}" ]] && continue
  echo "[media-storage-gate] drift ${check_name}=${mismatch_count}"
  if ! [[ "$mismatch_count" =~ ^[0-9]+$ ]]; then
    echo "[media-storage-gate] Invalid mismatch_count for ${check_name}: ${mismatch_count}"
    drift_fail=1
    continue
  fi
  if (( mismatch_count != 0 )); then
    drift_fail=1
  fi
done <<< "$drift_rows"

echo "[media-storage-gate] Checking constraint validation..."
constraint_rows="$(psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -At <<'SQL'
with media_files_has_variant_hints as (
  select exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'media_files'
        and column_name = 'thumb_variant_path'
    ) and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'media_files'
        and column_name = 'poster_variant_path'
    ) and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'media_files'
        and column_name = 'preview_variant_path'
    ) as value
),
expected as (
  select 'media_files_storage_scope_check'::text as conname, true as required
  union all
  select 'media_files_storage_path_shape_check'::text, true
  union all
  select 'media_files_variant_hint_shape_check'::text, (select value from media_files_has_variant_hints)
  union all
  select 'media_asset_variants_storage_path_shape_check'::text, to_regclass('public.media_asset_variants') is not null
),
actual as (
  select conname, convalidated
  from pg_constraint
  where conname in (select conname from expected)
)
select
  e.conname,
  e.required,
  (a.conname is not null) as present,
  coalesce(a.convalidated, false) as convalidated
from expected e
left join actual a using (conname)
order by e.conname;
SQL
)"

constraint_fail=0
while IFS='|' read -r conname required present convalidated; do
  [[ -z "${conname}" ]] && continue
  echo "[media-storage-gate] constraint ${conname} required=${required} present=${present} validated=${convalidated}"
  if [[ "$required" == "t" && "$present" != "t" ]]; then
    echo "[media-storage-gate] Required constraint is missing: ${conname}"
    constraint_fail=1
  fi
  if [[ "$present" == "t" && "$convalidated" != "t" ]]; then
    echo "[media-storage-gate] Constraint is not validated: ${conname}"
    constraint_fail=1
  fi
done <<< "$constraint_rows"

if (( drift_fail != 0 || constraint_fail != 0 )); then
  echo "[media-storage-gate] FAIL: Deploy blocked. Run remediation loop (009 -> 016 -> 017 -> drift check)."
  exit 1
fi

echo "[media-storage-gate] PASS: Drift checks and constraints are healthy."
