-- Add service-role-only RPCs for derivative claim/update processing loops.

create or replace function public.claim_media_derivative_batch(
    p_limit integer default 20,
    p_max_attempts integer default 5,
    p_lease_seconds integer default 180
)
returns table (
    id uuid,
    user_id uuid,
    storage_path text,
    file_type text,
    processing_attempts integer,
    processing_status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_limit integer := greatest(coalesce(p_limit, 1), 1);
    v_max_attempts integer := greatest(coalesce(p_max_attempts, 1), 1);
    v_lease_seconds integer := greatest(coalesce(p_lease_seconds, 1), 1);
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized';
    end if;

    return query
    with candidates as (
        select mf.id
        from public.media_files mf
        where lower(coalesce(mf.file_type, '')) like 'image%'
          and mf.processing_status in ('pending', 'failed', 'processing')
          and coalesce(mf.processing_attempts, 0) < v_max_attempts
          and nullif(trim(coalesce(mf.storage_path, '')), '') is not null
          and nullif(trim(coalesce(mf.thumb_variant_path, '')), '') is null
          and (
              (
                  mf.processing_status = 'processing'
                  and coalesce(mf.processing_updated_at, mf.updated_at, mf.created_at, now())
                      <= now() - make_interval(secs => v_lease_seconds)
              )
              or (
                  mf.processing_status in ('pending', 'failed')
                  and coalesce(mf.processing_next_retry_at, now()) <= now()
              )
          )
        order by
            coalesce(mf.processing_next_retry_at, mf.created_at),
            coalesce(mf.processing_updated_at, mf.created_at),
            mf.created_at,
            mf.id
        for update skip locked
        limit v_limit
    ),
    claimed as (
        update public.media_files mf
        set
            processing_status = 'processing',
            processing_attempts = coalesce(mf.processing_attempts, 0) + 1,
            processing_next_retry_at = now() + make_interval(secs => v_lease_seconds),
            processing_last_error = null,
            processing_updated_at = now()
        from candidates c
        where mf.id = c.id
        returning
            mf.id,
            mf.user_id,
            mf.storage_path,
            mf.file_type,
            mf.processing_attempts,
            mf.processing_status
    )
    select *
    from claimed;
end;
$$;

create or replace function public.mark_media_derivative_ready(
    p_media_file_id uuid,
    p_user_id uuid,
    p_thumb_variant_path text,
    p_width integer default null,
    p_height integer default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_thumb_path text := nullif(trim(coalesce(p_thumb_variant_path, '')), '');
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized';
    end if;

    if p_media_file_id is null or p_user_id is null then
        return false;
    end if;

    if v_thumb_path is null
       or v_thumb_path not like p_user_id::text || '/%'
       or v_thumb_path like '/%'
       or position(chr(92) in v_thumb_path) > 0
       or v_thumb_path ~ '(^|/)\.\.(/|$)' then
        raise exception 'Invalid thumb variant path';
    end if;

    update public.media_files mf
    set
        thumb_variant_path = v_thumb_path,
        width = coalesce(p_width, mf.width),
        height = coalesce(p_height, mf.height),
        processing_status = 'ready',
        processing_next_retry_at = null,
        processing_last_error = null,
        processing_updated_at = now()
    where mf.id = p_media_file_id
      and mf.user_id = p_user_id
      and lower(coalesce(mf.file_type, '')) like 'image%';

    return found;
end;
$$;

create or replace function public.mark_media_derivative_failed(
    p_media_file_id uuid,
    p_user_id uuid,
    p_error text,
    p_retry_seconds integer default 300,
    p_exhausted boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
    v_error text := left(coalesce(nullif(trim(coalesce(p_error, '')), ''), 'media_derivative_failed'), 500);
    v_retry_seconds integer := greatest(coalesce(p_retry_seconds, 0), 0);
begin
    if auth.role() <> 'service_role' then
        raise exception 'Caller is not authorized';
    end if;

    if p_media_file_id is null or p_user_id is null then
        return false;
    end if;

    update public.media_files mf
    set
        processing_status = 'failed',
        processing_next_retry_at = case
            when coalesce(p_exhausted, false) then null
            else now() + make_interval(secs => v_retry_seconds)
        end,
        processing_last_error = v_error,
        processing_updated_at = now()
    where mf.id = p_media_file_id
      and mf.user_id = p_user_id
      and lower(coalesce(mf.file_type, '')) like 'image%';

    return found;
end;
$$;

revoke all on function public.claim_media_derivative_batch(integer, integer, integer) from public;
revoke all on function public.claim_media_derivative_batch(integer, integer, integer) from anon;
revoke all on function public.claim_media_derivative_batch(integer, integer, integer) from authenticated;
grant execute on function public.claim_media_derivative_batch(integer, integer, integer) to service_role;

revoke all on function public.mark_media_derivative_ready(uuid, uuid, text, integer, integer) from public;
revoke all on function public.mark_media_derivative_ready(uuid, uuid, text, integer, integer) from anon;
revoke all on function public.mark_media_derivative_ready(uuid, uuid, text, integer, integer) from authenticated;
grant execute on function public.mark_media_derivative_ready(uuid, uuid, text, integer, integer) to service_role;

revoke all on function public.mark_media_derivative_failed(uuid, uuid, text, integer, boolean) from public;
revoke all on function public.mark_media_derivative_failed(uuid, uuid, text, integer, boolean) from anon;
revoke all on function public.mark_media_derivative_failed(uuid, uuid, text, integer, boolean) from authenticated;
grant execute on function public.mark_media_derivative_failed(uuid, uuid, text, integer, boolean) to service_role;
