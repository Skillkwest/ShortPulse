import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type { MediaListProfile } from "../../../lib/mediaListProfile";
import { normalizeMediaSearchTerm } from "./mediaQueryModel";

export type MediaListTab = "uploaded_images" | "uploaded_videos" | "private" | "ai_generations";
export type MediaListMediaKind = "all" | "images" | "videos";

export type MediaListSurface =
  | "media-library-route"
  | "media-library-modal"
  | "media-library-panel";

export type MediaListCursor = {
  createdAt: string;
  id: string;
};

type MediaListResponse<TRow> = {
  rows?: TRow[];
  nextCursor?: MediaListCursor | null;
  hasMore?: boolean;
  signedById?: Record<string, string | null>;
  libraryTotalCount?: number | null;
};

type FetchMediaListPageArgs = {
  tab?: MediaListTab | null;
  query: string;
  cursor: MediaListCursor | null;
  limit: number;
  surface: MediaListSurface;
  profile?: MediaListProfile;
  folderId?: string | null;
  projectId?: string | null;
  mediaKind?: MediaListMediaKind | null;
  includeLibraryTotalCount?: boolean;
  fetcher?: typeof fetchWithAuth;
};

export type FetchMediaListPageResult<TRow> = {
  rows: TRow[];
  nextCursor: MediaListCursor | null;
  hasMore: boolean;
  signedById: Map<string, string>;
  libraryTotalCount?: number | null;
} | null;

const MAX_LIMIT_BY_SURFACE: Record<MediaListSurface, number> = {
  "media-library-modal": 36,
  "media-library-panel": 36,
  "media-library-route": 60,
};

const toSafeCursor = (value: unknown): MediaListCursor | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as { createdAt?: unknown; id?: unknown };
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt.trim() : "";
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!createdAt || !id) return null;
  return { createdAt, id };
};

const clampLimit = (surface: MediaListSurface, limit: number): number => {
  const maxLimit = MAX_LIMIT_BY_SURFACE[surface];
  const parsed = Number(limit);
  if (!Number.isFinite(parsed)) return maxLimit;
  const normalized = Math.trunc(parsed);
  if (normalized < 1) return 1;
  if (normalized > maxLimit) return maxLimit;
  return normalized;
};

/**
 * Fetches one paged media-list slice from `/api/media/list`.
 * Returns `null` when the request cannot be fulfilled so callers can fallback to legacy direct queries.
 */
export const fetchMediaListPage = async <TRow>({
  tab,
  query,
  cursor,
  limit,
  surface,
  profile,
  folderId,
  projectId,
  mediaKind,
  includeLibraryTotalCount,
  fetcher = fetchWithAuth,
}: FetchMediaListPageArgs): Promise<FetchMediaListPageResult<TRow>> => {
  try {
    const response = await fetcher("/api/media/list", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tab: tab ?? undefined,
        query: normalizeMediaSearchTerm(query),
        cursor,
        limit: clampLimit(surface, limit),
        surface,
        profile,
        folderId: typeof folderId === "string" && folderId.trim() ? folderId.trim() : undefined,
        projectId: typeof projectId === "string" && projectId.trim() ? projectId.trim() : undefined,
        mediaKind: mediaKind ?? undefined,
        includeLibraryTotalCount: includeLibraryTotalCount === true,
      }),
      shortpulseLogScope: "app",
    }).catch(() => null);
    if (!response?.ok) return null;
    const payload = (await response.json().catch(() => null)) as MediaListResponse<TRow> | null;
    const rows = Array.isArray(payload?.rows) ? payload.rows : [];
    const nextCursor = toSafeCursor(payload?.nextCursor);
    const hasMore = payload?.hasMore === true;
    const libraryTotalCount =
      typeof payload?.libraryTotalCount === "number" && Number.isFinite(payload.libraryTotalCount)
        ? Math.max(0, Math.trunc(payload.libraryTotalCount))
        : null;
    const signedById = new Map<string, string>();
    const signedMap = payload?.signedById ?? {};
    for (const [id, rawUrl] of Object.entries(signedMap)) {
      const mediaId = id.trim();
      const signedUrl = typeof rawUrl === "string" ? rawUrl.trim() : "";
      if (!mediaId || !signedUrl) continue;
      signedById.set(mediaId, signedUrl);
    }
    return {
      rows,
      nextCursor,
      hasMore,
      signedById,
      libraryTotalCount,
    };
  } catch {
    return null;
  }
};
