-- Add derivative-processing control fields and defaults for media_files image rows.
-- Establishes deterministic retry/lease metadata for worker claims.

do $$
begin
    if not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'media_files'
          and column_name = 'processing_status'
    ) then
        raise exception 'public.media_files.processing_status is required before applying migration 065 (apply migration 005 first)';
    end if;
end;
$$;

alter table public.media_files
    add column if not exists processing_attempts integer not null default 0;

alter table public.media_files
    add column if not exists processing_next_retry_at timestamptz;

alter table public.media_files
    add column if not exists processing_last_error text;

alter table public.media_files
    add column if not exists processing_updated_at timestamptz not null default timezone('utc', now());

update public.media_files
set
    processing_attempts = coalesce(processing_attempts, 0),
    processing_updated_at = coalesce(processing_updated_at, updated_at, created_at, timezone('utc', now()))
where processing_attempts is null
   or processing_updated_at is null;

alter table public.media_files
    drop constraint if exists media_files_processing_attempts_check;

alter table public.media_files
    add constraint media_files_processing_attempts_check
    check (processing_attempts between 0 and 1000);

create index if not exists ix_media_files_image_processing_claim
    on public.media_files (
        processing_status,
        processing_next_retry_at,
        processing_updated_at,
        created_at,
        id
    )
    where lower(coalesce(file_type, '')) like 'image%';

create index if not exists ix_media_files_image_processing_attempts
    on public.media_files (processing_status, processing_attempts, processing_next_retry_at)
    where lower(coalesce(file_type, '')) like 'image%';

create or replace function public.set_media_files_processing_defaults()
returns trigger
language plpgsql
as $$
begin
    new.processing_attempts := coalesce(new.processing_attempts, 0);
    new.processing_updated_at := coalesce(new.processing_updated_at, timezone('utc', now()));

    if lower(coalesce(new.file_type, '')) like 'image%' then
        if coalesce(new.processing_status, '') = '' or new.processing_status = 'ready' then
            if nullif(trim(coalesce(new.thumb_variant_path, '')), '') is null then
                new.processing_status := 'pending';
            else
                new.processing_status := 'ready';
            end if;
        end if;
        if new.processing_status in ('pending', 'failed') then
            new.processing_next_retry_at := coalesce(new.processing_next_retry_at, timezone('utc', now()));
        elsif new.processing_status = 'ready' then
            new.processing_next_retry_at := null;
        end if;
    else
        new.processing_status := coalesce(new.processing_status, 'ready');
        if new.processing_status = 'ready' then
            new.processing_next_retry_at := null;
        end if;
    end if;

    return new;
end;
$$;

drop trigger if exists trg_media_files_processing_defaults on public.media_files;
create trigger trg_media_files_processing_defaults
before insert on public.media_files
for each row
execute function public.set_media_files_processing_defaults();

do $$
begin
    if to_regclass('public.media_asset_variants') is not null then
        update public.media_files mf
        set
            processing_status = 'pending',
            processing_next_retry_at = coalesce(mf.processing_next_retry_at, timezone('utc', now())),
            processing_last_error = null,
            processing_updated_at = timezone('utc', now())
        where lower(coalesce(mf.file_type, '')) like 'image%'
          and mf.processing_status = 'ready'
          and nullif(trim(coalesce(mf.thumb_variant_path, '')), '') is null
          and not exists (
              select 1
              from public.media_asset_variants mv
              where mv.media_file_id = mf.id
                and mv.status = 'ready'
                and mv.variant_kind in ('thumb_240', 'thumb_480')
                and nullif(trim(coalesce(mv.storage_path, '')), '') is not null
          );
    else
        update public.media_files mf
        set
            processing_status = 'pending',
            processing_next_retry_at = coalesce(mf.processing_next_retry_at, timezone('utc', now())),
            processing_last_error = null,
            processing_updated_at = timezone('utc', now())
        where lower(coalesce(mf.file_type, '')) like 'image%'
          and mf.processing_status = 'ready'
          and nullif(trim(coalesce(mf.thumb_variant_path, '')), '') is null;
    end if;
end;
$$;
