/**
 * Admin API: create a new AI Studio safety policy version for a profile.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import {
  createAgentSafetyPolicyVersion,
  normalizeRequestedSafetyProfileId,
  type AgentSafetyPolicyMutationResult,
} from "../../../../lib/server/api/agentSafetyPolicyControlPlane";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import { validateSafetyPolicyDocument } from "../../../../features/agent-runtime/safetyPolicy/policyDocument";

type CreatePolicyVersionRequest = {
  profileId?: string;
  policy?: unknown;
  note?: string;
  reason?: string;
  singleReviewerAck?: boolean;
};

type CreatePolicyVersionResponse = {
  ok: boolean;
  result: AgentSafetyPolicyMutationResult;
};

type CreatePolicyVersionErrorResponse = { error: string; detail?: unknown };

const normalizeNullableText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized.length) return null;
  return normalized.slice(0, maxLength);
};

const statusToHttpCode = (status: AgentSafetyPolicyMutationResult["status"]): number => {
  if (status === "profile_not_found") return 404;
  if (status === "rejected") return 400;
  return 200;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CreatePolicyVersionResponse | CreatePolicyVersionErrorResponse>
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const body = (req.body ?? {}) as CreatePolicyVersionRequest;
  const profileId = normalizeRequestedSafetyProfileId(body.profileId);
  if (!profileId) {
    return res.status(400).json({
      error: "profileId must be one of prod_safe_v1, staging_lenient, dev_absolute_zero.",
    });
  }
  if (process.env.NODE_ENV === "production" && profileId === "dev_absolute_zero") {
    return res.status(400).json({
      error: "dev_absolute_zero cannot be used in production.",
    });
  }
  const policyValidation = validateSafetyPolicyDocument(body.policy);
  if (!policyValidation.ok) {
    return res.status(400).json({
      error: "Invalid policy payload.",
      detail: policyValidation.errors,
    });
  }
  const reason = normalizeNullableText(body.reason, 400);
  const note = normalizeNullableText(body.note, 400);
  const singleReviewerAck = body.singleReviewerAck === true;

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const result = await createAgentSafetyPolicyVersion({
      supabaseAdmin,
      profileId,
      policy: policyValidation.policy,
      note,
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
      routeLabel: "admin/agent-safety-policy/version",
      user: adminUser,
      metadata: { requested_profile_id: profileId },
    });
    return res.status(500).json({
      error: "Unable to create safety policy version.",
    });
  }
}
