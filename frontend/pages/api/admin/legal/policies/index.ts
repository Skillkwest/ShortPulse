/**
 * Admin legal policy collection API.
 * Lists the three managed legal documents and their active runtime metadata.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../lib/server/api/auth";
import { listLegalPoliciesForAdmin } from "../../../../../lib/server/api/legalPolicyControlPlane";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/legal/policies.auth",
    });
    return res.status(500).json({ error: "Unable to load legal policies." });
  }
  if (!adminUser) return;
  res.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    const policies = await listLegalPoliciesForAdmin();
    return res.status(200).json({ policies });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/legal/policies",
      user: adminUser,
    });
    return res.status(500).json({ error: "Unable to load legal policies." });
  }
}
