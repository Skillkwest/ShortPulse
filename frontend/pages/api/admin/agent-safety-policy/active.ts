/**
 * Admin API: returns active AI Studio agent safety control-plane snapshot.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import {
  fetchActiveAgentSafetyPolicy,
  type ActiveAgentSafetyPolicy,
} from "../../../../lib/server/api/agentSafetyPolicyControlPlane";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

type ActivePolicyResponse =
  | {
      ok: true;
      policy: ActiveAgentSafetyPolicy;
    }
  | {
      ok: true;
      policy: null;
      message: string;
    };

type ActivePolicyErrorResponse = { error: string };

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ActivePolicyResponse | ActivePolicyErrorResponse>
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/agent-safety-policy/active.auth",
    });
    return res.status(500).json({
      error: "Unable to read active safety policy.",
    });
  }
  if (!adminUser) return;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const policy = await fetchActiveAgentSafetyPolicy({ supabaseAdmin });
    if (!policy) {
      return res.status(200).json({
        ok: true,
        policy: null,
        message: "Agent safety control plane is not initialized.",
      });
    }

    return res.status(200).json({
      ok: true,
      policy,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/agent-safety-policy/active",
      user: adminUser,
    });
    return res.status(500).json({
      error: "Unable to read active safety policy.",
    });
  }
}
