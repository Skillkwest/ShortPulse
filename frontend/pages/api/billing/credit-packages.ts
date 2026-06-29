/**
 * Returns active credit top-up packages for authenticated users.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import {
  CREDIT_TOP_UP_REQUIRES_SUBSCRIPTION_MESSAGE,
  resolveCreditTopUpEligibilityForUser,
} from "../../../lib/server/api/creditTopUpEligibility";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type PackageResponse = {
  id: string;
  display_name: string;
  credit_amount_cents: number;
  price_cents: number;
  sort_order: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/credit-packages.auth",
    });
    return res.status(500).json({
      error: "Unable to load credit packages.",
    });
  }
  if (!user) {
    return;
  }

  try {
    const eligibility = await resolveCreditTopUpEligibilityForUser(user.id);
    if (!eligibility.eligible) {
      return res.status(403).json({ error: CREDIT_TOP_UP_REQUIRES_SUBSCRIPTION_MESSAGE });
    }

    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("billing_credit_packages")
      .select("id, display_name, credit_amount_cents, price_cents, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      throw new Error(error.message || "Failed to load credit packages.");
    }

    return res.status(200).json({ packages: (data ?? []) as PackageResponse[] });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/credit-packages",
      user,
    });
    return res.status(500).json({
      error: "Unable to load credit packages.",
    });
  }
}
