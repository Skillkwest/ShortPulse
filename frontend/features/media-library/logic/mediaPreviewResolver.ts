/**
 * Shared preview-resolver helpers for media rows.
 * Encapsulates resolve-previews API request/response handling for reuse across surfaces.
 */
import { fetchWithAuth } from "../../../lib/authenticatedFetch";

type ResolvePreviewUrlsByMediaIdsArgs = {
  ids: string[];
  expiresInSeconds?: number;
  fetcher?: typeof fetchWithAuth;
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
  fetcher = fetchWithAuth,
}: ResolvePreviewUrlsByMediaIdsArgs): Promise<Map<string, string>> => {
  if (!ids.length) return new Map();
  try {
    const response = await fetcher("/api/media/resolve-previews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ids,
        expiresInSeconds,
      }),
      shortpulseLogScope: "app",
    }).catch(() => null);
    if (!response?.ok) return new Map();
    const payload = (await response.json().catch(() => null)) as ResolvePreviewUrlsPayload;
    const urls = payload?.urls ?? {};
    const resolvedById = new Map<string, string>();
    for (const mediaId of ids) {
      const url = urls[mediaId];
      if (!url) continue;
      resolvedById.set(mediaId, url);
    }
    return resolvedById;
  } catch {
    return new Map();
  }
};
