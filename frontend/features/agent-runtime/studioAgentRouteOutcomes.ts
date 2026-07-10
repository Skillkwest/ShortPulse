import { buildAgentMachineOutcome } from "./agentMachineOutcome";
import type { AgentReasonCode } from "../../prefabs/agent/outcomeContract";
import type { StudioAgentSafetyInputPrecheckField } from "./studioAgentSafetyInputPrecheck";
import type {
  SafetyCategoryId,
  SafetyModality,
  SafetyPolicyAction,
  SafetyProfileId,
} from "./safetyPolicy/types";

export type StudioAgentTelemetryStatus = "success" | "refuse" | "error";
export type StudioAgentTelemetryOutcomeClass =
  | "success_prompt"
  | "success_message"
  | "refusal_model"
  | "refusal_safety"
  | "upstream_error"
  | "route_error";
export type StudioAgentSafetyTelemetryOutcome = "pass" | "rewritten" | "refusal";
export type StudioAgentSafetyTelemetrySource = "model_output";
export type StudioAgentSafetyDecisionSource = "profile" | "hard_floor" | "absolute_zero";
export type StudioAgentSafetyStage = "input_precheck" | "output_postprocess";

export type StudioAgentSafetyTelemetryFields = {
  policyVersion?: number | null;
  policySchemaVersion?: number | null;
  promptTemplateVersion?: string | null;
  runtimeScopeKey?: string | null;
  profileId?: SafetyProfileId | null;
  modality?: SafetyModality | null;
  category?: SafetyCategoryId | null;
  decisionAction?: SafetyPolicyAction | null;
  decisionSource?: StudioAgentSafetyDecisionSource | null;
  providerBlocked?: boolean;
  hardFloorViolation?: boolean;
  rollbackTriggered?: boolean;
  safeCompletionVersion?: string | null;
  safeCompletionEnabled?: boolean;
  refusalSource?: "typed_model" | "semantic_model" | "lexical_model" | null;
  recoveryEligible?: boolean;
  recoveryAttempted?: boolean;
  recoveryOutcome?: "not_attempted" | "recovered" | "refused" | "error";
  recoverySkipReason?: string | null;
  recoveryLatencyMs?: number | null;
};

export const STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE = "I cannot describe this.";

export const emitStudioAgentTurnTelemetry = ({
  flow,
  path,
  status,
  traceId,
  model,
  outcomeClass,
  retryUsed,
  retryCount,
  repairUsed,
  repairCount,
  reasonCode,
  totalLatencyMs,
  stageLatencyMs,
  pulsePresetId,
  pulseTurnPhase,
  pulseWorkflowStatusBefore,
  pulseWorkflowStatusAfter,
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
  traceId?: string | null;
  model: string;
  outcomeClass: StudioAgentTelemetryOutcomeClass;
  retryUsed: boolean;
  retryCount?: number;
  repairUsed?: boolean;
  repairCount?: number;
  reasonCode?: AgentReasonCode;
  totalLatencyMs: number;
  stageLatencyMs: Record<string, number>;
  pulsePresetId?: string | null;
  pulseTurnPhase?: "activation" | "followup" | "completed_followup" | null;
  pulseWorkflowStatusBefore?: string | null;
  pulseWorkflowStatusAfter?: string | null;
  fallbackReason?: string;
  safetyOutcome?: StudioAgentSafetyTelemetryOutcome;
  safetySource?: StudioAgentSafetyTelemetrySource;
  safetyFallback?: boolean;
  safetyDebugReason?: string;
  safetyDebugEnabled?: boolean;
  safetyTelemetry?: StudioAgentSafetyTelemetryFields;
}) => {
  const machineOutcome = buildAgentMachineOutcome({
    outcomeClass,
    ...(reasonCode ? { reasonCode } : {}),
  });
  console.info(
    "[studio-agent][telemetry]",
    JSON.stringify({
      flow,
      path,
      status,
      trace_id: traceId ?? null,
      model,
      decision: machineOutcome.decision,
      outcome_class: machineOutcome.outcome_class,
      reason_code: machineOutcome.reason_code,
      retryable: machineOutcome.retryable,
      retry_used: retryUsed,
      ...(typeof retryCount === "number" ? { retry_count: retryCount } : {}),
      repair_used: Boolean(repairUsed),
      repair_count: typeof repairCount === "number" ? repairCount : repairUsed ? 1 : 0,
      latency_ms_total: totalLatencyMs,
      latency_ms_stage: stageLatencyMs,
      ...(pulsePresetId ? { pulse_preset_id: pulsePresetId } : {}),
      ...(pulseTurnPhase ? { pulse_turn_phase: pulseTurnPhase } : {}),
      ...(pulseWorkflowStatusBefore
        ? { pulse_workflow_status_before: pulseWorkflowStatusBefore }
        : {}),
      ...(pulseWorkflowStatusAfter
        ? { pulse_workflow_status_after: pulseWorkflowStatusAfter }
        : {}),
      ...(fallbackReason ? { fallback_reason: fallbackReason } : {}),
      ...(safetyOutcome ? { safety_outcome: safetyOutcome } : {}),
      ...(safetySource ? { safety_source: safetySource } : {}),
      ...(typeof safetyFallback === "boolean" ? { safety_fallback: safetyFallback } : {}),
      policy_version: safetyTelemetry?.policyVersion ?? null,
      policy_schema_version: safetyTelemetry?.policySchemaVersion ?? null,
      prompt_template_version: safetyTelemetry?.promptTemplateVersion ?? null,
      runtime_scope_key: safetyTelemetry?.runtimeScopeKey ?? null,
      profile_id: safetyTelemetry?.profileId ?? null,
      modality: safetyTelemetry?.modality ?? null,
      category: safetyTelemetry?.category ?? null,
      decision_action: safetyTelemetry?.decisionAction ?? null,
      decision_source: safetyTelemetry?.decisionSource ?? null,
      provider_blocked: safetyTelemetry?.providerBlocked ?? false,
      hard_floor_violation: safetyTelemetry?.hardFloorViolation ?? false,
      rollback_triggered: safetyTelemetry?.rollbackTriggered ?? false,
      safe_completion_contract_version: safetyTelemetry?.safeCompletionVersion ?? null,
      safe_completion_enabled: safetyTelemetry?.safeCompletionEnabled ?? false,
      refusal_source: safetyTelemetry?.refusalSource ?? null,
      recovery_eligible: safetyTelemetry?.recoveryEligible ?? false,
      recovery_attempted: safetyTelemetry?.recoveryAttempted ?? false,
      recovery_outcome: safetyTelemetry?.recoveryOutcome ?? "not_attempted",
      recovery_skip_reason: safetyTelemetry?.recoverySkipReason ?? null,
      recovery_latency_ms: safetyTelemetry?.recoveryLatencyMs ?? null,
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
  policySchemaVersion,
  promptTemplateVersion,
  runtimeScopeKey,
  profileId,
  modality,
  category,
  decisionAction,
  decisionSource,
  hardFloorViolation,
  refusalField,
  rewrittenFields,
  nonBlockingSignalCount,
}: {
  flow: string;
  outcome: "pass" | "rewritten" | "refusal";
  rewrittenFieldCount: number;
  providerCallSkipped: boolean;
  policyVersion: number | null;
  policySchemaVersion?: number | null;
  promptTemplateVersion?: string | null;
  runtimeScopeKey?: string | null;
  profileId: SafetyProfileId | null;
  modality: SafetyModality;
  category: SafetyCategoryId | null;
  decisionAction: SafetyPolicyAction | null;
  decisionSource: StudioAgentSafetyDecisionSource | null;
  hardFloorViolation: boolean;
  refusalField?: StudioAgentSafetyInputPrecheckField | null;
  rewrittenFields?: StudioAgentSafetyInputPrecheckField[];
  nonBlockingSignalCount?: number;
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
      policy_schema_version: policySchemaVersion ?? null,
      prompt_template_version: promptTemplateVersion ?? null,
      runtime_scope_key: runtimeScopeKey ?? null,
      profile_id: profileId,
      modality,
      category,
      decision_action: decisionAction,
      decision_source: decisionSource,
      hard_floor_violation: hardFloorViolation,
      refusal_field: refusalField ?? null,
      rewritten_fields: Array.isArray(rewrittenFields) ? rewrittenFields : [],
      non_blocking_signal_count:
        typeof nonBlockingSignalCount === "number" ? nonBlockingSignalCount : 0,
    })
  );
};

export const emitStudioAgentUntrustedImageTextTelemetry = ({
  flow,
  signalCount,
  affectedImageCount,
  removedInstructionLikeLineCount,
  policyVersion,
  policySchemaVersion,
  promptTemplateVersion,
  runtimeScopeKey,
  profileId,
}: {
  flow: string;
  signalCount: number;
  affectedImageCount: number;
  removedInstructionLikeLineCount: number;
  policyVersion: number | null;
  policySchemaVersion?: number | null;
  promptTemplateVersion?: string | null;
  runtimeScopeKey?: string | null;
  profileId: SafetyProfileId | null;
}) => {
  if (signalCount <= 0) return;
  console.info(
    "[studio-agent][untrusted-image-text]",
    JSON.stringify({
      flow,
      safety_stage: "vision_untrusted_quarantine",
      signal_count: signalCount,
      affected_image_count: affectedImageCount,
      removed_instruction_like_line_count: removedInstructionLikeLineCount,
      policy_version: policyVersion,
      policy_schema_version: policySchemaVersion ?? null,
      prompt_template_version: promptTemplateVersion ?? null,
      runtime_scope_key: runtimeScopeKey ?? null,
      profile_id: profileId,
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
  fallbackReason,
  reasonCode = "UPSTREAM_ERROR",
}: {
  traceId: string;
  detail: string;
  stage?: string;
  fallbackReason?: string;
  reasonCode?: "UPSTREAM_ERROR";
}) => ({
  ...buildAgentMachineOutcome({
    outcomeClass: "upstream_error",
    reasonCode,
  }),
  error: stage ? `Upstream error (${stage})` : "Upstream error",
  detail,
  ...(fallbackReason ? { fallback_reason: fallbackReason } : {}),
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
  outcomeClass = "refusal_safety",
}: {
  traceId: string;
  canonicalPrompt: string | null;
  reasonCode?: "SAFETY_INPUT_REFUSAL" | "SAFETY_OUTPUT_REFUSAL" | "PROVIDER_SAFETY_REFUSAL";
  outcomeClass?: "refusal_safety" | "refusal_model";
}) => ({
  ...buildAgentMachineOutcome({
    outcomeClass,
    reasonCode,
  }),
  message: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
  actions: undefined,
  canonicalPrompt,
  traceId,
});
