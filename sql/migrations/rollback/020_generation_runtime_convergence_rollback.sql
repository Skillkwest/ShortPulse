-- Roll back 020_generation_runtime_convergence.sql hardening constraints/defaults.

alter table if exists public.ai_generations
    drop constraint if exists ai_generations_recovery_attempts_non_negative_check;

alter table if exists public.ai_generations
    alter column recovery_attempts drop not null;

alter table if exists public.ai_generations
    alter column recovery_attempts drop default;
