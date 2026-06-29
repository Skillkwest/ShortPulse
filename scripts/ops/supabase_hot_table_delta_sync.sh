#!/usr/bin/env bash
# Purpose: catch up the small set of hot tables that continue drifting while staging stays live.
# Responsibilities: read production watermarks, export only newer staging rows to temp CSV files,
# then upsert them into production in dependency order.

set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash scripts/ops/supabase_hot_table_delta_sync.sh \
    --source-url <postgres-url> \
    --target-url <postgres-url> \
    [--source-label staging] \
    [--target-label production] \
    --apply

Env fallbacks:
  SHORTPULSE_STAGING_DB_URL
  SHORTPULSE_PRODUCTION_DB_URL

Notes:
  - Syncs the current live-write hot tables:
  - auth.refresh_tokens
  - public.worker_instances
  - public.worker_runs
  - public.app_error_logs
  - public.app_error_events
  - public.ai_credit_reservations
  - public.ai_credit_ledger
  - public.growth_attribution_identities
  - Export scope is watermark-based from production max(updated_at/created_at).
  - Imports use primary-key upserts.
  - This script mutates the target database and requires explicit --apply.
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[nuclo-hot-sync] missing required command: $1" >&2
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

  echo "[nuclo-hot-sync] missing required command: psql" >&2
  exit 1
}

SOURCE_URL="${SHORTPULSE_STAGING_DB_URL:-}"
TARGET_URL="${SHORTPULSE_PRODUCTION_DB_URL:-}"
SOURCE_LABEL="staging"
TARGET_LABEL="production"
APPLY="false"

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
    --apply)
      APPLY="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "[nuclo-hot-sync] unknown option: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [[ "$APPLY" != "true" ]]; then
  echo "[nuclo-hot-sync] refusing to mutate target without explicit --apply." >&2
  usage >&2
  exit 1
fi

if [[ -z "$SOURCE_URL" || -z "$TARGET_URL" ]]; then
  echo "[nuclo-hot-sync] source and target URLs are required." >&2
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

worker_runs_max="$(query_scalar "$TARGET_URL" "select coalesce(max(created_at), '-infinity'::timestamptz) from public.worker_runs;")"
worker_instances_max="$(query_scalar "$TARGET_URL" "select coalesce(max(updated_at), '-infinity'::timestamptz) from public.worker_instances;")"
app_error_events_max="$(query_scalar "$TARGET_URL" "select coalesce(max(created_at), '-infinity'::timestamptz) from public.app_error_events;")"
app_error_logs_max="$(query_scalar "$TARGET_URL" "select coalesce(max(updated_at), '-infinity'::timestamptz) from public.app_error_logs;")"
growth_attr_max="$(query_scalar "$TARGET_URL" "select coalesce(max(updated_at), '-infinity'::timestamptz) from public.growth_attribution_identities;")"
refresh_tokens_max="$(query_scalar "$TARGET_URL" "select coalesce(max(updated_at), '-infinity'::timestamptz) from auth.refresh_tokens;")"
credit_reservations_max="$(query_scalar "$TARGET_URL" "select coalesce(max(updated_at), '-infinity'::timestamptz) from public.ai_credit_reservations;")"
credit_ledger_max="$(query_scalar "$TARGET_URL" "select coalesce(max(created_at), '-infinity'::timestamptz) from public.ai_credit_ledger;")"

copy_export \
  "select instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id from auth.refresh_tokens where updated_at > timestamptz '${refresh_tokens_max}' order by updated_at, id" \
  "$TMP_DIR/auth_refresh_tokens.csv"
copy_export \
  "select id, worker_type, instance_key, instance_label, hostname, pid, build_id, status, started_at, last_heartbeat_at, last_ok_at, last_error, last_response, metadata, created_at, updated_at from public.worker_instances where updated_at > timestamptz '${worker_instances_max}' order by updated_at, id" \
  "$TMP_DIR/public_worker_instances.csv"
copy_export \
  "select id, worker_instance_id, trigger_source, route_label, status, started_at, completed_at, metrics, error_summary, metadata, created_at, updated_at from public.worker_runs where created_at > timestamptz '${worker_runs_max}' order by created_at, id" \
  "$TMP_DIR/public_worker_runs.csv"
copy_export \
  "select id, fingerprint, source, scope, severity, status, message, stack, route, endpoint, request_id, http_status, user_id, user_email, metadata, first_seen_at, last_seen_at, occurrences_count, created_at, updated_at from public.app_error_logs where updated_at > timestamptz '${app_error_logs_max}' order by updated_at, id" \
  "$TMP_DIR/public_app_error_logs.csv"
copy_export \
  "select id, incident_id, fingerprint, source, scope, severity, message, stack, route, endpoint, request_id, http_status, user_id, user_email, metadata, occurred_at, created_at from public.app_error_events where created_at > timestamptz '${app_error_events_max}' order by created_at, id" \
  "$TMP_DIR/public_app_error_events.csv"
copy_export \
  "select id, user_id, source_ref, provider_request_id, model_id, amount_cents, status, reason, metadata, created_at, updated_at, captured_at, released_at from public.ai_credit_reservations where updated_at > timestamptz '${credit_reservations_max}' order by updated_at, id" \
  "$TMP_DIR/public_ai_credit_reservations.csv"
copy_export \
  "select id, user_id, change_cents, reason, ref_id, created_at, source, source_ref, metadata, created_by from public.ai_credit_ledger where created_at > timestamptz '${credit_ledger_max}' order by created_at, id" \
  "$TMP_DIR/public_ai_credit_ledger.csv"
copy_export \
  "select anonymous_id, user_id, first_utm_source, first_utm_medium, first_utm_campaign, first_landing_path, first_referrer_host, last_utm_source, last_utm_medium, last_utm_campaign, last_landing_path, last_referrer_host, first_seen_at, last_seen_at, signup_submitted_at, signup_completed_at, stitched_at, created_at, updated_at from public.growth_attribution_identities where updated_at > timestamptz '${growth_attr_max}' order by updated_at, anonymous_id" \
  "$TMP_DIR/public_growth_attribution_identities.csv"

echo "[nuclo-hot-sync] source=$SOURCE_LABEL target=$TARGET_LABEL"
wc -l \
  "$TMP_DIR/auth_refresh_tokens.csv" \
  "$TMP_DIR/public_worker_instances.csv" \
  "$TMP_DIR/public_worker_runs.csv" \
  "$TMP_DIR/public_app_error_logs.csv" \
  "$TMP_DIR/public_app_error_events.csv" \
  "$TMP_DIR/public_ai_credit_reservations.csv" \
  "$TMP_DIR/public_ai_credit_ledger.csv" \
  "$TMP_DIR/public_growth_attribution_identities.csv"

"$PSQL_BIN" "$TARGET_URL" -v ON_ERROR_STOP=1 <<SQL
begin;

create temp table tmp_auth_refresh_tokens (like auth.refresh_tokens including defaults) on commit drop;
\copy tmp_auth_refresh_tokens from '${TMP_DIR}/auth_refresh_tokens.csv' csv
insert into auth.refresh_tokens (instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id)
select instance_id, id, token, user_id, revoked, created_at, updated_at, parent, session_id
from tmp_auth_refresh_tokens
on conflict (id) do update set
  instance_id = excluded.instance_id,
  token = excluded.token,
  user_id = excluded.user_id,
  revoked = excluded.revoked,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  parent = excluded.parent,
  session_id = excluded.session_id;

create temp table tmp_worker_instances (like public.worker_instances including defaults) on commit drop;
\copy tmp_worker_instances from '${TMP_DIR}/public_worker_instances.csv' csv
insert into public.worker_instances (id, worker_type, instance_key, instance_label, hostname, pid, build_id, status, started_at, last_heartbeat_at, last_ok_at, last_error, last_response, metadata, created_at, updated_at)
select id, worker_type, instance_key, instance_label, hostname, pid, build_id, status, started_at, last_heartbeat_at, last_ok_at, last_error, last_response, metadata, created_at, updated_at
from tmp_worker_instances
on conflict (id) do update set
  worker_type = excluded.worker_type,
  instance_key = excluded.instance_key,
  instance_label = excluded.instance_label,
  hostname = excluded.hostname,
  pid = excluded.pid,
  build_id = excluded.build_id,
  status = excluded.status,
  started_at = excluded.started_at,
  last_heartbeat_at = excluded.last_heartbeat_at,
  last_ok_at = excluded.last_ok_at,
  last_error = excluded.last_error,
  last_response = excluded.last_response,
  metadata = excluded.metadata,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

create temp table tmp_worker_runs (like public.worker_runs including defaults) on commit drop;
\copy tmp_worker_runs from '${TMP_DIR}/public_worker_runs.csv' csv
insert into public.worker_runs (id, worker_instance_id, trigger_source, route_label, status, started_at, completed_at, metrics, error_summary, metadata, created_at, updated_at)
select id, worker_instance_id, trigger_source, route_label, status, started_at, completed_at, metrics, error_summary, metadata, created_at, updated_at
from tmp_worker_runs
on conflict (id) do update set
  worker_instance_id = excluded.worker_instance_id,
  trigger_source = excluded.trigger_source,
  route_label = excluded.route_label,
  status = excluded.status,
  started_at = excluded.started_at,
  completed_at = excluded.completed_at,
  metrics = excluded.metrics,
  error_summary = excluded.error_summary,
  metadata = excluded.metadata,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

create temp table tmp_app_error_logs (like public.app_error_logs including defaults) on commit drop;
\copy tmp_app_error_logs from '${TMP_DIR}/public_app_error_logs.csv' csv
insert into public.app_error_logs (id, fingerprint, source, scope, severity, status, message, stack, route, endpoint, request_id, http_status, user_id, user_email, metadata, first_seen_at, last_seen_at, occurrences_count, created_at, updated_at)
select id, fingerprint, source, scope, severity, status, message, stack, route, endpoint, request_id, http_status, user_id, user_email, metadata, first_seen_at, last_seen_at, occurrences_count, created_at, updated_at
from tmp_app_error_logs
on conflict (id) do update set
  fingerprint = excluded.fingerprint,
  source = excluded.source,
  scope = excluded.scope,
  severity = excluded.severity,
  status = excluded.status,
  message = excluded.message,
  stack = excluded.stack,
  route = excluded.route,
  endpoint = excluded.endpoint,
  request_id = excluded.request_id,
  http_status = excluded.http_status,
  user_id = excluded.user_id,
  user_email = excluded.user_email,
  metadata = excluded.metadata,
  first_seen_at = excluded.first_seen_at,
  last_seen_at = excluded.last_seen_at,
  occurrences_count = excluded.occurrences_count,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

create temp table tmp_app_error_events (like public.app_error_events including defaults) on commit drop;
\copy tmp_app_error_events from '${TMP_DIR}/public_app_error_events.csv' csv
insert into public.app_error_events (id, incident_id, fingerprint, source, scope, severity, message, stack, route, endpoint, request_id, http_status, user_id, user_email, metadata, occurred_at, created_at)
select id, incident_id, fingerprint, source, scope, severity, message, stack, route, endpoint, request_id, http_status, user_id, user_email, metadata, occurred_at, created_at
from tmp_app_error_events
on conflict (id) do update set
  incident_id = excluded.incident_id,
  fingerprint = excluded.fingerprint,
  source = excluded.source,
  scope = excluded.scope,
  severity = excluded.severity,
  message = excluded.message,
  stack = excluded.stack,
  route = excluded.route,
  endpoint = excluded.endpoint,
  request_id = excluded.request_id,
  http_status = excluded.http_status,
  user_id = excluded.user_id,
  user_email = excluded.user_email,
  metadata = excluded.metadata,
  occurred_at = excluded.occurred_at,
  created_at = excluded.created_at;

create temp table tmp_ai_credit_reservations (like public.ai_credit_reservations including defaults) on commit drop;
\copy tmp_ai_credit_reservations from '${TMP_DIR}/public_ai_credit_reservations.csv' csv
insert into public.ai_credit_reservations (
  id, user_id, source_ref, provider_request_id, model_id, amount_cents, status, reason,
  metadata, created_at, updated_at, captured_at, released_at
)
select
  id, user_id, source_ref, provider_request_id, model_id, amount_cents, status, reason,
  metadata, created_at, updated_at, captured_at, released_at
from tmp_ai_credit_reservations
on conflict (id) do update set
  user_id = excluded.user_id,
  source_ref = excluded.source_ref,
  provider_request_id = excluded.provider_request_id,
  model_id = excluded.model_id,
  amount_cents = excluded.amount_cents,
  status = excluded.status,
  reason = excluded.reason,
  metadata = excluded.metadata,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at,
  captured_at = excluded.captured_at,
  released_at = excluded.released_at;

create temp table tmp_ai_credit_ledger (like public.ai_credit_ledger including defaults) on commit drop;
\copy tmp_ai_credit_ledger from '${TMP_DIR}/public_ai_credit_ledger.csv' csv
insert into public.ai_credit_ledger (
  id, user_id, change_cents, reason, ref_id, created_at, source, source_ref, metadata, created_by
)
select
  id, user_id, change_cents, reason, ref_id, created_at, source, source_ref, metadata, created_by
from tmp_ai_credit_ledger
on conflict (id) do update set
  user_id = excluded.user_id,
  change_cents = excluded.change_cents,
  reason = excluded.reason,
  ref_id = excluded.ref_id,
  created_at = excluded.created_at,
  source = excluded.source,
  source_ref = excluded.source_ref,
  metadata = excluded.metadata,
  created_by = excluded.created_by;

create temp table tmp_growth_attribution_identities (like public.growth_attribution_identities including defaults) on commit drop;
\copy tmp_growth_attribution_identities from '${TMP_DIR}/public_growth_attribution_identities.csv' csv
insert into public.growth_attribution_identities (anonymous_id, user_id, first_utm_source, first_utm_medium, first_utm_campaign, first_landing_path, first_referrer_host, last_utm_source, last_utm_medium, last_utm_campaign, last_landing_path, last_referrer_host, first_seen_at, last_seen_at, signup_submitted_at, signup_completed_at, stitched_at, created_at, updated_at)
select anonymous_id, user_id, first_utm_source, first_utm_medium, first_utm_campaign, first_landing_path, first_referrer_host, last_utm_source, last_utm_medium, last_utm_campaign, last_landing_path, last_referrer_host, first_seen_at, last_seen_at, signup_submitted_at, signup_completed_at, stitched_at, created_at, updated_at
from tmp_growth_attribution_identities
on conflict (anonymous_id) do update set
  user_id = excluded.user_id,
  first_utm_source = excluded.first_utm_source,
  first_utm_medium = excluded.first_utm_medium,
  first_utm_campaign = excluded.first_utm_campaign,
  first_landing_path = excluded.first_landing_path,
  first_referrer_host = excluded.first_referrer_host,
  last_utm_source = excluded.last_utm_source,
  last_utm_medium = excluded.last_utm_medium,
  last_utm_campaign = excluded.last_utm_campaign,
  last_landing_path = excluded.last_landing_path,
  last_referrer_host = excluded.last_referrer_host,
  first_seen_at = excluded.first_seen_at,
  last_seen_at = excluded.last_seen_at,
  signup_submitted_at = excluded.signup_submitted_at,
  signup_completed_at = excluded.signup_completed_at,
  stitched_at = excluded.stitched_at,
  created_at = excluded.created_at,
  updated_at = excluded.updated_at;

commit;
SQL
