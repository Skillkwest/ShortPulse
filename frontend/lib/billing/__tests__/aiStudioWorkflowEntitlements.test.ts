import { describe, expect, it } from "vitest";
import {
  AI_STUDIO_WORKFLOW_PLAN_REQUIRED_CODE,
  isAiStudioPlanGatedWorkflowTool,
  resolveAiStudioWorkflowFamily,
  resolveAiStudioWorkflowPlanAccess,
} from "../aiStudioWorkflowEntitlements";

describe("aiStudioWorkflowEntitlements", () => {
  it("blocks baseline and Starter plans from Video and Sound workflow families", () => {
    expect(
      resolveAiStudioWorkflowPlanAccess({
        planId: "starter",
        selectedTool: "video",
      }).restriction
    ).toMatchObject({
      code: AI_STUDIO_WORKFLOW_PLAN_REQUIRED_CODE,
      workflow: "video",
      planId: "starter",
      ctaHref: "/pricing",
      ctaLabel: "View plans",
    });

    expect(
      resolveAiStudioWorkflowPlanAccess({
        planId: "free",
        selectedTool: "music",
      }).restriction
    ).toMatchObject({
      workflow: "audio",
      planId: "free",
    });
  });

  it("allows higher paid plans and non-gated workflows", () => {
    expect(
      resolveAiStudioWorkflowPlanAccess({
        planId: "media",
        selectedTool: "video",
      }).allowed
    ).toBe(true);
    expect(
      resolveAiStudioWorkflowPlanAccess({
        planId: "starter",
        selectedTool: "create",
      }).allowed
    ).toBe(true);
    expect(
      resolveAiStudioWorkflowPlanAccess({
        planId: "starter",
        selectedTool: "edit",
      }).allowed
    ).toBe(true);
  });

  it("normalizes workflow family by tool id or submit mode", () => {
    expect(resolveAiStudioWorkflowFamily({ selectedTool: "text-to-speech" })).toBe("audio");
    expect(resolveAiStudioWorkflowFamily({ selectedTool: "kling" })).toBe("video");
    expect(resolveAiStudioWorkflowFamily({ selectedTool: "create", mode: "audio" })).toBe("audio");
    expect(isAiStudioPlanGatedWorkflowTool("sound-effects")).toBe(true);
    expect(isAiStudioPlanGatedWorkflowTool("media-library")).toBe(false);
  });
});
