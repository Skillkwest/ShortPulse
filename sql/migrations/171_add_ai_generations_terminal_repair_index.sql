-- Give the generation projection repair loop an index for terminal generation scans.
-- The repair loop reads recent success/fail ai_generations rows by completed_at
-- when backfilling missing or stale generation_projection rows.

create index if not exists ix_ai_generations_terminal_completed_repair
    on public.ai_generations (completed_at desc nulls last)
    include (
        id,
        user_id,
        request_id,
        provider,
        model_id,
        status,
        failure_reason_code,
        error_message,
        created_at
    )
    where completed_at is not null
      and status in ('success', 'fail');
