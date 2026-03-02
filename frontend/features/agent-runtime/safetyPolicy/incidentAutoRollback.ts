/**
 * Executes policy-only rollback when a production hard-floor safety incident is detected.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveAgentSafetyRollbackCooldownHours,
  rollbackAgentSafetyPolicy,
  type AgentSafetyPolicyMutationStatus,
} from "../../../lib/server/api/agentSafetyPolicyControlPlane";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import type { SafetyEnvironment } from "./types";

export type SafetyIncidentAutoRollbackResult = {
  attempted: boolean;
  rollbackTriggered: boolean;
  status: AgentSafetyPolicyMutationStatus | null;
  cooldownUntil: string | null;
  message: string | null;
};

const ROLLBACK_TRIGGER_STATUSES = new Set<AgentSafetyPolicyMutationStatus>([
  "rolled_back",
  "already_safe",
]);

export const shouldAttemptSafetyIncidentAutoRollback = ({
  environment,
  autoRollbackEnabled,
  hardFloorViolation,
}: {
  environment: SafetyEnvironment;
  autoRollbackEnabled: boolean;
  hardFloorViolation: boolean;
}): boolean => environment === "production" && autoRollbackEnabled && hardFloorViolation;

export const maybeTriggerSafetyIncidentAutoRollback = async ({
  environment,
  autoRollbackEnabled,
  hardFloorViolation,
  actorUserId,
  actorEmail,
  source = "runtime_hard_floor_incident",
  reason = "Automatic safety-policy rollback triggered by hard-floor incident.",
  cooldownHours = resolveAgentSafetyRollbackCooldownHours(
    process.env.STUDIO_AGENT_SAFETY_ROLLBACK_COOLDOWN_HOURS
  ),
  supabaseAdmin,
}: {
  environment: SafetyEnvironment;
  autoRollbackEnabled: boolean;
  hardFloorViolation: boolean;
  actorUserId: string;
  actorEmail: string | null;
  source?: string;
  reason?: string;
  cooldownHours?: number;
  supabaseAdmin?: SupabaseClient;
}): Promise<SafetyIncidentAutoRollbackResult> => {
  if (
    !shouldAttemptSafetyIncidentAutoRollback({
      environment,
      autoRollbackEnabled,
      hardFloorViolation,
    })
  ) {
    return {
      attempted: false,
      rollbackTriggered: false,
      status: null,
      cooldownUntil: null,
      message: null,
    };
  }

  const result = await rollbackAgentSafetyPolicy({
    supabaseAdmin: supabaseAdmin ?? getSupabaseAdmin(),
    reason,
    actorUserId,
    actorEmail,
    source,
    cooldownHours,
  });

  return {
    attempted: true,
    rollbackTriggered: ROLLBACK_TRIGGER_STATUSES.has(result.status),
    status: result.status,
    cooldownUntil: result.cooldownUntil,
    message: result.message,
  };
};
