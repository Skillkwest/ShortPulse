-- Correct quickswap storage scope check to allow deterministic legacy backfill paths.
-- Migration 045 backfills from character_reference_images, whose storage paths are user-scoped
-- character paths but not always under /quickswap/.

alter table character_quick_swap_items
    drop constraint if exists character_quick_swap_items_storage_scope_check;
alter table character_quick_swap_items
    add constraint character_quick_swap_items_storage_scope_check
    check (storage_path like user_id::text || '/characters/' || character_id::text || '/%');
