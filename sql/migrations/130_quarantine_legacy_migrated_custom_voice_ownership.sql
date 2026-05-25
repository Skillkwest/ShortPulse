-- Quarantine legacy-migrated custom voice ownership rows for manual review.
-- Runtime authority now requires high-confidence ownership, so older migrated
-- rows should move into an explicit disputed state until repaired.

update public.user_owned_custom_voices
set
    ownership_confidence = 'disputed',
    updated_at = timezone('utc', now())
where provider = 'elevenlabs'
  and ownership_provenance = 'legacy_migrated'
  and ownership_confidence = 'migrated';
