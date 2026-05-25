update public.user_owned_custom_voices
set
    ownership_confidence = 'migrated',
    updated_at = timezone('utc', now())
where provider = 'elevenlabs'
  and ownership_provenance = 'legacy_migrated'
  and ownership_confidence = 'disputed';
