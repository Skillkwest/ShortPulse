/**
 * Compatibility adapter for AI Studio motion-reference uploads.
 * Preserves the legacy response contract while reusing canonical upload validation/storage logic.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../lib/server/api/auth";
import { logApiRouteException } from "../../lib/server/api/appErrorLogs";
import { logLegacyUploadAdapterUsage } from "../../lib/server/mediaUploadAdapterTelemetry";
import {
  deleteSignedStorageAssetForUser,
  MediaUploadServiceError,
  uploadSignedStorageAssetForUser,
} from "../../lib/server/mediaUploadService";

type UploadResponse = {
  url: string;
  path: string;
  size: number;
  mimeType: string;
};

type ErrorResponse = {
  error: string;
  details?: string;
};

type DeleteRequestBody = {
  path?: unknown;
};

export const config = {
  api: {
    bodyParser: false,
  },
};

const MOTION_CONTROL_STORAGE_FOLDER = "videos/motion-control";

const readJsonBody = async (req: NextApiRequest): Promise<unknown> =>
  await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;

    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      req.off("data", onData);
      req.off("end", onEnd);
      req.off("error", onError);
      req.off("aborted", onAborted);
      callback();
    };

    const onData = (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    };

    const onEnd = () => {
      settle(() => {
        const rawBody = Buffer.concat(chunks).toString("utf8").trim();
        if (!rawBody) {
          resolve({});
          return;
        }
        try {
          resolve(JSON.parse(rawBody));
        } catch {
          reject(new MediaUploadServiceError(400, "Invalid request", "Request body must be JSON."));
        }
      });
    };

    const onError = (error: Error) => {
      settle(() => reject(error));
    };

    const onAborted = () => {
      settle(() =>
        reject(new MediaUploadServiceError(400, "Invalid request", "Request was aborted."))
      );
    };

    req.on("data", onData);
    req.on("end", onEnd);
    req.on("error", onError);
    req.on("aborted", onAborted);
  });

const readCleanupStoragePath = async (req: NextApiRequest): Promise<string> => {
  const body = (await readJsonBody(req)) as DeleteRequestBody;
  const storagePath = typeof body?.path === "string" ? body.path.trim() : "";
  if (!storagePath) {
    throw new MediaUploadServiceError(400, "Invalid request", "Motion upload path is required.");
  }
  return storagePath;
};

/**
 * Handles motion-control source video uploads.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<UploadResponse | ErrorResponse>
) {
  if (req.method !== "POST" && req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    if (req.method === "DELETE") {
      const storagePath = await readCleanupStoragePath(req);
      await deleteSignedStorageAssetForUser({
        userId: user.id,
        storagePath,
        storageFolderOverride: MOTION_CONTROL_STORAGE_FOLDER,
      });
      return res.status(204).end();
    }

    const uploaded = await uploadSignedStorageAssetForUser({
      req,
      userId: user.id,
      defaultDestinationTab: "uploaded_videos",
      storageFolderOverride: MOTION_CONTROL_STORAGE_FOLDER,
    });
    await logLegacyUploadAdapterUsage({
      req,
      routeLabel: "upload-video",
      userId: user.id,
      userEmail: user.email,
      fileSize: uploaded.size,
      storagePath: uploaded.path,
    });
    return res.status(200).json(uploaded);
  } catch (error) {
    if (error instanceof MediaUploadServiceError) {
      return res.status(error.status).json({
        error: error.message,
        details: error.details,
      });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "upload-video",
      user,
    });

    return res.status(500).json({
      error: "Upload failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
