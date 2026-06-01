import type { NextApiRequest, NextApiResponse } from "next";
import { getModelPricingPolicySnapshot } from "../../../lib/model-runtime/pricingPolicy";
import { materializeImageBilledCreditPolicy } from "../../../lib/model-runtime/materializeImageBilledCreditPolicy";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireApiUser } from "../../../lib/server/api/auth";
import { resolveRuntimeModelPricingPolicy } from "../../../lib/server/api/modelPricingControlPlane";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) return;

  try {
    const resolution = await resolveRuntimeModelPricingPolicy({ bypassCache: true });
    const runtimePolicy = materializeImageBilledCreditPolicy(resolution.policy);
    const snapshot = getModelPricingPolicySnapshot(resolution.policy, {
      activePolicyVersion: resolution.activePolicyVersion,
      policySource: resolution.source,
      updatedAt: resolution.updatedAt,
      updatedByEmail: resolution.updatedByEmail,
    });
    res.setHeader("Cache-Control", "no-store, max-age=0");
    return res.status(200).json({
      modelPolicy: {
        ...snapshot,
        document: runtimePolicy,
      },
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "pricing/model-policy",
      user,
      metadata: {
        source: "api.pricing.model-policy",
      },
    });
    return res.status(500).json({ error: "Unable to load model pricing policy." });
  }
}
