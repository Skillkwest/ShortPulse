/**
 * Server-authoritative media-list API for route/modal pagination.
 * Provides tab-filtered keyset paging plus optional first-slice signed URL hydration.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  DEFAULT_MEDIA_LIST_PROFILE,
  isMediaListProfile,
  resolveMediaListSelectColumns,
  type MediaListProfile,
} from "../../../lib/mediaListProfile";
import { resolvePreviewProfileForSurface } from "../../../lib/mediaPreviewTransformProfile";
import { resolveMediaSigningStoragePaths } from "../../../lib/mediaPreviewPath";
import { resolvePolicySignedImageTransform } from "../../../lib/mediaSignedTransformPolicy";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import { assertProjectMediaFolderAccessForUser } from "../../../lib/server/projectMediaFoldersService";
import { getProjectForUser, parseProjectId } from "../../../lib/server/projectsService";
import {
  normalizeMediaSearchTerm,
  withMediaSearchFilter,
  withMediaTabFilter,
  type MediaQueryDataTab,
} from "../../../features/media-library/logic/mediaQueryModel";
import {
  isCustomMediaFolderId,
  MEDIA_LIBRARY_ROOT_FOLDER_ID,
} from "../../../lib/server/mediaFoldersService";

type MediaListSurface = "media-library-route" | "media-library-modal" | "media-library-panel";
type MediaListMediaKind = "all" | "images" | "videos";

type MediaListCursor = {
  createdAt: string;
  id: string;
};

type MediaListRow = {
  id: string;
  filename: string;
  storage_path: string;
  file_type: string | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  source: string | null;
  source_ref: string | null;
  prompt_id: string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path: string | null;
  poster_variant_path: string | null;
  preview_variant_path: string | null;
  created_at: string;
  updated_at: string | null;
};

type FolderScopedMediaListRow = MediaListRow & {
  folder_membership?: unknown;
};

type MediaListSuccessResponse = {
  rows: MediaListRow[];
  nextCursor: MediaListCursor | null;
  hasMore: boolean;
  signedById?: Record<string, string | null>;
  libraryTotalCount?: number | null;
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
  "media-library-panel": 36,
  "media-library-route": 60,
};

const INITIAL_SIGN_BUDGET_BY_SURFACE: Record<MediaListSurface, number> = {
  "media-library-modal": 6,
  "media-library-panel": 6,
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
const isCharacterScopeExclusionEnabled = (): boolean =>
  parseBooleanEnv(process.env.SHORTPULSE_MEDIA_LIBRARY_EXCLUDE_CHARACTER_SCOPE, true);

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
  if (
    value === "media-library-route" ||
    value === "media-library-modal" ||
    value === "media-library-panel"
  ) {
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

const toMediaKind = (value: unknown): MediaListMediaKind | null => {
  if (value === "all" || value === "images" || value === "videos") {
    return value;
  }
  return null;
};

const toFolderId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
};

const toProjectId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  return parseProjectId(value);
};

const hasProjectIdInput = (value: unknown): boolean =>
  typeof value === "string" && value.trim().length > 0;

const toCursor = (value: unknown): MediaListCursor | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as { createdAt?: unknown; id?: unknown };
  const createdAt = typeof raw.createdAt === "string" ? raw.createdAt.trim() : "";
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!createdAt || !id) return null;
  return { createdAt, id };
};

const toProfile = (value: unknown): MediaListProfile | null => {
  if (value == null) return DEFAULT_MEDIA_LIST_PROFILE;
  return isMediaListProfile(value) ? value : null;
};

const toIncludeLibraryTotalCount = (value: unknown): boolean => value === true;

const withMediaKindFilter = <
  T extends {
    ilike: (column: string, pattern: string) => T;
    not: (column: string, operator: string, value: string) => T;
  },
>(
  query: T,
  mediaKind: MediaListMediaKind
): T => {
  if (mediaKind === "images") return query.ilike("file_type", "image%");
  if (mediaKind === "videos") return query.ilike("file_type", "video%");
  return query;
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

const stripFolderMembershipRows = (
  rows: FolderScopedMediaListRow[] | MediaListRow[],
  folderScoped: boolean
): MediaListRow[] => {
  if (!folderScoped) return rows as MediaListRow[];
  return (rows as FolderScopedMediaListRow[]).map((row) => {
    const normalizedRow = { ...row };
    delete normalizedRow.folder_membership;
    return normalizedRow;
  });
};

const isSafeScopedPath = (path: string, userId: string): boolean => {
  const normalized = path.trim();
  if (!normalized) return false;
  if (normalized.startsWith("/") || normalized.includes("\\")) return false;
  if (TRAVERSAL_SEGMENT_REGEX.test(normalized)) return false;
  return normalized.startsWith(`${userId}/`);
};

const resolveLibraryTotalCount = async ({
  userId,
  characterScopeExclusionEnabled,
}: {
  userId: string;
  characterScopeExclusionEnabled: boolean;
}): Promise<number | null> => {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    let query = supabaseAdmin
      .from("media_files")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if (characterScopeExclusionEnabled) {
      query = query.not("storage_path", "like", `${userId}/characters/%`);
    }
    const { count, error } = await query;
    if (error) return null;
    return typeof count === "number" && Number.isFinite(count) ? Math.max(0, count) : null;
  } catch {
    return null;
  }
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
  tab: MediaQueryDataTab | null;
}): Promise<Record<string, string | null>> => {
  const signBudget =
    surface === "media-library-modal"
      ? ((tab ? INITIAL_SIGN_BUDGET_BY_TAB_FOR_MODAL[tab] : undefined) ??
        INITIAL_SIGN_BUDGET_BY_SURFACE[surface])
      : INITIAL_SIGN_BUDGET_BY_SURFACE[surface];
  const previewProfile = resolvePreviewProfileForSurface(surface);
  const seedRows = rows.slice(0, signBudget);
  if (!seedRows.length) return {};

  const candidatesById = new Map<string, string[]>();
  for (const row of seedRows) {
    const candidates = resolveMediaSigningStoragePaths(row, userId).filter((path) =>
      isSafeScopedPath(path, userId)
    );
    if (!candidates.length) continue;
    candidatesById.set(row.id, candidates);
  }
  if (!candidatesById.size) return {};

  const supabaseAdmin = getSupabaseAdmin();
  const signedById: Record<string, string | null> = {};
  await Promise.all(
    seedRows.map(async (row) => {
      const candidates = candidatesById.get(row.id) ?? [];
      if (!candidates.length) return;
      let resolvedUrl: string | null = null;
      for (const candidate of candidates) {
        const transform = resolvePolicySignedImageTransform(previewProfile, candidate);
        const { data, error } = await supabaseAdmin.storage
          .from(MEDIA_BUCKET)
          .createSignedUrl(
            candidate,
            DEFAULT_SIGNED_URL_TTL_SECONDS,
            transform ? { transform } : undefined
          );
        if (error || !data?.signedUrl) continue;
        resolvedUrl = data.signedUrl;
        break;
      }
      if (resolvedUrl) {
        signedById[row.id] = resolvedUrl;
      }
    })
  );

  return signedById;
};

const assertFolderAccess = async ({
  userId,
  folderId,
  projectId,
}: {
  userId: string;
  folderId: string;
  projectId: string | null;
}): Promise<void> => {
  if (folderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
  if (projectId) {
    const project = await getProjectForUser({ userId, projectId });
    if (!project) {
      throw new Error("Project not found");
    }
    await assertProjectMediaFolderAccessForUser({
      userId,
      projectId,
      folderId,
    });
    return;
  }
  if (!isCustomMediaFolderId(folderId)) {
    throw new Error("Invalid folder id");
  }

  const supabaseAdmin = getSupabaseAdmin();
  const { data: folderRow, error: folderError } = await supabaseAdmin
    .from("media_folders")
    .select("id")
    .eq("id", folderId)
    .eq("user_id", userId)
    .maybeSingle();
  if (folderError) {
    throw new Error(folderError.message || "Failed to load folder");
  }
  if (!folderRow) {
    throw new Error("Folder not found");
  }
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
    const mediaKind = toMediaKind(requestBody.mediaKind);
    const surface = toSurface(requestBody.surface);
    const profile = toProfile(requestBody.profile);
    const folderId = toFolderId(requestBody.folderId) ?? MEDIA_LIBRARY_ROOT_FOLDER_ID;
    const projectId = toProjectId(requestBody.projectId);
    if (hasProjectIdInput(requestBody.projectId) && !projectId) {
      return res.status(400).json({ error: "Invalid project id" });
    }
    if (!surface || !profile || (!tab && !mediaKind)) {
      return res.status(400).json({ error: "Invalid tab, surface, or profile" });
    }

    const query = normalizeMediaSearchTerm(
      typeof requestBody.query === "string" ? requestBody.query : ""
    );
    const characterScopeExclusionEnabled = isCharacterScopeExclusionEnabled();
    const includeLibraryTotalCount = toIncludeLibraryTotalCount(
      requestBody.includeLibraryTotalCount
    );
    const cursor = toCursor(requestBody.cursor);
    const limit = clampLimit(surface, requestBody.limit);
    try {
      await assertFolderAccess({
        userId: user.id,
        folderId,
        projectId,
      });
    } catch (folderError) {
      if (folderError instanceof Error) {
        if (folderError.message === "Invalid folder id") {
          return res.status(400).json({ error: "Invalid folder id" });
        }
        if (folderError.message === "Folder not found") {
          return res.status(404).json({ error: "Folder not found" });
        }
        if (folderError.message === "Project not found") {
          return res.status(404).json({ error: "Project not found" });
        }
      }
      throw folderError;
    }
    const selectColumns = resolveMediaListSelectColumns(profile);
    const supabaseAdmin = getSupabaseAdmin();
    const folderScoped = folderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID;
    const buildBaseQuery = () => {
      let queryBuilder = supabaseAdmin
        .from("media_files")
        .select(
          folderScoped
            ? projectId
              ? `${selectColumns}, folder_membership:project_media_folder_media_items!project_media_folder_media_items_media_file_fk!inner(folder_id,user_id,project_id)`
              : `${selectColumns}, folder_membership:media_folder_media_items!media_folder_media_items_media_file_fk!inner(folder_id,user_id)`
            : selectColumns
        )
        .eq("user_id", user.id);
      if (characterScopeExclusionEnabled) {
        queryBuilder = queryBuilder.not("storage_path", "like", `${user.id}/characters/%`);
      }
      if (folderScoped) {
        queryBuilder = queryBuilder
          .eq("folder_membership.folder_id", folderId)
          .eq("folder_membership.user_id", user.id);
        if (projectId) {
          queryBuilder = queryBuilder.eq("folder_membership.project_id", projectId);
        }
      }
      if (mediaKind) {
        queryBuilder = withMediaKindFilter(queryBuilder, mediaKind);
      } else if (tab) {
        queryBuilder = withMediaTabFilter(queryBuilder, tab);
      }
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
      fetchedRows.push(
        ...stripFolderMembershipRows(
          (firstPageResponse.data ?? []) as unknown as FolderScopedMediaListRow[],
          folderScoped
        )
      );
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
      const sameTimestampRows = stripFolderMembershipRows(
        (sameTimestampResponse.data ?? []) as unknown as FolderScopedMediaListRow[],
        folderScoped
      );
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
        fetchedRows.push(
          ...stripFolderMembershipRows(
            (olderRowsResponse.data ?? []) as unknown as FolderScopedMediaListRow[],
            folderScoped
          )
        );
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
    const libraryTotalCount = includeLibraryTotalCount
      ? await resolveLibraryTotalCount({
          userId: user.id,
          characterScopeExclusionEnabled,
        })
      : null;

    res.setHeader("x-shortpulse-media-list-surface", surface);
    res.setHeader("x-shortpulse-media-list-tab", tab ?? mediaKind ?? "unknown");
    res.setHeader("x-shortpulse-media-list-folder-id", folderId);
    res.setHeader("x-shortpulse-media-list-profile", profile);
    res.setHeader("x-shortpulse-media-list-row-count", String(rows.length));
    res.setHeader("x-shortpulse-media-list-query-mode", query ? "search" : "default");
    res.setHeader(
      "x-shortpulse-media-list-character-scope-exclusion",
      characterScopeExclusionEnabled ? "on" : "off"
    );
    res.setHeader(
      "x-shortpulse-media-list-initial-signed-count",
      String(Object.keys(signedById).length)
    );

    return res.status(200).json({
      rows,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
      signedById: Object.keys(signedById).length ? signedById : undefined,
      libraryTotalCount,
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
