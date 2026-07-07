/**
 * Shared AI Studio workflow entitlement policy.
 * Keeps client navigation and server submit guards aligned for plan-gated workflow families.
 */

export type AiStudioWorkflowFamily = "video" | "audio";

export type AiStudioWorkflowPlanRestriction = {
  code: typeof AI_STUDIO_WORKFLOW_PLAN_REQUIRED_CODE;
  workflow: AiStudioWorkflowFamily;
  planId: string;
  message: string;
  ctaHref: string;
  ctaLabel: string;
};

export type AiStudioWorkflowPlanAccess = {
  allowed: boolean;
  workflow: AiStudioWorkflowFamily | null;
  restriction: AiStudioWorkflowPlanRestriction | null;
};

export const AI_STUDIO_WORKFLOW_PLAN_REQUIRED_CODE = "WORKFLOW_PLAN_REQUIRED";
export const AI_STUDIO_WORKFLOW_PLAN_REQUIRED_MESSAGE =
  "Choose a higher plan to use Video and Sound workflows.";
export const AI_STUDIO_WORKFLOW_PLAN_CTA_HREF = "/pricing";
export const AI_STUDIO_WORKFLOW_PLAN_CTA_LABEL = "View plans";

const RESTRICTED_WORKFLOW_GENERATION_PLAN_IDS = new Set(["free", "starter"]);
const RESTRICTED_WORKFLOW_NAVIGATION_PLAN_IDS = new Set(["starter"]);
const VIDEO_WORKFLOW_TOOL_IDS = new Set(["video", "kling"]);
const AUDIO_WORKFLOW_TOOL_IDS = new Set([
  "sound",
  "voices",
  "text-to-speech",
  "voice-changer",
  "sound-effects",
  "music",
  "voiceover",
]);

/**
 * Normalizes billing plan ids for workflow entitlement comparisons.
 */
export const normalizeAiStudioWorkflowPlanId = (planId: string | null | undefined): string => {
  const normalized = (planId ?? "").trim().toLowerCase();
  if (!normalized) return "free";
  if (normalized === "pro") return "studio";
  if (normalized === "creative" || normalized === "creative_suite") return "business";
  return normalized;
};

/**
 * Resolves the AI Studio workflow family represented by a tool/mode pair.
 */
export const resolveAiStudioWorkflowFamily = ({
  selectedTool,
  mode,
}: {
  selectedTool?: string | null;
  mode?: string | null;
}): AiStudioWorkflowFamily | null => {
  const normalizedTool = (selectedTool ?? "").trim().toLowerCase();
  const normalizedMode = (mode ?? "").trim().toLowerCase();
  if (normalizedMode === "video" || VIDEO_WORKFLOW_TOOL_IDS.has(normalizedTool)) return "video";
  if (normalizedMode === "audio" || AUDIO_WORKFLOW_TOOL_IDS.has(normalizedTool)) return "audio";
  return null;
};

/**
 * Returns true when a tool id belongs to a plan-gated AI Studio workflow.
 */
export const isAiStudioPlanGatedWorkflowTool = (tool: string | null | undefined): boolean =>
  resolveAiStudioWorkflowFamily({ selectedTool: tool }) != null;

/**
 * Resolves whether the supplied plan may generate from the requested AI Studio workflow.
 */
export const resolveAiStudioWorkflowPlanAccess = ({
  planId,
  selectedTool,
  mode,
}: {
  planId?: string | null;
  selectedTool?: string | null;
  mode?: string | null;
}): AiStudioWorkflowPlanAccess => {
  const normalizedPlanId = normalizeAiStudioWorkflowPlanId(planId);
  const workflow = resolveAiStudioWorkflowFamily({ selectedTool, mode });
  if (!workflow || !RESTRICTED_WORKFLOW_GENERATION_PLAN_IDS.has(normalizedPlanId)) {
    return { allowed: true, workflow, restriction: null };
  }

  return {
    allowed: false,
    workflow,
    restriction: {
      code: AI_STUDIO_WORKFLOW_PLAN_REQUIRED_CODE,
      workflow,
      planId: normalizedPlanId,
      message: AI_STUDIO_WORKFLOW_PLAN_REQUIRED_MESSAGE,
      ctaHref: AI_STUDIO_WORKFLOW_PLAN_CTA_HREF,
      ctaLabel: AI_STUDIO_WORKFLOW_PLAN_CTA_LABEL,
    },
  };
};

/**
 * Resolves whether the supplied plan may navigate into the requested AI Studio workflow.
 */
export const resolveAiStudioWorkflowNavigationAccess = ({
  planId,
  selectedTool,
  mode,
}: {
  planId?: string | null;
  selectedTool?: string | null;
  mode?: string | null;
}): AiStudioWorkflowPlanAccess => {
  const normalizedPlanId = normalizeAiStudioWorkflowPlanId(planId);
  const workflow = resolveAiStudioWorkflowFamily({ selectedTool, mode });
  if (!workflow || !RESTRICTED_WORKFLOW_NAVIGATION_PLAN_IDS.has(normalizedPlanId)) {
    return { allowed: true, workflow, restriction: null };
  }

  return {
    allowed: false,
    workflow,
    restriction: {
      code: AI_STUDIO_WORKFLOW_PLAN_REQUIRED_CODE,
      workflow,
      planId: normalizedPlanId,
      message: AI_STUDIO_WORKFLOW_PLAN_REQUIRED_MESSAGE,
      ctaHref: AI_STUDIO_WORKFLOW_PLAN_CTA_HREF,
      ctaLabel: AI_STUDIO_WORKFLOW_PLAN_CTA_LABEL,
    },
  };
};
