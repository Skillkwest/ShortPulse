import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { createMediaPerfTimer } from "../../../lib/mediaPerfTelemetry";
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
    | "media-library-modal"
    | "media-library-panel"
    | "elements-media-panel"
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
  surface?:
    | "media-library-modal"
    | "media-library-panel"
    | "elements-media-panel"
    | "reference-grid"
    | "quick-slot"
    | "character-grid"
    | "detail-modal";
};

const LOCAL_SIGN_FIRST_SURFACES = new Set([
  "media-library-modal",
  "media-library-panel",
  "elements-media-panel",
]);
const MAX_LOCAL_SIGN_CANDIDATES_PER_ROW = 2;

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
  const previewCandidatesById = new Map<string, ReturnType<typeof resolveMediaPreviewCandidates>>();
  const unresolvedRows = rows.filter((row) => {
    const previewCandidates = resolveMediaPreviewCandidates(row, currentUserId);
    previewCandidatesById.set(row.id, previewCandidates);
    const directUrl = previewCandidates.directUrl;
    if (!directUrl) return true;
    directResolvedById.set(row.id, directUrl);
    return false;
  });
  const localResolvedById = new Map<string, string>();
  const needsResolverRows = [...unresolvedRows];
  if (surface && LOCAL_SIGN_FIRST_SURFACES.has(surface)) {
    await Promise.all(
      unresolvedRows.map(async (row) => {
        const previewCandidates = previewCandidatesById.get(row.id);
        const storageCandidates = (previewCandidates?.storagePaths ?? [])
          .map((candidate) => candidate.trim())
          .filter(Boolean)
          .slice(0, MAX_LOCAL_SIGN_CANDIDATES_PER_ROW);
        for (const storagePath of storageCandidates) {
          const signedUrl = await signMediaStoragePath(storagePath);
          if (!signedUrl) continue;
          localResolvedById.set(row.id, signedUrl);
          return;
        }
      })
    );
  }
  const unresolvedAfterLocalSign = needsResolverRows.filter(
    (row) => !localResolvedById.has(row.id)
  );
  const ids = collectUniqueMediaIds(unresolvedAfterLocalSign);
  const unresolvedIds = new Set(ids);
  if (directResolvedById.size) {
    applySignedUrlsToTab(tab, directResolvedById);
  }
  if (localResolvedById.size) {
    applySignedUrlsToTab(tab, localResolvedById);
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
  surface,
}: HydrateMediaPreviewViaStorageDownloadArgs<TRow>): Promise<string | null> => {
  const storageCandidates = resolveMediaPreviewCandidates(row, currentUserId).storagePaths;
  const finishFallback = createMediaPerfTimer({
    surface: surface ?? "unknown",
    candidate_count: storageCandidates.length,
  });
  for (const storagePath of storageCandidates) {
    const blob = await downloadFromStoragePath(storagePath).catch(() => null);
    if (!blob || !blob.size) continue;
    const objectUrl = URL.createObjectURL(blob);
    applyObjectUrlForRow(row, objectUrl);
    finishFallback("media.storage_download_fallback.completed", {
      succeeded_count: 1,
      failed_count: 0,
    });
    return objectUrl;
  }
  finishFallback("media.storage_download_fallback.failed", {
    succeeded_count: 0,
    failed_count: 1,
  });
  return null;
};
