/**
 * Admin API for publishing a new active dashboard announcement.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import {
  normalizeDashboardAnnouncementInput,
  publishDashboardAnnouncement,
  type DashboardAnnouncement,
} from "../../../../lib/server/api/dashboardAnnouncements";

type PublishAnnouncementBody = {
  title?: unknown;
  message?: unknown;
};

type PublishAnnouncementResponse = {
  ok: true;
  announcement: DashboardAnnouncement;
};

type PublishAnnouncementErrorResponse = {
  error: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PublishAnnouncementResponse | PublishAnnouncementErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) {
    return;
  }

  const { title, message } = (req.body ?? {}) as PublishAnnouncementBody;
  const normalized = normalizeDashboardAnnouncementInput(title, message);
  if (normalized.error) {
    return res.status(400).json({ error: normalized.error });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const announcement = await publishDashboardAnnouncement(supabaseAdmin, {
      title: normalized.title,
      message: normalized.message,
      actorUserId: adminUser.id,
    });
    return res.status(200).json({
      ok: true,
      announcement,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/announcements/publish",
      user: adminUser,
      metadata: {
        source: "api.admin.announcements.publish",
        title_length: normalized.title.length,
        message_length: normalized.message.length,
      },
    });
    return res.status(500).json({ error: "Unable to publish announcement." });
  }
}
