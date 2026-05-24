-- Add an authoritative per-user custom voice ownership ledger.
-- Shared provider inventory must not be treated as ownership by itself.

create table if not exists public.user_owned_custom_voices (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    provider text not null,
    voice_id text not null,
    display_name text not null,
    description text,
    preview_url text,
    sample_storage_path text,
    origin_kind text not null,
    saved_source text not null,
    provider_delete_eligible boolean not null default false,
    ownership_provenance text not null default 'legacy_migrated',
    ownership_confidence text not null default 'migrated',
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint user_owned_custom_voices_provider_check
        check (provider = 'elevenlabs'),
    constraint user_owned_custom_voices_voice_id_check
        check (voice_id = btrim(voice_id) and char_length(voice_id) between 1 and 255),
    constraint user_owned_custom_voices_display_name_check
        check (display_name = btrim(display_name) and char_length(display_name) between 1 and 255),
    constraint user_owned_custom_voices_origin_kind_check
        check (origin_kind in ('provider-user-created', 'provider-saved', 'provider-default', 'legacy-saved')),
    constraint user_owned_custom_voices_saved_source_check
        check (saved_source in ('provider-save', 'text-to-voice-create', 'voice-clone', 'legacy')),
    constraint user_owned_custom_voices_sample_storage_path_length_check
        check (sample_storage_path is null or char_length(sample_storage_path) <= 1024),
    constraint user_owned_custom_voices_preview_url_length_check
        check (preview_url is null or char_length(preview_url) <= 2048),
    constraint user_owned_custom_voices_ownership_provenance_check
        check (ownership_provenance in ('text_to_voice_create', 'voice_clone', 'provider_save', 'legacy_migrated', 'admin_repair')),
    constraint user_owned_custom_voices_ownership_confidence_check
        check (ownership_confidence in ('high', 'migrated', 'disputed'))
);

create unique index if not exists ix_user_owned_custom_voices_provider_voice
    on public.user_owned_custom_voices (provider, voice_id);

create unique index if not exists ix_user_owned_custom_voices_user_provider_voice
    on public.user_owned_custom_voices (user_id, provider, voice_id);

create index if not exists ix_user_owned_custom_voices_user_created
    on public.user_owned_custom_voices (user_id, created_at desc);

alter table public.user_owned_custom_voices enable row level security;

drop policy if exists select_user_owned_custom_voices_isolation on public.user_owned_custom_voices;
create policy select_user_owned_custom_voices_isolation
    on public.user_owned_custom_voices
    for select
    using (user_id = auth.uid());

drop policy if exists insert_user_owned_custom_voices_isolation on public.user_owned_custom_voices;
create policy insert_user_owned_custom_voices_isolation
    on public.user_owned_custom_voices
    for insert
    with check (user_id = auth.uid());

drop policy if exists update_user_owned_custom_voices_isolation on public.user_owned_custom_voices;
create policy update_user_owned_custom_voices_isolation
    on public.user_owned_custom_voices
    for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

drop policy if exists delete_user_owned_custom_voices_isolation on public.user_owned_custom_voices;
create policy delete_user_owned_custom_voices_isolation
    on public.user_owned_custom_voices
    for delete
    using (user_id = auth.uid());
