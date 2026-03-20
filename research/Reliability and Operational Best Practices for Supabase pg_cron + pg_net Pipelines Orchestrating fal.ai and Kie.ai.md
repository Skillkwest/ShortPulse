# Reliability and Operational Best Practices for Supabase pg_cron + pg_net Pipelines Orchestrating fal.ai and Kie.ai

A media-generation app that fans out work to external “media hubs” (e.g., fal and Kie) is effectively a distributed system whose dominant failure modes are *partial*, *silent*, and *duplicate* outcomes: a request that times out may still succeed, a callback may arrive twice, or a worker may die after committing state but before acknowledging completion. citeturn10search0turn17search26turn4view0turn3view2

In that world, the “best practice” shape is not “no failures,” but “failures become bounded, observable, and recoverable without wedging the queue.” The core move is to define system invariants and enforce them with time-bounded leases, deterministic state transitions, idempotency constraints, and a reconciliation loop that cannot itself create load spikes or starvation. citeturn10search0turn12search5turn9search0turn4view0

## System invariants that prevent permanent queue wedges

Your current approach—queue + recovery/drainage + hourly “crumb”/health scans—matches a real, common pattern: **reconciliation** (periodically recomputing “what should be true” and repairing drift). That’s directionally correct, but it tends to become expensive and slow if it’s your *primary* reliability mechanism. To avoid “stuck generations permanently in the queue,” you want a smaller set of invariants that make “wedges” impossible by construction.

### The non-negotiable invariants for AI media orchestration

A queue-backed orchestration system that talks to external providers is healthiest when these invariants are true:

**Every queued item is time-bounded.**  
If something can be “in progress forever,” you’ve allowed an unbounded wedge. Time bounds can be implemented as leases (lock with expiry), provider-level deadlines, and/or explicit “stalled” detection. citeturn12search5turn17search0turn20view1

**Every side effect is idempotent.**  
Both fal and Kie explicitly warn that duplicate callbacks can happen and handlers must be idempotent. citeturn4view0turn3view2  
Temporal’s durable-execution guidance generalizes this: if work can be retried or delivered “at least once,” you must design for duplicates. citeturn17search26turn17search10

**“Completed” means “durably persisted,” not “provider says done.”**  
fal’s generated media is retained with defaults and can expire; it can be controlled per-request. Kie documents explicit URL validity windows (e.g., 14 days for certain video URLs) and recommends immediate download. citeturn5search0turn5search4turn3view2  
So the durable definition of “complete” in your system should be: provider completed **and** you have copied the artifact to storage you control **and** you have verified it (size/checksum at minimum).

**Reconciliation exists, but it is not the only thing preventing wedges.**  
Reconciliation should mop up rare edge cases (webhook lost, worker crash, provider blackhole), not constantly rescue the primary flow. citeturn9search0turn10search0turn16view0

### A practical reference state machine (provider-agnostic)

A good “lane” to continue in is codifying your generation lifecycle as a strict state machine with allowed transitions and deadlines:

- `SUBMITTED` (provider request created; have provider_request_id / taskId)
- `WAITING_CALLBACK` (primary path)
- `CALLBACK_RECEIVED` (raw callback accepted + persisted)
- `ARTIFACT_FETCHING` (download/copy in progress)
- `COMPLETED` (durable artifact stored + verified)
- `FAILED_TERMINAL` (non-retryable)
- `FAILED_RETRYABLE` (eligible for retry)
- `QUARANTINED` (poison job; needs operator attention or specialized automated handling)

This structure is what lets you quarantine poison jobs instead of letting them permanently occupy the “ready” path.

## pg_cron failure detection on Supabase managed Postgres

Supabase Cron is built on pg_cron; jobs are stored in `cron.job`, and runs are recorded in `cron.job_run_details`. citeturn20view1turn7view0  
Supabase additionally publishes operational guidance: avoid running more than 8 cron jobs concurrently, and keep each job under 10 minutes for best performance. citeturn20view1

Crucially, **pg_cron has its own queuing behavior**: it can run multiple jobs in parallel, but only *one instance of a specific job at a time*; if a second instance triggers before the first finishes, it queues behind it. This is a common “invisible wedge” if a job’s runtime exceeds its schedule interval. citeturn7view0turn20view0

### Exact definitions and SQL checks for “missing / inactive / failing / stalled”

To make “exact queries/thresholds” feasible, the strongest practice is to maintain a small **job registry** table that encodes the expectations you care about (interval, max runtime, owner, severity). That avoids trying to infer expected cadence from arbitrary cron expressions, which is fragile.

A minimal registry:

```sql
create schema if not exists ops;

create table if not exists ops.cron_job_registry (
  jobname text primary key,
  expected_interval_seconds integer not null, -- e.g. 60, 300, 3600
  max_runtime_seconds integer not null,       -- e.g. 60, 300, 600
  max_missed_runs integer not null default 2, -- threshold for "missing"
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
```

This is consistent with Supabase’s own advice to keep cron jobs short and spaced to avoid overload. citeturn20view1turn20view0

#### Job missing

**Definition (operational):** a job that is marked `enabled` in your registry but has no corresponding row in `cron.job`.

```sql
select r.jobname
from ops.cron_job_registry r
left join cron.job j on j.jobname = r.jobname
where r.enabled = true
  and j.jobname is null;
```

This assumes the Supabase-visible `cron.job` includes `jobname` (as shown in Supabase’s pg_cron debugging guide examples). citeturn20view0

**Threshold:** any missing job is a page-worthy defect if it’s safety-critical; otherwise ticket. The point is that “missing” is binary.

#### Job inactive

There are two “inactive” vectors you should treat distinctly:

**Inactive by configuration:** job exists but is not active (or globally disabled). Supabase recommends managing jobs via `cron.schedule`, `cron.alter_job`, and `cron.unschedule`. citeturn20view0turn7view0

```sql
-- jobs in cron.job that are inactive (if your pg_cron schema exposes active)
select jobname, schedule, command
from cron.job
where jobname in (select jobname from ops.cron_job_registry where enabled = true)
  and active = false;
```

If your `cron.job` does not expose `active`, treat “inactive” as “missing heartbeats” (below), and encode enablement in your registry instead.

**Inactive due to scheduler death:** Supabase explicitly instructs checking `pg_stat_activity` for `application_name ilike 'pg_cron scheduler'`; if absent, the worker has died and requires a reboot to revive. citeturn20view0

```sql
select count(*) = 0 as scheduler_missing
from pg_stat_activity
where application_name ilike 'pg_cron scheduler';
```

**Threshold:** `scheduler_missing = true` is urgent because it can silently stop all automation. citeturn20view0

#### Job failing

Supabase recommends querying `cron.job_run_details` for non-succeeded/non-running statuses over a recent window. citeturn20view0  
pg_cron’s `job_run_details` includes `status`, `return_message`, and timestamps for diagnosis. citeturn7view0turn20view0

A robust “failing” signal uses both a recency window and a failure ratio:

```sql
with runs as (
  select
    j.jobname,
    d.status,
    d.start_time
  from cron.job_run_details d
  join cron.job j using (jobid)
  where d.start_time > now() - interval '6 hours'
    and j.jobname in (select jobname from ops.cron_job_registry where enabled = true)
)
select
  jobname,
  count(*) filter (where status = 'failed') as failed_runs,
  count(*) as total_runs,
  (count(*) filter (where status = 'failed'))::float / nullif(count(*),0) as fail_ratio
from runs
group by jobname
having count(*) >= 3
   and ((count(*) filter (where status = 'failed')) >= 2 or
        (count(*) filter (where status = 'failed'))::float / count(*) >= 0.5);
```

**Threshold guidance:**  
- Page if `fail_ratio >= 0.5` for critical jobs (recovery, archival, billing/credits).  
- Ticket if sporadic single failures.  
This aligns with SLO thinking: alert on sustained budget burn rather than single blips. citeturn9search2turn9search0

#### Job stalled

Supabase recommends keeping each cron job under ~10 minutes. citeturn20view1  
A “stalled” job is one that is recorded as `running` with no `end_time` beyond an expected maximum.

```sql
select
  j.jobname,
  d.runid,
  d.start_time,
  now() - d.start_time as running_for
from cron.job_run_details d
join cron.job j using (jobid)
join ops.cron_job_registry r on r.jobname = j.jobname
where d.status = 'running'
  and d.end_time is null
  and now() - d.start_time > make_interval(secs => r.max_runtime_seconds);
```

**Threshold:** set `max_runtime_seconds` per job. For “fleet scan” jobs, keep it well under your schedule interval to avoid pg_cron’s per-job serialization from building a hidden backlog. citeturn7view0turn20view1

### A better alternative to hourly “crumb scans” for cron health

If hourly scans are currently doing the heavy lifting, make them more surgical:

- Scan *cron control-plane* first (scheduler alive, failing/stalled jobs) and only then scan tenant/job state. citeturn20view0turn9search0
- Partition scans to avoid synchronized hourly spikes (“cron storms”)—randomized jitter is explicitly recommended in distributed systems because periodic cron-like bursts can amplify overload and retry storms. citeturn10search0turn10search19

## pg_net HTTP dispatch diagnostics, retention, and evidence preservation

pg_net is asynchronous and runs requests only after the transaction commits, which matters if you enqueue HTTP requests inside longer transactions. citeturn16view0  
It stores pending requests in `net.http_request_queue` (deleted when executed) and stores responses in an unlogged `net._http_response` table by default for 6 hours. citeturn16view0turn1view0  
Unlogged tables are not preserved across crashes/unclean shutdowns, so you cannot treat pg_net’s internal tables as durable evidence. citeturn16view0

### Validate retention windows and configure them explicitly

Supabase documents:

- default response retention: **6 hours** (via `net._http_response`) citeturn16view0turn1view0  
- configurable TTL (`pg_net.ttl`) starting with pg_net v0.12.0+ and requiring worker restart with `net.worker_restart()` citeturn16view0

That gives you a clear design constraint: anything you need for forensics, billing disputes, or incident triage must be copied out of `net._http_response` before it rolls off.

### Failure signatures you can classify deterministically

The pg_net schema makes it straightforward to produce a stable taxonomy:

- HTTP failures: `status_code >= 400` citeturn16view0  
- timeouts: `timed_out = true` and/or timeout-like `error_msg` citeturn16view0turn0search16  
- transport errors: non-null `error_msg` (often with null `status_code`) citeturn16view0

Baseline diagnostic query (last 6 hours, aligned to default retention):

```sql
select
  id as request_id,
  created,
  status_code,
  timed_out,
  error_msg,
  content_type
from net._http_response
where created > now() - interval '6 hours'
  and (status_code >= 400 or timed_out = true or error_msg is not null)
order by created desc;
```

Supabase’s troubleshooting notes also describe a specific “all columns null except id/error_msg/created” pattern that can appear in timeout scenarios and may require upgrading Postgres/pg_net for fixes. citeturn0search16turn16view0

### Persist evidence safely before it rolls off

Because you should not rely on triggers on pg_net internal tables (Supabase explicitly warns against adding triggers to `net` schema tables), use a scheduled archival job instead. citeturn0search0turn20view1

A safe archival pattern:

```sql
create table if not exists ops.http_response_archive (
  request_id bigint primary key,
  archived_at timestamptz not null default now(),
  created timestamptz,
  status_code int,
  timed_out bool,
  error_msg text,
  headers jsonb,
  content text
);

insert into ops.http_response_archive (request_id, created, status_code, timed_out, error_msg, headers, content)
select
  r.id, r.created, r.status_code, r.timed_out, r.error_msg, r.headers, r.content
from net._http_response r
where r.created > now() - interval '6 hours'
  and not exists (
    select 1 from ops.http_response_archive a where a.request_id = r.id
  );
```

Schedule this at a cadence shorter than the retention window (e.g., every 5–10 minutes) with jitter to avoid synchronized load. citeturn10search0turn16view0

## Webhook reliability contract for fal and Kie and callback security hardening

Both providers provide explicit webhook behavior that should directly drive your queue deadlines, idempotency model, and incident thresholds.

### fal webhook contract you can “compile” into system rules

fal’s webhook documentation specifies:

- initial webhook delivery timeout: **15 seconds** citeturn4view0  
- retry policy: **10 retries within 2 hours** when delivery fails or times out citeturn4view0  
- handlers must be idempotent and tolerate repeat deliveries for the same `request_id` citeturn4view0turn4view1  

fal’s signature verification process is unusually well-specified:

- verification uses a JWKS endpoint and ED25519 keys citeturn4view0  
- do not cache keys longer than 24 hours (keys can change) citeturn4view0  
- reject if timestamp differs by more than ±5 minutes (replay protection + clock skew tolerance) citeturn4view0  

Those requirements strongly suggest:
- Your webhook handler must ACK quickly (within ~15 seconds), push work to async processing, and treat webhook receipt as *notification*, not completion. citeturn4view0turn3view2
- Your “callback freshness” SLI can treat a callback as valid only if it passes timestamp tolerance and signature validation. citeturn4view0turn13search2

fal also documents media retention controls and explicit expiration semantics:

- per-request media expiration can be set via `X-Fal-Object-Lifecycle-Preference` (including “no expiration”), and expired files are permanently deleted citeturn5search0turn5search2  
- generated media is available for at least 7 days by default, and fal recommends downloading and storing anything you need long-term citeturn5search4

So “artifact availability guarantees” in your system cannot be “fal finished”; it must be “we downloaded and persisted.”

### Kie.ai callback contract you can “compile” into system rules

Kie’s callback documentation (example: Runway AI video callbacks) specifies:

- callback timeout: **15 seconds** citeturn3view2  
- idempotency warning: “the same task_id may receive multiple callbacks” citeturn3view2  
- retry stopping rule: if **3 consecutive retries fail, callbacks stop** citeturn3view2  
- artifact URL validity: example video URLs “valid for 14 days,” with guidance to download immediately citeturn3view2  

Kie’s “Get Task Details” endpoint docs also recommend:

- use callbacks for production, but if polling: exponential backoff, and stop polling after 10–15 minutes; also notes that generated content URLs “typically expire after 24 hours” in that context citeturn3view3

That translates into two important operational rules:

- Your system must treat webhook delivery as **at-most-some-retries**, not guaranteed; you must have polling reconciliation. citeturn3view2turn3view3  
- Your durable artifact persistence must run immediately post-success.

### Callback security hardening: replay window, clock skew, constant-time verification

fal explicitly requires timestamp verification (±5 minutes) and a defined signing procedure. citeturn4view0  
For HMAC-style signatures (common among providers), OWASP recommends constant-time comparisons for MAC/HMAC validation to mitigate timing attacks. citeturn13search2  
RFC 9110’s idempotency semantics are a useful conceptual anchor: systems must tolerate retries when the client cannot tell if a previous request succeeded. Webhooks create the same ambiguity, in reverse. citeturn13search7

Practical hardening rules that follow directly:

- **Replay window:** reject callbacks older than your tolerated skew window (fal mandates ±5 minutes). citeturn4view0  
- **Clock discipline:** keep server time accurate (required for timestamp windows to work). citeturn4view0turn13search24  
- **Constant-time compare:** used for MAC comparisons; prefer vetted library primitives. citeturn13search2  
- **Persist raw callback evidence:** store raw body bytes (or a hash + compressed blob) *before* processing—this is essential when diagnosing disputes and duplicate deliveries, and aligns with provider expectations of idempotent handling. citeturn4view0turn3view2  

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["webhook retry timeline diagram 15 second timeout 10 retries 2 hours","dead letter queue poison message handling diagram","idempotency key database constraint diagram"],"num_per_query":1}

## Polling fallback, leases, idempotency data model, and poison-job quarantine

Your description (“generations getting stuck,” “permanently in the queue,” “errors and timeout issues,” “recovery pipeline and drainage system”) is textbook “poison job” behavior: retries happen without isolation and without a deterministic terminal/quarantine rule, eventually clogging the queue.

### Polling fallback and reconciliation cadence tuning

Given the explicit callback behaviors:

- fal retries webhooks over a 2-hour span. citeturn4view0  
- Kie may stop callbacks after 3 consecutive failures. citeturn3view2  

A practical (provider-agnostic) tuning model:

- **Fast poll window** shortly after submission (to catch early failures and missing callbacks quickly).  
- **Backoff + jitter** to avoid spikes; jitter is explicitly recommended to prevent synchronized retries/cron bursts from amplifying overload. citeturn10search0turn10search19  
- **Hard stop / escalation** at a provider-specific limit (e.g., Kie suggests stopping polling after 10–15 minutes in their task-detail best practices, even though some tasks may take longer; you can instead stop *aggressive* polling and shift to a slower reconciliation loop). citeturn3view3  

A good “two-lane” reconciliation pattern:

- **Lane A (interactive / user-facing):** poll frequently for a short period with jitter, then slow down.  
- **Lane B (fleet reconcilers):** a broader periodic sweep (e.g., every 30–60 minutes) that checks long-running jobs and ensures eventual resolution without creating bursts.

### Lease-timeout calibration with real latency distributions

Your queue should lease work to workers with an expiry so that:
- if a worker dies, the job becomes eligible again;
- if the worker is alive, it renews the lease (“heartbeat”).

This is the same core mechanism durable orchestration systems emphasize: long-running work needs heartbeats and timeouts to avoid indefinite stalls. citeturn17search0turn17search26

A concrete calibration method:

- Measure provider completion latency percentiles (`p50`, `p95`, `p99`) per model/provider.  
- Set your *lease duration* to something like `p99 + safety_margin`, and renew every `lease/3` while still processing.  
- Set a separate *maximum age* (Schedule-to-Close style) after which the job is escalated/quarantined, not retried forever. This matches the intent of schedule-to-close bounds and heartbeat-based failure detection patterns. citeturn17search0turn17search26

### Poison-job taxonomy with deterministic quarantine criteria

You asked for deterministic classes even before rebuilding architecture. The provider docs already support clear cut boundaries:

- fal: 4XX are not retried (client error), while certain 5XX/timeouts can be retried in queue-based execution; improper status usage changes retry behavior. citeturn4view3turn4view2  
- Kie: callback `code` values separate client errors (`400`) vs server errors (`500`), and they surface common “terminal-ish” messages like inappropriate content or incorrect format; they also surface “concurrency limit reached,” which is typically retryable with backoff. citeturn3view2turn18search3  
- DLQ patterns exist specifically to isolate messages that cannot be processed successfully after N tries (poison pills) rather than letting them loop forever. citeturn19search1turn19search5

A deterministic taxonomy that works well in practice:

**Retryable** (auto-retry with exponential backoff + jitter, bounded by max attempts and max age)
- provider 429 throttles / “concurrent generation limit reached” (treat as retryable with backoff) citeturn4view2turn18search3turn10search0  
- 503/504, connection errors, timed_out true citeturn4view2turn4view3turn16view0  
- missing callback but provider status still “queued/generating”

**Terminal** (do not retry automatically)
- provider indicates invalid input / policy / moderation (Kie examples include inappropriate content or incorrect format) citeturn3view2turn3view3  
- fal 4XX results (explicitly treated as client errors; not retried in their retry semantics) citeturn4view3

**Quarantine** (stop retry loops; preserve evidence; require manual or specialized automation)
- repeated retryable failures beyond attempt cap (e.g., >5 attempts or >X minutes age)  
- inconsistent state transitions (callback says success but artifact fetch fails repeatedly)  
- security anomalies (signature verification failures, timestamp outside tolerance)

The DLQ mental model is: quarantine exists to protect throughput and to enable faster root-cause diagnosis by isolating bad items. citeturn19search5turn19search1

### Idempotency data model: unique keys and constraints that block duplicates

Both providers explicitly require you to tolerate duplicate callbacks (`request_id` in fal, `task_id` in Kie). citeturn4view0turn3view2  
Temporal’s guidance generalizes this to durable systems: activities can be re-executed; design them idempotently. citeturn17search26turn17search10  
RFC 9110’s idempotency definition is a helpful north star: repeated delivery should not create repeated side effects. citeturn13search7

A concrete constraint set that prevents duplicates:

- `generations(provider, provider_request_id)` **unique**  
- `callbacks(provider, provider_request_id, callback_digest)` **unique** (digest = hash(raw_body_bytes))  
- `artifacts(generation_id, artifact_kind)` **unique** (e.g., `image`, `video`, `thumbnail`)  
- `credit_ledger(generation_id, mutation_type)` **unique** (e.g., `reserve`, `settle`, `refund`)  

And enforce state transitions as conditional updates:

```sql
update generations
set state = 'ARTIFACT_FETCHING',
    state_updated_at = now()
where id = $1
  and state = 'CALLBACK_RECEIVED';
```

This “compare-and-swap” style prevents out-of-order or duplicate transitions from corrupting state.

## SLO/SLI design, fleet scan coverage, cron storm mitigation, and incident automation

If you want your hourly crumb scans to become a principled reliability layer instead of an ad-hoc safety net, anchor them to SLIs/SLOs.

Google’s SRE guidance emphasizes:
- define SLIs as quantitative gauges of service health;
- set SLOs as targets;
- treat `100% - SLO` as an error budget. citeturn9search0turn9search4  
Alerting should focus on how quickly you burn the error budget (burn rate), not on isolated blips. citeturn9search2turn9search20

### Concrete SLIs and SLOs for your generation pipeline

These map directly to the failure modes you listed:

**Missed fleet runs (scheduler correctness)**  
- **SLI:** % of expected fleet scans that actually executed within `scan_interval + grace`  
- **SLO example:** 99.9% of scans execute within 10 minutes of expected time

This ties directly to detecting pg_cron scheduler death and job stall/failure. citeturn20view0turn20view1

**Recovery lag (time-to-repair)**  
- **SLI:** time from “job became unhealthy” → “job repaired or quarantined” (p50/p95/p99)  
- **SLO example:** p95 recovery lag < 15 minutes for retryable failures

This is the metric that will reveal whether hourly scans are too slow for user expectations.

**Stuck age percentiles (wedge pressure)**  
- **SLI:** p95/p99 age of jobs in non-terminal states (`WAITING_CALLBACK`, `ARTIFACT_FETCHING`, `RUNNING`)  
- **SLO example:** p99 stuck age < provider_retry_window + artifact_download_budget

fal provides an explicit webhook retry window (2 hours), which can bound your reconciliation expectations. citeturn4view0turn4view2

**Backlog growth rate (capacity and cost)**  
Queueing theory (Little’s Law) explains why latency spikes can explode concurrency needs and create backlogs; AWS explicitly uses Little’s Law to describe insurmountable queue backlogs. citeturn12search5turn12search3turn10search0  
- **SLI:** Δ(backlog size)/Δ(time) and minutes-to-zero at current throughput  
- **SLO example:** backlog returns to baseline within X minutes after a burst

### Fleet scan coverage model: active users vs all users

Active-only scans reduce cost, but they create blind spots: stuck work for “inactive” tenants can accumulate and later become a surprise incident (or a billing/support dispute).

A rigorous way to quantify blind spots:

- Define cohorts:  
  - `active`: user last_seen < 24h  
  - `inactive_with_outstanding_work`: last_seen >= 24h AND has jobs in non-terminal state  
- Track: `% of outstanding jobs owned by inactive tenants`

This gives you a data-driven decision whether you need:
- a second pass cohort (e.g., daily full scan), or
- a rolling sampler of inactive accounts.

This approach follows SRE thinking: measure what matters, then set objectives and budgets. citeturn9search0turn9search4

### Cron storm mitigation across all internal jobs

Periodic cron-like bursts are a known contributor to overload and retry storms; AWS explicitly calls out periodic cron jobs as a source of request bursts and recommends jitter to disperse synchronized retries. citeturn10search0turn10search19  
Supabase also recommends limiting concurrent cron jobs. citeturn20view1

Practical mitigation tactics:

- Avoid scheduling many jobs at `:00`.  
- Add per-job jitter (randomized offsets) so fleet scans and archival jobs don’t synchronize. citeturn10search0turn10search19  
- Partition fleet scans deterministically (e.g., hash tenant_id into 60 buckets; run one bucket per minute) to get full coverage without bursts.

### Per-tenant fairness controls and starvation prevention

Two relevant “high value” patterns:

- Google SRE explicitly recommends per-customer quotas so misbehaving customers receive errors while others remain unaffected during overload. citeturn18search2  
- The entity["company","Microsoft","cloud platform vendor"] Bulkhead pattern isolates resources so one tenant/dependency can’t cascade failures across the system. citeturn18search0  

In your pipeline, this becomes:

- per-tenant concurrency caps (submit + in-flight + artifact downloads)  
- per-tenant queue fairness (round-robin across tenants rather than FIFO across all jobs)  
- separate bulkheads for “interactive” vs “batch/backfill” traffic

### Operator runbook automation and incident simulation

For incident readiness, the goal is a **one-command diagnostics bundle** that captures:
- pg_cron scheduler alive + failing/stalled jobs citeturn20view0turn7view0  
- pg_net request queue depth + recent failures (before the 6-hour response TTL rolls off) citeturn16view0turn1view0  
- callback verification failure counts (fal timestamp/signature rules; Kie signature rules) citeturn4view0turn0search9  
- quarantine counts and top failure signatures

This aligns with entity["company","Google","technology company"]’s incident response guidance emphasizing structured incident management and checklists. citeturn11search29turn9search0

For ongoing confidence, regular “game days” / chaos drills are explicitly recommended in chaos engineering principles and cloud reliability guidance:

- Chaos engineering: define steady state, vary real-world events, run experiments, minimize blast radius. citeturn11search0turn11search1  
- entity["company","Amazon Web Services","cloud provider"] Well-Architected reliability guidance recommends conducting game days regularly. citeturn11search6  

In your specific pipeline, the highest-value drills are:
- provider blackhole (no callbacks, status endpoints degraded)
- webhook outage / signature key rotation issue
- 429 surge (provider throttling)
- partial DB degradation (slow queries causing lease expiry + duplicate processing)

Each drill should have explicit “steady state” metrics (queue age percentiles, callback error rate, recovery lag) so you can tell if the system held. citeturn11search0turn9search0turn12search5