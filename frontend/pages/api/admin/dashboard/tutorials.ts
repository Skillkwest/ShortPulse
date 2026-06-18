/**
 * Admin API for reading and managing signed-in dashboard tutorial cards.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import {
  deleteDashboardTutorial,
  normalizeDashboardTutorialInput,
  readAdminDashboardTutorials,
  reorderDashboardTutorials,
  saveDashboardTutorial,
  type DashboardTutorial,
} from "../../../../lib/server/api/dashboardTutorials";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

type AdminDashboardTutorialsResponse = {
  tutorials: DashboardTutorial[];
};

type AdminDashboardTutorialSaveResponse = {
  tutorial: DashboardTutorial;
  message: string;
};

type AdminDashboardTutorialDeleteResponse = {
  ok: true;
  message: string;
};

type AdminDashboardTutorialsErrorResponse = {
  error: string;
};

const normalizeTutorialId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const normalizeReorderIds = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  const ids = value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
  if (ids.length !== value.length) return null;
  return new Set(ids).size === ids.length ? ids : null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<
    | AdminDashboardTutorialsResponse
    | AdminDashboardTutorialSaveResponse
    | AdminDashboardTutorialDeleteResponse
    | AdminDashboardTutorialsErrorResponse
  >
) {
  if (!["GET", "POST", "PATCH", "DELETE"].includes(req.method ?? "")) {
    res.setHeader("Allow", "GET, POST, PATCH, DELETE");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/dashboard/tutorials.auth",
      scope: "app",
    });
    return res.status(500).json({ error: "Unable to manage dashboard tutorials." });
  }
  if (!adminUser) {
    return;
  }

  try {
    if (req.method === "GET") {
      const supabaseAdmin = getSupabaseAdmin();
      const tutorials = await readAdminDashboardTutorials(supabaseAdmin);
      return res.status(200).json({ tutorials });
    }

    if (req.method === "PATCH") {
      const ids = normalizeReorderIds((req.body as { ids?: unknown } | null)?.ids);
      if (!ids) {
        return res.status(400).json({ error: "Unique tutorial ids are required." });
      }
      const supabaseAdmin = getSupabaseAdmin();
      const tutorials = await reorderDashboardTutorials(supabaseAdmin, {
        ids,
        actorUserId: adminUser.id,
      });
      return res.status(200).json({ tutorials });
    }

    if (req.method === "DELETE") {
      const id = normalizeTutorialId(
        (req.query.id as string | undefined) ?? (req.body as { id?: unknown } | null)?.id
      );
      if (!id) {
        return res.status(400).json({ error: "Tutorial id is required." });
      }
      const supabaseAdmin = getSupabaseAdmin();
      await deleteDashboardTutorial(supabaseAdmin, id);
      return res.status(200).json({ ok: true, message: "Tutorial deleted." });
    }

    const validation = normalizeDashboardTutorialInput(req.body);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const tutorial = await saveDashboardTutorial(supabaseAdmin, {
      id: normalizeTutorialId((req.body as { id?: unknown } | null)?.id),
      tutorial: validation.tutorial,
      actorUserId: adminUser.id,
    });
    return res.status(200).json({
      tutorial,
      message: tutorial.isActive ? "Tutorial saved and active." : "Tutorial saved as inactive.",
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/dashboard/tutorials",
      user: adminUser,
      metadata: {
        source: "api.admin.dashboard.tutorials",
        method: req.method,
      },
    });
    return res.status(500).json({ error: "Unable to manage dashboard tutorials." });
  }
}
