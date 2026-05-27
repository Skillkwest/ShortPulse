/**
 * Shared preview-resolver helpers for media rows.
 * Encapsulates resolve-previews API request/response handling for reuse across surfaces.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { createMediaPerfTimer } from "../../../lib/mediaPerfTelemetry";
import type { MediaPreviewTransformProfile } from "../../../lib/mediaPreviewTransformProfile";
import { resolveMediaPreviewCandidates } from "../../../lib/mediaPreviewPath";

type ResolvePreviewUrlsByMediaIdsArgs = {
  ids: string[];
  expiresInSeconds?: number;
  surface?:
    | "media-library-modal"
    | "media-library-panel"
    | "elements-media-panel"
    | "character-media-panel"
    | "reference-grid"
    | "quick-slot"
    | "character-grid"
    | "detail-modal";
  fetcher?: typeof fetchWithAuth;
};

type ResolveSelectionUrlArgs<TRow extends { storage_path?: string | null }> = {
  row: TRow;
  currentUserId: string | null;
  signStoragePath: (
    storagePath: string,
    options?: { forceRefresh?: boolean; previewProfile?: MediaPreviewTransformProfile }
  ) => Promise<string | null>;
};

type ResolvePreviewUrlsPayload = {
  urls?: Record<string, string | null>;
} | null;

/**
 * Builds a stable, deduped media-id list from row collections.
 */
export const collectUniqueMediaIds = <TRow extends { id?: string | null }>(
  rows: TRow[]
): string[] =>
  Array.from(
    new Set(
      rows
        .map((row) => (typeof row.id === "string" ? row.id.trim() : ""))
        .filter((id) => id.length > 0)
    )
  );

/**
 * Resolves signed preview URLs for media ids via `/api/media/resolve-previews`.
 */
export const resolveSignedPreviewUrlsByMediaIds = async ({
  ids,
  expiresInSeconds = 3600,
  surface,
  fetcher = fetchWithAuth,
}: ResolvePreviewUrlsByMediaIdsArgs): Promise<Map<string, string>> => {
  if (!ids.length) return new Map();
  const finishResolvePreviews = createMediaPerfTimer({
    surface: surface ?? "unknown",
    batch_size: ids.length,
  });
  try {
    const response = await fetcher("/api/media/resolve-previews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ids,
        expiresInSeconds,
        surface,
      }),
      shortpulseLogScope: "app",
    }).catch(() => null);
    if (!response?.ok) {
      finishResolvePreviews("media.resolve_previews.failed", {
        failed_count: ids.length,
        error_kind: response ? "http_error" : "network_error",
      });
      return new Map();
    }
    const payload = (await response.json().catch(() => null)) as ResolvePreviewUrlsPayload;
    const urls = payload?.urls ?? {};
    const resolvedById = new Map<string, string>();
    for (const mediaId of ids) {
      const url = urls[mediaId];
      if (!url) continue;
      resolvedById.set(mediaId, url);
    }
    finishResolvePreviews("media.resolve_previews.completed", {
      resolved_count: resolvedById.size,
      failed_count: Math.max(0, ids.length - resolvedById.size),
    });
    return resolvedById;
  } catch {
    finishResolvePreviews("media.resolve_previews.failed", {
      failed_count: ids.length,
      error_kind: "unexpected_error",
    });
    return new Map();
  }
};

/**
 * Resolves a signed URL for media selection, prioritizing canonical storage path.
 */
export const resolveSignedSelectionUrl = async <TRow extends { storage_path?: string | null }>({
  row,
  currentUserId,
  signStoragePath,
}: ResolveSelectionUrlArgs<TRow>): Promise<string | null> => {
  const previewCandidates = resolveMediaPreviewCandidates(row, currentUserId);
  if (previewCandidates.directUrl) {
    return previewCandidates.directUrl;
  }
  const candidates = previewCandidates.storagePaths.filter(
    (value, index, all) => Boolean(value) && all.indexOf(value) === index
  );
  for (const storagePath of candidates) {
    const signedUrl = await signStoragePath(storagePath, { forceRefresh: true });
    if (signedUrl) return signedUrl;
  }
  return null;
};
