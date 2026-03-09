/**
 * Server-authoritative media-list API for route/modal pagination.
 * Provides tab-filtered keyset paging plus optional first-slice signed URL hydration.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { resolveMediaSigningStoragePaths } from "../../../lib/mediaPreviewPath";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import {
  normalizeMediaSearchTerm,
  withMediaSearchFilter,
  withMediaTabFilter,
  type MediaQueryDataTab,
} from "../../../features/media-library/logic/mediaQueryModel";

type MediaListSurface = "media-library-route" | "media-library-modal";

type MediaListCursor = {
  createdAt: string;
  id: string;
};

type MediaListRow = {
  id: string;
  filename: string;
  storage_path: string;
  file_type: string | null;
  file_size: number | null;
  source: string | null;
  source_ref: string | null;
  prompt_id: string | null;
  metadata: Record<string, unknown> | null;
  thumb_variant_path: string | null;
  poster_variant_path: string | null;
  preview_variant_path: string | null;
  created_at: string;
  updated_at: string | null;
};

type MediaListSuccessResponse = {
  rows: MediaListRow[];
  nextCursor: MediaListCursor | null;
  hasMore: boolean;
  signedById?: Record<string, string | null>;
};

type MediaListErrorResponse = {
  error: string;
  details?: string;
};

const MEDIA_BUCKET = "media_library";
const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600;
const TRAVERSAL_SEGMENT_REGEX = /(?:^|\/)\.\.(?:\/|$)/;

const LIMIT_BY_SURFACE: Record<MediaListSurface, number> = {
  "media-library-modal": 36,
  "media-library-route": 60,
};

const INITIAL_SIGN_BUDGET_BY_SURFACE: Record<MediaListSurface, number> = {
  "media-library-modal": 6,
  "media-library-route": 10,
};
const INITIAL_SIGN_BUDGET_BY_TAB_FOR_MODAL: Partial<Record<MediaQueryDataTab, number>> = {
  private: 10,
};

const parseBooleanEnv = (value: string | undefined, fallback: boolean): boolean => {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "true") return true;
  if (normalized === "false") return false;
  return fallback;
};

const isMediaListApiEnabled = (): boolean =>
  parseBooleanEnv(process.env.SHORTPULSE_MEDIA_LIST_API_ENABLED, true);

const asRecord = (value: unknown): Record<string, unknown> => {
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
};

const toSurface = (value: unknown): MediaListSurface | null => {
  if (value === "media-library-route" || value === "media-library-modal") {
    return value;
  }
  return null;
};

const toTab = (value: unknown): MediaQueryDataTab | null => {
  if (
    value === "uploaded_images" ||
    value === "uploaded_videos" ||
    value === "private" ||
    value === "ai_generations"
  ) {
    return value;
  }
  return null;
};

const toCursor = (value: unknown): MediaListCursor | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as { createdAt?: unknown; id?: unknown };
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt.trim() : "";
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!createdAt || !id) return null;
  return { createdAt, id };
};

const clampLimit = (surface: MediaListSurface, value: unknown): number => {
  const maxLimit = LIMIT_BY_SURFACE[surface];
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return maxLimit;
  const normalized = Math.trunc(parsed);
  if (normalized < 1) return 1;
  if (normalized > maxLimit) return maxLimit;
  return normalized;
};

const buildCursor = (rows: MediaListRow[]): MediaListCursor | null => {
  if (!rows.length) return null;
  const tail = rows[rows.length - 1];
  const id = tail.id?.trim() ?? "";
  const createdAt = tail.created_at?.trim() ?? "";
  if (!id || !createdAt) return null;
  return { id, createdAt };
};

const createdAtTime = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const mergeUniqueRows = (rows: MediaListRow[], limit: number): MediaListRow[] => {
  if (!rows.length) return [];
  const byId = new Map<string, MediaListRow>();
  for (const row of rows) {
    if (!row?.id) continue;
    byId.set(row.id, row);
  }
  return Array.from(byId.values())
    .sort((left, right) => {
      const createdDelta = createdAtTime(right.created_at) - createdAtTime(left.created_at);
      if (createdDelta !== 0) return createdDelta;
      return right.id.localeCompare(left.id);
    })
    .slice(0, limit);
};

const isSafeScopedPath = (path: string, userId: string): boolean => {
  const normalized = path.trim();
  if (!normalized) return false;
  if (normalized.startsWith("/") || normalized.includes("\\")) return false;
  if (TRAVERSAL_SEGMENT_REGEX.test(normalized)) return false;
  return normalized.startsWith(`${userId}/`);
};

const resolveInitialSignedById = async ({
  rows,
  userId,
  surface,
  tab,
}: {
  rows: MediaListRow[];
  userId: string;
  surface: MediaListSurface;
  tab: MediaQueryDataTab;
}): Promise<Record<string, string | null>> => {
  const signBudget =
    surface === "media-library-modal"
      ? (INITIAL_SIGN_BUDGET_BY_TAB_FOR_MODAL[tab] ?? INITIAL_SIGN_BUDGET_BY_SURFACE[surface])
      : INITIAL_SIGN_BUDGET_BY_SURFACE[surface];
  const seedRows = rows.slice(0, signBudget);
  if (!seedRows.length) return {};

  const candidatesById = new Map<string, string[]>();
  const signPathSet = new Set<string>();
  for (const row of seedRows) {
    const candidates = resolveMediaSigningStoragePaths(row, userId).filter((path) =>
      isSafeScopedPath(path, userId)
    );
    if (!candidates.length) continue;
    candidatesById.set(row.id, candidates);
    for (const path of candidates) {
      signPathSet.add(path);
    }
  }
  const pathsToSign = Array.from(signPathSet);
  if (!pathsToSign.length) return {};

  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(pathsToSign, DEFAULT_SIGNED_URL_TTL_SECONDS);
  if (error) return {};

  const signedByPath = new Map<string, string | null>();
  for (const item of data ?? []) {
    const path =
      typeof (item as { path?: unknown }).path === "string"
        ? (item as { path: string }).path.trim()
        : "";
    if (!path) continue;
    const signedUrl =
      typeof (item as { signedUrl?: unknown }).signedUrl === "string"
        ? ((item as { signedUrl: string }).signedUrl || "").trim()
        : "";
    signedByPath.set(path, signedUrl || null);
  }

  const signedById: Record<string, string | null> = {};
  for (const [id, candidates] of candidatesById.entries()) {
    const signedUrl = candidates
      .map((candidate) => signedByPath.get(candidate) ?? null)
      .find((value) => Boolean(value));
    if (!signedUrl) continue;
    signedById[id] = signedUrl;
  }
  return signedById;
};

/**
 * Handles user-scoped media-list pagination and optional first-slice signing.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MediaListSuccessResponse | MediaListErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  if (!isMediaListApiEnabled()) {
    return res.status(503).json({
      error: "Media list API is disabled",
      details: "Enable SHORTPULSE_MEDIA_LIST_API_ENABLED to use this route.",
    });
  }

  try {
    const requestBody = asRecord(req.body);
    const tab = toTab(requestBody.tab);
    const surface = toSurface(requestBody.surface);
    if (!tab || !surface) {
      return res.status(400).json({ error: "Invalid tab or surface" });
    }

    const query = normalizeMediaSearchTerm(
      typeof requestBody.query === "string" ? requestBody.query : ""
    );
    const cursor = toCursor(requestBody.cursor);
    const limit = clampLimit(surface, requestBody.limit);

    const selectColumns =
      "id, filename, storage_path, file_type, file_size, source, source_ref, prompt_id, metadata, thumb_variant_path, poster_variant_path, preview_variant_path, created_at, updated_at";
    const supabaseAdmin = getSupabaseAdmin();
    const buildBaseQuery = () => {
      let queryBuilder = supabaseAdmin
        .from("media_files")
        .select(selectColumns)
        .eq("user_id", user.id);
      queryBuilder = withMediaTabFilter(queryBuilder, tab);
      queryBuilder = withMediaSearchFilter(queryBuilder, query);
      return queryBuilder
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
    };

    const fetchedRows: MediaListRow[] = [];
    if (!cursor) {
      const firstPageResponse = await buildBaseQuery().limit(limit);
      if (firstPageResponse.error) {
        return res.status(500).json({
          error: "Failed to list media",
          details: firstPageResponse.error.message,
        });
      }
      fetchedRows.push(...((firstPageResponse.data ?? []) as MediaListRow[]));
    } else {
      const sameTimestampResponse = await buildBaseQuery()
        .eq("created_at", cursor.createdAt)
        .lt("id", cursor.id)
        .limit(limit);
      if (sameTimestampResponse.error) {
        return res.status(500).json({
          error: "Failed to list media",
          details: sameTimestampResponse.error.message,
        });
      }
      const sameTimestampRows = (sameTimestampResponse.data ?? []) as MediaListRow[];
      fetchedRows.push(...sameTimestampRows);

      const remaining = limit - sameTimestampRows.length;
      if (remaining > 0) {
        const olderRowsResponse = await buildBaseQuery()
          .lt("created_at", cursor.createdAt)
          .limit(remaining);
        if (olderRowsResponse.error) {
          return res.status(500).json({
            error: "Failed to list media",
            details: olderRowsResponse.error.message,
          });
        }
        fetchedRows.push(...((olderRowsResponse.data ?? []) as MediaListRow[]));
      }
    }

    const rows = mergeUniqueRows(fetchedRows, limit);
    const nextCursor = buildCursor(rows);
    const hasMore = rows.length === limit && Boolean(nextCursor);
    const signedById = await resolveInitialSignedById({
      rows,
      userId: user.id,
      surface,
      tab,
    });

    res.setHeader("x-shortpulse-media-list-surface", surface);
    res.setHeader("x-shortpulse-media-list-tab", tab);
    res.setHeader("x-shortpulse-media-list-row-count", String(rows.length));
    res.setHeader("x-shortpulse-media-list-query-mode", query ? "search" : "default");
    res.setHeader(
      "x-shortpulse-media-list-initial-signed-count",
      String(Object.keys(signedById).length)
    );

    return res.status(200).json({
      rows,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
      signedById: Object.keys(signedById).length ? signedById : undefined,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-list",
      user,
    });
    return res.status(500).json({
      error: "Failed to list media",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
