-- Prevent duplicate media persistence rows for the same generation output slot.

create unique index if not exists media_files_generation_output_idx_unique
    on public.media_files (
        source_ref,
        ((metadata ->> 'generation_output_index'))
    )
    where source = 'ai_studio'
      and source_ref is not null
      and (metadata ->> 'generation_output_index') is not null;
