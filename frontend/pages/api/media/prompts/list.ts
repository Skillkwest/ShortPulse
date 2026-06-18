/**
 * Server-authoritative prompt list API for AI Studio media library panel.
 * Supports folder-aware keyset pagination and search filtering.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import {
  assertMediaFolderAccessForUser,
  MEDIA_LIBRARY_ROOT_FOLDER_ID,
} from "../../../../lib/server/mediaFoldersService";

type PromptListCursor = {
  createdAt: string;
  id: string;
};

type PromptListRow = {
  id: string;
  title: string | null;
  prompt_text: string;
  mode: string | null;
  source: string | null;
  created_at: string;
  updated_at: string | null;
};

type FolderScopedPromptListRow = PromptListRow & {
  folder_membership?: unknown;
};

type PromptListSuccessResponse = {
  rows: PromptListRow[];
  nextCursor: PromptListCursor | null;
  hasMore: boolean;
};

type PromptListErrorResponse = {
  error: string;
  details?: string;
};

const MAX_LIMIT = 50;

const normalizeSearchTerm = (value: string): string =>
  value
    .trim()
    .replace(/[,%*()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toRequestBody = (value: unknown): Record<string, unknown> => {
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

const asString = (value: unknown): string => {
  return typeof value === "string" ? value.trim() : "";
};

const asFolderId = (value: unknown): string => {
  const folderId = asString(value);
  if (!folderId) return MEDIA_LIBRARY_ROOT_FOLDER_ID;
  return folderId;
};

const asCursor = (value: unknown): PromptListCursor | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as { createdAt?: unknown; id?: unknown };
  const createdAt = asString(raw.createdAt);
  const id = asString(raw.id);
  if (!createdAt || !id) return null;
  return { createdAt, id };
};

const clampLimit = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return MAX_LIMIT;
  const normalized = Math.trunc(parsed);
  if (normalized < 1) return 1;
  if (normalized > MAX_LIMIT) return MAX_LIMIT;
  return normalized;
};

const createdAtTime = (value: string | null | undefined): number => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const mergeUniqueRows = (rows: PromptListRow[], limit: number): PromptListRow[] => {
  if (!rows.length) return [];
  const byId = new Map<string, PromptListRow>();
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

const buildCursor = (rows: PromptListRow[]): PromptListCursor | null => {
  if (!rows.length) return null;
  const tail = rows[rows.length - 1];
  if (!tail?.id || !tail?.created_at) return null;
  return {
    id: tail.id,
    createdAt: tail.created_at,
  };
};

const stripFolderMembershipRows = (
  rows: FolderScopedPromptListRow[] | PromptListRow[],
  folderScoped: boolean
): PromptListRow[] => {
  if (!folderScoped) return rows as PromptListRow[];
  return (rows as FolderScopedPromptListRow[]).map((row) => {
    const normalizedRow = { ...row };
    delete normalizedRow.folder_membership;
    return normalizedRow;
  });
};

const assertFolderAccess = async ({
  userId,
  folderId,
}: {
  userId: string;
  folderId: string;
}): Promise<void> => {
  if (folderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) return;
  await assertMediaFolderAccessForUser({ userId, folderId });
};

/**
 * Lists prompt rows for the authenticated user.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PromptListSuccessResponse | PromptListErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-prompts-list.auth",
      scope: "app",
    });
    return res.status(500).json({ error: "Failed to list prompts" });
  }
  if (!user) return;
  const userId = user.id;

  try {
    const body = toRequestBody(req.body);
    const folderId = asFolderId(body.folderId);
    const query = normalizeSearchTerm(asString(body.query));
    const cursor = asCursor(body.cursor);
    const limit = clampLimit(body.limit);

    await assertFolderAccess({ userId, folderId });

    const supabaseAdmin = getSupabaseAdmin();
    const selectColumns = "id, title, prompt_text, mode, source, created_at, updated_at";
    const folderScoped = folderId !== MEDIA_LIBRARY_ROOT_FOLDER_ID;
    const buildBaseQuery = () => {
      let queryBuilder = supabaseAdmin
        .from("media_prompts")
        .select(
          folderScoped
            ? `${selectColumns}, folder_membership:media_folder_prompt_items!media_folder_prompt_items_prompt_fk!inner(folder_id,user_id)`
            : selectColumns
        )
        .eq("user_id", userId);
      if (folderScoped) {
        queryBuilder = queryBuilder
          .eq("folder_membership.folder_id", folderId)
          .eq("folder_membership.user_id", userId);
      }
      if (query) {
        const wildcard = `*${query}*`;
        queryBuilder = queryBuilder.or(`title.ilike.${wildcard},prompt_text.ilike.${wildcard}`);
      }
      return queryBuilder
        .order("created_at", { ascending: false })
        .order("id", { ascending: false });
    };

    const fetchedRows: PromptListRow[] = [];
    if (!cursor) {
      const firstPageResponse = await buildBaseQuery().limit(limit);
      if (firstPageResponse.error) {
        return res.status(500).json({
          error: "Failed to list prompts",
          details: firstPageResponse.error.message,
        });
      }
      fetchedRows.push(
        ...stripFolderMembershipRows(
          (firstPageResponse.data ?? []) as unknown as FolderScopedPromptListRow[],
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
          error: "Failed to list prompts",
          details: sameTimestampResponse.error.message,
        });
      }
      const sameTimestampRows = stripFolderMembershipRows(
        (sameTimestampResponse.data ?? []) as unknown as FolderScopedPromptListRow[],
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
            error: "Failed to list prompts",
            details: olderRowsResponse.error.message,
          });
        }
        fetchedRows.push(
          ...stripFolderMembershipRows(
            (olderRowsResponse.data ?? []) as unknown as FolderScopedPromptListRow[],
            folderScoped
          )
        );
      }
    }

    const rows = mergeUniqueRows(fetchedRows, limit);
    const nextCursor = buildCursor(rows);
    const hasMore = rows.length === limit && Boolean(nextCursor);

    return res.status(200).json({
      rows,
      nextCursor: hasMore ? nextCursor : null,
      hasMore,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Invalid folder id") {
        return res.status(400).json({ error: "Invalid folder id" });
      }
      if (error.message === "Folder not found") {
        return res.status(404).json({ error: "Folder not found" });
      }
      if (error.message === "Project not found") {
        return res.status(404).json({ error: "Project not found" });
      }
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "media-prompts-list",
      user,
    });
    return res.status(500).json({
      error: "Failed to list prompts",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
