/**
 * Shared route-level machine-outcome telemetry for non-studio-agent OpenAI lanes.
 * Emits deterministic outcome fields so regressions stay visible on retained routes.
 */
import type { AgentMachineOutcomeFields } from "../../prefabs/agent/outcomeContract";

type AgentRouteTelemetryTag = "extract-style";

const resolveOutputContractTelemetryViolation = ({
  reasonCode,
  retryable,
  fallbackReason,
}: {
  reasonCode?: AgentMachineOutcomeFields["reason_code"];
  retryable?: AgentMachineOutcomeFields["retryable"];
  fallbackReason?: string | null;
}): string | null => {
  const isOutputContractReason = reasonCode === "UPSTREAM_OUTPUT_CONTRACT";
  if (isOutputContractReason && retryable !== false) {
    return "output_contract_reason_retryable_mismatch";
  }
  if (fallbackReason === "parse_repair_failed" && !isOutputContractReason) {
    return "parse_repair_reason_code_mismatch";
  }
  if (fallbackReason === "parse_repair_failed" && retryable !== false) {
    return "parse_repair_retryable_mismatch";
  }
  return null;
};

/**
 * Emits a normalized telemetry event for a route machine outcome payload.
 */
export const emitAgentRouteOutcomeTelemetry = ({
  telemetryTag,
  routeLabel,
  statusCode,
  machineOutcome,
  policyVersion,
  policySchemaVersion,
  promptTemplateVersion,
  runtimeScopeKey,
  profileId,
  modality,
  category,
  decisionAction,
  decisionSource,
  providerBlocked,
  hardFloorViolation,
  rollbackTriggered,
  fallbackReason,
}: {
  telemetryTag: AgentRouteTelemetryTag;
  routeLabel: string;
  statusCode: number;
  machineOutcome: AgentMachineOutcomeFields;
  policyVersion: number | null;
  policySchemaVersion: number | null;
  promptTemplateVersion?: string | null;
  runtimeScopeKey?: string | null;
  profileId: string | null;
  modality: "text" | "image";
  category?: string | null;
  decisionAction?: string | null;
  decisionSource?: string | null;
  providerBlocked?: boolean | null;
  hardFloorViolation?: boolean | null;
  rollbackTriggered?: boolean | null;
  fallbackReason?: string | null;
}) => {
  const contractViolation = resolveOutputContractTelemetryViolation({
    reasonCode: machineOutcome.reason_code,
    retryable: machineOutcome.retryable,
    fallbackReason,
  });
  console.info(
    `[${telemetryTag}][telemetry]`,
    JSON.stringify({
      route: routeLabel,
      status_code: statusCode,
      decision: machineOutcome.decision,
      outcome_class: machineOutcome.outcome_class,
      reason_code: machineOutcome.reason_code,
      retryable: machineOutcome.retryable,
      policy_version: policyVersion,
      policy_schema_version: policySchemaVersion,
      prompt_template_version: promptTemplateVersion ?? null,
      runtime_scope_key: runtimeScopeKey ?? null,
      profile_id: profileId,
      modality,
      category: category ?? null,
      decision_action: decisionAction ?? null,
      decision_source: decisionSource ?? null,
      provider_blocked: providerBlocked ?? null,
      hard_floor_violation: hardFloorViolation ?? null,
      rollback_triggered: rollbackTriggered ?? null,
      fallback_reason: fallbackReason ?? null,
      contract_violation: contractViolation,
    })
  );
};
