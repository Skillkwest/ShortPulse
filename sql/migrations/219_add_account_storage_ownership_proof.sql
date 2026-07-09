-- Add proof-only inactive-account storage ownership diagnostics.
-- This migration intentionally adds no deletion authority and no cleanup queue.

create or replace function public.get_account_storage_ownership_proof_details(
    p_inactive_days integer default 180,
    p_user_id uuid default null,
    p_limit integer default 500
)
returns table (
    user_id uuid,
    user_email text,
    owner_state text,
    activity_status text,
    proof_status text,
    proof_reason text,
    auth_created_at timestamptz,
    auth_deleted_at timestamptz,
    last_sign_in_at timestamptz,
    last_activity_at timestamptz,
    last_generation_at timestamptz,
    last_credit_ledger_at timestamptz,
    last_media_file_at timestamptz,
    last_project_at timestamptz,
    last_workspace_at timestamptz,
    last_custom_voice_at timestamptz,
    last_voice_source_lifecycle_at timestamptz,
    last_billing_contract_at timestamptz,
    open_or_grace_contract_count bigint,
    active_credit_reservation_count bigint,
    media_file_count bigint,
    project_count bigint,
    custom_voice_count bigint,
    storage_object_count bigint,
    storage_total_mb numeric,
    inactive_days integer
)
language sql
security definer
set search_path = public, storage, auth, pg_temp
as $$
with settings as (
    select
        least(greatest(coalesce(p_inactive_days, 180), 30), 3650)::integer as inactive_days,
        least(greatest(coalesce(p_limit, 500), 1), 100000)::integer as row_limit
),
storage_prefixes as (
    select
        (split_part(btrim(coalesce(o.name, '')), '/', 1))::uuid as user_id,
        count(*)::bigint as storage_object_count,
        coalesce(
            sum(
                case
                    when coalesce(o.metadata->>'size', '') ~ '^[0-9]+$'
                        then (o.metadata->>'size')::numeric
                    else 0::numeric
                end
            ),
            0::numeric
        ) as storage_total_bytes,
        max(o.created_at) as last_storage_object_at
    from storage.objects o
    where o.bucket_id = 'media_library'
      and split_part(btrim(coalesce(o.name, '')), '/', 1) ~*
          '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    group by (split_part(btrim(coalesce(o.name, '')), '/', 1))::uuid
),
subject_ids as (
    select u.id as user_id
    from auth.users u
    union
    select sp.user_id
    from storage_prefixes sp
),
generation_activity as (
    select
        g.user_id,
        max(greatest(g.created_at, coalesce(g.completed_at, g.created_at))) as last_generation_at
    from public.ai_generations g
    group by g.user_id
),
credit_ledger_activity as (
    select
        l.user_id,
        max(l.created_at) as last_credit_ledger_at
    from public.ai_credit_ledger l
    group by l.user_id
),
reservation_activity as (
    select
        r.user_id,
        count(*) filter (where r.status = 'reserved')::bigint as active_credit_reservation_count,
        max(coalesce(r.updated_at, r.created_at)) as last_credit_reservation_at
    from public.ai_credit_reservations r
    group by r.user_id
),
media_file_activity as (
    select
        mf.user_id,
        count(*)::bigint as media_file_count,
        max(coalesce(mf.updated_at, mf.created_at)) as last_media_file_at
    from public.media_files mf
    group by mf.user_id
),
project_activity as (
    select
        p.user_id,
        count(*)::bigint as project_count,
        max(coalesce(p.updated_at, p.created_at)) as last_project_at
    from public.projects p
    group by p.user_id
),
workspace_activity as (
    select
        ws.user_id,
        max(coalesce(ws.updated_at, ws.created_at)) as last_workspace_at
    from public.project_workspace_states ws
    group by ws.user_id
),
custom_voice_activity as (
    select
        cv.user_id,
        count(*)::bigint as custom_voice_count,
        max(coalesce(cv.updated_at, cv.created_at)) as last_custom_voice_at
    from public.user_owned_custom_voices cv
    group by cv.user_id
),
voice_source_activity as (
    select
        vsl.user_id,
        max(coalesce(vsl.updated_at, vsl.created_at)) as last_voice_source_lifecycle_at
    from public.voice_source_lifecycle vsl
    group by vsl.user_id
),
billing_contract_activity as (
    select
        c.user_id,
        count(*) filter (
            where c.ended_at is null
              and lower(coalesce(c.status, '')) in ('active', 'trialing', 'past_due')
        )::bigint as open_or_grace_contract_count,
        max(
            greatest(
                c.created_at,
                coalesce(c.updated_at, c.created_at),
                coalesce(c.current_period_start, c.created_at),
                coalesce(c.current_period_end, c.created_at),
                coalesce(c.started_at, c.created_at),
                coalesce(c.ended_at, c.created_at)
            )
        ) as last_billing_contract_at
    from public.billing_subscription_contracts c
    group by c.user_id
),
joined as (
    select
        sid.user_id,
        u.email::text as user_email,
        u.created_at as auth_created_at,
        u.deleted_at as auth_deleted_at,
        u.last_sign_in_at,
        ga.last_generation_at,
        cla.last_credit_ledger_at,
        mfa.last_media_file_at,
        pa.last_project_at,
        wa.last_workspace_at,
        cva.last_custom_voice_at,
        vsa.last_voice_source_lifecycle_at,
        bca.last_billing_contract_at,
        coalesce(bca.open_or_grace_contract_count, 0)::bigint as open_or_grace_contract_count,
        coalesce(ra.active_credit_reservation_count, 0)::bigint as active_credit_reservation_count,
        coalesce(mfa.media_file_count, 0)::bigint as media_file_count,
        coalesce(pa.project_count, 0)::bigint as project_count,
        coalesce(cva.custom_voice_count, 0)::bigint as custom_voice_count,
        coalesce(sp.storage_object_count, 0)::bigint as storage_object_count,
        coalesce(sp.storage_total_bytes, 0::numeric) as storage_total_bytes,
        (
            select max(activity_at)
            from (
                values
                    (u.created_at),
                    (u.updated_at),
                    (u.last_sign_in_at),
                    (ga.last_generation_at),
                    (cla.last_credit_ledger_at),
                    (ra.last_credit_reservation_at),
                    (mfa.last_media_file_at),
                    (pa.last_project_at),
                    (wa.last_workspace_at),
                    (cva.last_custom_voice_at),
                    (vsa.last_voice_source_lifecycle_at),
                    (bca.last_billing_contract_at),
                    (sp.last_storage_object_at)
            ) as activity_values(activity_at)
        ) as last_activity_at
    from subject_ids sid
    left join auth.users u on u.id = sid.user_id
    left join storage_prefixes sp on sp.user_id = sid.user_id
    left join generation_activity ga on ga.user_id = sid.user_id
    left join credit_ledger_activity cla on cla.user_id = sid.user_id
    left join reservation_activity ra on ra.user_id = sid.user_id
    left join media_file_activity mfa on mfa.user_id = sid.user_id
    left join project_activity pa on pa.user_id = sid.user_id
    left join workspace_activity wa on wa.user_id = sid.user_id
    left join custom_voice_activity cva on cva.user_id = sid.user_id
    left join voice_source_activity vsa on vsa.user_id = sid.user_id
    left join billing_contract_activity bca on bca.user_id = sid.user_id
    where p_user_id is null or sid.user_id = p_user_id
),
classified as (
    select
        j.*,
        case
            when j.auth_created_at is null then 'no_auth_user_row'
            when j.auth_deleted_at is not null then 'auth_user_deleted'
            else 'auth_user_present'
        end as owner_state,
        case
            when j.auth_created_at is null then 'owner_unknown'
            when j.auth_deleted_at is not null then 'deleted_auth_user'
            when j.last_activity_at is null then 'no_activity_recorded'
            when j.last_activity_at >= now() - make_interval(days => s.inactive_days)
                then 'recent_activity'
            else 'no_recent_activity'
        end as activity_status,
        s.inactive_days
    from joined j
    cross join settings s
),
proofed as (
    select
        c.*,
        case
            when c.owner_state = 'no_auth_user_row' then 'owner_missing_manual_review'
            when c.owner_state = 'auth_user_deleted' then 'deleted_auth_report_only'
            when c.open_or_grace_contract_count > 0 then 'active_user_report_only'
            when c.active_credit_reservation_count > 0 then 'active_user_report_only'
            when c.activity_status = 'recent_activity' then 'active_user_report_only'
            else 'inactive_user_report_only'
        end as proof_status,
        case
            when c.owner_state = 'no_auth_user_row'
                then 'Storage prefix has no matching auth.users row; requires manual ownership review.'
            when c.owner_state = 'auth_user_deleted'
                then 'Auth row is deleted; this is still report-only and not deletion authority.'
            when c.open_or_grace_contract_count > 0
                then 'Current billing contract is active, trialing, or past_due; treat as active/protected.'
            when c.active_credit_reservation_count > 0
                then 'A reserved credit hold exists; treat as active/protected until resolved.'
            when c.activity_status = 'recent_activity'
                then 'At least one account, billing, project, media, voice, generation, or storage activity timestamp is within the inactive window.'
            else 'No tracked activity inside the inactive window and no open billing/reservation blocker; report-only proof, not deletion authority.'
        end as proof_reason
    from classified c
)
select
    p.user_id,
    p.user_email,
    p.owner_state,
    p.activity_status,
    p.proof_status,
    p.proof_reason,
    p.auth_created_at,
    p.auth_deleted_at,
    p.last_sign_in_at,
    p.last_activity_at,
    p.last_generation_at,
    p.last_credit_ledger_at,
    p.last_media_file_at,
    p.last_project_at,
    p.last_workspace_at,
    p.last_custom_voice_at,
    p.last_voice_source_lifecycle_at,
    p.last_billing_contract_at,
    p.open_or_grace_contract_count,
    p.active_credit_reservation_count,
    p.media_file_count,
    p.project_count,
    p.custom_voice_count,
    p.storage_object_count,
    round((p.storage_total_bytes / 1048576.0), 3) as storage_total_mb,
    p.inactive_days
from proofed p
cross join settings s
order by
    case p.proof_status
        when 'active_user_report_only' then 0
        when 'owner_missing_manual_review' then 1
        when 'deleted_auth_report_only' then 2
        else 3
    end,
    p.storage_total_bytes desc,
    p.last_activity_at desc nulls last,
    p.user_id
limit (select row_limit from settings);
$$;

comment on function public.get_account_storage_ownership_proof_details(integer, uuid, integer)
    is 'Service-role-only proof report for inactive-account media/storage ownership. It returns report-only account status evidence and confers no deletion authority.';

revoke all on function public.get_account_storage_ownership_proof_details(integer, uuid, integer) from public;
revoke all on function public.get_account_storage_ownership_proof_details(integer, uuid, integer) from anon;
revoke all on function public.get_account_storage_ownership_proof_details(integer, uuid, integer) from authenticated;
grant execute on function public.get_account_storage_ownership_proof_details(integer, uuid, integer) to service_role;

create or replace function public.get_account_storage_ownership_proof_summary(
    p_inactive_days integer default 180
)
returns table (
    owner_state text,
    activity_status text,
    proof_status text,
    proof_reason text,
    user_count bigint,
    storage_prefix_count bigint,
    storage_object_count bigint,
    storage_total_mb numeric,
    users_with_open_or_grace_contracts bigint,
    users_with_active_credit_reservations bigint,
    users_with_recent_activity bigint,
    oldest_last_activity_at timestamptz,
    newest_last_activity_at timestamptz,
    inactive_days integer
)
language sql
security definer
set search_path = public, storage, auth, pg_temp
as $$
select
    d.owner_state,
    d.activity_status,
    d.proof_status,
    d.proof_reason,
    count(*)::bigint as user_count,
    count(*) filter (where d.storage_object_count > 0)::bigint as storage_prefix_count,
    coalesce(sum(d.storage_object_count), 0)::bigint as storage_object_count,
    round(coalesce(sum(d.storage_total_mb), 0::numeric), 3) as storage_total_mb,
    count(*) filter (where d.open_or_grace_contract_count > 0)::bigint
        as users_with_open_or_grace_contracts,
    count(*) filter (where d.active_credit_reservation_count > 0)::bigint
        as users_with_active_credit_reservations,
    count(*) filter (where d.activity_status = 'recent_activity')::bigint
        as users_with_recent_activity,
    min(d.last_activity_at) as oldest_last_activity_at,
    max(d.last_activity_at) as newest_last_activity_at,
    max(d.inactive_days)::integer as inactive_days
from public.get_account_storage_ownership_proof_details(p_inactive_days, null, 100000) d
group by
    d.owner_state,
    d.activity_status,
    d.proof_status,
    d.proof_reason
order by
    case d.proof_status
        when 'active_user_report_only' then 0
        when 'owner_missing_manual_review' then 1
        when 'deleted_auth_report_only' then 2
        else 3
    end,
    storage_total_mb desc,
    user_count desc;
$$;

comment on function public.get_account_storage_ownership_proof_summary(integer)
    is 'Service-role-only aggregate inactive-account storage ownership proof. It exposes no object paths and authorizes no deletion.';

revoke all on function public.get_account_storage_ownership_proof_summary(integer) from public;
revoke all on function public.get_account_storage_ownership_proof_summary(integer) from anon;
revoke all on function public.get_account_storage_ownership_proof_summary(integer) from authenticated;
grant execute on function public.get_account_storage_ownership_proof_summary(integer) to service_role;
