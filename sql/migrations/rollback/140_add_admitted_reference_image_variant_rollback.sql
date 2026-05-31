-- Roll back the admitted generated-image reference variant kind.
-- Requires admitted_reference_25mb rows to be deleted before this constraint is restored.

alter table media_asset_variants
    drop constraint if exists media_asset_variants_variant_kind_check;

alter table media_asset_variants
    add constraint media_asset_variants_variant_kind_check
    check (
        variant_kind in (
            'original',
            'thumb_240',
            'thumb_480',
            'poster_720',
            'preview_loop_360p',
            'playback_720p'
        )
    );
