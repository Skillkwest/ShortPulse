/**
 * Shared parsing helpers for project generation association repair.
 */
import { assertUserScopedMediaStoragePath } from "../mediaStoragePath";

export type SnapshotRecord = Record<string, unknown>;

export type ProjectGenerationProjectionRow = {
  generation_id?: unknown;
  project_id?: unknown;
  request_id?: unknown;
  source_ref?: unknown;
  provider?: unknown;
  model_id?: unknown;
  display_prompt?: unknown;
  display_title?: unknown;
  transcript_text?: unknown;
  preview_url?: unknown;
  companion_art_status?: unknown;
  companion_art_storage_path?: unknown;
  result_urls?: unknown;
  saved_media_ids?: unknown;
  save_state?: unknown;
  save_error?: unknown;
  preview_storage_path?: unknown;
  full_storage_path?: unknown;
  task_state?: unknown;
  queue_state?: unknown;
  error_message?: unknown;
  error_message_short?: unknown;
  error_detail?: unknown;
  generation_replay?: unknown;
  workflow_reload?: unknown;
  character_context?: unknown;
  style_context?: unknown;
  started_at?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
  hidden_in_reference_grid?: unknown;
  reference_grid_visible?: unknown;
};

export type ProjectGenerationPublicationRow = {
  generation_id?: unknown;
  owned_media_file_id?: unknown;
  preview_storage_path?: unknown;
  full_storage_path?: unknown;
  created_at?: unknown;
};

export type ProjectGenerationMediaFileRow = {
  id?: unknown;
  storage_path?: unknown;
  file_type?: unknown;
  poster_variant_path?: unknown;
  thumb_variant_path?: unknown;
  preview_variant_path?: unknown;
};

export type ProjectGenerationMediaDelivery = {
  previewPosterStoragePath: string | null;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
};

export const asRecord = (value: unknown): SnapshotRecord =>
  value && typeof value === "object" && !Array.isArray(value) ? (value as SnapshotRecord) : {};

export const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

export const toSafeUserScopedPath = (value: unknown, userId: string): string | null => {
  const candidate = asTrimmedString(value);
  if (!candidate) return null;
  try {
    return assertUserScopedMediaStoragePath({
      path: candidate,
      userId,
      label: "Project generation delivery path",
    });
  } catch {
    return null;
  }
};

export const parseIsoTimestampMs = (value: unknown): number | null => {
  const iso = asTrimmedString(value);
  const parsed = Date.parse(iso ?? "");
  return Number.isFinite(parsed) ? parsed : null;
};

export const resolveProjectionCreatedAt = (
  projection: ProjectGenerationProjectionRow | null | undefined
): string | null =>
  asTrimmedString(projection?.started_at) ??
  asTrimmedString(projection?.created_at) ??
  asTrimmedString(projection?.updated_at);

export const asTrimmedStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asTrimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));
};

export const asIsoTimestampString = (value: unknown): string | null => {
  const normalized = asTrimmedString(value);
  if (!normalized) return null;
  return parseIsoTimestampMs(normalized) === null ? null : normalized;
};

export const asBoolean = (value: unknown): boolean | null =>
  typeof value === "boolean" ? value : null;
