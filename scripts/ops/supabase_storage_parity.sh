#!/usr/bin/env bash
# Purpose: compare Supabase storage bucket metadata and object totals across two databases.
# Responsibilities: report bucket-definition drift plus object-count/byte-count drift so
# Nuclo can separate metadata parity from actual storage-payload parity.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/supabase_storage_parity.sh \
    --source-url <postgres-url> \
    --target-url <postgres-url> \
    [--bucket media_library] \
    [--source-label staging] \
    [--target-label production]

Env fallbacks:
  SHORTPULSE_STAGING_DB_URL
  SHORTPULSE_PRODUCTION_DB_URL

Notes:
  - Compares storage.buckets metadata plus storage.objects counts and summed bytes.
  - Exit code 0 means the selected bucket set matched exactly.
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[nuclo-storage-parity] missing required command: $1" >&2
    exit 1
  }
}

SOURCE_URL="${SHORTPULSE_STAGING_DB_URL:-}"
TARGET_URL="${SHORTPULSE_PRODUCTION_DB_URL:-}"
SOURCE_LABEL="source"
TARGET_LABEL="target"
BUCKET_FILTER=""

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
    --bucket)
      BUCKET_FILTER="${2:-}"
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
      echo "[nuclo-storage-parity] unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SOURCE_URL" || -z "$TARGET_URL" ]]; then
  echo "[nuclo-storage-parity] source and target URLs are required." >&2
  usage >&2
  exit 1
fi

require_command psql
require_command python3

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

BUCKET_CONDITION="true"
if [[ -n "$BUCKET_FILTER" ]]; then
  ESCAPED_BUCKET_FILTER="${BUCKET_FILTER//\'/\'\'}"
  BUCKET_CONDITION="b.id = '${ESCAPED_BUCKET_FILTER}'"
fi

STORAGE_QUERY=$'with object_totals as (\n  select\n    bucket_id,\n    count(*)::bigint as object_count,\n    coalesce(sum(coalesce(nullif(metadata->>\'size\', \'\')::bigint, 0)), 0)::bigint as object_bytes\n  from storage.objects\n  group by 1\n)\nselect\n  b.id,\n  b.public::text,\n  coalesce(b.file_size_limit::text, \'\'),\n  coalesce(array_to_string(b.allowed_mime_types, \',\'), \'\'),\n  coalesce(o.object_count, 0)::bigint,\n  coalesce(o.object_bytes, 0)::bigint\nfrom storage.buckets b\nleft join object_totals o on o.bucket_id = b.id\nwhere '"${BUCKET_CONDITION}"$'\norder by b.id;'

psql "$SOURCE_URL" \
  -v ON_ERROR_STOP=1 \
  -Atq \
  -F $'\t' \
  -c "$STORAGE_QUERY" > "$TMP_DIR/source_storage.tsv"

psql "$TARGET_URL" \
  -v ON_ERROR_STOP=1 \
  -Atq \
  -F $'\t' \
  -c "$STORAGE_QUERY" > "$TMP_DIR/target_storage.tsv"

echo "[nuclo-storage-parity] source=$SOURCE_LABEL target=$TARGET_LABEL bucket=${BUCKET_FILTER:-all}"

python3 - "$TMP_DIR/source_storage.tsv" "$TMP_DIR/target_storage.tsv" "$SOURCE_LABEL" "$TARGET_LABEL" <<'PY'
import sys
from pathlib import Path

source_path = Path(sys.argv[1])
target_path = Path(sys.argv[2])
source_label = sys.argv[3]
target_label = sys.argv[4]

def read_rows(path: Path):
    rows = {}
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        bucket_id, is_public, file_limit, mime_types, object_count, object_bytes = line.split("\t")
        rows[bucket_id] = {
            "public": is_public,
            "file_limit": file_limit,
            "mime_types": mime_types,
            "object_count": int(object_count),
            "object_bytes": int(object_bytes),
        }
    return rows

source_rows = read_rows(source_path)
target_rows = read_rows(target_path)
status = 0

for bucket_id in sorted(source_rows):
    if bucket_id not in target_rows:
        status = 1
        print(f"Missing bucket in {target_label}: {bucket_id}")
        continue
    source_row = source_rows[bucket_id]
    target_row = target_rows[bucket_id]
    mismatches = []
    for field in ("public", "file_limit", "mime_types", "object_count", "object_bytes"):
        if source_row[field] != target_row[field]:
            mismatches.append((field, source_row[field], target_row[field]))
    if mismatches:
        status = 1
        print(f"Bucket drift: {bucket_id}")
        for field, source_value, target_value in mismatches:
            print(
                f"  - {field}: {source_label}={source_value} {target_label}={target_value}"
            )

for bucket_id in sorted(target_rows):
    if bucket_id not in source_rows:
        status = 1
        print(f"Extra bucket in {target_label}: {bucket_id}")

if status == 0:
    print("No bucket metadata or object-total drift detected.")

sys.exit(status)
PY
