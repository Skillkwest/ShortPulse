/**
 * Admin API for reading the current active dashboard announcement.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import {
  readActiveDashboardAnnouncement,
  type DashboardAnnouncement,
} from "../../../../lib/server/api/dashboardAnnouncements";

type AdminCurrentAnnouncementResponse = {
  announcement: DashboardAnnouncement | null;
};

type AdminCurrentAnnouncementErrorResponse = {
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminCurrentAnnouncementResponse | AdminCurrentAnnouncementErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) {
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const announcement = await readActiveDashboardAnnouncement(supabaseAdmin);
    return res.status(200).json({ announcement });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/announcements/current",
      user: adminUser,
      metadata: {
        source: "api.admin.announcements.current",
      },
    });
    return res.status(500).json({ error: "Unable to load current announcement." });
  }
}
