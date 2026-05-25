-- Custom voice ownership backfill diagnostics.
-- Purpose: verify authoritative custom voice ownership rows after migrations 128/129.
-- Safe to run repeatedly; read-only.
-- If the legacy saved-voice column is absent, legacy candidate counts will report as zero.

create temporary table if not exists user_owned_custom_voices_backfill_counts (
    owned_custom_voice_row_count bigint not null,
    legacy_owned_candidate_count bigint not null,
    missing_backfilled_row_count bigint not null,
    migrated_confidence_row_count bigint not null,
    disputed_confidence_row_count bigint not null,
    high_confidence_row_count bigint not null
) on commit drop;

truncate table user_owned_custom_voices_backfill_counts;

do $$
declare
    has_legacy_saved_voices_column boolean := false;
begin
    select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'user_preferences'
          and column_name = 'ai_studio_saved_voices'
    )
    into has_legacy_saved_voices_column;

    if has_legacy_saved_voices_column then
        execute $sql$
            with legacy_saved_voices as (
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
            legacy_owned_candidates as (
                select distinct on (
                    user_id,
                    lower(btrim(saved_voice ->> 'voiceId'))
                )
                    user_id,
                    btrim(saved_voice ->> 'voiceId') as voice_id,
                    btrim(saved_voice ->> 'name') as display_name,
                    btrim(saved_voice ->> 'originKind') as origin_kind,
                    btrim(saved_voice ->> 'savedSource') as saved_source,
                    coalesce((saved_voice ->> 'providerDeleteEligible')::boolean, false) as provider_delete_eligible,
                    nullif(saved_voice ->> 'createdAt', '')::timestamptz as created_at
                from legacy_saved_voices
                where
                    jsonb_typeof(saved_voice) = 'object'
                    and nullif(btrim(saved_voice ->> 'voiceId'), '') is not null
                    and nullif(btrim(saved_voice ->> 'name'), '') is not null
                    and (
                        btrim(saved_voice ->> 'originKind') = 'provider-user-created'
                        or btrim(saved_voice ->> 'savedSource') in ('text-to-voice-create', 'voice-clone')
                        or coalesce((saved_voice ->> 'providerDeleteEligible')::boolean, false)
                    )
                order by
                    user_id,
                    lower(btrim(saved_voice ->> 'voiceId')),
                    nullif(saved_voice ->> 'createdAt', '')::timestamptz desc nulls last
            ),
            owned_rows as (
                select
                    user_id,
                    provider,
                    voice_id,
                    display_name,
                    ownership_provenance,
                    ownership_confidence,
                    created_at
                from public.user_owned_custom_voices
                where provider = 'elevenlabs'
            ),
            missing_backfilled_rows as (
                select
                    candidate.user_id,
                    candidate.voice_id
                from legacy_owned_candidates as candidate
                left join owned_rows as owned
                  on owned.user_id = candidate.user_id
                 and lower(owned.voice_id) = lower(candidate.voice_id)
                where owned.voice_id is null
            )
            insert into user_owned_custom_voices_backfill_counts (
                owned_custom_voice_row_count,
                legacy_owned_candidate_count,
                missing_backfilled_row_count,
                migrated_confidence_row_count,
                disputed_confidence_row_count,
                high_confidence_row_count
            )
            select
                (select count(*)::bigint from owned_rows),
                (select count(*)::bigint from legacy_owned_candidates),
                (select count(*)::bigint from missing_backfilled_rows),
                (select count(*)::bigint from owned_rows where ownership_confidence = 'migrated'),
                (select count(*)::bigint from owned_rows where ownership_confidence = 'disputed'),
                (select count(*)::bigint from owned_rows where ownership_confidence = 'high')
        $sql$;
    else
        insert into user_owned_custom_voices_backfill_counts (
            owned_custom_voice_row_count,
            legacy_owned_candidate_count,
            missing_backfilled_row_count,
            migrated_confidence_row_count,
            disputed_confidence_row_count,
            high_confidence_row_count
        )
        select
            count(*)::bigint as owned_custom_voice_row_count,
            0::bigint as legacy_owned_candidate_count,
            0::bigint as missing_backfilled_row_count,
            count(*) filter (where ownership_confidence = 'migrated')::bigint as migrated_confidence_row_count,
            count(*) filter (where ownership_confidence = 'disputed')::bigint as disputed_confidence_row_count,
            count(*) filter (where ownership_confidence = 'high')::bigint as high_confidence_row_count
        from public.user_owned_custom_voices
        where provider = 'elevenlabs';
    end if;
end;
$$;

select
    owned_custom_voice_row_count,
    legacy_owned_candidate_count,
    missing_backfilled_row_count,
    migrated_confidence_row_count,
    disputed_confidence_row_count,
    high_confidence_row_count
from user_owned_custom_voices_backfill_counts;

-- Optional detail when the legacy column exists:
-- with legacy_saved_voices as (
--     select
--         preferences.user_id,
--         saved_voice
--     from public.user_preferences as preferences
--     cross join lateral jsonb_array_elements(preferences.ai_studio_saved_voices) as saved_voice
-- ),
-- legacy_owned_candidates as (
--     select distinct on (user_id, lower(btrim(saved_voice ->> 'voiceId')))
--         user_id,
--         btrim(saved_voice ->> 'voiceId') as voice_id,
--         btrim(saved_voice ->> 'name') as display_name,
--         btrim(saved_voice ->> 'originKind') as origin_kind,
--         btrim(saved_voice ->> 'savedSource') as saved_source,
--         coalesce((saved_voice ->> 'providerDeleteEligible')::boolean, false) as provider_delete_eligible,
--         nullif(saved_voice ->> 'createdAt', '')::timestamptz as created_at
--     from legacy_saved_voices
--     where
--         jsonb_typeof(saved_voice) = 'object'
--         and nullif(btrim(saved_voice ->> 'voiceId'), '') is not null
--         and nullif(btrim(saved_voice ->> 'name'), '') is not null
--         and (
--             btrim(saved_voice ->> 'originKind') = 'provider-user-created'
--             or btrim(saved_voice ->> 'savedSource') in ('text-to-voice-create', 'voice-clone')
--             or coalesce((saved_voice ->> 'providerDeleteEligible')::boolean, false)
--         )
--     order by user_id, lower(btrim(saved_voice ->> 'voiceId')), nullif(saved_voice ->> 'createdAt', '')::timestamptz desc nulls last
-- )
-- select
--     candidate.*
-- from legacy_owned_candidates as candidate
-- left join public.user_owned_custom_voices as owned
--   on owned.user_id = candidate.user_id
--  and lower(owned.voice_id) = lower(candidate.voice_id)
-- where owned.voice_id is null
-- order by candidate.created_at desc nulls last
-- limit 200;
