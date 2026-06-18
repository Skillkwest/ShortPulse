/**
 * Admin API for moving one shared kanban board item between statuses.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../../lib/server/api/auth";
import {
  isAdminKanbanStatus,
  moveAdminKanbanItem,
  type AdminKanbanItem,
} from "../../../../../../lib/server/api/adminKanbanBoard";
import { getSupabaseAdmin } from "../../../../../../lib/server/api/supabaseAdmin";

type MoveKanbanItemResponse = {
  ok: true;
  item: AdminKanbanItem;
};

type MoveKanbanItemErrorResponse = {
  error: string;
};

type MoveKanbanItemBody = {
  status?: unknown;
};

const readItemId = (req: NextApiRequest): string | null => {
  const value = req.query.itemId;
  return typeof value === "string" && value ? value : null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MoveKanbanItemResponse | MoveKanbanItemErrorResponse>
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
      routeLabel: "admin/kanban/items/[itemId]/move.auth",
      scope: "app",
    });
    return res.status(500).json({ error: "Unable to move admin kanban item." });
  }
  if (!adminUser) return;

  const itemId = readItemId(req);
  if (!itemId) {
    return res.status(400).json({ error: "Item id is required." });
  }

  const body = (req.body ?? {}) as MoveKanbanItemBody;
  if (!isAdminKanbanStatus(body.status)) {
    return res.status(400).json({ error: "Valid status is required." });
  }

  try {
    const item = await moveAdminKanbanItem(getSupabaseAdmin(), {
      itemId,
      status: body.status,
      actorUserId: adminUser.id,
      actorEmail: adminUser.email ?? null,
    });
    if (!item) return res.status(404).json({ error: "Kanban item not found." });
    return res.status(200).json({ ok: true, item });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/kanban/items/[itemId]/move",
      user: adminUser,
      metadata: {
        source: "api.admin.kanban.item.move",
        item_id: itemId,
        status: body.status,
      },
    });
    return res.status(500).json({ error: "Unable to move admin kanban item." });
  }
}
