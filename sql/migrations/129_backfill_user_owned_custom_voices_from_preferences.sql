-- Backfill authoritative custom voice ownership rows from the legacy saved-voice preference cache.
-- This only migrates entries that look like owned custom/provider-created voices.
-- If the legacy column is absent in the target environment, this migration intentionally no-ops.

do $$
declare
    has_legacy_saved_voices_column boolean := false;
begin
    if to_regclass('public.user_owned_custom_voices') is null then
        raise exception 'public.user_owned_custom_voices table is required before applying migration 129';
    end if;
    if to_regclass('public.user_preferences') is null then
        raise exception 'public.user_preferences table is required before applying migration 129';
    end if;

    select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'user_preferences'
          and column_name = 'ai_studio_saved_voices'
    )
    into has_legacy_saved_voices_column;

    if not has_legacy_saved_voices_column then
        raise notice 'Migration 129 skipped: public.user_preferences.ai_studio_saved_voices is absent in this environment.';
        return;
    end if;

    execute $backfill$
        with expanded_saved_voices as (
            select
                preferences.user_id,
                saved_voice
            from public.user_preferences as preferences
            cross join lateral jsonb_array_elements(
                case
                    when jsonb_typeof(preferences.ai_studio_saved_voices) = 'array'
                        then preferences.ai_studio_saved_voices
                    else '[]'::jsonb
                end
            ) as saved_voice
        ),
        normalized_owned_custom_voices as (
            select
                user_id,
                'elevenlabs'::text as provider,
                btrim(saved_voice ->> 'voiceId') as voice_id,
                btrim(saved_voice ->> 'name') as display_name,
                nullif(btrim(saved_voice ->> 'description'), '') as description,
                nullif(btrim(saved_voice ->> 'previewUrl'), '') as preview_url,
                nullif(btrim(saved_voice ->> 'sampleStoragePath'), '') as sample_storage_path,
                case
                    when btrim(saved_voice ->> 'originKind') in ('provider-user-created', 'provider-saved', 'provider-default', 'legacy-saved')
                        then btrim(saved_voice ->> 'originKind')
                    else 'provider-user-created'
                end as origin_kind,
                case
                    when btrim(saved_voice ->> 'savedSource') in ('provider-save', 'text-to-voice-create', 'voice-clone', 'legacy')
                        then btrim(saved_voice ->> 'savedSource')
                    when coalesce((saved_voice ->> 'providerDeleteEligible')::boolean, false)
                        then 'legacy'
                    else 'legacy'
                end as saved_source,
                coalesce((saved_voice ->> 'providerDeleteEligible')::boolean, false) as provider_delete_eligible,
                case
                    when btrim(saved_voice ->> 'savedSource') = 'text-to-voice-create' then 'text_to_voice_create'
                    when btrim(saved_voice ->> 'savedSource') = 'voice-clone' then 'voice_clone'
                    when btrim(saved_voice ->> 'savedSource') = 'provider-save' then 'provider_save'
                    else 'legacy_migrated'
                end as ownership_provenance,
                case
                    when btrim(saved_voice ->> 'savedSource') in ('text-to-voice-create', 'voice-clone')
                        then 'high'
                    else 'migrated'
                end as ownership_confidence,
                coalesce(
                    nullif(saved_voice ->> 'createdAt', '')::timestamptz,
                    timezone('utc', now())
                ) as created_at,
                timezone('utc', now()) as updated_at
            from expanded_saved_voices
            where
                jsonb_typeof(saved_voice) = 'object'
                and nullif(btrim(saved_voice ->> 'voiceId'), '') is not null
                and nullif(btrim(saved_voice ->> 'name'), '') is not null
                and (
                    btrim(saved_voice ->> 'originKind') = 'provider-user-created'
                    or btrim(saved_voice ->> 'savedSource') in ('text-to-voice-create', 'voice-clone')
                    or coalesce((saved_voice ->> 'providerDeleteEligible')::boolean, false)
                )
        )
        insert into public.user_owned_custom_voices (
            user_id,
            provider,
            voice_id,
            display_name,
            description,
            preview_url,
            sample_storage_path,
            origin_kind,
            saved_source,
            provider_delete_eligible,
            ownership_provenance,
            ownership_confidence,
            created_at,
            updated_at
        )
        select distinct on (user_id, provider, voice_id)
            user_id,
            provider,
            voice_id,
            display_name,
            description,
            preview_url,
            sample_storage_path,
            origin_kind,
            saved_source,
            provider_delete_eligible,
            ownership_provenance,
            ownership_confidence,
            created_at,
            updated_at
        from normalized_owned_custom_voices
        order by user_id, provider, voice_id, created_at desc
        on conflict (user_id, provider, voice_id) do nothing
    $backfill$;
end;
$$;
