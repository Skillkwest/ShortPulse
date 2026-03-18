export type MediaListProfile = "minimal" | "expanded";

export const DEFAULT_MEDIA_LIST_PROFILE: MediaListProfile = "minimal";

const MEDIA_LIST_COMMON_SELECT_COLUMNS = [
  "id",
  "filename",
  "storage_path",
  "file_type",
  "width",
  "height",
  "file_size",
  "source",
  "source_ref",
  "prompt_id",
  "thumb_variant_path",
  "poster_variant_path",
  "preview_variant_path",
  "created_at",
  "updated_at",
];

export const MEDIA_LIST_MINIMAL_SELECT_COLUMNS = MEDIA_LIST_COMMON_SELECT_COLUMNS.join(", ");
export const MEDIA_LIST_EXPANDED_SELECT_COLUMNS = [
  ...MEDIA_LIST_COMMON_SELECT_COLUMNS.slice(0, 10),
  "metadata",
  ...MEDIA_LIST_COMMON_SELECT_COLUMNS.slice(10),
].join(", ");

export const isMediaListProfile = (value: unknown): value is MediaListProfile =>
  value === "minimal" || value === "expanded";

export const resolveMediaListSelectColumns = (profile: MediaListProfile): string =>
  profile === "expanded" ? MEDIA_LIST_EXPANDED_SELECT_COLUMNS : MEDIA_LIST_MINIMAL_SELECT_COLUMNS;
