/**
 * Returns the active billing catalog for authenticated users.
 * Centralizes subscription plans and one-time credit packages behind one backend contract.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { loadBillingCatalogSnapshot } from "../../../lib/server/api/billingCatalog";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) {
    return;
  }

  try {
    const snapshot = await loadBillingCatalogSnapshot();
    return res.status(200).json(snapshot);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "billing/catalog",
      user,
    });
    return res.status(500).json({
      error: "Unable to load billing catalog.",
    });
  }
}
