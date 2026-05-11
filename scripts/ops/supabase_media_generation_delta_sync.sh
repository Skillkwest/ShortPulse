#!/usr/bin/env bash
# Purpose: catch up the media-generation tables that still drift during a live cutover window.
# Responsibilities: read production watermarks, export only newer or updated staging rows,
# then upsert them into production in dependency order.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/supabase_media_generation_delta_sync.sh \
    --source-url <postgres-url> \
    --target-url <postgres-url> \
    [--source-label staging] \
    [--target-label production]

Env fallbacks:
  SHORTPULSE_STAGING_DB_URL
  SHORTPULSE_PRODUCTION_DB_URL

Notes:
  - Syncs the current media-generation drift tables plus the lineage required
    for publication foreign keys:
    - public.ai_generations
    - public.generation_attempts
    - public.ai_generation_outputs
    - public.media_files
    - public.generation_publications
    - public.project_media_items
    - public.media_events
  - Export scope is watermark-based from production max(updated_at/created_at),
    with publication-delta lineage pulled in explicitly so FK dependencies land
    before new publications.
  - Imports use primary-key upserts.
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[nuclo-media-sync] missing required command: $1" >&2
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

  echo "[nuclo-media-sync] missing required command: psql" >&2
  exit 1
}

SOURCE_URL="${SHORTPULSE_STAGING_DB_URL:-}"
TARGET_URL="${SHORTPULSE_PRODUCTION_DB_URL:-}"
SOURCE_LABEL="staging"
TARGET_LABEL="production"

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
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[nuclo-media-sync] unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ -z "$SOURCE_URL" || -z "$TARGET_URL" ]]; then
  echo "[nuclo-media-sync] source and target URLs are required." >&2
  usage >&2
  exit 1
fi

require_command mktemp
PSQL_BIN="$(find_psql)"

TMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

query_scalar() {
  local url="$1"
  local sql="$2"
  "$PSQL_BIN" "$url" -Atq -v ON_ERROR_STOP=1 -c "$sql"
}

copy_export() {
  local sql="$1"
  local output_path="$2"
  "$PSQL_BIN" "$SOURCE_URL" -v ON_ERROR_STOP=1 -c "\\copy (${sql}) to '${output_path}' csv" >/dev/null
}

media_files_max="$(query_scalar "$TARGET_URL" "select coalesce(max(updated_at), '-infinity'::timestamptz) from public.media_files;")"
ai_generations_created_max="$(query_scalar "$TARGET_URL" "select coalesce(max(created_at), '-infinity'::timestamptz) from public.ai_generations;")"
generation_attempts_updated_max="$(query_scalar "$TARGET_URL" "select coalesce(max(updated_at), '-infinity'::timestamptz) from public.generation_attempts;")"
ai_generation_outputs_updated_max="$(query_scalar "$TARGET_URL" "select coalesce(max(updated_at), '-infinity'::timestamptz) from public.ai_generation_outputs;")"
generation_publications_max="$(query_scalar "$TARGET_URL" "select coalesce(max(updated_at), '-infinity'::timestamptz) from public.generation_publications;")"
project_media_items_max="$(query_scalar "$TARGET_URL" "select coalesce(max(updated_at), '-infinity'::timestamptz) from public.project_media_items;")"
media_events_max="$(query_scalar "$TARGET_URL" "select coalesce(max(created_at), '-infinity'::timestamptz) from public.media_events;")"
generation_projection_max="$(query_scalar "$TARGET_URL" "select coalesce(max(updated_at), '-infinity'::timestamptz) from public.generation_projection;")"

copy_export \
  "with publication_delta as (
     select generation_id
     from public.generation_publications
     where updated_at > timestamptz '${generation_publications_max}'
       and generation_id is not null
   )
   select id, user_id, mode, provider, model_id, prompt_text, aspect, duration_seconds,
          resolution, request_id, status, error_message, created_at, completed_at, metadata,
          failure_reason_code, recovery_state, recovery_attempts, last_recovery_at,
          next_recovery_at, last_media_detected_at
   from public.ai_generations
   where created_at > timestamptz '${ai_generations_created_max}'
      or id in (select generation_id from publication_delta)
   order by created_at, id" \
  "$TMP_DIR/public_ai_generations.csv"
copy_export \
  "with publication_delta as (
     select generation_attempt_id
     from public.generation_publications
     where updated_at > timestamptz '${generation_publications_max}'
       and generation_attempt_id is not null
   ),
   output_delta as (
     select generation_attempt_id
     from public.ai_generation_outputs
     where updated_at > timestamptz '${ai_generation_outputs_updated_max}'
       and generation_attempt_id is not null
   )
   select id, generation_id, user_id, attempt_number, provider, model_id, provider_request_id,
          status, dispatch_source, submit_route, queue_id, submitted_at, started_at, completed_at,
          last_observed_at, failure_reason_code, error_message, metadata, created_at, updated_at
   from public.generation_attempts
   where updated_at > timestamptz '${generation_attempts_updated_max}'
      or id in (select generation_attempt_id from publication_delta
                union
                select generation_attempt_id from output_delta)
   order by updated_at, id" \
  "$TMP_DIR/public_generation_attempts.csv"
copy_export \
  "with publication_delta as (
     select generation_output_id
     from public.generation_publications
     where updated_at > timestamptz '${generation_publications_max}'
       and generation_output_id is not null
   )
   select id, generation_id, user_id, output_index, provider_request_id, result_url, media_file_id,
          metadata, created_at, updated_at, generation_attempt_id
   from public.ai_generation_outputs
   where updated_at > timestamptz '${ai_generation_outputs_updated_max}'
      or id in (select generation_output_id from publication_delta)
   order by updated_at, id" \
  "$TMP_DIR/public_ai_generation_outputs.csv"
copy_export \
  "with publication_delta as (
     select generation_id
     from public.generation_publications
     where updated_at > timestamptz '${generation_publications_max}'
       and generation_id is not null
   ),
   attempt_delta as (
     select generation_id
     from public.generation_attempts
     where updated_at > timestamptz '${generation_attempts_updated_max}'
       and generation_id is not null
   ),
   generation_delta as (
     select id as generation_id
     from public.ai_generations
     where created_at > timestamptz '${ai_generations_created_max}'
   )
   select generation_id, user_id, request_id, provider, provider_request_id, latest_attempt_id,
          status, task_state, queue_state, display_prompt, model_id, preview_url,
          preview_storage_path, full_storage_path, error_message, error_message_short,
          error_detail, save_state, hidden_in_reference_grid, reference_grid_visible,
          publication_state, result_urls, saved_media_ids, generation_replay,
          character_context, style_context, started_at, completed_at, created_at,
          updated_at, source_ref, project_id
   from public.generation_projection
   where updated_at > timestamptz '${generation_projection_max}'
      or generation_id in (
        select generation_id from publication_delta
        union
        select generation_id from attempt_delta
        union
        select generation_id from generation_delta
      )
   order by updated_at, generation_id" \
  "$TMP_DIR/public_generation_projection.csv"
copy_export \
  "with publication_delta as (
     select owned_media_file_id
     from public.generation_publications
     where updated_at > timestamptz '${generation_publications_max}'
       and owned_media_file_id is not null
   ),
   output_delta as (
     select media_file_id
     from public.ai_generation_outputs
     where updated_at > timestamptz '${ai_generation_outputs_updated_max}'
       and media_file_id is not null
   )
   select id, user_id, filename, storage_path, file_type, file_size, width, height, duration_seconds,
          thumbnail_path, tags, description, is_favorite, created_at, updated_at, source, source_ref,
          prompt_id, metadata, processing_status, poster_variant_path, thumb_variant_path,
          preview_variant_path, processing_attempts, processing_next_retry_at, processing_last_error,
          processing_updated_at
   from public.media_files
   where updated_at > timestamptz '${media_files_max}'
      or id in (select owned_media_file_id from publication_delta
                union
                select media_file_id from output_delta)
   order by updated_at, id" \
  "$TMP_DIR/public_media_files.csv"
copy_export \
  "select id, generation_id, generation_attempt_id, generation_output_id, user_id, publication_state, reusable, visible_in_ai_studio, visible_in_reference_grid, owned_media_file_id, preview_url, full_url, preview_storage_path, full_storage_path, published_at, archived_at, archive_reason, metadata, created_at, updated_at from public.generation_publications where updated_at > timestamptz '${generation_publications_max}' order by updated_at, id" \
  "$TMP_DIR/public_generation_publications.csv"
copy_export \
  "select project_id, media_file_id, user_id, created_at, updated_at from public.project_media_items where updated_at > timestamptz '${project_media_items_max}' order by updated_at, project_id, media_file_id" \
  "$TMP_DIR/public_project_media_items.csv"
copy_export \
  "select id, user_id, event_type, entity_type, entity_id, metadata, created_at from public.media_events where created_at > timestamptz '${media_events_max}' order by created_at, id" \
  "$TMP_DIR/public_media_events.csv"

echo "[nuclo-media-sync] source=$SOURCE_LABEL target=$TARGET_LABEL"
wc -l \
  "$TMP_DIR/public_ai_generations.csv" \
  "$TMP_DIR/public_generation_attempts.csv" \
  "$TMP_DIR/public_ai_generation_outputs.csv" \
  "$TMP_DIR/public_generation_projection.csv" \
  "$TMP_DIR/public_media_files.csv" \
  "$TMP_DIR/public_generation_publications.csv" \
  "$TMP_DIR/public_project_media_items.csv" \
  "$TMP_DIR/public_media_events.csv"

"$PSQL_BIN" "$TARGET_URL" -v ON_ERROR_STOP=1 <<SQL
begin;

create temp table tmp_ai_generations (like public.ai_generations including defaults) on commit drop;
\copy tmp_ai_generations from '${TMP_DIR}/public_ai_generations.csv' csv
insert into public.ai_generations (
  id, user_id, mode, provider, model_id, prompt_text, aspect, duration_seconds, resolution,
  request_id, status, error_message, created_at, completed_at, metadata, failure_reason_code,
  recovery_state, recovery_attempts, last_recovery_at, next_recovery_at, last_media_detected_at
)
select
  id, user_id, mode, provider, model_id, prompt_text, aspect, duration_seconds, resolution,
  request_id, status, error_message, created_at, completed_at, metadata, failure_reason_code,
  recovery_state, recovery_attempts, last_recovery_at, next_recovery_at, last_media_detected_at
from tmp_ai_generations
on conflict (id) do update set
  user_id = excluded.user_id,
  mode = excluded.mode,
  provider = excluded.provider,
  model_id = excluded.model_id,
  prompt_text = excluded.prompt_text,
  aspect = excluded.aspect,
  duration_seconds = excluded.duration_seconds,
  resolution = excluded.resolution,
  request_id = excluded.request_id,
  status = excluded.status,
  error_message = excluded.error_message,
  created_at = excluded.created_at,
  completed_at = excluded.completed_at,
  metadata = excluded.metadata,
  failure_reason_code = excluded.failure_reason_code,
  recovery_state = excluded.recovery_state,
  recovery_attempts = excluded.recovery_attempts,
  last_recovery_at = excluded.last_recovery_at,
  next_recovery_at = excluded.next_recovery_at,
  last_media_detected_at = excluded.last_media_detected_at;

create temp table tmp_generation_attempts (like public.generation_attempts including defaults) on commit drop;
\copy tmp_generation_attempts from '${TMP_DIR}/public_generation_attempts.csv' csv
insert into public.generation_attempts (
  id, generation_id, user_id, attempt_number, provider, model_id, provider_request_id, status,
  dispatch_source, submit_route, queue_id, submitted_at, started_at, completed_at,
  last_observed_at, failure_reason_code, error_message, metadata, created_at, updated_at
)
select
  id, generation_id, user_id, attempt_number, provider, model_id, provider_request_id, status,
  dispatch_source, submit_route, queue_id, submitted_at, started_at, completed_at,
  last_observed_at, failure_reason_code, error_message, metadata, created_at, updated_at
from tmp_generation_attempts
on conflict (id) do update set
  generation_id = excluded.generation_id,
  user_id = excluded.user_id,
  attempt_number = excluded.attempt_number,
  provider = excluded.provider,
  model_id = excluded.model_id,
  provider_request_id = excluded.provider_request_id,
  status = excluded.status,
  dispatch_source = excluded.dispatch_source,
  submit_route = excluded.submit_route,
  queue_id = excluded.queue_id,
  submitted_at = excluded.submitted_at,
  started_at = excluded.started_at,
  completed_at = excluded.completed_at,
  last_observed_at = excluded.last_observed_at,
  failure_reason_code = excluded.failure_reason_code,
  error_message = excluded.error_message,
  metadata = excluded.metadata,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

create temp table tmp_media_files (like public.media_files including defaults) on commit drop;
\copy tmp_media_files from '${TMP_DIR}/public_media_files.csv' csv
insert into public.media_files (
  id, user_id, filename, storage_path, file_type, file_size, width, height, duration_seconds,
  thumbnail_path, tags, description, is_favorite, created_at, updated_at, source, source_ref,
  prompt_id, metadata, processing_status, poster_variant_path, thumb_variant_path,
  preview_variant_path, processing_attempts, processing_next_retry_at, processing_last_error,
  processing_updated_at
)
select
  id, user_id, filename, storage_path, file_type, file_size, width, height, duration_seconds,
  thumbnail_path, tags, description, is_favorite, created_at, updated_at, source, source_ref,
  prompt_id, metadata, processing_status, poster_variant_path, thumb_variant_path,
  preview_variant_path, processing_attempts, processing_next_retry_at, processing_last_error,
  processing_updated_at
from tmp_media_files
on conflict (id) do update set
  user_id = excluded.user_id,
  filename = excluded.filename,
  storage_path = excluded.storage_path,
  file_type = excluded.file_type,
  file_size = excluded.file_size,
  width = excluded.width,
  height = excluded.height,
  duration_seconds = excluded.duration_seconds,
  thumbnail_path = excluded.thumbnail_path,
  tags = excluded.tags,
  description = excluded.description,
  is_favorite = excluded.is_favorite,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  source = excluded.source,
  source_ref = excluded.source_ref,
  prompt_id = excluded.prompt_id,
  metadata = excluded.metadata,
  processing_status = excluded.processing_status,
  poster_variant_path = excluded.poster_variant_path,
  thumb_variant_path = excluded.thumb_variant_path,
  preview_variant_path = excluded.preview_variant_path,
  processing_attempts = excluded.processing_attempts,
  processing_next_retry_at = excluded.processing_next_retry_at,
  processing_last_error = excluded.processing_last_error,
  processing_updated_at = excluded.processing_updated_at;

create temp table tmp_ai_generation_outputs (like public.ai_generation_outputs including defaults) on commit drop;
\copy tmp_ai_generation_outputs from '${TMP_DIR}/public_ai_generation_outputs.csv' csv
insert into public.ai_generation_outputs (
  id, generation_id, user_id, output_index, provider_request_id, result_url, media_file_id,
  metadata, created_at, updated_at, generation_attempt_id
)
select
  id, generation_id, user_id, output_index, provider_request_id, result_url, media_file_id,
  metadata, created_at, updated_at, generation_attempt_id
from tmp_ai_generation_outputs
on conflict (id) do update set
  generation_id = excluded.generation_id,
  user_id = excluded.user_id,
  output_index = excluded.output_index,
  provider_request_id = excluded.provider_request_id,
  result_url = excluded.result_url,
  media_file_id = excluded.media_file_id,
  metadata = excluded.metadata,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  generation_attempt_id = excluded.generation_attempt_id;

create temp table tmp_generation_projection (like public.generation_projection including defaults) on commit drop;
\copy tmp_generation_projection from '${TMP_DIR}/public_generation_projection.csv' csv
insert into public.generation_projection (
  generation_id, user_id, request_id, provider, provider_request_id, latest_attempt_id, status,
  task_state, queue_state, display_prompt, model_id, preview_url, preview_storage_path,
  full_storage_path, error_message, error_message_short, error_detail, save_state,
  hidden_in_reference_grid, reference_grid_visible, publication_state, result_urls,
  saved_media_ids, generation_replay, character_context, style_context, started_at,
  completed_at, created_at, updated_at, source_ref, project_id
)
select
  generation_id, user_id, request_id, provider, provider_request_id, latest_attempt_id, status,
  task_state, queue_state, display_prompt, model_id, preview_url, preview_storage_path,
  full_storage_path, error_message, error_message_short, error_detail, save_state,
  hidden_in_reference_grid, reference_grid_visible, publication_state, result_urls,
  saved_media_ids, generation_replay, character_context, style_context, started_at,
  completed_at, created_at, updated_at, source_ref, project_id
from tmp_generation_projection
on conflict (generation_id) do update set
  user_id = excluded.user_id,
  request_id = excluded.request_id,
  provider = excluded.provider,
  provider_request_id = excluded.provider_request_id,
  latest_attempt_id = excluded.latest_attempt_id,
  status = excluded.status,
  task_state = excluded.task_state,
  queue_state = excluded.queue_state,
  display_prompt = excluded.display_prompt,
  model_id = excluded.model_id,
  preview_url = excluded.preview_url,
  preview_storage_path = excluded.preview_storage_path,
  full_storage_path = excluded.full_storage_path,
  error_message = excluded.error_message,
  error_message_short = excluded.error_message_short,
  error_detail = excluded.error_detail,
  save_state = excluded.save_state,
  hidden_in_reference_grid = excluded.hidden_in_reference_grid,
  reference_grid_visible = excluded.reference_grid_visible,
  publication_state = excluded.publication_state,
  result_urls = excluded.result_urls,
  saved_media_ids = excluded.saved_media_ids,
  generation_replay = excluded.generation_replay,
  character_context = excluded.character_context,
  style_context = excluded.style_context,
  started_at = excluded.started_at,
  completed_at = excluded.completed_at,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  source_ref = excluded.source_ref,
  project_id = excluded.project_id;

create temp table tmp_generation_publications (like public.generation_publications including defaults) on commit drop;
\copy tmp_generation_publications from '${TMP_DIR}/public_generation_publications.csv' csv
insert into public.generation_publications (
  id, generation_id, generation_attempt_id, generation_output_id, user_id, publication_state,
  reusable, visible_in_ai_studio, visible_in_reference_grid, owned_media_file_id, preview_url,
  full_url, preview_storage_path, full_storage_path, published_at, archived_at, archive_reason,
  metadata, created_at, updated_at
)
select
  id, generation_id, generation_attempt_id, generation_output_id, user_id, publication_state,
  reusable, visible_in_ai_studio, visible_in_reference_grid, owned_media_file_id, preview_url,
  full_url, preview_storage_path, full_storage_path, published_at, archived_at, archive_reason,
  metadata, created_at, updated_at
from tmp_generation_publications
on conflict (id) do update set
  generation_id = excluded.generation_id,
  generation_attempt_id = excluded.generation_attempt_id,
  generation_output_id = excluded.generation_output_id,
  user_id = excluded.user_id,
  publication_state = excluded.publication_state,
  reusable = excluded.reusable,
  visible_in_ai_studio = excluded.visible_in_ai_studio,
  visible_in_reference_grid = excluded.visible_in_reference_grid,
  owned_media_file_id = excluded.owned_media_file_id,
  preview_url = excluded.preview_url,
  full_url = excluded.full_url,
  preview_storage_path = excluded.preview_storage_path,
  full_storage_path = excluded.full_storage_path,
  published_at = excluded.published_at,
  archived_at = excluded.archived_at,
  archive_reason = excluded.archive_reason,
  metadata = excluded.metadata,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

create temp table tmp_project_media_items (like public.project_media_items including defaults) on commit drop;
\copy tmp_project_media_items from '${TMP_DIR}/public_project_media_items.csv' csv
insert into public.project_media_items (project_id, media_file_id, user_id, created_at, updated_at)
select project_id, media_file_id, user_id, created_at, updated_at
from tmp_project_media_items
on conflict (project_id, media_file_id) do update set
  user_id = excluded.user_id,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

create temp table tmp_media_events (like public.media_events including defaults) on commit drop;
\copy tmp_media_events from '${TMP_DIR}/public_media_events.csv' csv
insert into public.media_events (id, user_id, event_type, entity_type, entity_id, metadata, created_at)
select id, user_id, event_type, entity_type, entity_id, metadata, created_at
from tmp_media_events
on conflict (id) do update set
  user_id = excluded.user_id,
  event_type = excluded.event_type,
  entity_type = excluded.entity_type,
  entity_id = excluded.entity_id,
  metadata = excluded.metadata,
  created_at = excluded.created_at;

commit;
SQL
