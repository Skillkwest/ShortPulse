/**
 * Returns the active billing catalog for authenticated users.
 * Centralizes subscription plans and one-time credit packages behind one backend contract.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type BillingPlanResponse = {
  id: string;
  display_name: string;
  monthly_price_cents: number;
  monthly_credits_cents: number;
  storage_limit_bytes: number;
  is_active: boolean;
};

type CreditPackageResponse = {
  id: string;
  display_name: string;
  credit_amount_cents: number;
  price_cents: number;
  sort_order: number;
};

type StorageAddonResponse = {
  id: string;
  display_name: string;
  storage_limit_bytes: number;
  monthly_price_cents: number;
  sort_order: number;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) {
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const [plansResult, packagesResult, storageAddonsResult] = await Promise.all([
      supabaseAdmin
        .from("billing_plans")
        .select(
          "id, display_name, monthly_price_cents, monthly_credits_cents, storage_limit_bytes, is_active"
        )
        .eq("is_active", true)
        .order("monthly_price_cents", { ascending: true }),
      supabaseAdmin
        .from("billing_credit_packages")
        .select("id, display_name, credit_amount_cents, price_cents, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
      supabaseAdmin
        .from("billing_storage_addons")
        .select("id, display_name, storage_limit_bytes, monthly_price_cents, sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true }),
    ]);

    if (plansResult.error || packagesResult.error || storageAddonsResult.error) {
      const detail = [
        plansResult.error?.message,
        packagesResult.error?.message,
        storageAddonsResult.error?.message,
      ]
        .filter(Boolean)
        .join(" | ");
      return res.status(500).json({ error: detail || "Unable to load billing catalog." });
    }

    return res.status(200).json({
      plans: (plansResult.data ?? []) as BillingPlanResponse[],
      packages: (packagesResult.data ?? []) as CreditPackageResponse[],
      storageAddons: (storageAddonsResult.data ?? []) as StorageAddonResponse[],
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/catalog",
      user,
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load billing catalog.",
    });
  }
}
