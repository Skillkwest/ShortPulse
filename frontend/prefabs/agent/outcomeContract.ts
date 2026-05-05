/**
 * Canonical machine-readable outcome contract for AI Studio agent routes.
 * This contract is additive across active Standard/Pulse route fields.
 */
export type AgentDecision = "allow" | "refuse" | "error";

export type AgentOutcomeClass =
  | "success_prompt"
  | "success_message"
  | "refusal_safety"
  | "refusal_model"
  | "upstream_error"
  | "route_error";

export type AgentReasonCode =
  | "SUCCESS_PROMPT"
  | "SUCCESS_MESSAGE"
  | "SAFETY_INPUT_REFUSAL"
  | "SAFETY_OUTPUT_REFUSAL"
  | "PROVIDER_SAFETY_REFUSAL"
  | "UPSTREAM_OUTPUT_CONTRACT"
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
