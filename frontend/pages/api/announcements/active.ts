/**
 * Authenticated announcement read route.
 * Returns the currently active global dashboard announcement or null.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import {
  readActiveDashboardAnnouncement,
  type DashboardAnnouncement,
} from "../../../lib/server/api/dashboardAnnouncements";

type ActiveAnnouncementResponse = {
  announcement: DashboardAnnouncement | null;
};

type ActiveAnnouncementErrorResponse = {
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ActiveAnnouncementResponse | ActiveAnnouncementErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "announcements/active.auth",
    });
    return res.status(500).json({ error: "Unable to load active announcement." });
  }
  if (!user) {
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
      routeLabel: "announcements/active",
      user,
      metadata: {
        source: "api.announcements.active",
      },
    });
    return res.status(500).json({ error: "Unable to load active announcement." });
  }
}
