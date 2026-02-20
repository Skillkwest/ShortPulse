-- Rollback 029: restore 028 function body.

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
