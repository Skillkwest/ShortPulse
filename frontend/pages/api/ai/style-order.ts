import type { NextApiRequest, NextApiResponse } from "next";
import { normalizeStylesLibraryOrderedIds } from "../../../features/ai-studio/logic/stylesLibraryCatalog";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type StyleOrderResponse = {
  stylePanelIds: string[];
};

const readRequestStylePanelIds = (
  value: unknown
): { ok: true; stylePanelIds: string[] } | { ok: false; message: string } => {
  if (!Array.isArray(value)) {
    return { ok: false, message: "stylePanelIds must be an array." };
  }
  return { ok: true, stylePanelIds: normalizeStylesLibraryOrderedIds(value) };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StyleOrderResponse | { error: string }>
) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  if (req.method !== "GET" && req.method !== "PUT") {
    res.setHeader("Allow", "GET, PUT");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user: Awaited<ReturnType<typeof requireApiUser>>;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/ai/style-order.auth",
      scope: "app",
    });
    return res.status(500).json({ error: "Failed to verify style order access." });
  }
  if (!user) return;

  const supabaseAdmin = getSupabaseAdmin();

  if (req.method === "GET") {
    try {
      const { data, error } = await supabaseAdmin
        .from("user_preferences")
        .select("ai_studio_style_panel_ids")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return res.status(200).json({
        stylePanelIds: normalizeStylesLibraryOrderedIds(data?.ai_studio_style_panel_ids),
      });
    } catch (error) {
      await logApiRouteException({
        req,
        error,
        routeLabel: "api/ai/style-order.read",
        user,
      });
      return res.status(500).json({ error: "Failed to load style order." });
    }
  }

  const parsed = readRequestStylePanelIds(req.body?.stylePanelIds);
  if (!parsed.ok) {
    return res.status(400).json({ error: parsed.message });
  }

  try {
    const { error } = await supabaseAdmin.from("user_preferences").upsert(
      {
        user_id: user.id,
        ai_studio_style_panel_ids: parsed.stylePanelIds,
      },
      { onConflict: "user_id" }
    );
    if (error) throw error;
    return res.status(200).json({ stylePanelIds: parsed.stylePanelIds });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "api/ai/style-order.write",
      user,
    });
    return res.status(500).json({ error: "Failed to save style order." });
  }
}
