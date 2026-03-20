/**
 * Canonical machine-readable outcome contract for AI Studio agent routes.
 * This contract is additive and backward-compatible with legacy response fields.
 */
export type AgentDecision = "allow" | "refuse" | "error";

export type AgentOutcomeClass =
  | "success_prompt"
  | "refusal_safety"
  | "refusal_model"
  | "fallback_infra"
  | "upstream_error"
  | "route_error";

export type AgentReasonCode =
  | "SUCCESS_PROMPT"
  | "SAFETY_INPUT_REFUSAL"
  | "SAFETY_OUTPUT_REFUSAL"
  | "PROVIDER_SAFETY_REFUSAL"
  | "INFRA_FALLBACK_TRANSIENT"
  | "INFRA_FALLBACK_TIMEOUT"
  | "INFRA_FALLBACK_RATE_LIMIT"
  | "UPSTREAM_ERROR"
  | "ROUTE_ERROR"
  | "REQUEST_INVALID"
  | "AUTH_REQUIRED"
  | "CONFIG_MISSING";

export type AgentMachineOutcomeFields = {
  decision?: AgentDecision;
  outcome_class?: AgentOutcomeClass;
  reason_code?: AgentReasonCode;
  retryable?: boolean;
  fallback_reason?: string;
};
