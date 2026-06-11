/**
 * Admin API for preparing direct dashboard tutorial thumbnail uploads.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../lib/server/api/auth";
import {
  DashboardTutorialAssetError,
  prepareDashboardTutorialThumbnailUpload,
  type DashboardTutorialPreparedThumbnailUpload,
} from "../../../../../lib/server/api/dashboardTutorialAssets";
import { getSupabaseAdmin } from "../../../../../lib/server/api/supabaseAdmin";

type PrepareThumbnailResponse = {
  target: DashboardTutorialPreparedThumbnailUpload;
};

type PrepareThumbnailErrorResponse = {
  error: string;
  details?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PrepareThumbnailResponse | PrepareThumbnailErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const body = (req.body ?? {}) as { sourceMimeType?: unknown; sourceSize?: unknown };
    const target = await prepareDashboardTutorialThumbnailUpload(getSupabaseAdmin(), {
      sourceMimeType: body.sourceMimeType,
      sourceSize: body.sourceSize,
    });
    return res.status(200).json({ target });
  } catch (error) {
    if (error instanceof DashboardTutorialAssetError) {
      return res.status(error.status).json({ error: error.message, details: error.details });
    }

    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/dashboard/tutorial-thumbnail/prepare",
      user: adminUser,
      metadata: {
        source: "api.admin.dashboard.tutorial_thumbnail.prepare",
      },
    });
    return res.status(500).json({ error: "Unable to prepare thumbnail upload." });
  }
}
