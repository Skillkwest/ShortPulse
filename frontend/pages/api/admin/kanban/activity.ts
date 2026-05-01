/**
 * Admin API for reading the shared Ophestivus board action log.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import {
  listAdminKanbanActionLog,
  type AdminKanbanActionLogEntry,
} from "../../../../lib/server/api/adminKanbanBoard";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

type KanbanActionLogResponse = {
  activity: AdminKanbanActionLogEntry[];
};

type KanbanActionLogErrorResponse = {
  error: string;
};

const readLimit = (req: NextApiRequest): number => {
  const value = req.query.limit;
  const rawLimit = Array.isArray(value) ? value[0] : value;
  if (typeof rawLimit !== "string" || rawLimit.trim() === "") return 100;
  const parsed = Number(rawLimit);
  return Number.isFinite(parsed) ? parsed : 100;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<KanbanActionLogResponse | KanbanActionLogErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const activity = await listAdminKanbanActionLog(supabaseAdmin, readLimit(req));
    return res.status(200).json({ activity });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/kanban/activity",
      user: adminUser,
      metadata: {
        source: "api.admin.kanban.activity",
      },
    });
    return res.status(500).json({ error: "Unable to load Ophestivus action log." });
  }
}
