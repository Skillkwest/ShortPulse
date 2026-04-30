/**
 * Admin API for reading one kanban board item's activity timeline.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../../lib/server/api/auth";
import {
  listAdminKanbanActivity,
  readAdminKanbanItem,
  type AdminKanbanActivity,
} from "../../../../../../lib/server/api/adminKanbanBoard";
import { getSupabaseAdmin } from "../../../../../../lib/server/api/supabaseAdmin";

type KanbanActivityResponse = {
  activity: AdminKanbanActivity[];
};

type KanbanActivityErrorResponse = {
  error: string;
};

const readItemId = (req: NextApiRequest): string | null => {
  const value = req.query.itemId;
  return typeof value === "string" && value ? value : null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<KanbanActivityResponse | KanbanActivityErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const itemId = readItemId(req);
  if (!itemId) {
    return res.status(400).json({ error: "Item id is required." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const item = await readAdminKanbanItem(supabaseAdmin, itemId);
    if (!item) return res.status(404).json({ error: "Kanban item not found." });

    const activity = await listAdminKanbanActivity(supabaseAdmin, itemId);
    return res.status(200).json({ activity });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/kanban/items/[itemId]/activity",
      user: adminUser,
      metadata: {
        source: "api.admin.kanban.item.activity",
        item_id: itemId,
      },
    });
    return res.status(500).json({ error: "Unable to load admin kanban item activity." });
  }
}
