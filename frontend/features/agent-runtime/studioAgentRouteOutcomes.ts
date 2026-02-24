export type StudioAgentTelemetryStatus = "success" | "refuse" | "error";
export type StudioAgentTelemetryOutcomeClass =
  | "success_prompt"
  | "refusal_model"
  | "refusal_safety"
  | "upstream_error"
  | "route_error";

export const STUDIO_AGENT_SAFETY_REFUSAL_MESSAGE = "I cannot describe this.";

export const emitStudioAgentTurnTelemetry = ({
  flow,
  path,
  status,
  model,
  outcomeClass,
  retryUsed,
  totalLatencyMs,
  stageLatencyMs,
}: {
  flow: string;
  path: string;
  status: StudioAgentTelemetryStatus;
  model: string;
  outcomeClass: StudioAgentTelemetryOutcomeClass;
  retryUsed: boolean;
  totalLatencyMs: number;
  stageLatencyMs: Record<string, number>;
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
      latency_ms_total: totalLatencyMs,
      latency_ms_stage: stageLatencyMs,
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
