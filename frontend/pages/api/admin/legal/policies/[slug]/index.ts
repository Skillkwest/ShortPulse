/**
 * Admin legal policy item API.
 * Returns one managed legal document with recent version history.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { isLegalPolicySlug } from "../../../../../../features/legal/data/legalPolicies";
import { logApiRouteException } from "../../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../../lib/server/api/auth";
import { resolveLegalPolicyForAdmin } from "../../../../../../lib/server/api/legalPolicyControlPlane";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const slug = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;
  if (!isLegalPolicySlug(slug)) {
    return res.status(400).json({ error: "Invalid legal policy slug." });
  }

  let adminUser;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/legal/policies/[slug].auth",
    });
    return res.status(500).json({ error: "Unable to load legal policy." });
  }
  if (!adminUser) return;
  res.setHeader("Cache-Control", "no-store, max-age=0");

  try {
    const policy = await resolveLegalPolicyForAdmin({ slug });
    return res.status(200).json({ policy });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/legal/policies/[slug]",
      user: adminUser,
    });
    return res.status(500).json({ error: "Unable to load legal policy." });
  }
}
