-- pg_net control-plane failure taxonomy diagnostics (read-only)
--
-- Purpose:
-- 1) Measure pending request queue depth.
-- 2) Classify recent response failures into deterministic buckets.
-- 3) Surface recent failing responses for incident packets.
-- 4) Show observable response-retention window in `_http_response`.
--
-- Notes:
-- - `net._http_response` is ephemeral (default retention often 6h) and unlogged.
-- - Archive required forensic rows before retention expiry.

-- 1) Current queue depth.
select count(*) as pending_http_request_count
from net.http_request_queue;

-- 2) Last 6h failure-class summary.
with classified as (
  select
    r.id,
    r.created,
    r.status_code,
    r.timed_out,
    r.error_msg,
    case
      when coalesce(r.timed_out, false) then 'timeout'
      when r.error_msg is not null and coalesce(r.status_code, 0) = 0 then 'transport_error'
      when coalesce(r.status_code, 0) >= 500 then 'http_5xx'
      when coalesce(r.status_code, 0) >= 400 then 'http_4xx'
      when r.error_msg is not null then 'transport_error'
      else 'ok'
    end as failure_class
  from net._http_response r
  where r.created > now() - interval '6 hours'
)
select
  failure_class,
  count(*) as response_count
from classified
where failure_class <> 'ok'
group by failure_class
order by response_count desc, failure_class;

-- 3) Recent failure details (last 200 rows).
with classified as (
  select
    r.id,
    r.created,
    r.status_code,
    r.timed_out,
    r.error_msg,
    case
      when coalesce(r.timed_out, false) then 'timeout'
      when r.error_msg is not null and coalesce(r.status_code, 0) = 0 then 'transport_error'
      when coalesce(r.status_code, 0) >= 500 then 'http_5xx'
      when coalesce(r.status_code, 0) >= 400 then 'http_4xx'
      when r.error_msg is not null then 'transport_error'
      else 'ok'
    end as failure_class
  from net._http_response r
  where r.created > now() - interval '6 hours'
)
select
  id as request_id,
  created,
  failure_class,
  status_code,
  timed_out,
  error_msg
from classified
where failure_class <> 'ok'
order by created desc
limit 200;

-- 4) Observed `_http_response` retention window.
select
  min(created) as oldest_response_utc,
  max(created) as newest_response_utc,
  case
    when min(created) is null or max(created) is null then null
    else extract(epoch from (max(created) - min(created)))::bigint
  end as observed_span_seconds,
  count(*) as retained_response_rows
from net._http_response;
