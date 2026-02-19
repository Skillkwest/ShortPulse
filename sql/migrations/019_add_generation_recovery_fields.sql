-- Add minimal recovery-state columns and indexes for Fal reliability reconciler workflows.

alter table public.ai_generations
    add column if not exists failure_reason_code text;

alter table public.ai_generations
    add column if not exists recovery_state text;

alter table public.ai_generations
    add column if not exists recovery_attempts integer not null default 0;

alter table public.ai_generations
    add column if not exists last_recovery_at timestamptz;

alter table public.ai_generations
    add column if not exists next_recovery_at timestamptz;

alter table public.ai_generations
    add column if not exists last_media_detected_at timestamptz;

update public.ai_generations
set recovery_state = 'none'
where recovery_state is null;

alter table public.ai_generations
    alter column recovery_state set default 'none';

alter table public.ai_generations
    alter column recovery_state set not null;

alter table public.ai_generations
    drop constraint if exists ai_generations_recovery_state_check;

alter table public.ai_generations
    add constraint ai_generations_recovery_state_check
    check (recovery_state in ('none', 'queued', 'recovering', 'recovered', 'exhausted'));

-- Deduplicate legacy rows before enforcing unique (user_id, request_id).
-- Keep the most authoritative row per pair, preferring:
-- success > running > pending > fail, then newest completed/created timestamps.
with ranked as (
    select
        id,
        user_id,
        request_id,
        row_number() over (
            partition by user_id, request_id
            order by
                case status
                    when 'success' then 4
                    when 'running' then 3
                    when 'pending' then 2
                    when 'fail' then 1
                    else 0
                end desc,
                (completed_at is not null) desc,
                completed_at desc nulls last,
                created_at desc,
                id desc
        ) as row_num
    from public.ai_generations
    where request_id is not null
),
dupe_pairs as (
    select user_id, request_id
    from ranked
    group by user_id, request_id
    having count(*) > 1
),
winner_rows as (
    select r.id, r.user_id, r.request_id
    from ranked r
    join dupe_pairs d
      on d.user_id = r.user_id
     and d.request_id = r.request_id
    where r.row_num = 1
),
loser_rows as (
    select r.id, r.user_id, r.request_id
    from ranked r
    join dupe_pairs d
      on d.user_id = r.user_id
     and d.request_id = r.request_id
    where r.row_num > 1
),
merged_loser_metadata as (
    select
        w.id as winner_id,
        coalesce(jsonb_object_agg(k.key, k.value), '{}'::jsonb) as merged_metadata
    from winner_rows w
    join loser_rows l
      on l.user_id = w.user_id
     and l.request_id = w.request_id
    join public.ai_generations g
      on g.id = l.id
    left join lateral jsonb_each(coalesce(g.metadata, '{}'::jsonb)) k on true
    group by w.id
)
update public.ai_generations g
set metadata = coalesce(g.metadata, '{}'::jsonb) || m.merged_metadata
from merged_loser_metadata m
where g.id = m.winner_id;

with ranked as (
    select
        id,
        row_number() over (
            partition by user_id, request_id
            order by
                case status
                    when 'success' then 4
                    when 'running' then 3
                    when 'pending' then 2
                    when 'fail' then 1
                    else 0
                end desc,
                (completed_at is not null) desc,
                completed_at desc nulls last,
                created_at desc,
                id desc
        ) as row_num
    from public.ai_generations
    where request_id is not null
)
delete from public.ai_generations g
using ranked r
where g.id = r.id
  and r.row_num > 1;

create unique index if not exists ai_generations_user_request_id_unique_idx
    on public.ai_generations (user_id, request_id)
    where request_id is not null;

create index if not exists ai_generations_recovery_scan_idx
    on public.ai_generations (recovery_state, next_recovery_at, created_at);
