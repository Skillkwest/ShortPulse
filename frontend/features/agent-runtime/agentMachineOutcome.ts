/**
 * Shared machine-outcome mapping for AI Studio agent route payload contracts.
 * Keeps additive route fields deterministic across success/refusal/fallback/error lanes.
 */
import type {
  AgentMachineOutcomeFields,
  AgentOutcomeClass,
  AgentReasonCode,
} from "../../prefabs/agent/outcomeContract";

const RATE_LIMIT_PATTERNS: RegExp[] = [
  /\brate\s*limit(?:ed|ing)?\b/i,
  /\btoo\s+many\s+requests\b/i,
];
const TIMEOUT_PATTERNS: RegExp[] = [
  /\btimeout\b/i,
  /\btimed\s*out\b/i,
  /\betimedout\b/i,
  /\bdeadline\b/i,
  /\babort(?:error)?\b/i,
];
const OUTPUT_CONTRACT_PATTERNS: RegExp[] = [
  /\bparse\/repair\s+failed\b/i,
  /\bcontract\s+violation\b/i,
];
const OUTPUT_CONTRACT_STAGE_HINTS = new Set(["prompt_missing", "style_prompt_missing"]);

const ROUTE_ERROR_REASON_RETRYABLE: Record<
  Extract<AgentReasonCode, "ROUTE_ERROR" | "REQUEST_INVALID" | "AUTH_REQUIRED" | "CONFIG_MISSING">,
  boolean
> = {
  ROUTE_ERROR: true,
  REQUEST_INVALID: false,
  AUTH_REQUIRED: false,
  CONFIG_MISSING: false,
};

const validateReasonCodeForOutcomeClass = ({
  outcomeClass,
  reasonCode,
}: {
  outcomeClass: AgentOutcomeClass;
  reasonCode: AgentReasonCode;
}): boolean => {
  if (outcomeClass === "success_prompt") return reasonCode === "SUCCESS_PROMPT";
  if (outcomeClass === "success_message") return reasonCode === "SUCCESS_MESSAGE";
  if (outcomeClass === "refusal_safety") {
    return (
      reasonCode === "SAFETY_INPUT_REFUSAL" ||
      reasonCode === "SAFETY_OUTPUT_REFUSAL" ||
      reasonCode === "PROVIDER_SAFETY_REFUSAL"
    );
  }
  if (outcomeClass === "refusal_model") return reasonCode === "PROVIDER_SAFETY_REFUSAL";
  if (outcomeClass === "fallback_infra") {
    return (
      reasonCode === "INFRA_FALLBACK_TRANSIENT" ||
      reasonCode === "INFRA_FALLBACK_TIMEOUT" ||
      reasonCode === "INFRA_FALLBACK_RATE_LIMIT" ||
      reasonCode === "INFRA_FALLBACK_OUTPUT_CONTRACT"
    );
  }
  if (outcomeClass === "upstream_error") {
    return reasonCode === "UPSTREAM_ERROR" || reasonCode === "UPSTREAM_OUTPUT_CONTRACT";
  }
  return (
    reasonCode === "ROUTE_ERROR" ||
    reasonCode === "REQUEST_INVALID" ||
    reasonCode === "AUTH_REQUIRED" ||
    reasonCode === "CONFIG_MISSING"
  );
};

const resolveDefaultReasonCode = (outcomeClass: AgentOutcomeClass): AgentReasonCode => {
  if (outcomeClass === "success_prompt") return "SUCCESS_PROMPT";
  if (outcomeClass === "success_message") return "SUCCESS_MESSAGE";
  if (outcomeClass === "refusal_safety") return "SAFETY_OUTPUT_REFUSAL";
  if (outcomeClass === "refusal_model") return "PROVIDER_SAFETY_REFUSAL";
  if (outcomeClass === "fallback_infra") return "INFRA_FALLBACK_TRANSIENT";
  if (outcomeClass === "upstream_error") return "UPSTREAM_ERROR";
  return "ROUTE_ERROR";
};

const resolveDecisionForOutcomeClass = (
  outcomeClass: AgentOutcomeClass
): AgentMachineOutcomeFields["decision"] => {
  if (
    outcomeClass === "success_prompt" ||
    outcomeClass === "success_message" ||
    outcomeClass === "fallback_infra"
  ) {
    return "allow";
  }
  if (outcomeClass === "refusal_model" || outcomeClass === "refusal_safety") return "refuse";
  return "error";
};

const resolveRetryable = ({
  outcomeClass,
  reasonCode,
}: {
  outcomeClass: AgentOutcomeClass;
  reasonCode: AgentReasonCode;
}): boolean => {
  if (outcomeClass === "route_error") {
    return ROUTE_ERROR_REASON_RETRYABLE[
      reasonCode as keyof typeof ROUTE_ERROR_REASON_RETRYABLE
    ] as boolean;
  }
  if (outcomeClass === "fallback_infra") {
    return reasonCode !== "INFRA_FALLBACK_OUTPUT_CONTRACT";
  }
  if (outcomeClass === "upstream_error") return reasonCode !== "UPSTREAM_OUTPUT_CONTRACT";
  return false;
};

/**
 * Builds additive machine-outcome fields for route payloads.
 */
export const buildAgentMachineOutcome = ({
  outcomeClass,
  reasonCode,
}: {
  outcomeClass: AgentOutcomeClass;
  reasonCode?: AgentReasonCode;
}): AgentMachineOutcomeFields => {
  const resolvedReasonCode =
    reasonCode && validateReasonCodeForOutcomeClass({ outcomeClass, reasonCode })
      ? reasonCode
      : resolveDefaultReasonCode(outcomeClass);
  return {
    decision: resolveDecisionForOutcomeClass(outcomeClass),
    outcome_class: outcomeClass,
    reason_code: resolvedReasonCode,
    retryable: resolveRetryable({ outcomeClass, reasonCode: resolvedReasonCode }),
  };
};

/**
 * Resolves infra fallback reason code for transient assistant-fallback lanes.
 */
export const resolveInfraFallbackReasonCode = ({
  status,
  detail,
}: {
  status?: number | null;
  detail?: string | null;
}): Extract<
  AgentReasonCode,
  | "INFRA_FALLBACK_TRANSIENT"
  | "INFRA_FALLBACK_TIMEOUT"
  | "INFRA_FALLBACK_RATE_LIMIT"
  | "INFRA_FALLBACK_OUTPUT_CONTRACT"
> => {
  const normalizedDetail = String(detail ?? "").trim();
  if (OUTPUT_CONTRACT_PATTERNS.some((pattern) => pattern.test(normalizedDetail))) {
    return "INFRA_FALLBACK_OUTPUT_CONTRACT";
  }
  if (status === 429 || RATE_LIMIT_PATTERNS.some((pattern) => pattern.test(normalizedDetail))) {
    return "INFRA_FALLBACK_RATE_LIMIT";
  }
  if (
    status === 408 ||
    status === 504 ||
    TIMEOUT_PATTERNS.some((pattern) => pattern.test(normalizedDetail))
  ) {
    return "INFRA_FALLBACK_TIMEOUT";
  }
  return "INFRA_FALLBACK_TRANSIENT";
};

/**
 * Resolves upstream error reason code for hard error lanes.
 * Use stage hints for deterministic contract failures that are not represented by raw provider detail.
 */
export const resolveUpstreamReasonCode = ({
  detail,
  stage,
}: {
  detail?: string | null;
  stage?: string | null;
}): Extract<AgentReasonCode, "UPSTREAM_ERROR" | "UPSTREAM_OUTPUT_CONTRACT"> => {
  const normalizedDetail = String(detail ?? "").trim();
  const normalizedStage = String(stage ?? "")
    .trim()
    .toLowerCase();
  if (normalizedStage.length && OUTPUT_CONTRACT_STAGE_HINTS.has(normalizedStage)) {
    return "UPSTREAM_OUTPUT_CONTRACT";
  }
  if (OUTPUT_CONTRACT_PATTERNS.some((pattern) => pattern.test(normalizedDetail))) {
    return "UPSTREAM_OUTPUT_CONTRACT";
  }
  return "UPSTREAM_ERROR";
};
