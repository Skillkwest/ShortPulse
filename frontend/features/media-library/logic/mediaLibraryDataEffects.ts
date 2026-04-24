/**
 * Media Library side-effect helpers for event logging and storage cleanup.
 * Centralizes Supabase operations used by delete flows so page orchestration stays thin.
 */
import { invalidateSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseQueryClient, readSupabaseUserId } from "../../../lib/supabaseClient";
import { BUCKET, isMissingRelationError, isNonEmptyString } from "./mediaLibraryPageHelpers";

type MediaVariantPathRow = {
  storage_path: string | null;
};

export type MediaDeleteTarget = {
  id: string;
  storage_path: string;
  preview_storage_path?: string | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
};

const STORAGE_DELETE_BATCH_SIZE = 100;

/**
 * Writes a media event row scoped to the current signed-in user, if available.
 * Inputs: event kind, entity kind/id, and optional metadata payload.
 * Output: Promise resolved after best-effort insert attempt.
 * Side effects: reads auth session and writes `media_events` via Supabase.
 */
export const logMediaEvent = async (
  eventType: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown> = {}
) => {
  try {
    const supabase = ensureSupabaseQueryClient();
    const userId = await readSupabaseUserId();
    if (!userId) return;
    const { error } = await supabase.from("media_events").insert({
      user_id: userId,
      event_type: eventType,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
    });
    if (error) {
      console.warn("Media event log failed", error);
    }
  } catch (error) {
    console.warn("Media event log error", error);
  }
};

/**
 * Resolves all storage paths that should be removed for a set of media targets.
 * Inputs: delete targets containing canonical and optional variant/preview paths.
 * Output: de-duplicated list of storage paths to delete.
 * Side effects: queries `media_asset_variants` for additional variant paths.
 */
export const collectMediaStoragePathsForDelete = async (
  targets: MediaDeleteTarget[]
): Promise<string[]> => {
  if (!targets.length) return [];
  const basePaths = targets.flatMap((target) => [
    target.storage_path,
    target.preview_storage_path,
    target.thumb_variant_path,
    target.poster_variant_path,
    target.preview_variant_path,
  ]);
  const dedupedBasePaths = Array.from(new Set(basePaths.filter(isNonEmptyString)));
  const targetIds = targets.map((target) => target.id);
  if (!targetIds.length) return dedupedBasePaths;

  const supabase = ensureSupabaseQueryClient();
  const { data: variantRows, error: variantError } = await supabase
    .from("media_asset_variants")
    .select("storage_path")
    .in("media_file_id", targetIds);

  // Backward compatibility for environments that have not applied migration 005 yet.
  if (variantError && isMissingRelationError(variantError)) {
    return dedupedBasePaths;
  }
  if (variantError) throw variantError;

  const variantPaths = ((variantRows ?? []) as MediaVariantPathRow[]).map(
    (row) => row.storage_path
  );
  return Array.from(new Set([...dedupedBasePaths, ...variantPaths.filter(isNonEmptyString)]));
};

/**
 * Deletes storage objects in batches and invalidates signed-url cache entries.
 * Inputs: storage paths to remove from the Media Library bucket.
 * Output: Promise resolved after all batches are removed.
 * Side effects: performs Supabase storage deletes and cache invalidation.
 */
export const removeStoragePaths = async (paths: string[]): Promise<void> => {
  if (!paths.length) return;
  const supabase = ensureSupabaseQueryClient();
  for (let start = 0; start < paths.length; start += STORAGE_DELETE_BATCH_SIZE) {
    const batch = paths.slice(start, start + STORAGE_DELETE_BATCH_SIZE);
    const { error: storageError } = await supabase.storage.from(BUCKET).remove(batch);
    if (storageError) throw storageError;
    batch.forEach((path) => {
      invalidateSignedMediaUrl(BUCKET, path);
    });
  }
};

/**
 * Deletes one media file row plus all associated storage objects/variants.
 * Inputs: one media delete target containing canonical + optional variant paths.
 * Output: Promise resolved after storage and DB row are removed.
 * Side effects: removes bucket objects and deletes one `media_files` row.
 */
export const deleteMediaFileWithStorage = async (target: MediaDeleteTarget): Promise<void> => {
  const supabase = ensureSupabaseQueryClient();
  const deletePaths = await collectMediaStoragePathsForDelete([target]);
  const { error: deleteError } = await supabase.from("media_files").delete().eq("id", target.id);
  if (deleteError) throw deleteError;
  try {
    await removeStoragePaths(deletePaths);
  } catch (storageError) {
    console.warn("Media storage cleanup failed after DB delete", storageError);
  }
};

/**
 * Deletes one saved prompt row.
 * Inputs: prompt id.
 * Output: Promise resolved after DB delete succeeds.
 * Side effects: deletes one `media_prompts` row.
 */
export const deleteMediaPromptById = async (promptId: string): Promise<void> => {
  const normalizedPromptId = promptId.trim();
  if (!normalizedPromptId) return;
  const supabase = ensureSupabaseQueryClient();
  const { error: deleteError } = await supabase
    .from("media_prompts")
    .delete()
    .eq("id", normalizedPromptId);
  if (deleteError) throw deleteError;
};
