/**
 * Server-side helper seam for AI Studio safety control-plane RPC access.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type SafetyProfileId = "prod_safe_v1" | "staging_lenient" | "dev_absolute_zero";

export type ActiveAgentSafetyPolicy = {
  activeProfileId: SafetyProfileId;
  activePolicyVersion: number;
  activePolicy: Record<string, unknown>;
  activePolicyVersionId: number;
  lastKnownSafeProfileId: SafetyProfileId | null;
  lastKnownSafePolicyVersion: number | null;
  lastKnownSafePolicyVersionId: number | null;
  cooldownUntil: string | null;
  updatedAt: string;
  updatedByUserId: string | null;
  updatedByEmail: string | null;
};

export type AgentSafetyPolicyMutationStatus =
  | "activated"
  | "already_active"
  | "cooldown_blocked"
  | "rejected"
  | "profile_not_found"
  | "not_initialized"
  | "rolled_back"
  | "already_safe"
  | "no_safe_target";

export type AgentSafetyPolicyMutationResult = {
  status: AgentSafetyPolicyMutationStatus;
  activeProfileId: SafetyProfileId | null;
  activePolicyVersion: number | null;
  cooldownUntil: string | null;
  message: string | null;
};

export type RuntimeSafetyProfileSource = "control_plane" | "env" | "fallback";

export type RuntimeSafetyProfileResolution = {
  profileId: SafetyProfileId;
  policyVersion: number | null;
  source: RuntimeSafetyProfileSource;
};

const VALID_PROFILE_IDS = new Set<SafetyProfileId>([
  "prod_safe_v1",
  "staging_lenient",
  "dev_absolute_zero",
]);

const VALID_MUTATION_STATUSES = new Set<AgentSafetyPolicyMutationStatus>([
  "activated",
  "already_active",
  "cooldown_blocked",
  "rejected",
  "profile_not_found",
  "not_initialized",
  "rolled_back",
  "already_safe",
  "no_safe_target",
]);

const DEFAULT_RUNTIME_PROFILE_ID: SafetyProfileId = "prod_safe_v1";
const DEFAULT_CONTROL_PLANE_CACHE_TTL_MS = 5000;
const MIN_CONTROL_PLANE_CACHE_TTL_MS = 1000;
const MAX_CONTROL_PLANE_CACHE_TTL_MS = 60000;

let runtimeActivePolicyCache: {
  expiresAtMs: number;
  value: ActiveAgentSafetyPolicy | null;
} | null = null;

const asObjectRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const normalizeRpcRow = (payload: unknown): Record<string, unknown> | null => {
  if (Array.isArray(payload)) {
    return asObjectRecord(payload[0]);
  }
  return asObjectRecord(payload);
};

const asNullableString = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized.length) return null;
  return normalized.slice(0, maxLength);
};

const asNullableNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asProfileId = (value: unknown): SafetyProfileId | null => {
  const normalized = asNullableString(value, 64)?.toLowerCase() ?? null;
  if (!normalized) return null;
  return VALID_PROFILE_IDS.has(normalized as SafetyProfileId)
    ? (normalized as SafetyProfileId)
    : null;
};

const asMutationStatus = (value: unknown): AgentSafetyPolicyMutationStatus | null => {
  const normalized = asNullableString(value, 64)?.toLowerCase() ?? null;
  if (!normalized) return null;
  return VALID_MUTATION_STATUSES.has(normalized as AgentSafetyPolicyMutationStatus)
    ? (normalized as AgentSafetyPolicyMutationStatus)
    : null;
};

const resolveProfileVersionFromId = (profileId: string | null | undefined): number | null => {
  if (typeof profileId !== "string") return null;
  const match = profileId
    .trim()
    .toLowerCase()
    .match(/_v(\d+)$/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const resolveControlPlaneCacheTtlMs = (rawValue?: string | null): number => {
  const parsed = Number(rawValue ?? String(DEFAULT_CONTROL_PLANE_CACHE_TTL_MS));
  if (!Number.isFinite(parsed)) return DEFAULT_CONTROL_PLANE_CACHE_TTL_MS;
  return Math.max(
    MIN_CONTROL_PLANE_CACHE_TTL_MS,
    Math.min(MAX_CONTROL_PLANE_CACHE_TTL_MS, Math.floor(parsed))
  );
};

const isRuntimeControlPlaneSyncEnabled = (rawValue?: string | null): boolean =>
  String(rawValue ?? "true")
    .trim()
    .toLowerCase() !== "false";

const normalizeActivePolicy = (value: unknown): Record<string, unknown> => {
  const record = asObjectRecord(value);
  return record ?? {};
};

export const normalizeRequestedSafetyProfileId = (value: unknown): SafetyProfileId | null =>
  asProfileId(value);

export const resolveAgentSafetyRollbackCooldownHours = (rawValue?: string | null): number => {
  const parsed = Number(rawValue ?? "24");
  if (!Number.isFinite(parsed)) return 24;
  return Math.max(1, Math.min(168, Math.floor(parsed)));
};

export const clearRuntimeSafetyProfileCacheForTests = (): void => {
  runtimeActivePolicyCache = null;
};

export const resolveRuntimeSafetyProfile = async ({
  envProfileId,
  runtimeControlPlaneSyncEnabled = process.env
    .STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_SYNC_ENABLED,
  controlPlaneCacheTtlMs = process.env.STUDIO_AGENT_SAFETY_RUNTIME_CONTROL_PLANE_CACHE_TTL_MS,
}: {
  envProfileId?: string | null;
  runtimeControlPlaneSyncEnabled?: string | null;
  controlPlaneCacheTtlMs?: string | null;
}): Promise<RuntimeSafetyProfileResolution> => {
  const normalizedEnvProfileId = asProfileId(envProfileId);
  const fallbackProfileId = normalizedEnvProfileId ?? DEFAULT_RUNTIME_PROFILE_ID;
  if (!isRuntimeControlPlaneSyncEnabled(runtimeControlPlaneSyncEnabled)) {
    return {
      profileId: fallbackProfileId,
      policyVersion: resolveProfileVersionFromId(fallbackProfileId),
      source: normalizedEnvProfileId ? "env" : "fallback",
    };
  }

  const hasAdminConfig =
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.trim().length > 0 &&
    typeof process.env.SUPABASE_SERVICE_ROLE_KEY === "string" &&
    process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 0;
  if (!hasAdminConfig) {
    return {
      profileId: fallbackProfileId,
      policyVersion: resolveProfileVersionFromId(fallbackProfileId),
      source: normalizedEnvProfileId ? "env" : "fallback",
    };
  }

  const nowMs = Date.now();
  if (runtimeActivePolicyCache && runtimeActivePolicyCache.expiresAtMs > nowMs) {
    const cachedProfileId = runtimeActivePolicyCache.value?.activeProfileId ?? null;
    if (cachedProfileId) {
      return {
        profileId: cachedProfileId,
        policyVersion:
          runtimeActivePolicyCache.value?.activePolicyVersion ??
          resolveProfileVersionFromId(cachedProfileId),
        source: "control_plane",
      };
    }
    return {
      profileId: fallbackProfileId,
      policyVersion: resolveProfileVersionFromId(fallbackProfileId),
      source: normalizedEnvProfileId ? "env" : "fallback",
    };
  }

  try {
    const activePolicy = await fetchActiveAgentSafetyPolicy({ supabaseAdmin: getSupabaseAdmin() });
    runtimeActivePolicyCache = {
      expiresAtMs: nowMs + resolveControlPlaneCacheTtlMs(controlPlaneCacheTtlMs),
      value: activePolicy,
    };
    const activeProfileId = activePolicy?.activeProfileId ?? null;
    if (activeProfileId) {
      return {
        profileId: activeProfileId,
        policyVersion:
          activePolicy?.activePolicyVersion ?? resolveProfileVersionFromId(activeProfileId),
        source: "control_plane",
      };
    }
  } catch {
    runtimeActivePolicyCache = {
      expiresAtMs: nowMs + resolveControlPlaneCacheTtlMs(controlPlaneCacheTtlMs),
      value: null,
    };
  }

  return {
    profileId: fallbackProfileId,
    policyVersion: resolveProfileVersionFromId(fallbackProfileId),
    source: normalizedEnvProfileId ? "env" : "fallback",
  };
};

export const fetchActiveAgentSafetyPolicy = async ({
  supabaseAdmin,
}: {
  supabaseAdmin: SupabaseClient;
}): Promise<ActiveAgentSafetyPolicy | null> => {
  const { data, error } = await supabaseAdmin.rpc("get_active_agent_safety_policy");
  if (error) {
    throw error;
  }

  const row = normalizeRpcRow(data);
  if (!row) return null;

  const activeProfileId = asProfileId(row.active_profile_id);
  const activePolicyVersion = asNullableNumber(row.active_policy_version);
  const activePolicyVersionId = asNullableNumber(row.active_policy_version_id);
  const updatedAt = asNullableString(row.updated_at, 80);
  if (!activeProfileId || !activePolicyVersion || !activePolicyVersionId || !updatedAt) {
    throw new Error("Invalid active agent safety policy payload.");
  }

  return {
    activeProfileId,
    activePolicyVersion,
    activePolicy: normalizeActivePolicy(row.active_policy),
    activePolicyVersionId,
    lastKnownSafeProfileId: asProfileId(row.last_known_safe_profile_id),
    lastKnownSafePolicyVersion: asNullableNumber(row.last_known_safe_policy_version),
    lastKnownSafePolicyVersionId: asNullableNumber(row.last_known_safe_policy_version_id),
    cooldownUntil: asNullableString(row.cooldown_until, 80),
    updatedAt,
    updatedByUserId: asNullableString(row.updated_by_user_id, 80),
    updatedByEmail: asNullableString(row.updated_by_email, 320),
  };
};

export const activateAgentSafetyPolicy = async ({
  supabaseAdmin,
  profileId,
  reason,
  actorUserId,
  actorEmail,
  singleReviewerAck,
  source = "admin_api",
}: {
  supabaseAdmin: SupabaseClient;
  profileId: SafetyProfileId;
  reason: string | null;
  actorUserId: string;
  actorEmail: string | null;
  singleReviewerAck: boolean;
  source?: string;
}): Promise<AgentSafetyPolicyMutationResult> => {
  const { data, error } = await supabaseAdmin.rpc("activate_agent_safety_policy", {
    p_profile_id: profileId,
    p_reason: reason,
    p_actor_user_id: actorUserId,
    p_actor_email: actorEmail,
    p_single_reviewer_ack: singleReviewerAck,
    p_source: source,
  });
  if (error) {
    throw error;
  }

  const row = normalizeRpcRow(data);
  const status = asMutationStatus(row?.status);
  if (!status) {
    throw new Error("Invalid activate agent safety policy payload.");
  }

  return {
    status,
    activeProfileId: asProfileId(row?.active_profile_id),
    activePolicyVersion: asNullableNumber(row?.active_policy_version),
    cooldownUntil: asNullableString(row?.cooldown_until, 80),
    message: asNullableString(row?.message, 400),
  };
};

export const rollbackAgentSafetyPolicy = async ({
  supabaseAdmin,
  reason,
  actorUserId,
  actorEmail,
  source = "manual",
  cooldownHours,
}: {
  supabaseAdmin: SupabaseClient;
  reason: string | null;
  actorUserId: string;
  actorEmail: string | null;
  source?: string;
  cooldownHours: number;
}): Promise<AgentSafetyPolicyMutationResult> => {
  const { data, error } = await supabaseAdmin.rpc("rollback_agent_safety_policy", {
    p_reason: reason,
    p_actor_user_id: actorUserId,
    p_actor_email: actorEmail,
    p_source: source,
    p_cooldown_hours: cooldownHours,
  });
  if (error) {
    throw error;
  }

  const row = normalizeRpcRow(data);
  const status = asMutationStatus(row?.status);
  if (!status) {
    throw new Error("Invalid rollback agent safety policy payload.");
  }

  return {
    status,
    activeProfileId: asProfileId(row?.active_profile_id),
    activePolicyVersion: asNullableNumber(row?.active_policy_version),
    cooldownUntil: asNullableString(row?.cooldown_until, 80),
    message: asNullableString(row?.message, 400),
  };
};
