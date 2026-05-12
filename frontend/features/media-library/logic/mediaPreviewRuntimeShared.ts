import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { MediaPreviewTransformProfile } from "../../../lib/mediaPreviewTransformProfile";
import { resolveMediaPreviewCandidates } from "../../../lib/mediaPreviewPath";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import { BUCKET, type MediaDataTab } from "./mediaLibraryPageHelpers";
import { collectUniqueMediaIds, resolveSignedPreviewUrlsByMediaIds } from "./mediaPreviewResolver";

type SigningCandidateRow = {
  id: string;
  storage_path?: string | null;
  file_type?: string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
};

type ResolveAndApplySignedPreviewUrlsByRowsArgs<TRow extends SigningCandidateRow> = {
  tab: MediaDataTab;
  rows: TRow[];
  applySignedUrlsToTab: (tab: MediaDataTab, signedById: Map<string, string>) => void;
  currentUserId?: string | null;
  surface?:
    | "media-library-route"
    | "media-library-modal"
    | "media-library-panel"
    | "reference-grid"
    | "quick-slot"
    | "character-grid"
    | "detail-modal";
  fetcher?: typeof fetchWithAuth;
};

type HydrateMediaPreviewViaStorageDownloadArgs<TRow extends SigningCandidateRow> = {
  row: TRow;
  currentUserId: string | null;
  downloadFromStoragePath: (storagePath: string) => Promise<Blob | null>;
  applyObjectUrlForRow: (row: TRow, objectUrl: string) => void;
};

export const signMediaStoragePath = async (
  storagePath: string,
  options?: { forceRefresh?: boolean; previewProfile?: MediaPreviewTransformProfile }
): Promise<string | null> =>
  getSignedMediaUrl({
    bucket: BUCKET,
    storagePath,
    expiresInSeconds: 3600,
    forceRefresh: options?.forceRefresh ?? false,
    previewProfile: options?.previewProfile ?? "none",
  });

export const resolveAndApplySignedPreviewUrlsByRows = async <TRow extends SigningCandidateRow>({
  tab,
  rows,
  applySignedUrlsToTab,
  currentUserId = null,
  surface,
  fetcher = fetchWithAuth,
}: ResolveAndApplySignedPreviewUrlsByRowsArgs<TRow>): Promise<Set<string>> => {
  const directResolvedById = new Map<string, string>();
  const unresolvedRows = rows.filter((row) => {
    const directUrl = resolveMediaPreviewCandidates(row, currentUserId).directUrl;
    if (!directUrl) return true;
    directResolvedById.set(row.id, directUrl);
    return false;
  });
  const ids = collectUniqueMediaIds(unresolvedRows);
  const unresolvedIds = new Set(ids);
  if (directResolvedById.size) {
    applySignedUrlsToTab(tab, directResolvedById);
  }
  if (!ids.length) return unresolvedIds;
  const resolvedById = await resolveSignedPreviewUrlsByMediaIds({
    ids,
    surface,
    fetcher,
  });
  for (const mediaId of resolvedById.keys()) {
    unresolvedIds.delete(mediaId);
  }
  applySignedUrlsToTab(tab, resolvedById);
  return unresolvedIds;
};

export const hydrateMediaPreviewViaStorageDownload = async <TRow extends SigningCandidateRow>({
  row,
  currentUserId,
  downloadFromStoragePath,
  applyObjectUrlForRow,
}: HydrateMediaPreviewViaStorageDownloadArgs<TRow>): Promise<string | null> => {
  const storageCandidates = resolveMediaPreviewCandidates(row, currentUserId).storagePaths;
  for (const storagePath of storageCandidates) {
    const blob = await downloadFromStoragePath(storagePath).catch(() => null);
    if (!blob || !blob.size) continue;
    const objectUrl = URL.createObjectURL(blob);
    applyObjectUrlForRow(row, objectUrl);
    return objectUrl;
  }
  return null;
};
