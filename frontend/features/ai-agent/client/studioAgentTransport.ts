/**
 * HTTP transport helpers for AI agent requests.
 * Isolates route call details from hook state management logic.
 */
import type { AgentApiRequest, AgentResponse } from "../../../prefabs/agent";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import type {
  AgentDecision,
  AgentOutcomeClass,
  AgentReasonCode,
} from "../../../prefabs/agent/outcomeContract";

export type StudioAgentTransportErrorPayload = {
  code?: string;
  message?: string;
  error?: string;
  detail?: string;
  details?: Record<string, unknown>;
  traceId?: string;
  decision?: AgentDecision;
  outcome_class?: AgentOutcomeClass;
  reason_code?: AgentReasonCode;
  retryable?: boolean;
  fallback_reason?: string;
};

export type StudioAgentTransportResult =
  | {
      ok: true;
      data: AgentResponse;
    }
  | {
      ok: false;
      status: number;
      detail: string;
      rawBody: string;
      parsedError?: StudioAgentTransportErrorPayload;
    };

const parseErrorPayload = (value: unknown): StudioAgentTransportErrorPayload | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const details =
    record.details && typeof record.details === "object" && !Array.isArray(record.details)
      ? (record.details as Record<string, unknown>)
      : undefined;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
    error: typeof record.error === "string" ? record.error : undefined,
    detail: typeof record.detail === "string" ? record.detail : undefined,
    details,
    traceId: typeof record.traceId === "string" ? record.traceId : undefined,
    decision:
      record.decision === "allow" || record.decision === "refuse" || record.decision === "error"
        ? record.decision
        : undefined,
    outcome_class:
      record.outcome_class === "success_prompt" ||
      record.outcome_class === "refusal_safety" ||
      record.outcome_class === "refusal_model" ||
      record.outcome_class === "fallback_infra" ||
      record.outcome_class === "upstream_error" ||
      record.outcome_class === "route_error"
        ? record.outcome_class
        : undefined,
    reason_code:
      record.reason_code === "SUCCESS_PROMPT" ||
      record.reason_code === "SAFETY_INPUT_REFUSAL" ||
      record.reason_code === "SAFETY_OUTPUT_REFUSAL" ||
      record.reason_code === "PROVIDER_SAFETY_REFUSAL" ||
      record.reason_code === "INFRA_FALLBACK_TRANSIENT" ||
      record.reason_code === "INFRA_FALLBACK_TIMEOUT" ||
      record.reason_code === "INFRA_FALLBACK_RATE_LIMIT" ||
      record.reason_code === "INFRA_FALLBACK_OUTPUT_CONTRACT" ||
      record.reason_code === "UPSTREAM_OUTPUT_CONTRACT" ||
      record.reason_code === "UPSTREAM_ERROR" ||
      record.reason_code === "ROUTE_ERROR" ||
      record.reason_code === "REQUEST_INVALID" ||
      record.reason_code === "AUTH_REQUIRED" ||
      record.reason_code === "CONFIG_MISSING"
        ? record.reason_code
        : undefined,
    retryable: typeof record.retryable === "boolean" ? record.retryable : undefined,
    fallback_reason:
      typeof record.fallback_reason === "string" ? record.fallback_reason : undefined,
  };
};

const resolveTransportErrorDetail = ({
  rawBody,
  parsedError,
}: {
  rawBody: string;
  parsedError: StudioAgentTransportErrorPayload | undefined;
}): string => {
  const preferred = parsedError?.message ?? parsedError?.detail ?? parsedError?.error;
  const trimmedPreferred = preferred?.trim();
  if (trimmedPreferred) return trimmedPreferred;
  const trimmedBody = rawBody.trim();
  return trimmedBody.length ? trimmedBody : "Agent request failed";
};

/**
 * Send a turn request to the canonical studio-agent endpoint.
 */
export const sendStudioAgentTurn = async (
  body: AgentApiRequest
): Promise<StudioAgentTransportResult> => {
  const response = await fetchWithAuth("/api/ai/studio-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const rawBody = await response.text();
    let parsedError: StudioAgentTransportErrorPayload | undefined;
    try {
      parsedError = parseErrorPayload(JSON.parse(rawBody)) ?? undefined;
    } catch {
      parsedError = undefined;
    }
    return {
      ok: false,
      status: response.status,
      detail: resolveTransportErrorDetail({ rawBody, parsedError }),
      rawBody,
      parsedError,
    };
  }

  return {
    ok: true,
    data: (await response.json()) as AgentResponse,
  };
};
