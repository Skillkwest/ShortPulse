/**
 * Admin API for reading and saving dashboard offers.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import {
  normalizeDashboardOfferInput,
  readAdminDashboardOffers,
  saveDashboardOffer,
  type DashboardOffer,
} from "../../../../lib/server/api/dashboardOffers";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

type AdminOffersResponse = {
  offers: DashboardOffer[];
};

type AdminOfferSaveResponse = {
  offer: DashboardOffer;
  message: string;
};

type AdminOffersErrorResponse = {
  error: string;
};

const normalizeOfferId = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AdminOffersResponse | AdminOfferSaveResponse | AdminOffersErrorResponse>
) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/offers.auth",
      scope: "app",
    });
    return res.status(500).json({ error: "Unable to save dashboard offers." });
  }
  if (!adminUser) {
    return;
  }

  try {
    if (req.method === "GET") {
      const supabaseAdmin = getSupabaseAdmin();
      const offers = await readAdminDashboardOffers(supabaseAdmin);
      return res.status(200).json({ offers });
    }

    const validation = normalizeDashboardOfferInput(req.body);
    if (validation.error) {
      return res.status(400).json({ error: validation.error });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const offer = await saveDashboardOffer(supabaseAdmin, {
      id: normalizeOfferId((req.body as { id?: unknown } | null)?.id),
      offer: validation.offer,
      actorUserId: adminUser.id,
    });
    return res.status(200).json({
      offer,
      message: offer.isActive ? "Offer saved and active." : "Offer saved as inactive.",
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/offers",
      user: adminUser,
      metadata: {
        source: "api.admin.offers",
      },
    });
    return res.status(500).json({ error: "Unable to save dashboard offers." });
  }
}
