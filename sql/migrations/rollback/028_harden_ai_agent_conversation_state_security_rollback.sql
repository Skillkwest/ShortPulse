-- Rollback 028: restore 018-era conversation state RPC behavior and grants.
-- Note: default privileges are not reverted by this rollback.

drop function if exists public.prune_ai_agent_conversation_state_expired(integer);

alter table if exists public.ai_agent_conversation_state
    drop constraint if exists ai_agent_conversation_state_conversation_id_length_check;

create or replace function public.upsert_ai_agent_conversation_state(
    p_user_id uuid,
    p_conversation_id text,
    p_canonical_prompt text,
    p_ttl interval default interval '30 days',
    p_user_cap integer default 200
)
returns table (
    user_id uuid,
    conversation_id text,
    canonical_prompt text,
    updated_at timestamptz,
    expires_at timestamptz,
    turn_count integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_conversation_id text;
    v_canonical_prompt text;
    v_row_cap integer;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;
    if auth.role() <> 'service_role' and auth.uid() is distinct from p_user_id then
        raise exception 'Caller is not authorized for this user id';
    end if;

    v_conversation_id := btrim(coalesce(p_conversation_id, ''));
    if v_conversation_id = '' then
        raise exception 'Conversation id is required';
    end if;

    v_canonical_prompt := left(btrim(coalesce(p_canonical_prompt, '')), 4096);
    if v_canonical_prompt = '' then
        raise exception 'Canonical prompt is required';
    end if;

    v_row_cap := greatest(coalesce(p_user_cap, 200), 1);

    delete from public.ai_agent_conversation_state
     where user_id = p_user_id
       and expires_at <= now();

    insert into public.ai_agent_conversation_state (
        user_id,
        conversation_id,
        canonical_prompt,
        updated_at,
        expires_at,
        turn_count
    )
    values (
        p_user_id,
        v_conversation_id,
        v_canonical_prompt,
        now(),
        now() + coalesce(p_ttl, interval '30 days'),
        1
    )
    on conflict (user_id, conversation_id) do update
    set canonical_prompt = excluded.canonical_prompt,
        updated_at = now(),
        expires_at = now() + coalesce(p_ttl, interval '30 days'),
        turn_count = public.ai_agent_conversation_state.turn_count + 1;

    with overflow as (
        select state.conversation_id
          from public.ai_agent_conversation_state state
         where state.user_id = p_user_id
         order by state.updated_at desc
         offset v_row_cap
    )
    delete from public.ai_agent_conversation_state state
    using overflow
     where state.user_id = p_user_id
       and state.conversation_id = overflow.conversation_id;

    return query
    select
        state.user_id,
        state.conversation_id,
        state.canonical_prompt,
        state.updated_at,
        state.expires_at,
        state.turn_count
      from public.ai_agent_conversation_state state
     where state.user_id = p_user_id
       and state.conversation_id = v_conversation_id
     limit 1;
end;
$$;

revoke all on function public.upsert_ai_agent_conversation_state(
    uuid,
    text,
    text,
    interval,
    integer
) from public;
grant execute on function public.upsert_ai_agent_conversation_state(
    uuid,
    text,
    text,
    interval,
    integer
) to authenticated;
grant execute on function public.upsert_ai_agent_conversation_state(
    uuid,
    text,
    text,
    interval,
    integer
) to service_role;
