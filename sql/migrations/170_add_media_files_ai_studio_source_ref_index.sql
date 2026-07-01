-- Speed generation-owned media lookups used by recovery and media reconciliation.
-- Existing media indexes are optimized for user/source listing or processing state,
-- not direct lookup by the generation source_ref.

create index if not exists ix_media_files_ai_studio_user_source_ref_created
    on public.media_files (user_id, source_ref, created_at asc)
    include (id)
    where source = 'ai_studio'
      and source_ref is not null;
