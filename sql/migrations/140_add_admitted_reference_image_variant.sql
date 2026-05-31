-- Add durable admitted image variants for generated-image product-use references.
-- Original media_files rows remain the full-quality authority for detail/save/export.

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
            'playback_720p',
            'admitted_reference_25mb'
        )
    );
