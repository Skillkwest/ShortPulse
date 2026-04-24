/**
 * Shared fallback-reason normalization for assistant-fallback lanes.
 * Produces compact labels suitable for payloads and telemetry.
 */
export const resolveStudioAgentFallbackReasonLabel = ({
  stage,
  status,
  detail,
}: {
  stage?: string;
  status?: number;
  detail?: string;
}): string => {
  const normalizedStage = typeof stage === "string" ? stage.trim().toLowerCase() : "";
  if (normalizedStage.length) {
    return `stage_${normalizedStage.replace(/[^a-z0-9_]+/g, "_")}`;
  }

  const normalizedDetail = typeof detail === "string" ? detail.trim().toLowerCase() : "";
  if (normalizedDetail.includes("responses unavailable")) return "responses_unavailable";
  if (normalizedDetail.includes("parse/repair failed")) return "parse_repair_failed";
  if (normalizedDetail.includes("contract violation")) return "output_contract";
  if (
    (normalizedDetail.includes("parse") && normalizedDetail.includes("json")) ||
    normalizedDetail.includes("json at position") ||
    normalizedDetail.includes("unexpected token")
  ) {
    return "json_parse_failure";
  }
  if (normalizedDetail.includes("timeout") || normalizedDetail.includes("timed out")) {
    return "timeout";
  }
  if (normalizedDetail.includes("rate limit") || normalizedDetail.includes("too many requests")) {
    return "rate_limit";
  }

  if (status === 429) return "rate_limit";
  if (status === 408 || status === 504) return "timeout";
  if (typeof status === "number" && status >= 500) return "upstream_unavailable";
  if (typeof status === "number" && status >= 400) return "upstream_error";

  return "runtime_failure";
};
