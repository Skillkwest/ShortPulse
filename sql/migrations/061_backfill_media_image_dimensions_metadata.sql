-- Backfill canonical image dimension metadata keys on media_files rows.
-- Normalizes legacy dimension keys into metadata.width / metadata.height / metadata.aspect_ratio.

WITH candidates AS (
  SELECT
    mf.id,
    COALESCE(
      mf.metadata ->> 'width',
      mf.metadata ->> 'image_width',
      mf.metadata ->> 'video_width',
      mf.metadata ->> 'pixel_width',
      mf.metadata -> 'dimensions' ->> 'width',
      ''
    ) AS width_raw,
    COALESCE(
      mf.metadata ->> 'height',
      mf.metadata ->> 'image_height',
      mf.metadata ->> 'video_height',
      mf.metadata ->> 'pixel_height',
      mf.metadata -> 'dimensions' ->> 'height',
      ''
    ) AS height_raw
  FROM public.media_files mf
  WHERE lower(COALESCE(mf.file_type, '')) LIKE 'image%'
),
resolved AS (
  SELECT
    id,
    CASE
      WHEN width_raw ~ '^[0-9]+(?:\.[0-9]+)?$'
      THEN GREATEST(1, ROUND(width_raw::numeric)::int)
      ELSE NULL
    END AS width_px,
    CASE
      WHEN height_raw ~ '^[0-9]+(?:\.[0-9]+)?$'
      THEN GREATEST(1, ROUND(height_raw::numeric)::int)
      ELSE NULL
    END AS height_px
  FROM candidates
)
UPDATE public.media_files mf
SET metadata = jsonb_strip_nulls(
  COALESCE(mf.metadata, '{}'::jsonb)
  || CASE WHEN r.width_px IS NOT NULL THEN jsonb_build_object('width', r.width_px) ELSE '{}'::jsonb END
  || CASE WHEN r.height_px IS NOT NULL THEN jsonb_build_object('height', r.height_px) ELSE '{}'::jsonb END
  || CASE
    WHEN r.width_px IS NOT NULL AND r.height_px IS NOT NULL AND r.height_px > 0
    THEN jsonb_build_object('aspect_ratio', ROUND((r.width_px::numeric / r.height_px::numeric), 6))
    ELSE '{}'::jsonb
  END
)
FROM resolved r
WHERE mf.id = r.id
  AND (r.width_px IS NOT NULL OR r.height_px IS NOT NULL);
