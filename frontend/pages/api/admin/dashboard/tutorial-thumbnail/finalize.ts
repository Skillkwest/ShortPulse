/**
 * Admin API for finalizing direct dashboard tutorial thumbnail uploads.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../lib/server/api/auth";
import {
  DashboardTutorialAssetError,
  finalizeDashboardTutorialThumbnailUpload,
  type DashboardTutorialFinalizedThumbnailUpload,
} from "../../../../../lib/server/api/dashboardTutorialAssets";
import { getSupabaseAdmin } from "../../../../../lib/server/api/supabaseAdmin";

type FinalizeThumbnailResponse = {
  thumbnail: DashboardTutorialFinalizedThumbnailUpload;
};

type FinalizeThumbnailErrorResponse = {
  error: string;
  details?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<FinalizeThumbnailResponse | FinalizeThumbnailErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/dashboard/tutorial-thumbnail/finalize.auth",
      scope: "app",
    });
    return res.status(500).json({ error: "Unable to finalize thumbnail upload." });
  }
  if (!adminUser) {
    return;
  }

  try {
    const body = (req.body ?? {}) as {
      sourceStoragePath?: unknown;
      sourceMimeType?: unknown;
      sourceSize?: unknown;
    };
    const thumbnail = await finalizeDashboardTutorialThumbnailUpload(getSupabaseAdmin(), {
      storagePath: body.sourceStoragePath,
      sourceMimeType: body.sourceMimeType,
      sourceSize: body.sourceSize,
    });
    return res.status(200).json({ thumbnail });
  } catch (error) {
    if (error instanceof DashboardTutorialAssetError) {
      return res.status(error.status).json({ error: error.message, details: error.details });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/dashboard/tutorial-thumbnail/finalize",
      user: adminUser,
      metadata: {
        source: "api.admin.dashboard.tutorial_thumbnail.finalize",
      },
    });
    return res.status(500).json({ error: "Unable to finalize thumbnail upload." });
  }
}
