/**
 * Moves multiple user-owned media files between Media Library tabs.
 * Uses per-file move semantics while returning a batched success/failure summary.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../_utils/appErrorLogs";
import { requireApiUser } from "../_utils/auth";
import {
  isMediaDataTab,
  moveMediaFileForUser,
  type MediaFileRow,
} from "../../../lib/server/mediaMoveService";
import type { MediaDataTab } from "../../../features/media-library/logic/mediaMoveRouting";

type MoveBatchItemSuccess = {
  fileId: string;
  file: MediaFileRow;
  fromTab: MediaDataTab;
  toTab: MediaDataTab;
  previousStoragePath: string;
  nextStoragePath: string;
};

type MoveBatchItemFailure = {
  fileId: string;
  error: string;
  details?: string;
};

type MoveBatchSuccessResponse = {
  destinationTab: MediaDataTab;
  moved: MoveBatchItemSuccess[];
  failed: MoveBatchItemFailure[];
  summary: {
    requested: number;
    moved: number;
    failed: number;
  };
};

type MoveBatchErrorResponse = {
  error: string;
  details?: string;
};

const MAX_MOVE_BATCH_SIZE = 40;

const toRequestBody = (body: unknown): Record<string, unknown> => {
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return {};
    } catch {
      return {};
    }
  }
  if (body && typeof body === "object" && !Array.isArray(body)) {
    return body as Record<string, unknown>;
  }
  return {};
};

const asString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const asStringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  const deduped = new Set<string>();
  for (const raw of value) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    deduped.add(trimmed);
  }
  return Array.from(deduped);
};

/**
 * API handler for batched media-file moves.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MoveBatchSuccessResponse | MoveBatchErrorResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const requestBody = toRequestBody(req.body);
    const destination = asString(requestBody.destinationTab);
    const fileIds = asStringList(requestBody.fileIds);

    if (!destination || !fileIds.length) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!isMediaDataTab(destination)) {
      return res.status(400).json({ error: "Invalid destination tab" });
    }
    if (fileIds.length > MAX_MOVE_BATCH_SIZE) {
      return res.status(400).json({
        error: "Too many files in move batch",
        details: `Maximum ${MAX_MOVE_BATCH_SIZE} files per request`,
      });
    }

    const destinationTab: MediaDataTab = destination;
    const moved: MoveBatchItemSuccess[] = [];
    const failed: MoveBatchItemFailure[] = [];

    for (const fileId of fileIds) {
      const moveResult = await moveMediaFileForUser({
        userId: user.id,
        fileId,
        destinationTab,
      });
      if (!moveResult.ok) {
        failed.push({
          fileId,
          error: moveResult.value.error,
          details: moveResult.value.details,
        });
        continue;
      }
      moved.push({
        fileId,
        file: moveResult.value.file,
        fromTab: moveResult.value.fromTab,
        toTab: moveResult.value.toTab,
        previousStoragePath: moveResult.value.previousStoragePath,
        nextStoragePath: moveResult.value.nextStoragePath,
      });
    }

    return res.status(200).json({
      destinationTab,
      moved,
      failed,
      summary: {
        requested: fileIds.length,
        moved: moved.length,
        failed: failed.length,
      },
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "media-move-batch",
      user,
    });

    return res.status(500).json({
      error: "Failed to move media files",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
