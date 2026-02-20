-- Generation runtime convergence baseline.
-- Enforces recovery-field defaults/shape so runtime no longer needs legacy column fallbacks.

update public.ai_generations
set
    recovery_state = coalesce(nullif(trim(recovery_state), ''), 'none'),
    recovery_attempts = coalesce(recovery_attempts, 0)
where recovery_state is null
   or trim(recovery_state) = ''
   or recovery_attempts is null;

alter table public.ai_generations
    alter column recovery_state set default 'none';

alter table public.ai_generations
    alter column recovery_state set not null;

alter table public.ai_generations
    alter column recovery_attempts set default 0;

alter table public.ai_generations
    alter column recovery_attempts set not null;

alter table public.ai_generations
    drop constraint if exists ai_generations_recovery_attempts_non_negative_check;

alter table public.ai_generations
    add constraint ai_generations_recovery_attempts_non_negative_check
    check (recovery_attempts >= 0);
