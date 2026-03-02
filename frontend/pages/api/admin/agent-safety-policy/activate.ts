/**
 * Admin API: activate a target AI Studio agent safety profile.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import {
  activateAgentSafetyPolicy,
  normalizeRequestedSafetyProfileId,
  type AgentSafetyPolicyMutationResult,
} from "../../../../lib/server/api/agentSafetyPolicyControlPlane";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

type ActivatePolicyRequest = {
  profileId?: string;
  reason?: string;
  singleReviewerAck?: boolean;
};

type ActivatePolicyResponse = {
  ok: boolean;
  result: AgentSafetyPolicyMutationResult;
};

type ActivatePolicyErrorResponse = { error: string };

const normalizeReason = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized.length) return null;
  return normalized.slice(0, 400);
};

const statusToHttpCode = (status: AgentSafetyPolicyMutationResult["status"]): number => {
  if (status === "cooldown_blocked") return 409;
  if (status === "profile_not_found") return 404;
  if (status === "rejected") return 400;
  if (status === "not_initialized") return 503;
  return 200;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ActivatePolicyResponse | ActivatePolicyErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const body = (req.body ?? {}) as ActivatePolicyRequest;
  const profileId = normalizeRequestedSafetyProfileId(body.profileId);
  if (!profileId) {
    return res.status(400).json({
      error: "profileId must be one of prod_safe_v1, staging_lenient, dev_absolute_zero.",
    });
  }
  if (process.env.NODE_ENV === "production" && profileId === "dev_absolute_zero") {
    return res.status(400).json({
      error: "dev_absolute_zero cannot be activated in production.",
    });
  }

  const singleReviewerAck = body.singleReviewerAck === true;
  const reason = normalizeReason(body.reason);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const result = await activateAgentSafetyPolicy({
      supabaseAdmin,
      profileId,
      reason,
      actorUserId: adminUser.id,
      actorEmail: adminUser.email ?? null,
      singleReviewerAck,
      source: "admin_api",
    });

    const statusCode = statusToHttpCode(result.status);
    return res.status(statusCode).json({
      ok: statusCode < 400,
      result,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/agent-safety-policy/activate",
      user: adminUser,
      metadata: {
        requested_profile_id: profileId,
      },
    });
    return res.status(500).json({
      error: "Unable to activate safety policy.",
    });
  }
}
