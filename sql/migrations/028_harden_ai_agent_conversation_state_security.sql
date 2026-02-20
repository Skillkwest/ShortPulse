-- Harden AI agent conversation state retention, privilege scope, and deterministic pruning.
-- Forward-only hardening migration for ai_agent_conversation_state and
-- upsert_ai_agent_conversation_state while preserving RPC name/signature/return contract.

alter default privileges in schema public revoke execute on functions from public;

do $$
begin
    if not exists (
        select 1
          from pg_constraint
         where conname = 'ai_agent_conversation_state_conversation_id_length_check'
           and conrelid = 'public.ai_agent_conversation_state'::regclass
    ) then
        alter table public.ai_agent_conversation_state
            add constraint ai_agent_conversation_state_conversation_id_length_check
            check (char_length(conversation_id) between 1 and 191)
            not valid;
    end if;
end;
$$;

alter table public.ai_agent_conversation_state
    validate constraint ai_agent_conversation_state_conversation_id_length_check;

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
set search_path = public, pg_temp
as $$
declare
    v_conversation_id text;
    v_canonical_prompt text;
    v_row_cap integer;
    v_ttl interval;
    v_now timestamptz;
begin
    if p_user_id is null then
        raise exception 'User id is required';
    end if;

    if auth.role() <> 'service_role' then
        raise exception 'Only service_role can upsert conversation state';
    end if;

    v_conversation_id := btrim(coalesce(p_conversation_id, ''));
    if v_conversation_id = '' then
        raise exception 'Conversation id is required';
    end if;
    if char_length(v_conversation_id) > 191 then
        raise exception 'Conversation id length exceeds max of 191';
    end if;

    v_canonical_prompt := left(btrim(coalesce(p_canonical_prompt, '')), 4096);
    if v_canonical_prompt = '' then
        raise exception 'Canonical prompt is required';
    end if;

    v_row_cap := least(greatest(coalesce(p_user_cap, 200), 1), 200);

    v_ttl := coalesce(p_ttl, interval '30 days');
    if v_ttl < interval '1 day' then
        v_ttl := interval '1 day';
    elsif v_ttl > interval '90 days' then
        v_ttl := interval '90 days';
    end if;

    v_now := now();

    -- Serialize per-user upsert+prune so concurrent writes cannot produce non-deterministic eviction.
    perform pg_advisory_xact_lock(hashtext(p_user_id::text));

    delete from public.ai_agent_conversation_state
     where user_id = p_user_id
       and expires_at <= v_now;

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
        v_now,
        v_now + v_ttl,
        1
    )
    on conflict (user_id, conversation_id) do update
    set canonical_prompt = excluded.canonical_prompt,
        updated_at = v_now,
        expires_at = v_now + v_ttl,
        turn_count = public.ai_agent_conversation_state.turn_count + 1;

    with overflow as (
        select state.conversation_id
          from public.ai_agent_conversation_state state
         where state.user_id = p_user_id
         order by
            (state.conversation_id = v_conversation_id) desc,
            state.updated_at desc,
            state.conversation_id desc
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

create or replace function public.prune_ai_agent_conversation_state_expired(
    p_limit integer default 10000
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_limit integer;
    v_deleted integer;
begin
    v_limit := least(greatest(coalesce(p_limit, 10000), 1), 50000);

    with expired as (
        select state.user_id, state.conversation_id
          from public.ai_agent_conversation_state state
         where state.expires_at <= now()
         order by state.expires_at asc, state.user_id asc, state.conversation_id asc
         limit v_limit
    )
    delete from public.ai_agent_conversation_state state
    using expired
     where state.user_id = expired.user_id
       and state.conversation_id = expired.conversation_id;

    get diagnostics v_deleted = row_count;
    return v_deleted;
end;
$$;

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
) from authenticated;
grant execute on function public.upsert_ai_agent_conversation_state(
    uuid,
    text,
    text,
    interval,
    integer
) to service_role;

revoke all on function public.prune_ai_agent_conversation_state_expired(integer) from public;
revoke all on function public.prune_ai_agent_conversation_state_expired(integer) from authenticated;
grant execute on function public.prune_ai_agent_conversation_state_expired(integer) to service_role;
