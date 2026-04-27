/**
 * Shared Media Library preview-storage-path normalization.
 * Centralizes the preview-path fallback used by route fetches and mutation flows.
 */
import { resolveMediaSigningStoragePaths } from "../../../lib/mediaPreviewPath";

type PreviewStoragePathRow = {
  storage_path: string;
};

/**
 * Resolves the canonical preview storage path for a media row.
 * Inputs: a media row plus the current signed-in user id when available.
 * Output: the first signable preview candidate, or the canonical storage path.
 * Side effects: none.
 */
export const resolveMediaPreviewStoragePath = <TRow extends PreviewStoragePathRow>(
  row: TRow,
  currentUserId: string | null
): string => resolveMediaSigningStoragePaths(row, currentUserId)[0] ?? row.storage_path;
