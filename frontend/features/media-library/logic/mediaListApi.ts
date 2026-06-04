import {
  fetchWithAuth,
  isAuthRequiredError,
  isAuthSessionTimeoutError,
} from "../../../lib/authenticatedFetch";
import type { MediaListProfile } from "../../../lib/mediaListProfile";
import { normalizeMediaSearchTerm } from "./mediaQueryModel";

export type MediaListTab = "uploaded_images" | "uploaded_videos" | "private" | "ai_generations";
export type MediaListMediaKind = "all" | "images" | "videos" | "audio";

export type MediaListSurface =
  | "media-library-modal"
  | "media-library-panel"
  | "elements-media-panel"
  | "character-media-panel";

export type MediaListCursor = {
  createdAt: string;
  id: string;
};

export const MEDIA_LIST_AUTH_REQUIRED_CODE = "MEDIA_LIST_AUTH_REQUIRED" as const;
export const MEDIA_LIST_AUTH_SESSION_TIMEOUT_CODE = "MEDIA_LIST_AUTH_SESSION_TIMEOUT" as const;
export const MEDIA_LIST_FORBIDDEN_CODE = "MEDIA_LIST_FORBIDDEN" as const;
export const MEDIA_LIST_SERVER_ERROR_CODE = "MEDIA_LIST_SERVER_ERROR" as const;

export type MediaListRequestErrorCode =
  | typeof MEDIA_LIST_AUTH_REQUIRED_CODE
  | typeof MEDIA_LIST_AUTH_SESSION_TIMEOUT_CODE
  | typeof MEDIA_LIST_FORBIDDEN_CODE
  | typeof MEDIA_LIST_SERVER_ERROR_CODE;

export type MediaListRequestError = Error & {
  code: MediaListRequestErrorCode;
  status?: number;
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
  countOnly?: boolean;
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
  "elements-media-panel": 36,
  "character-media-panel": 36,
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

const createMediaListRequestError = (
  code: MediaListRequestErrorCode,
  message: string,
  options?: { status?: number }
): MediaListRequestError => {
  const error = new Error(message) as MediaListRequestError;
  error.code = code;
  if (typeof options?.status === "number" && Number.isFinite(options.status)) {
    error.status = Math.trunc(options.status);
  }
  return error;
};

const readResponseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.clone().json()) as { error?: unknown; message?: unknown };
    if (typeof payload?.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
    if (typeof payload?.message === "string" && payload.message.trim()) {
      return payload.message.trim();
    }
  } catch {
    // Fall through to text response read.
  }

  try {
    const text = (await response.clone().text()).trim();
    return text;
  } catch {
    return "";
  }
};

const toHttpFailureError = async (response: Response): Promise<MediaListRequestError> => {
  const status = response.status;
  const message = await readResponseErrorMessage(response);

  if (status === 401) {
    return createMediaListRequestError(
      MEDIA_LIST_AUTH_REQUIRED_CODE,
      message || "You must be signed in to load the Media Library.",
      { status }
    );
  }

  if (status === 403) {
    return createMediaListRequestError(
      MEDIA_LIST_FORBIDDEN_CODE,
      message || "You do not have access to this Media Library view.",
      { status }
    );
  }

  return createMediaListRequestError(
    MEDIA_LIST_SERVER_ERROR_CODE,
    message || `Media Library request failed with status ${status}.`,
    { status }
  );
};

export const isMediaListRequestErrorCode = (
  error: unknown,
  code: MediaListRequestErrorCode
): error is MediaListRequestError => {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === code;
};

/**
 * Fetches one paged media-list slice from the canonical `/api/media/list` route.
 * Returns `null` when the request cannot be fulfilled so callers can surface a deterministic load failure.
 */
export const fetchMediaListPage = async <TRow>({
  tab,
  query,
  cursor,
  limit,
  surface,
  profile,
  folderId,
  mediaKind,
  includeLibraryTotalCount,
  countOnly,
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
        mediaKind: mediaKind ?? undefined,
        includeLibraryTotalCount: includeLibraryTotalCount === true,
        countOnly: countOnly === true,
      }),
      shortpulseLogScope: "app",
      shortpulseRetryNetworkOnce: true,
    });
    if (!response.ok) {
      throw await toHttpFailureError(response);
    }
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
  } catch (error) {
    if (isAuthRequiredError(error)) {
      throw createMediaListRequestError(
        MEDIA_LIST_AUTH_REQUIRED_CODE,
        error.message || "You must be signed in to load the Media Library.",
        { status: 401 }
      );
    }
    if (isAuthSessionTimeoutError(error)) {
      throw createMediaListRequestError(
        MEDIA_LIST_AUTH_SESSION_TIMEOUT_CODE,
        error.message || "Timed out resolving auth session for the Media Library."
      );
    }
    if (
      isMediaListRequestErrorCode(error, MEDIA_LIST_AUTH_REQUIRED_CODE) ||
      isMediaListRequestErrorCode(error, MEDIA_LIST_AUTH_SESSION_TIMEOUT_CODE) ||
      isMediaListRequestErrorCode(error, MEDIA_LIST_FORBIDDEN_CODE) ||
      isMediaListRequestErrorCode(error, MEDIA_LIST_SERVER_ERROR_CODE)
    ) {
      throw error;
    }
    return null;
  }
};
