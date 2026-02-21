export type StudioAgentTelemetryStatus = "success" | "refuse" | "error";

export const emitStudioAgentTurnTelemetry = ({
  flow,
  path,
  status,
  model,
  retryUsed,
  totalLatencyMs,
  stageLatencyMs,
}: {
  flow: string;
  path: string;
  status: StudioAgentTelemetryStatus;
  model: string;
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
