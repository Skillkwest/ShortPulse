/**
 * Admin API: rollback AI Studio agent safety policy to last-known-safe profile/version.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import {
  resolveAgentSafetyRollbackCooldownHours,
  rollbackAgentSafetyPolicy,
  type AgentSafetyPolicyMutationResult,
} from "../../../../lib/server/api/agentSafetyPolicyControlPlane";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

type RollbackPolicyRequest = {
  reason?: string;
  source?: string;
};

type RollbackPolicyResponse = {
  ok: boolean;
  result: AgentSafetyPolicyMutationResult;
};

type RollbackPolicyErrorResponse = { error: string };

const normalizeReason = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized.length) return null;
  return normalized.slice(0, 400);
};

const normalizeSource = (value: unknown): string => {
  if (typeof value !== "string") return "manual";
  const normalized = value.trim().toLowerCase();
  if (!normalized.length) return "manual";
  return normalized.slice(0, 64);
};

const statusToHttpCode = (status: AgentSafetyPolicyMutationResult["status"]): number => {
  if (status === "no_safe_target") return 409;
  if (status === "not_initialized") return 503;
  return 200;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RollbackPolicyResponse | RollbackPolicyErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/agent-safety-policy/rollback.auth",
    });
    return res.status(500).json({
      error: "Unable to rollback safety policy.",
    });
  }
  if (!adminUser) return;

  const body = (req.body ?? {}) as RollbackPolicyRequest;
  const reason = normalizeReason(body.reason);
  const source = normalizeSource(body.source);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const result = await rollbackAgentSafetyPolicy({
      supabaseAdmin,
      reason,
      actorUserId: adminUser.id,
      actorEmail: adminUser.email ?? null,
      source,
      cooldownHours: resolveAgentSafetyRollbackCooldownHours(
        process.env.STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS
      ),
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
      routeLabel: "admin/agent-safety-policy/rollback",
      user: adminUser,
      metadata: {
        rollback_source: source,
      },
    });
    return res.status(500).json({
      error: "Unable to rollback safety policy.",
    });
  }
}
