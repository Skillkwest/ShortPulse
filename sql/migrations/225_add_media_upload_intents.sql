-- Add the durable, service-role-only authority for browser-to-storage media
-- transport. Upload intents authorize bounded bytes to one server-derived
-- private staging path only. They do not authorize provider access, billing,
-- durable Media Library admission, or customer-credit mutation.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'media_upload_staging',
    'media_upload_staging',
    false,
    104857600,
    array[
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'image/heic', 'image/heif', 'image/avif',
        'video/mp4', 'video/quicktime', 'video/webm', 'video/x-m4v',
        'audio/aac', 'audio/flac', 'audio/mp4', 'audio/mpeg',
        'audio/ogg', 'audio/wav', 'audio/webm', 'audio/x-m4a', 'audio/x-wav'
    ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.media_upload_intents (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    purpose text not null check (purpose in (
        'media_library',
        'reference_image',
        'reference_video',
        'motion_reference_video',
        'voice_changer_source',
        'product_image_asset'
    )),
    media_kind text not null check (media_kind in ('image', 'video', 'audio')),
    bucket_id text not null default 'media_upload_staging'
        check (bucket_id = 'media_upload_staging'),
    staging_path text not null unique check (
        char_length(staging_path) between 38 and 180
        and staging_path !~ '[[:space:]]'
    ),
    source_name text not null check (char_length(source_name) between 1 and 180),
    declared_mime_type text not null check (
        char_length(declared_mime_type) between 3 and 100
        and declared_mime_type ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'
    ),
    max_bytes bigint not null check (max_bytes between 1 and 104857600),
    owner_kind text check (
        owner_kind is null
        or (char_length(owner_kind) between 1 and 48 and owner_kind ~ '^[a-z0-9][a-z0-9._:-]*$')
    ),
    owner_ref text check (owner_ref is null or char_length(owner_ref) between 1 and 160),
    destination_kind text check (
        destination_kind is null
        or (
            char_length(destination_kind) between 1 and 48
            and destination_kind ~ '^[a-z0-9][a-z0-9._:-]*$'
        )
    ),
    idempotency_key text not null check (char_length(idempotency_key) between 1 and 160),
    status text not null default 'prepared' check (
        status in ('prepared', 'claimed', 'finalized', 'rejected', 'expired')
    ),
    detected_mime_type text check (
        detected_mime_type is null
        or (
            char_length(detected_mime_type) between 3 and 100
            and detected_mime_type ~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'
        )
    ),
    actual_bytes bigint check (actual_bytes is null or actual_bytes between 0 and 104857600),
    inspection_version text check (
        inspection_version is null
        or (
            char_length(inspection_version) between 1 and 48
            and inspection_version ~ '^[a-zA-Z0-9._:-]+$'
        )
    ),
    inspection_result text check (
        inspection_result is null
        or (
            char_length(inspection_result) between 1 and 64
            and inspection_result ~ '^[a-z0-9][a-z0-9._:-]*$'
        )
    ),
    expires_at timestamptz not null,
    claimed_at timestamptz,
    finalized_at timestamptz,
    rejected_at timestamptz,
    expired_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint media_upload_intents_owner_pair_check check (
        (owner_kind is null and owner_ref is null)
        or (owner_kind is not null and owner_ref is not null)
    ),
    constraint media_upload_intents_purpose_kind_check check (
        purpose = 'media_library'
        or (purpose in ('reference_image', 'product_image_asset') and media_kind = 'image')
        or (purpose in ('reference_video', 'motion_reference_video') and media_kind = 'video')
        or (purpose = 'voice_changer_source' and media_kind in ('audio', 'video'))
    ),
    constraint media_upload_intents_mime_kind_check check (
        declared_mime_type like media_kind || '/%'
    ),
    constraint media_upload_intents_expiry_check check (expires_at > created_at),
    constraint media_upload_intents_actual_size_check check (
        actual_bytes is null or actual_bytes <= max_bytes
    ),
    constraint media_upload_intents_lifecycle_check check (
        (status = 'prepared' and claimed_at is null and finalized_at is null
            and rejected_at is null and expired_at is null)
        or (status = 'claimed' and claimed_at is not null and finalized_at is null
            and rejected_at is null and expired_at is null)
        or (status = 'finalized' and claimed_at is not null and finalized_at is not null
            and rejected_at is null and expired_at is null
            and detected_mime_type is not null and actual_bytes is not null
            and inspection_version is not null and inspection_result = 'accepted')
        or (status = 'rejected' and rejected_at is not null and finalized_at is null
            and expired_at is null and inspection_result is not null)
        or (status = 'expired' and expired_at is not null and finalized_at is null
            and rejected_at is null)
    ),
    unique (user_id, purpose, idempotency_key)
);

create index if not exists ix_media_upload_intents_active_expiry
    on public.media_upload_intents (status, expires_at)
    where status in ('prepared', 'claimed');

create index if not exists ix_media_upload_intents_user_created
    on public.media_upload_intents (user_id, created_at desc);

alter table public.media_upload_intents enable row level security;

revoke all on table public.media_upload_intents from public, anon, authenticated;
grant select, insert, update, delete on table public.media_upload_intents to service_role;

create or replace function public.reserve_media_upload_intent(
    p_user_id uuid,
    p_purpose text,
    p_media_kind text,
    p_source_name text,
    p_declared_mime_type text,
    p_max_bytes bigint,
    p_owner_kind text,
    p_owner_ref text,
    p_destination_kind text,
    p_idempotency_key text,
    p_ttl_seconds integer default 7200
)
returns public.media_upload_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row public.media_upload_intents%rowtype;
    v_id uuid := gen_random_uuid();
    v_now timestamptz := clock_timestamp();
    v_source_name text := left(regexp_replace(trim(coalesce(p_source_name, '')), '[[:cntrl:]]', '', 'g'), 180);
    v_mime_type text := lower(trim(coalesce(p_declared_mime_type, '')));
    v_staging_path text;
begin
    if auth.role() is distinct from 'service_role' then
        raise exception 'Media upload intent reservation requires service_role.';
    end if;
    if p_user_id is null
       or p_purpose not in (
           'media_library', 'reference_image', 'reference_video',
           'motion_reference_video', 'voice_changer_source', 'product_image_asset'
       )
       or p_media_kind not in ('image', 'video', 'audio')
       or char_length(v_source_name) not between 1 and 180
       or v_mime_type !~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'
       or p_max_bytes is null or p_max_bytes not between 1 and 104857600
       or (p_owner_kind is null) <> (p_owner_ref is null)
       or (p_owner_kind is not null and (
           char_length(p_owner_kind) not between 1 and 48
           or p_owner_kind !~ '^[a-z0-9][a-z0-9._:-]*$'
           or char_length(p_owner_ref) not between 1 and 160
       ))
       or (p_destination_kind is not null and (
           char_length(p_destination_kind) not between 1 and 48
           or p_destination_kind !~ '^[a-z0-9][a-z0-9._:-]*$'
       ))
       or p_idempotency_key is null
       or char_length(p_idempotency_key) not between 1 and 160
       or p_ttl_seconds is null or p_ttl_seconds not between 300 and 7200 then
        raise exception 'Invalid media upload intent parameters.';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(
        p_user_id::text || ':' || p_purpose || ':' || p_idempotency_key,
        0
    ));

    select * into v_row
      from public.media_upload_intents
     where user_id = p_user_id
       and purpose = p_purpose
       and idempotency_key = p_idempotency_key
     for update;

    if v_row.id is not null then
        if v_row.media_kind <> p_media_kind
           or v_row.source_name <> v_source_name
           or v_row.declared_mime_type <> v_mime_type
           or v_row.max_bytes <> p_max_bytes
           or v_row.owner_kind is distinct from p_owner_kind
           or v_row.owner_ref is distinct from p_owner_ref
           or v_row.destination_kind is distinct from p_destination_kind then
            raise exception 'Media upload intent idempotency conflict.';
        end if;
        return v_row;
    end if;

    v_staging_path := p_user_id::text || '/' || v_id::text || '/object';
    insert into public.media_upload_intents (
        id, user_id, purpose, media_kind, staging_path, source_name,
        declared_mime_type, max_bytes, owner_kind, owner_ref,
        destination_kind, idempotency_key, expires_at
    ) values (
        v_id, p_user_id, p_purpose, p_media_kind, v_staging_path, v_source_name,
        v_mime_type, p_max_bytes, p_owner_kind, p_owner_ref,
        p_destination_kind, p_idempotency_key,
        v_now + make_interval(secs => p_ttl_seconds)
    )
    returning * into v_row;
    return v_row;
end;
$$;

create or replace function public.claim_media_upload_intent(
    p_intent_id uuid,
    p_user_id uuid,
    p_purpose text,
    p_staging_path text
)
returns public.media_upload_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row public.media_upload_intents%rowtype;
    v_now timestamptz := clock_timestamp();
begin
    if auth.role() is distinct from 'service_role' then
        raise exception 'Media upload intent claim requires service_role.';
    end if;
    select * into v_row from public.media_upload_intents
     where id = p_intent_id and user_id = p_user_id and purpose = p_purpose
       and staging_path = p_staging_path
     for update;
    if v_row.id is null then
        raise exception 'Media upload intent not found.';
    end if;
    if v_row.status <> 'prepared' then
        raise exception 'Media upload intent is not claimable.';
    end if;
    if v_row.expires_at <= v_now then
        update public.media_upload_intents
           set status = 'expired', expired_at = v_now, updated_at = v_now
         where id = v_row.id returning * into v_row;
        return v_row;
    end if;
    update public.media_upload_intents
       set status = 'claimed', claimed_at = v_now, updated_at = v_now
     where id = v_row.id returning * into v_row;
    return v_row;
end;
$$;

create or replace function public.finalize_media_upload_intent(
    p_intent_id uuid,
    p_user_id uuid,
    p_purpose text,
    p_staging_path text,
    p_detected_mime_type text,
    p_actual_bytes bigint,
    p_inspection_version text
)
returns public.media_upload_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row public.media_upload_intents%rowtype;
    v_now timestamptz := clock_timestamp();
    v_mime_type text := lower(trim(coalesce(p_detected_mime_type, '')));
begin
    if auth.role() is distinct from 'service_role' then
        raise exception 'Media upload intent finalization requires service_role.';
    end if;
    if v_mime_type !~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$'
       or p_actual_bytes is null or p_actual_bytes < 0 or p_actual_bytes > 104857600
       or p_inspection_version is null
       or char_length(p_inspection_version) not between 1 and 48
       or p_inspection_version !~ '^[a-zA-Z0-9._:-]+$' then
        raise exception 'Invalid media upload inspection facts.';
    end if;
    select * into v_row from public.media_upload_intents
     where id = p_intent_id and user_id = p_user_id
       and purpose = p_purpose and staging_path = p_staging_path
     for update;
    if v_row.id is null then
        raise exception 'Media upload intent not found.';
    end if;
    if v_row.status = 'finalized' then
        if v_row.detected_mime_type <> v_mime_type
           or v_row.actual_bytes <> p_actual_bytes
           or v_row.inspection_version <> p_inspection_version then
            raise exception 'Media upload intent finalization conflict.';
        end if;
        return v_row;
    end if;
    if v_row.status <> 'claimed' then
        raise exception 'Media upload intent is not finalizable.';
    end if;
    if p_actual_bytes > v_row.max_bytes then
        raise exception 'Media upload intent byte limit exceeded.';
    end if;
    update public.media_upload_intents
       set status = 'finalized', detected_mime_type = v_mime_type,
           actual_bytes = p_actual_bytes, inspection_version = p_inspection_version,
           inspection_result = 'accepted', finalized_at = v_now, updated_at = v_now
     where id = v_row.id returning * into v_row;
    return v_row;
end;
$$;

create or replace function public.reject_media_upload_intent(
    p_intent_id uuid,
    p_user_id uuid,
    p_purpose text,
    p_staging_path text,
    p_reason_code text,
    p_detected_mime_type text default null,
    p_actual_bytes bigint default null,
    p_inspection_version text default null
)
returns public.media_upload_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row public.media_upload_intents%rowtype;
    v_now timestamptz := clock_timestamp();
    v_mime_type text := nullif(lower(trim(coalesce(p_detected_mime_type, ''))), '');
begin
    if auth.role() is distinct from 'service_role' then
        raise exception 'Media upload intent rejection requires service_role.';
    end if;
    if p_reason_code is null or char_length(p_reason_code) not between 1 and 64
       or p_reason_code !~ '^[a-z0-9][a-z0-9._:-]*$'
       or (v_mime_type is not null and v_mime_type !~ '^[a-z0-9.+-]+/[a-z0-9.+-]+$')
       or (p_actual_bytes is not null and (p_actual_bytes < 0 or p_actual_bytes > 104857600))
       or (p_inspection_version is not null and (
           char_length(p_inspection_version) not between 1 and 48
           or p_inspection_version !~ '^[a-zA-Z0-9._:-]+$'
       )) then
        raise exception 'Invalid media upload rejection facts.';
    end if;
    select * into v_row from public.media_upload_intents
     where id = p_intent_id and user_id = p_user_id
       and purpose = p_purpose and staging_path = p_staging_path
     for update;
    if v_row.id is null then
        raise exception 'Media upload intent not found.';
    end if;
    if v_row.status = 'rejected' then
        if v_row.inspection_result <> p_reason_code then
            raise exception 'Media upload intent rejection conflict.';
        end if;
        return v_row;
    end if;
    if v_row.status not in ('prepared', 'claimed') then
        raise exception 'Media upload intent is not rejectable.';
    end if;
    update public.media_upload_intents
       set status = 'rejected', detected_mime_type = v_mime_type,
           actual_bytes = p_actual_bytes, inspection_version = p_inspection_version,
           inspection_result = p_reason_code, rejected_at = v_now, updated_at = v_now
     where id = v_row.id returning * into v_row;
    return v_row;
end;
$$;

create or replace function public.expire_media_upload_intent(
    p_intent_id uuid,
    p_user_id uuid
)
returns public.media_upload_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_row public.media_upload_intents%rowtype;
    v_now timestamptz := clock_timestamp();
begin
    if auth.role() is distinct from 'service_role' then
        raise exception 'Media upload intent expiry requires service_role.';
    end if;
    select * into v_row from public.media_upload_intents
     where id = p_intent_id and user_id = p_user_id for update;
    if v_row.id is null then
        raise exception 'Media upload intent not found.';
    end if;
    if v_row.status = 'expired' then return v_row; end if;
    if v_row.status not in ('prepared', 'claimed') or v_row.expires_at > v_now then
        raise exception 'Media upload intent is not expirable.';
    end if;
    update public.media_upload_intents
       set status = 'expired', expired_at = v_now, updated_at = v_now
     where id = v_row.id returning * into v_row;
    return v_row;
end;
$$;

revoke all on function public.reserve_media_upload_intent(
    uuid, text, text, text, text, bigint, text, text, text, text, integer
) from public, anon, authenticated;
revoke all on function public.claim_media_upload_intent(uuid, uuid, text, text)
    from public, anon, authenticated;
revoke all on function public.finalize_media_upload_intent(
    uuid, uuid, text, text, text, bigint, text
)
    from public, anon, authenticated;
revoke all on function public.reject_media_upload_intent(
    uuid, uuid, text, text, text, text, bigint, text
)
    from public, anon, authenticated;
revoke all on function public.expire_media_upload_intent(uuid, uuid)
    from public, anon, authenticated;

grant execute on function public.reserve_media_upload_intent(
    uuid, text, text, text, text, bigint, text, text, text, text, integer
) to service_role;
grant execute on function public.claim_media_upload_intent(uuid, uuid, text, text)
    to service_role;
grant execute on function public.finalize_media_upload_intent(
    uuid, uuid, text, text, text, bigint, text
)
    to service_role;
grant execute on function public.reject_media_upload_intent(
    uuid, uuid, text, text, text, text, bigint, text
)
    to service_role;
grant execute on function public.expire_media_upload_intent(uuid, uuid) to service_role;

commit;
