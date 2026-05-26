import type { AgentResponse } from "../../../prefabs/agent";
import { normalizeErrorText } from "../../../lib/errorText";
import { SAFETY_REFUSAL_MESSAGE, resolveSafetyRefusalText } from "../agentClientSafety";
import type { StudioAgentTransportResult } from "./studioAgentTransport";

type StudioAgentTransportFailureResult = Extract<StudioAgentTransportResult, { ok: false }>;

type TransportFailureResolution = {
  assistantMessage: string | null;
  response: AgentResponse | null;
  errorText: string | null;
};

const appendTraceId = ({ errorText, traceId }: { errorText: string; traceId?: string }): string => {
  const normalizedTraceId = traceId?.trim();
  if (!normalizedTraceId) return errorText;
  if (errorText.includes(normalizedTraceId)) return errorText;
  return `${errorText} (Trace ID: ${normalizedTraceId})`;
};

export const resolveStudioAgentTransportFailure = (
  transportResult: StudioAgentTransportFailureResult
): TransportFailureResolution => {
  const machineDecision = transportResult.parsedError?.decision;
  const machineOutcomeClass = transportResult.parsedError?.outcome_class;
  if (machineDecision === "refuse") {
    const refusalText =
      resolveSafetyRefusalText(
        transportResult.parsedError?.message ??
          transportResult.parsedError?.detail ??
          transportResult.parsedError?.error
      ) ?? SAFETY_REFUSAL_MESSAGE;
    return {
      assistantMessage: refusalText,
      response: {
        message: refusalText,
        actions: undefined,
        decision: "refuse",
        outcome_class: machineOutcomeClass ?? "refusal_safety",
        reason_code: transportResult.parsedError?.reason_code,
        retryable: transportResult.parsedError?.retryable,
        fallback_reason: transportResult.parsedError?.fallback_reason,
      },
      errorText: null,
    };
  }
  const refusalText = resolveSafetyRefusalText(
    transportResult.parsedError ?? transportResult.detail
  );
  if (refusalText) {
    return {
      assistantMessage: refusalText,
      response: { message: refusalText, actions: undefined },
      errorText: null,
    };
  }
  const structuredErrorText =
    transportResult.parsedError?.message ??
    transportResult.parsedError?.detail ??
    transportResult.parsedError?.error;
  return {
    assistantMessage: null,
    response: null,
    errorText: appendTraceId({
      errorText: normalizeErrorText(structuredErrorText ?? transportResult.detail, {
        fallback: `Agent request failed (${transportResult.status})`,
        maxLength: 320,
      }),
      traceId: transportResult.parsedError?.traceId,
    }),
  };
};
