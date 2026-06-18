/**
 * Admin API for clearing any active dashboard announcement.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import { clearActiveDashboardAnnouncement } from "../../../../lib/server/api/dashboardAnnouncements";

type ClearAnnouncementResponse = {
  ok: true;
};

type ClearAnnouncementErrorResponse = {
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ClearAnnouncementResponse | ClearAnnouncementErrorResponse>
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
      routeLabel: "admin/announcements/clear.auth",
    });
    return res.status(500).json({ error: "Unable to clear announcement." });
  }
  if (!adminUser) {
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    await clearActiveDashboardAnnouncement(supabaseAdmin, adminUser.id);
    return res.status(200).json({ ok: true });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/announcements/clear",
      user: adminUser,
      metadata: {
        source: "api.admin.announcements.clear",
      },
    });
    return res.status(500).json({ error: "Unable to clear announcement." });
  }
}
