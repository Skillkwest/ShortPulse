import { STUDIO_AGENT_INFRA_FALLBACK_MESSAGE } from "./studioAgentFailurePolicy";

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
      ...(safetyDebugEnabled && safetyDebugReason
        ? { safety_debug_reason: safetyDebugReason }
        : {}),
    })
  );
};

export const buildStudioAgentUpstreamErrorPayload = ({
  traceId,
  detail,
  stage,
}: {
  traceId: string;
  detail: string;
  stage?: string;
}) => ({
  error: stage ? `Upstream error (${stage})` : "Upstream error",
  detail,
  traceId,
});

export const buildStudioAgentRouteFailurePayload = ({
  traceId,
  detail,
}: {
  traceId: string;
  detail: string;
}) => ({
  error: "Agent call failed",
  detail,
  traceId,
});

export const buildStudioAgentInfraFallbackPayload = ({
  traceId,
  canonicalPrompt,
}: {
  traceId: string;
  canonicalPrompt: string | null;
}) => ({
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
}: {
  traceId: string;
  canonicalPrompt: string | null;
}) => ({
  message: STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE,
  actions: undefined,
  canonicalPrompt,
  traceId,
});
