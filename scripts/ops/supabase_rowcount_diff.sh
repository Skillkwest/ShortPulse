#!/usr/bin/env bash
# Purpose: compare row counts for shared tables across two hosted Supabase databases.
# Responsibilities: list missing tables and count mismatches so Nuclo can quickly
# measure live-data migration drift before or after a cutover rehearsal.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/supabase_rowcount_diff.sh \
    --source-url <postgres-url> \
    --target-url <postgres-url> \
    [--schema public] [--schema auth] [--schema storage] \
    [--source-label staging] \
    [--target-label production] \
    [--show-matches]

Env fallbacks:
  SHORTPULSE_STAGING_DB_URL
  SHORTPULSE_PRODUCTION_DB_URL

Notes:
  - Counts shared tables exactly with COUNT(*).
  - Exit code 0 means all shared-table counts matched and no table-presence drift was found.
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[nuclo-rowcount-diff] missing required command: $1" >&2
    exit 1
  }
}

SOURCE_URL="${SHORTPULSE_STAGING_DB_URL:-}"
TARGET_URL="${SHORTPULSE_PRODUCTION_DB_URL:-}"
SOURCE_LABEL="source"
TARGET_LABEL="target"
SHOW_MATCHES="false"
SCHEMAS=("public" "auth" "storage")

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
      if [[ "${SCHEMAS[*]}" == "public auth storage" ]]; then
        SCHEMAS=()
      fi
      SCHEMAS+=("${2:-}")
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
    --show-matches)
      SHOW_MATCHES="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[nuclo-rowcount-diff] unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SOURCE_URL" || -z "$TARGET_URL" ]]; then
  echo "[nuclo-rowcount-diff] source and target URLs are required." >&2
  usage >&2
  exit 1
fi

if [[ "${#SCHEMAS[@]}" -eq 0 ]]; then
  echo "[nuclo-rowcount-diff] at least one schema is required." >&2
  exit 1
fi

require_command psql
require_command python3
require_command sort
require_command comm

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

SCHEMA_LIST_SQL=""
for schema_name in "${SCHEMAS[@]}"; do
  if [[ -n "$SCHEMA_LIST_SQL" ]]; then
    SCHEMA_LIST_SQL+=", "
  fi
  SCHEMA_LIST_SQL+="'${schema_name//\'/\'\'}'"
done

TABLE_LIST_QUERY="select table_schema, table_name
from information_schema.tables
where table_schema in (${SCHEMA_LIST_SQL})
  and table_type = 'BASE TABLE'
order by 1, 2;"

psql "$SOURCE_URL" -v ON_ERROR_STOP=1 -Atq -F $'\t' -c "$TABLE_LIST_QUERY" | sort -u > "$TMP_DIR/source_tables.tsv"
psql "$TARGET_URL" -v ON_ERROR_STOP=1 -Atq -F $'\t' -c "$TABLE_LIST_QUERY" | sort -u > "$TMP_DIR/target_tables.tsv"

comm -23 "$TMP_DIR/source_tables.tsv" "$TMP_DIR/target_tables.tsv" > "$TMP_DIR/missing_in_target.tsv"
comm -13 "$TMP_DIR/source_tables.tsv" "$TMP_DIR/target_tables.tsv" > "$TMP_DIR/extra_in_target.tsv"
comm -12 "$TMP_DIR/source_tables.tsv" "$TMP_DIR/target_tables.tsv" > "$TMP_DIR/shared_tables.tsv"

count_table() {
  local url="$1"
  local schema_name="$2"
  local table_name="$3"
  psql "$url" -v ON_ERROR_STOP=1 -Atq <<SQL
select count(*)::bigint
from "${schema_name}"."${table_name}";
SQL
}

SOURCE_COUNTS="$TMP_DIR/source_counts.tsv"
TARGET_COUNTS="$TMP_DIR/target_counts.tsv"
>"$SOURCE_COUNTS"
>"$TARGET_COUNTS"

while IFS=$'\t' read -r schema_name table_name; do
  [[ -z "${schema_name:-}" || -z "${table_name:-}" ]] && continue
  source_count="$(count_table "$SOURCE_URL" "$schema_name" "$table_name")"
  target_count="$(count_table "$TARGET_URL" "$schema_name" "$table_name")"
  printf '%s\t%s\t%s\n' "$schema_name" "$table_name" "$source_count" >> "$SOURCE_COUNTS"
  printf '%s\t%s\t%s\n' "$schema_name" "$table_name" "$target_count" >> "$TARGET_COUNTS"
done < "$TMP_DIR/shared_tables.tsv"

echo "[nuclo-rowcount-diff] source=$SOURCE_LABEL target=$TARGET_LABEL schemas=${SCHEMAS[*]}"

python3 - "$SOURCE_COUNTS" "$TARGET_COUNTS" "$TMP_DIR/missing_in_target.tsv" "$TMP_DIR/extra_in_target.tsv" "$SOURCE_LABEL" "$TARGET_LABEL" "$SHOW_MATCHES" <<'PY'
import sys
from pathlib import Path

source_counts_path = Path(sys.argv[1])
target_counts_path = Path(sys.argv[2])
missing_path = Path(sys.argv[3])
extra_path = Path(sys.argv[4])
source_label = sys.argv[5]
target_label = sys.argv[6]
show_matches = sys.argv[7].lower() == "true"

def read_table_counts(path: Path):
    rows = {}
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        schema_name, table_name, count = line.split("\t")
        rows[(schema_name, table_name)] = int(count)
    return rows

def read_table_list(path: Path):
    rows = []
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        schema_name, table_name = line.split("\t")
        rows.append((schema_name, table_name))
    return rows

source_counts = read_table_counts(source_counts_path)
target_counts = read_table_counts(target_counts_path)
missing = read_table_list(missing_path)
extra = read_table_list(extra_path)

status = 0
if missing:
    status = 1
    print(f"Missing in {target_label}:")
    for schema_name, table_name in missing:
        print(f"  - {schema_name}.{table_name}")
if extra:
    status = 1
    print(f"Extra in {target_label}:")
    for schema_name, table_name in extra:
        print(f"  - {schema_name}.{table_name}")

diff_rows = []
match_rows = 0
for key in sorted(source_counts.keys()):
    source_count = source_counts[key]
    target_count = target_counts.get(key)
    if target_count is None:
      continue
    if source_count != target_count:
        status = 1
        diff_rows.append((key[0], key[1], source_count, target_count, source_count - target_count))
    else:
        match_rows += 1

if diff_rows:
    print(f"Count mismatches ({len(diff_rows)}):")
    for schema_name, table_name, source_count, target_count, delta in diff_rows:
        print(
            f"  - {schema_name}.{table_name}: "
            f"{source_label}={source_count} {target_label}={target_count} delta={delta}"
        )
elif not missing and not extra:
    print("No shared-table count drift detected.")

if show_matches:
    print(f"Matched shared-table counts: {match_rows}")

sys.exit(status)
PY
