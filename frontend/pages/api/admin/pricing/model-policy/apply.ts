import type { NextApiRequest, NextApiResponse } from "next";
import {
  adminPricingCustomRowsDocumentsEqual,
  compactAdminPricingCustomRowsDocument,
  type AdminPricingCustomRowsDocument,
} from "../../../../../lib/model-runtime/adminPricingCustomRows";
import {
  compactModelPricingPolicyDocument,
  modelPricingPolicyDocumentsEqual,
  type ModelPricingPolicyDocument,
} from "../../../../../lib/model-runtime/pricingPolicy";
import { logApiRouteException } from "../../../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../../../lib/server/api/auth";
import { applyModelPricingPolicy } from "../../../../../lib/server/api/modelPricingControlPlane";

type ApplyModelPricingPolicyRequest = {
  policy?: ModelPricingPolicyDocument;
  customRows?: AdminPricingCustomRowsDocument;
  note?: string;
  reason?: string;
};

const normalizeText = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
};

const statusToHttpCode = (status: string): number => {
  if (status === "rejected") return 400;
  if (status === "not_initialized") return 503;
  return 200;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const body = (req.body ?? {}) as ApplyModelPricingPolicyRequest;
  const policy = compactModelPricingPolicyDocument(body.policy);
  const customRows = compactAdminPricingCustomRowsDocument(body.customRows);
  const note = normalizeText(body.note, 400);
  const reason = normalizeText(body.reason, 400);

  try {
    const result = await applyModelPricingPolicy({
      policy,
      customRows,
      note,
      reason,
      actorUserId: adminUser.id,
      actorEmail: adminUser.email ?? null,
    });
    const statusCode = statusToHttpCode(result.status);
    if (statusCode >= 400) {
      return res.status(statusCode).json({ ok: false, ...result });
    }
    if (!modelPricingPolicyDocumentsEqual(policy, result.activePolicy)) {
      const message = "Applied policy could not be verified against the active runtime policy.";
      return res.status(409).json({
        ok: false,
        error: message,
        status: "verification_failed",
        activePolicyVersion: result.activePolicyVersion,
        activePolicyVersionId: result.activePolicyVersionId,
        activePolicy: result.activePolicy,
        activePolicyUpdatedAt: result.activePolicyUpdatedAt,
        activePolicyUpdatedByEmail: result.activePolicyUpdatedByEmail,
        message,
      });
    }
    if (!adminPricingCustomRowsDocumentsEqual(customRows, result.activeCustomRows)) {
      const message =
        "Applied custom pricing rows could not be verified against the active runtime state.";
      return res.status(409).json({
        ok: false,
        error: message,
        status: "verification_failed",
        activePolicyVersion: result.activePolicyVersion,
        activePolicyVersionId: result.activePolicyVersionId,
        activePolicy: result.activePolicy,
        activeCustomRows: result.activeCustomRows,
        activePolicyUpdatedAt: result.activePolicyUpdatedAt,
        activePolicyUpdatedByEmail: result.activePolicyUpdatedByEmail,
        message,
      });
    }
    return res.status(statusCode).json({ ok: statusCode < 400, ...result });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/pricing/model-policy/apply",
      user: adminUser,
      metadata: {
        source: "api.admin.pricing.model-policy.apply",
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to apply model pricing policy.",
    });
  }
}
