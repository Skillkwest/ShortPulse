/**
 * Returns active credit top-up packages for authenticated users.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../_utils/auth";
import { logApiRouteException } from "../_utils/appErrorLogs";
import { getSupabaseAdmin } from "../_utils/supabaseAdmin";

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

  const user = await requireApiUser(req, res);
  if (!user) {
    return;
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("billing_credit_packages")
      .select("id, display_name, credit_amount_cents, price_cents, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      return res.status(500).json({ error: error.message });
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
      error: error instanceof Error ? error.message : "Unable to load credit packages.",
    });
  }
}
