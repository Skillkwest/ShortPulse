-- Roll back migration 174 by restoring credits removed by the legacy signup
-- seed reversal rows. Use only during a controlled rollback window.

drop trigger if exists trg_reject_retired_signup_seed_credit_grant on public.ai_credit_ledger;
drop function if exists public.reject_retired_signup_seed_credit_grant();

with reversals as (
    select
        user_id,
        abs(change_cents)::integer as restore_cents,
        source_ref,
        metadata
    from public.ai_credit_ledger
    where source = 'signup_seed_reversal'
      and change_cents < 0
)
insert into public.ai_credit_ledger (
    user_id,
    change_cents,
    reason,
    source,
    source_ref,
    metadata
)
select
    user_id,
    restore_cents,
    'Rollback legacy free-plan credit removal',
    'signup_seed_reversal_rollback',
    'signup_seed_reversal_rollback:' || user_id::text,
    jsonb_build_object(
        'rolled_back_source_ref', source_ref,
        'rolled_back_metadata', metadata
    )
from reversals
where restore_cents > 0
  and not exists (
      select 1
      from public.ai_credit_ledger existing
      where existing.user_id = reversals.user_id
        and existing.source = 'signup_seed_reversal_rollback'
        and existing.source_ref = 'signup_seed_reversal_rollback:' || reversals.user_id::text
  );
