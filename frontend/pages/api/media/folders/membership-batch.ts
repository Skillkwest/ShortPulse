/**
 * Applies folder membership batch operations for media and prompt items.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import {
  applyFolderMembershipBatch,
  isCustomMediaFolderId,
  type FolderMembershipBatchAction,
} from "../../../../lib/server/mediaFoldersService";

type MembershipBatchSuccessResponse = {
  action: FolderMembershipBatchAction;
  folderId: string | null;
  sourceFolderId: string | null;
  targetFolderId: string | null;
  mediaAssigned: number;
  mediaUnassigned: number;
  promptsAssigned: number;
  promptsUnassigned: number;
  mediaDuplicates: number;
  promptDuplicates: number;
  mediaSkipped: number;
  promptSkipped: number;
};

type MembershipBatchErrorResponse = {
  error: string;
  details?: string;
};

const MAX_BATCH_IDS = 200;

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

const asAction = (value: unknown): FolderMembershipBatchAction | null => {
  if (value === "assign" || value === "unassign" || value === "move") return value;
  return null;
};

const asIdList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const deduped = new Set<string>();
  for (const entry of value) {
    if (typeof entry !== "string") continue;
    const normalized = entry.trim();
    if (!normalized) continue;
    deduped.add(normalized);
    if (deduped.size >= MAX_BATCH_IDS) break;
  }
  return Array.from(deduped);
};

/**
 * Handles folder membership assign/unassign operations.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MembershipBatchSuccessResponse | MembershipBatchErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const body = toRequestBody(req.body);
    const folderId = asString(body.folderId);
    const sourceFolderId = asString(body.sourceFolderId);
    const targetFolderId = asString(body.targetFolderId);
    const action = asAction(body.action);
    const mediaIds = asIdList(body.mediaIds);
    const promptIds = asIdList(body.promptIds);

    if (!action) {
      return res.status(400).json({
        error: "Invalid action",
        details: "Action must be assign, unassign, or move.",
      });
    }
    if (action === "move") {
      if (!isCustomMediaFolderId(sourceFolderId) || !isCustomMediaFolderId(targetFolderId)) {
        return res.status(400).json({
          error: "Invalid folder id",
        });
      }
    } else if (!isCustomMediaFolderId(folderId)) {
      return res.status(400).json({
        error: "Invalid folder id",
      });
    }
    if (!mediaIds.length && !promptIds.length) {
      return res.status(400).json({
        error: "No ids provided",
        details: "Provide mediaIds and/or promptIds.",
      });
    }

    const result = await applyFolderMembershipBatch({
      userId: user.id,
      action,
      folderId: action === "move" ? undefined : folderId,
      sourceFolderId: action === "move" ? sourceFolderId : undefined,
      targetFolderId: action === "move" ? targetFolderId : undefined,
      mediaIds,
      promptIds,
    });

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "Invalid folder id") {
        return res.status(400).json({ error: "Invalid folder id" });
      }
      if (error.message === "Folder not found") {
        return res.status(404).json({ error: "Folder not found" });
      }
      if (error.message === "One or more item ids are invalid for this user") {
        return res.status(403).json({
          error: "Invalid folder membership ids",
          details: "One or more media/prompt ids are not owned by this user.",
        });
      }
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "media-folders-membership-batch",
      user,
    });
    return res.status(500).json({
      error: "Failed to update folder membership",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
