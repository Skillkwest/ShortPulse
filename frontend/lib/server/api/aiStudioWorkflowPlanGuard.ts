/**
 * Server-side AI Studio workflow entitlement guard.
 * Resolves the caller's active billing plan and blocks plan-gated workflow submits before provider dispatch.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import {
  AI_STUDIO_WORKFLOW_PLAN_REQUIRED_CODE,
  resolveAiStudioWorkflowPlanAccess,
  type AiStudioWorkflowFamily,
} from "../../billing/aiStudioWorkflowEntitlements";
import { logGenerationFailure } from "./appErrorLogs";
import { resolveBillingConcurrencyEntitlement } from "./billingConcurrencyEntitlements";
import type { AuthenticatedApiUser } from "./auth";

export type AiStudioWorkflowPlanGuardResult =
  | { allowed: true; planId: string }
  | { allowed: false; planId: string | null };

/**
 * Rejects restricted workflow access for plans that cannot use Video or Sound generation.
 */
export const requireAiStudioWorkflowPlanAccess = async ({
  req,
  res,
  user,
  workflow,
  routeLabel,
}: {
  req: NextApiRequest;
  res: NextApiResponse;
  user: AuthenticatedApiUser;
  workflow: AiStudioWorkflowFamily;
  routeLabel: string;
}): Promise<AiStudioWorkflowPlanGuardResult> => {
  const entitlement = await resolveBillingConcurrencyEntitlement(user.id).catch(async (error) => {
    await logGenerationFailure({
      req,
      routeLabel,
      source: "api.ai_studio_workflow_plan_entitlement_unavailable",
      message:
        error instanceof Error
          ? error.message
          : "AI Studio workflow plan entitlement is unavailable.",
      statusCode: 503,
      userId: user.id,
      userEmail: user.email ?? null,
      metadata: { workflow },
    });
    return null;
  });

  if (!entitlement) {
    res.status(503).json({
      error: "Workflow access is temporarily unavailable. Please retry shortly.",
      code: "WORKFLOW_PLAN_ACCESS_UNAVAILABLE",
    });
    return { allowed: false, planId: null };
  }

  const access = resolveAiStudioWorkflowPlanAccess({
    planId: entitlement.planId,
    mode: workflow,
  });
  if (access.allowed || !access.restriction) {
    return { allowed: true, planId: entitlement.planId };
  }

  await logGenerationFailure({
    req,
    routeLabel,
    source: "api.ai_studio_workflow_plan_denied",
    message: access.restriction.message,
    statusCode: 402,
    userId: user.id,
    userEmail: user.email ?? null,
    metadata: {
      workflow,
      plan_id: entitlement.planId,
      entitlement_source: entitlement.source,
      max_concurrent_generations: entitlement.maxConcurrentGenerations,
    },
  });

  res.status(402).json({
    error: access.restriction.message,
    code: AI_STUDIO_WORKFLOW_PLAN_REQUIRED_CODE,
    workflow,
    planId: entitlement.planId,
    ctaHref: access.restriction.ctaHref,
    ctaLabel: access.restriction.ctaLabel,
  });
  return { allowed: false, planId: entitlement.planId };
};
