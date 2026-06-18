/**
 * Admin API for reading and editing one shared kanban board item.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../../lib/server/api/auth";
import {
  normalizeAdminKanbanItemInput,
  readAdminKanbanItem,
  updateAdminKanbanItem,
  type AdminKanbanItem,
} from "../../../../../../lib/server/api/adminKanbanBoard";
import { getSupabaseAdmin } from "../../../../../../lib/server/api/supabaseAdmin";

type KanbanItemResponse = {
  item: AdminKanbanItem;
};

type KanbanItemUpdateResponse = {
  ok: true;
  item: AdminKanbanItem;
};

type KanbanItemErrorResponse = {
  error: string;
};

type KanbanItemUpdateBody = {
  title?: unknown;
  details?: unknown;
};

const readItemId = (req: NextApiRequest): string | null => {
  const value = req.query.itemId;
  return typeof value === "string" && value ? value : null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<KanbanItemResponse | KanbanItemUpdateResponse | KanbanItemErrorResponse>
) {
  if (req.method !== "GET" && req.method !== "PATCH") {
    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/kanban/items/[itemId].auth",
      scope: "app",
    });
    return res.status(500).json({ error: "Unable to update admin kanban item." });
  }
  if (!adminUser) return;

  const itemId = readItemId(req);
  if (!itemId) {
    return res.status(400).json({ error: "Item id is required." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    if (req.method === "GET") {
      const item = await readAdminKanbanItem(supabaseAdmin, itemId);
      if (!item) return res.status(404).json({ error: "Kanban item not found." });
      return res.status(200).json({ item });
    }

    const body = (req.body ?? {}) as KanbanItemUpdateBody;
    const normalized = normalizeAdminKanbanItemInput(body.title, body.details);
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const item = await updateAdminKanbanItem(supabaseAdmin, {
      itemId,
      title: normalized.title,
      details: normalized.details,
      actorUserId: adminUser.id,
      actorEmail: adminUser.email ?? null,
    });
    if (!item) return res.status(404).json({ error: "Kanban item not found." });
    return res.status(200).json({ ok: true, item });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/kanban/items/[itemId]",
      user: adminUser,
      metadata: {
        source: "api.admin.kanban.item",
        method: req.method,
        item_id: itemId,
      },
    });
    return res.status(500).json({ error: "Unable to update admin kanban item." });
  }
}
