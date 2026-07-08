import { describe, expect, it } from "vitest";
import {
  AI_STUDIO_WORKFLOW_PLAN_REQUIRED_CODE,
  type AiStudioWorkflowPlanAccess,
} from "../../../../lib/billing/aiStudioWorkflowEntitlements";
import { resolveWorkflowPlanAccessCta } from "../AiStudioRouteApp";

describe("AiStudioRouteApp profile navigation", () => {
  it("preserves the AI Studio return path on workflow plan CTAs", () => {
    const access: AiStudioWorkflowPlanAccess = {
      allowed: false,
      workflow: "video",
      restriction: {
        code: AI_STUDIO_WORKFLOW_PLAN_REQUIRED_CODE,
        workflow: "video",
        planId: "starter",
        message: "Choose a higher plan to use Video and Sound workflows.",
        ctaHref: "/profile?section=subscription",
        ctaLabel: "View plans",
      },
    };

    expect(
      resolveWorkflowPlanAccessCta(access, {
        fromPath: "/ai-studio?projectId=project-1",
      })
    ).toEqual({
      label: "View plans",
      href: "/profile?section=subscription&from=%2Fai-studio%3FprojectId%3Dproject-1",
      ariaLabel: "View subscription plans",
    });
  });
});
