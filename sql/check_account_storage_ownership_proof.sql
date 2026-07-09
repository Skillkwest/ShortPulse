-- Account storage ownership proof report (read-only)
--
-- Purpose:
--   Summarize whether media/storage-owning accounts look active, inactive, deleted,
--   or owner-unknown using service-role-only proof RPCs.
--
-- Boundary:
--   This script is report-only. It returns aggregates only by default, prints no
--   object paths, and authorizes no deletion.

\set inactive_days :inactive_days

select
    owner_state,
    activity_status,
    proof_status,
    user_count,
    storage_prefix_count,
    storage_object_count,
    storage_total_mb,
    users_with_open_or_grace_contracts,
    users_with_active_credit_reservations,
    users_with_recent_activity,
    oldest_last_activity_at,
    newest_last_activity_at,
    inactive_days
from public.get_account_storage_ownership_proof_summary(:inactive_days::integer)
order by
    case proof_status
        when 'active_user_report_only' then 0
        when 'owner_missing_manual_review' then 1
        when 'deleted_auth_report_only' then 2
        else 3
    end,
    storage_total_mb desc,
    user_count desc;

select
    proof_status,
    count(*)::bigint as proof_group_count,
    coalesce(sum(user_count), 0)::bigint as user_count,
    coalesce(sum(storage_prefix_count), 0)::bigint as storage_prefix_count,
    coalesce(sum(storage_object_count), 0)::bigint as storage_object_count,
    round(coalesce(sum(storage_total_mb), 0::numeric), 3) as storage_total_mb
from public.get_account_storage_ownership_proof_summary(:inactive_days::integer)
group by proof_status
order by
    case proof_status
        when 'active_user_report_only' then 0
        when 'owner_missing_manual_review' then 1
        when 'deleted_auth_report_only' then 2
        else 3
    end,
    storage_total_mb desc;
