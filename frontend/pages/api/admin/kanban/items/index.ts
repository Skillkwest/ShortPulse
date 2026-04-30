/**
 * Admin API for listing and creating shared kanban board items.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../lib/server/api/auth";
import {
  createAdminKanbanItem,
  listAdminKanbanItems,
  normalizeAdminKanbanItemInput,
  type AdminKanbanItem,
} from "../../../../../lib/server/api/adminKanbanBoard";
import { getSupabaseAdmin } from "../../../../../lib/server/api/supabaseAdmin";

type KanbanItemsResponse = {
  items: AdminKanbanItem[];
};

type CreateKanbanItemResponse = {
  ok: true;
  item: AdminKanbanItem;
};

type KanbanItemsErrorResponse = {
  error: string;
};

type CreateKanbanItemBody = {
  title?: unknown;
  details?: unknown;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<KanbanItemsResponse | CreateKanbanItemResponse | KanbanItemsErrorResponse>
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  try {
    if (req.method === "GET") {
      const supabaseAdmin = getSupabaseAdmin();
      const items = await listAdminKanbanItems(supabaseAdmin);
      return res.status(200).json({ items });
    }

    const body = (req.body ?? {}) as CreateKanbanItemBody;
    const normalized = normalizeAdminKanbanItemInput(body.title, body.details);
    if (normalized.error) {
      return res.status(400).json({ error: normalized.error });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const item = await createAdminKanbanItem(supabaseAdmin, {
      title: normalized.title,
      details: normalized.details,
      actorUserId: adminUser.id,
      actorEmail: adminUser.email ?? null,
    });
    return res.status(201).json({ ok: true, item });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/kanban/items",
      user: adminUser,
      metadata: {
        source: "api.admin.kanban.items",
        method: req.method,
      },
    });
    return res.status(500).json({ error: "Unable to update admin kanban board." });
  }
}
