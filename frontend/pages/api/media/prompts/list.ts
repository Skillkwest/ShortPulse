/**
 * Server-authoritative prompt list API for AI Studio media library panel.
 * Supports folder-aware keyset pagination and search filtering.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import {
  isCustomMediaFolderId,
  MEDIA_LIBRARY_ROOT_FOLDER_ID,
} from "../../../../lib/server/mediaFoldersService";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

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

const resolveFolderPromptIds = async ({
  userId,
  folderId,
}: {
  userId: string;
  folderId: string;
}): Promise<string[] | null> => {
  if (folderId === MEDIA_LIBRARY_ROOT_FOLDER_ID) return null;
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

  const { data: membershipRows, error: membershipError } = await supabaseAdmin
    .from("media_folder_prompt_items")
    .select("prompt_id")
    .eq("user_id", userId)
    .eq("folder_id", folderId);
  if (membershipError) {
    throw new Error(membershipError.message || "Failed to load folder memberships");
  }

  const ids = new Set<string>();
  for (const row of membershipRows ?? []) {
    const promptId = asString((row as { prompt_id?: unknown }).prompt_id);
    if (!promptId) continue;
    ids.add(promptId);
  }
  return Array.from(ids);
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

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const body = toRequestBody(req.body);
    const folderId = asFolderId(body.folderId);
    const query = normalizeSearchTerm(asString(body.query));
    const cursor = asCursor(body.cursor);
    const limit = clampLimit(body.limit);

    const promptIds = await resolveFolderPromptIds({ userId: user.id, folderId });
    if (Array.isArray(promptIds) && promptIds.length === 0) {
      return res.status(200).json({
        rows: [],
        nextCursor: null,
        hasMore: false,
      });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const selectColumns = "id, title, prompt_text, mode, source, created_at, updated_at";
    const buildBaseQuery = () => {
      let queryBuilder = supabaseAdmin
        .from("media_prompts")
        .select(selectColumns)
        .eq("user_id", user.id);
      if (promptIds) {
        queryBuilder = queryBuilder.in("id", promptIds);
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
      fetchedRows.push(...((firstPageResponse.data ?? []) as PromptListRow[]));
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
      const sameTimestampRows = (sameTimestampResponse.data ?? []) as PromptListRow[];
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
        fetchedRows.push(...((olderRowsResponse.data ?? []) as PromptListRow[]));
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
