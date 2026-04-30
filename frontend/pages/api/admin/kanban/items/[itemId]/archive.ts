/**
 * Admin API for archiving one shared kanban board item.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../../lib/server/api/auth";
import { archiveAdminKanbanItem } from "../../../../../../lib/server/api/adminKanbanBoard";
import { getSupabaseAdmin } from "../../../../../../lib/server/api/supabaseAdmin";

type ArchiveKanbanItemResponse = {
  ok: true;
};

type ArchiveKanbanItemErrorResponse = {
  error: string;
};

const readItemId = (req: NextApiRequest): string | null => {
  const value = req.query.itemId;
  return typeof value === "string" && value ? value : null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ArchiveKanbanItemResponse | ArchiveKanbanItemErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const itemId = readItemId(req);
  if (!itemId) {
    return res.status(400).json({ error: "Item id is required." });
  }

  try {
    const archived = await archiveAdminKanbanItem(getSupabaseAdmin(), {
      itemId,
      actorUserId: adminUser.id,
      actorEmail: adminUser.email ?? null,
    });
    if (!archived) return res.status(404).json({ error: "Kanban item not found." });
    return res.status(200).json({ ok: true });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/kanban/items/[itemId]/archive",
      user: adminUser,
      metadata: {
        source: "api.admin.kanban.item.archive",
        item_id: itemId,
      },
    });
    return res.status(500).json({ error: "Unable to archive admin kanban item." });
  }
}
