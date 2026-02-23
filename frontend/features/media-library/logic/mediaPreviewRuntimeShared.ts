import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { resolveMediaSigningStoragePaths } from "../../../lib/mediaPreviewPath";
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

type ResolveAndApplySignedPreviewUrlsByRowsArgs<TRow extends { id?: string | null }> = {
  tab: MediaDataTab;
  rows: TRow[];
  applySignedUrlsToTab: (tab: MediaDataTab, signedById: Map<string, string>) => void;
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
  options?: { forceRefresh?: boolean }
): Promise<string | null> =>
  getSignedMediaUrl({
    bucket: BUCKET,
    storagePath,
    expiresInSeconds: 3600,
    forceRefresh: options?.forceRefresh ?? false,
  });

export const resolveAndApplySignedPreviewUrlsByRows = async <TRow extends { id?: string | null }>({
  tab,
  rows,
  applySignedUrlsToTab,
  fetcher = fetchWithAuth,
}: ResolveAndApplySignedPreviewUrlsByRowsArgs<TRow>): Promise<Set<string>> => {
  const ids = collectUniqueMediaIds(rows);
  const unresolvedIds = new Set(ids);
  if (!ids.length) return unresolvedIds;
  const resolvedById = await resolveSignedPreviewUrlsByMediaIds({
    ids,
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
  const storageCandidates = resolveMediaSigningStoragePaths(row, currentUserId);
  for (const storagePath of storageCandidates) {
    const blob = await downloadFromStoragePath(storagePath).catch(() => null);
    if (!blob || !blob.size) continue;
    const objectUrl = URL.createObjectURL(blob);
    applyObjectUrlForRow(row, objectUrl);
    return objectUrl;
  }
  return null;
};
