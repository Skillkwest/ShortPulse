-- Queue/recovery RPC execute grant hardening:
-- enforce service-role-only execute posture for queue enqueue/claim and recovery claim helpers.

revoke all on function public.enqueue_generation_submit(
    uuid,
    text,
    text,
    text,
    text,
    text,
    integer,
    text,
    text,
    jsonb,
    integer,
    jsonb
) from public;
revoke all on function public.enqueue_generation_submit(
    uuid,
    text,
    text,
    text,
    text,
    text,
    integer,
    text,
    text,
    jsonb,
    integer,
    jsonb
) from anon;
revoke all on function public.enqueue_generation_submit(
    uuid,
    text,
    text,
    text,
    text,
    text,
    integer,
    text,
    text,
    jsonb,
    integer,
    jsonb
) from authenticated;
grant execute on function public.enqueue_generation_submit(
    uuid,
    text,
    text,
    text,
    text,
    text,
    integer,
    text,
    text,
    jsonb,
    integer,
    jsonb
) to service_role;

revoke all on function public.claim_generation_submit_queue_batch(
    integer,
    integer,
    uuid
) from public;
revoke all on function public.claim_generation_submit_queue_batch(
    integer,
    integer,
    uuid
) from anon;
revoke all on function public.claim_generation_submit_queue_batch(
    integer,
    integer,
    uuid
) from authenticated;
grant execute on function public.claim_generation_submit_queue_batch(
    integer,
    integer,
    uuid
) to service_role;

revoke all on function public.claim_generation_recovery_batch(
    integer,
    integer,
    integer,
    integer
) from public;
revoke all on function public.claim_generation_recovery_batch(
    integer,
    integer,
    integer,
    integer
) from anon;
revoke all on function public.claim_generation_recovery_batch(
    integer,
    integer,
    integer,
    integer
) from authenticated;
grant execute on function public.claim_generation_recovery_batch(
    integer,
    integer,
    integer,
    integer
) to service_role;
