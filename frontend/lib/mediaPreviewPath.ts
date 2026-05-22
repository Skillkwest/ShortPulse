/**
 * Resolves the preferred storage path for lightweight media previews.
 * Falls back to canonical `storage_path` when no variant path metadata is available.
 */
export {
  classifyMediaPreviewPath,
  resolveDurablePreviewStoragePath,
  resolveMediaDirectPreviewUrls,
  resolveMediaPreviewCandidates,
  resolveMediaStoragePathCandidate,
  resolveMediaSigningStoragePaths,
  resolvePreferredMediaDirectPreviewUrl,
  resolvePreferredMediaSigningStoragePath,
  resolvePreviewStoragePath,
  resolveVideoBrowseSigningCandidates,
  resolveVideoPosterSigningStoragePaths,
  resolveVideoPosterStoragePath,
} from "./mediaPreviewPathCore";
export type { MediaPreviewPathKind } from "./mediaPreviewPathCore";
