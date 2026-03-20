import { STUDIO_AGENT_INFRA_FALLBACK_MESSAGE } from "./studioAgentFailurePolicy";
import { buildAgentMachineOutcome } from "./agentMachineOutcome";
import type {
  SafetyCategoryId,
  SafetyModality,
  SafetyPolicyAction,
  SafetyProfileId,
} from "./safetyPolicy/types";

export type StudioAgentTelemetryStatus = "success" | "refuse" | "error";
export type StudioAgentTelemetryOutcomeClass =
  | "success_prompt"
  | "refusal_model"
  | "refusal_safety"
  | "fallback_infra"
  | "upstream_error"
  | "route_error";
export type StudioAgentSafetyTelemetryOutcome = "pass" | "rewritten" | "refusal";
export type StudioAgentSafetyTelemetrySource = "model_output" | "describe_output";
export type StudioAgentSafetyDecisionSource = "profile" | "hard_floor" | "absolute_zero";
export type StudioAgentSafetyStage = "input_precheck" | "output_postprocess";

export type StudioAgentSafetyTelemetryFields = {
  policyVersion?: number | null;
  profileId?: SafetyProfileId | null;
  modality?: SafetyModality | null;
  category?: SafetyCategoryId | null;
  decisionAction?: SafetyPolicyAction | null;
  decisionSource?: StudioAgentSafetyDecisionSource | null;
  providerBlocked?: boolean;
  hardFloorViolation?: boolean;
  rollbackTriggered?: boolean;
};

export const STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE = "I cannot describe this.";

export const emitStudioAgentTurnTelemetry = ({
  flow,
  path,
  status,
  model,
  outcomeClass,
  retryUsed,
  retryCount,
  totalLatencyMs,
  stageLatencyMs,
  fallbackReason,
  safetyOutcome,
  safetySource,
  safetyFallback,
  safetyDebugReason,
  safetyDebugEnabled,
  safetyTelemetry,
}: {
  flow: string;
  path: string;
  status: StudioAgentTelemetryStatus;
  model: string;
  outcomeClass: StudioAgentTelemetryOutcomeClass;
  retryUsed: boolean;
  retryCount?: number;
  totalLatencyMs: number;
  stageLatencyMs: Record<string, number>;
  fallbackReason?: string;
  safetyOutcome?: StudioAgentSafetyTelemetryOutcome;
  safetySource?: StudioAgentSafetyTelemetrySource;
  safetyFallback?: boolean;
  safetyDebugReason?: string;
  safetyDebugEnabled?: boolean;
  safetyTelemetry?: StudioAgentSafetyTelemetryFields;
}) => {
  console.info(
    "[studio-agent][telemetry]",
    JSON.stringify({
      flow,
      path,
      status,
      model,
      outcome_class: outcomeClass,
      retry_used: retryUsed,
      ...(typeof retryCount === "number" ? { retry_count: retryCount } : {}),
      latency_ms_total: totalLatencyMs,
      latency_ms_stage: stageLatencyMs,
      ...(fallbackReason ? { fallback_reason: fallbackReason } : {}),
      ...(safetyOutcome ? { safety_outcome: safetyOutcome } : {}),
      ...(safetySource ? { safety_source: safetySource } : {}),
      ...(typeof safetyFallback === "boolean" ? { safety_fallback: safetyFallback } : {}),
      policy_version: safetyTelemetry?.policyVersion ?? null,
      profile_id: safetyTelemetry?.profileId ?? null,
      modality: safetyTelemetry?.modality ?? null,
      category: safetyTelemetry?.category ?? null,
      decision_action: safetyTelemetry?.decisionAction ?? null,
      decision_source: safetyTelemetry?.decisionSource ?? null,
      provider_blocked: safetyTelemetry?.providerBlocked ?? false,
      hard_floor_violation: safetyTelemetry?.hardFloorViolation ?? false,
      rollback_triggered: safetyTelemetry?.rollbackTriggered ?? false,
      ...(safetyDebugEnabled && safetyDebugReason
        ? { safety_debug_reason: safetyDebugReason }
        : {}),
    })
  );
};

export const emitStudioAgentInputPrecheckTelemetry = ({
  flow,
  outcome,
  rewrittenFieldCount,
  providerCallSkipped,
  policyVersion,
  profileId,
  modality,
  category,
  decisionAction,
  decisionSource,
  hardFloorViolation,
}: {
  flow: string;
  outcome: "pass" | "rewritten" | "refusal";
  rewrittenFieldCount: number;
  providerCallSkipped: boolean;
  policyVersion: number | null;
  profileId: SafetyProfileId | null;
  modality: SafetyModality;
  category: SafetyCategoryId | null;
  decisionAction: SafetyPolicyAction | null;
  decisionSource: StudioAgentSafetyDecisionSource | null;
  hardFloorViolation: boolean;
}) => {
  console.info(
    "[studio-agent][safety-input-precheck]",
    JSON.stringify({
      flow,
      safety_stage: "input_precheck" satisfies StudioAgentSafetyStage,
      safety_outcome: outcome,
      rewritten_field_count: rewrittenFieldCount,
      provider_call_skipped: providerCallSkipped,
      policy_version: policyVersion,
      profile_id: profileId,
      modality,
      category,
      decision_action: decisionAction,
      decision_source: decisionSource,
      hard_floor_violation: hardFloorViolation,
    })
  );
};

export const resolvePolicyVersionFromProfileId = (
  profileId: string | null | undefined
): number | null => {
  if (typeof profileId !== "string") return null;
  const normalized = profileId.trim().toLowerCase();
  if (!normalized.length) return null;
  const match = normalized.match(/_v(\d+)$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

export const buildStudioAgentUpstreamErrorPayload = ({
  traceId,
  detail,
  stage,
  reasonCode = "UPSTREAM_ERROR",
}: {
  traceId: string;
  detail: string;
  stage?: string;
  reasonCode?: "UPSTREAM_ERROR";
}) => ({
  ...buildAgentMachineOutcome({
    outcomeClass: "upstream_error",
    reasonCode,
  }),
  error: stage ? `Upstream error (${stage})` : "Upstream error",
  detail,
  traceId,
});

export const buildStudioAgentRouteFailurePayload = ({
  traceId,
  detail,
  reasonCode = "ROUTE_ERROR",
}: {
  traceId: string;
  detail: string;
  reasonCode?: "ROUTE_ERROR" | "REQUEST_INVALID" | "AUTH_REQUIRED" | "CONFIG_MISSING";
}) => ({
  ...buildAgentMachineOutcome({
    outcomeClass: "route_error",
    reasonCode,
  }),
  error: "Agent call failed",
  detail,
  traceId,
});

export const buildStudioAgentInfraFallbackPayload = ({
  traceId,
  canonicalPrompt,
  reasonCode = "INFRA_FALLBACK_TRANSIENT",
}: {
  traceId: string;
  canonicalPrompt: string | null;
  reasonCode?: "INFRA_FALLBACK_TRANSIENT" | "INFRA_FALLBACK_TIMEOUT" | "INFRA_FALLBACK_RATE_LIMIT";
}) => ({
  ...buildAgentMachineOutcome({
    outcomeClass: "fallback_infra",
    reasonCode,
  }),
  message: STUDIO_AGENT_INFRA_FALLBACK_MESSAGE,
  actions: undefined,
  canonicalPrompt,
  traceId,
});

const SAFETY_STATUS_ALLOWLIST = new Set([400, 403, 422]);
const SAFETY_DETAIL_PATTERNS: RegExp[] = [
  /\bcontent[\s_-]*policy\b/i,
  /\bpolicy[\s_-]*violation\b/i,
  /\bsafety\b/i,
  /\bmoderation\b/i,
  /\bdisallowed\b/i,
  /\bunsafe\b/i,
  /\bviolence\b/i,
  /\bself[\s_-]*harm\b/i,
  /\bhate\b/i,
  /\bsexual\b/i,
];

export const isStudioAgentSafetyRefusalUpstreamError = ({
  status,
  detail,
}: {
  status: number;
  detail: string;
}): boolean => {
  if (!SAFETY_STATUS_ALLOWLIST.has(status)) return false;
  const normalized = detail.trim().toLowerCase();
  if (!normalized.length) return false;
  return SAFETY_DETAIL_PATTERNS.some((pattern) => pattern.test(normalized));
};

export const buildStudioAgentSafetyRefusalPayload = ({
  traceId,
  canonicalPrompt,
  reasonCode = "SAFETY_OUTPUT_REFUSAL",
}: {
  traceId: string;
  canonicalPrompt: string | null;
  reasonCode?: "SAFETY_INPUT_REFUSAL" | "SAFETY_OUTPUT_REFUSAL" | "PROVIDER_SAFETY_REFUSAL";
}) => ({
  ...buildAgentMachineOutcome({
    outcomeClass: "refusal_safety",
    reasonCode,
  }),
  message: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
  actions: undefined,
  canonicalPrompt,
  traceId,
});
