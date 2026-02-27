-- Runtime RPC grant hardening:
-- Enforce service-role-only execute posture for critical runtime/admin RPCs.

revoke all on function public.admin_update_app_error_status(
    uuid,
    uuid,
    text,
    text,
    uuid,
    text
) from public;
revoke all on function public.admin_update_app_error_status(
    uuid,
    uuid,
    text,
    text,
    uuid,
    text
) from anon;
revoke all on function public.admin_update_app_error_status(
    uuid,
    uuid,
    text,
    text,
    uuid,
    text
) from authenticated;
grant execute on function public.admin_update_app_error_status(
    uuid,
    uuid,
    text,
    text,
    uuid,
    text
) to service_role;

revoke all on function public.reserve_generation_credits(
    uuid,
    text,
    text,
    integer,
    text,
    jsonb
) from public;
revoke all on function public.reserve_generation_credits(
    uuid,
    text,
    text,
    integer,
    text,
    jsonb
) from anon;
revoke all on function public.reserve_generation_credits(
    uuid,
    text,
    text,
    integer,
    text,
    jsonb
) from authenticated;
grant execute on function public.reserve_generation_credits(
    uuid,
    text,
    text,
    integer,
    text,
    jsonb
) to service_role;

revoke all on function public.mark_generation_reservation_submitted(
    uuid,
    text,
    text,
    jsonb
) from public;
revoke all on function public.mark_generation_reservation_submitted(
    uuid,
    text,
    text,
    jsonb
) from anon;
revoke all on function public.mark_generation_reservation_submitted(
    uuid,
    text,
    text,
    jsonb
) from authenticated;
grant execute on function public.mark_generation_reservation_submitted(
    uuid,
    text,
    text,
    jsonb
) to service_role;

revoke all on function public.release_generation_reservation_by_source_ref(
    uuid,
    text,
    text,
    jsonb
) from public;
revoke all on function public.release_generation_reservation_by_source_ref(
    uuid,
    text,
    text,
    jsonb
) from anon;
revoke all on function public.release_generation_reservation_by_source_ref(
    uuid,
    text,
    text,
    jsonb
) from authenticated;
grant execute on function public.release_generation_reservation_by_source_ref(
    uuid,
    text,
    text,
    jsonb
) to service_role;

revoke all on function public.release_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) from public;
revoke all on function public.release_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) from anon;
revoke all on function public.release_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) from authenticated;
grant execute on function public.release_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) to service_role;

revoke all on function public.capture_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) from public;
revoke all on function public.capture_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) from anon;
revoke all on function public.capture_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) from authenticated;
grant execute on function public.capture_generation_reservation_by_provider_request(
    uuid,
    text,
    text,
    jsonb
) to service_role;

revoke all on function public.admit_and_reserve_generation_credits(
    uuid,
    text,
    text,
    integer,
    text,
    jsonb,
    text,
    integer,
    text,
    integer,
    integer
) from public;
revoke all on function public.admit_and_reserve_generation_credits(
    uuid,
    text,
    text,
    integer,
    text,
    jsonb,
    text,
    integer,
    text,
    integer,
    integer
) from anon;
revoke all on function public.admit_and_reserve_generation_credits(
    uuid,
    text,
    text,
    integer,
    text,
    jsonb,
    text,
    integer,
    text,
    integer,
    integer
) from authenticated;
grant execute on function public.admit_and_reserve_generation_credits(
    uuid,
    text,
    text,
    integer,
    text,
    jsonb,
    text,
    integer,
    text,
    integer,
    integer
) to service_role;

revoke all on function public.release_stale_generation_reservations(
    integer,
    integer
) from public;
revoke all on function public.release_stale_generation_reservations(
    integer,
    integer
) from anon;
revoke all on function public.release_stale_generation_reservations(
    integer,
    integer
) from authenticated;
grant execute on function public.release_stale_generation_reservations(
    integer,
    integer
) to service_role;

revoke all on function public.upsert_ai_agent_conversation_state(
    uuid,
    text,
    text,
    interval,
    integer
) from public;
revoke all on function public.upsert_ai_agent_conversation_state(
    uuid,
    text,
    text,
    interval,
    integer
) from anon;
revoke all on function public.upsert_ai_agent_conversation_state(
    uuid,
    text,
    text,
    interval,
    integer
) from authenticated;
grant execute on function public.upsert_ai_agent_conversation_state(
    uuid,
    text,
    text,
    interval,
    integer
) to service_role;

revoke all on function public.prune_ai_agent_conversation_state_expired(
    integer
) from public;
revoke all on function public.prune_ai_agent_conversation_state_expired(
    integer
) from anon;
revoke all on function public.prune_ai_agent_conversation_state_expired(
    integer
) from authenticated;
grant execute on function public.prune_ai_agent_conversation_state_expired(
    integer
) to service_role;
