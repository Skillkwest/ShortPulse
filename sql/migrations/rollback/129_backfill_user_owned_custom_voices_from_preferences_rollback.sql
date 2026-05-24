delete from public.user_owned_custom_voices
where ownership_provenance = 'legacy_migrated'
  and ownership_confidence = 'migrated';
