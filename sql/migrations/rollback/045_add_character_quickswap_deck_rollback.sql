-- Roll back Quick Swap Deck V2 schema additions.

drop policy if exists modify_character_quick_swap_items_isolation on character_quick_swap_items;
drop policy if exists select_character_quick_swap_items_isolation on character_quick_swap_items;
drop table if exists character_quick_swap_items;

alter table media_files
    drop constraint if exists media_files_character_quickswap_source_shape_check;

alter table media_files
    drop constraint if exists media_files_source_check;
alter table media_files
    add constraint media_files_source_check
    check (
        source in (
            'upload',
            'private_upload',
            'ai_studio',
            'character_reference',
            'character_generation'
        )
    );
