/**
 * Shared route-level machine-outcome telemetry for non-studio-agent OpenAI lanes.
 * Emits deterministic outcome fields so regressions are visible across prompt/describe routes.
 */
import type { AgentMachineOutcomeFields } from "../../prefabs/agent/outcomeContract";

type AgentRouteTelemetryTag = "generate-prompt" | "describe-image";

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
}) => {
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
    })
  );
};
