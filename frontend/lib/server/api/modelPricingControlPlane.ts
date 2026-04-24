/**
 * Server-side helper seam for model pricing control-plane access.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  compactModelPricingPolicyDocument,
  getDefaultModelPricingPolicyDocument,
  type ModelPricingPolicyDocument,
} from "../../model-runtime/pricingPolicy";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type ActiveModelPricingPolicy = {
  activePolicyVersion: number;
  activePolicyVersionId: number;
  activePolicy: ModelPricingPolicyDocument;
  lastKnownSafePolicyVersion: number | null;
  lastKnownSafePolicyVersionId: number | null;
  updatedAt: string;
  updatedByUserId: string | null;
  updatedByEmail: string | null;
};

export type ModelPricingPolicyMutationStatus =
  | "activated"
  | "rolled_back"
  | "already_safe"
  | "not_initialized"
  | "rejected";

export type ModelPricingPolicyMutationResult = {
  status: ModelPricingPolicyMutationStatus;
  activePolicyVersion: number | null;
  activePolicyVersionId: number | null;
  message: string | null;
};

export type RuntimeModelPricingPolicyResolution = {
  policy: ModelPricingPolicyDocument;
  activePolicyVersion: number | null;
  activePolicyVersionId: number | null;
  source: "control_plane" | "fallback";
  updatedAt: string | null;
  updatedByEmail: string | null;
};

const DEFAULT_CONTROL_PLANE_CACHE_TTL_MS = 5000;
const MIN_CONTROL_PLANE_CACHE_TTL_MS = 1000;
const MAX_CONTROL_PLANE_CACHE_TTL_MS = 60000;
const VALID_STATUSES = new Set<ModelPricingPolicyMutationStatus>([
  "activated",
  "rolled_back",
  "already_safe",
  "not_initialized",
  "rejected",
]);

let runtimePolicyCache: {
  expiresAtMs: number;
  value: ActiveModelPricingPolicy | null;
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

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
};

const asNullableNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asMutationStatus = (value: unknown): ModelPricingPolicyMutationStatus | null => {
  const normalized = asNullableString(value)?.toLowerCase() ?? null;
  if (!normalized) return null;
  return VALID_STATUSES.has(normalized as ModelPricingPolicyMutationStatus)
    ? (normalized as ModelPricingPolicyMutationStatus)
    : null;
};

const resolveControlPlaneCacheTtlMs = (rawValue?: string | null): number => {
  const parsed = Number(rawValue ?? String(DEFAULT_CONTROL_PLANE_CACHE_TTL_MS));
  if (!Number.isFinite(parsed)) return DEFAULT_CONTROL_PLANE_CACHE_TTL_MS;
  return Math.max(
    MIN_CONTROL_PLANE_CACHE_TTL_MS,
    Math.min(MAX_CONTROL_PLANE_CACHE_TTL_MS, Math.floor(parsed))
  );
};

const mapActivePolicy = (row: Record<string, unknown> | null): ActiveModelPricingPolicy | null => {
  if (!row) return null;
  const activePolicyVersion = asNullableNumber(row.active_policy_version);
  const activePolicyVersionId = asNullableNumber(row.active_policy_version_id);
  const updatedAt = asNullableString(row.updated_at);
  if (activePolicyVersion == null || activePolicyVersionId == null || !updatedAt) {
    return null;
  }
  return {
    activePolicyVersion,
    activePolicyVersionId,
    activePolicy: compactModelPricingPolicyDocument(row.active_policy),
    lastKnownSafePolicyVersion: asNullableNumber(row.last_known_safe_policy_version),
    lastKnownSafePolicyVersionId: asNullableNumber(row.last_known_safe_policy_version_id),
    updatedAt,
    updatedByUserId: asNullableString(row.updated_by_user_id),
    updatedByEmail: asNullableString(row.updated_by_email),
  };
};

const mapMutationResult = (
  row: Record<string, unknown> | null,
  fallbackStatus: ModelPricingPolicyMutationStatus
): ModelPricingPolicyMutationResult => ({
  status: asMutationStatus(row?.status) ?? fallbackStatus,
  activePolicyVersion: asNullableNumber(row?.active_policy_version),
  activePolicyVersionId: asNullableNumber(row?.active_policy_version_id),
  message: asNullableString(row?.message),
});

export const clearRuntimeModelPricingPolicyCacheForTests = (): void => {
  runtimePolicyCache = null;
};

export const fetchActiveModelPricingPolicy = async ({
  supabaseAdmin = getSupabaseAdmin(),
}: {
  supabaseAdmin?: SupabaseClient;
} = {}): Promise<ActiveModelPricingPolicy | null> => {
  const { data, error } = await supabaseAdmin.rpc("get_active_model_pricing_policy");
  if (error) {
    throw new Error(error.message || "Failed to load active model pricing policy.");
  }
  return mapActivePolicy(normalizeRpcRow(data));
};

export const resolveRuntimeModelPricingPolicy = async ({
  controlPlaneCacheTtlMs = process.env.MODEL_PRICING_CONTROL_PLANE_CACHE_TTL_MS,
}: {
  controlPlaneCacheTtlMs?: string | null;
} = {}): Promise<RuntimeModelPricingPolicyResolution> => {
  const hasAdminConfig =
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.trim().length > 0 &&
    typeof process.env.SUPABASE_SERVICE_ROLE_KEY === "string" &&
    process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 0;
  if (!hasAdminConfig) {
    return {
      policy: getDefaultModelPricingPolicyDocument(),
      activePolicyVersion: null,
      activePolicyVersionId: null,
      source: "fallback",
      updatedAt: null,
      updatedByEmail: null,
    };
  }

  const nowMs = Date.now();
  if (runtimePolicyCache && runtimePolicyCache.expiresAtMs > nowMs) {
    const cached = runtimePolicyCache.value;
    if (cached) {
      return {
        policy: cached.activePolicy,
        activePolicyVersion: cached.activePolicyVersion,
        activePolicyVersionId: cached.activePolicyVersionId,
        source: "control_plane",
        updatedAt: cached.updatedAt,
        updatedByEmail: cached.updatedByEmail,
      };
    }
  }

  try {
    const activePolicy = await fetchActiveModelPricingPolicy();
    runtimePolicyCache = {
      expiresAtMs: nowMs + resolveControlPlaneCacheTtlMs(controlPlaneCacheTtlMs),
      value: activePolicy,
    };
    if (activePolicy) {
      return {
        policy: activePolicy.activePolicy,
        activePolicyVersion: activePolicy.activePolicyVersion,
        activePolicyVersionId: activePolicy.activePolicyVersionId,
        source: "control_plane",
        updatedAt: activePolicy.updatedAt,
        updatedByEmail: activePolicy.updatedByEmail,
      };
    }
  } catch {
    runtimePolicyCache = {
      expiresAtMs: nowMs + resolveControlPlaneCacheTtlMs(controlPlaneCacheTtlMs),
      value: null,
    };
  }

  return {
    policy: getDefaultModelPricingPolicyDocument(),
    activePolicyVersion: null,
    activePolicyVersionId: null,
    source: "fallback",
    updatedAt: null,
    updatedByEmail: null,
  };
};

export const applyModelPricingPolicy = async ({
  policy,
  note,
  reason,
  actorUserId,
  actorEmail,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  policy: ModelPricingPolicyDocument;
  note?: string | null;
  reason?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  supabaseAdmin?: SupabaseClient;
}): Promise<ModelPricingPolicyMutationResult> => {
  const { data, error } = await supabaseAdmin.rpc("apply_model_pricing_policy", {
    p_policy: compactModelPricingPolicyDocument(policy),
    p_note: note ?? null,
    p_reason: reason ?? null,
    p_actor_user_id: actorUserId ?? null,
    p_actor_email: actorEmail ?? null,
    p_source: "admin_api",
  });
  if (error) {
    throw new Error(error.message || "Failed to apply model pricing policy.");
  }
  clearRuntimeModelPricingPolicyCacheForTests();
  return mapMutationResult(normalizeRpcRow(data), "rejected");
};

export const rollbackModelPricingPolicy = async ({
  reason,
  actorUserId,
  actorEmail,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  reason?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  supabaseAdmin?: SupabaseClient;
}): Promise<ModelPricingPolicyMutationResult> => {
  const { data, error } = await supabaseAdmin.rpc("rollback_model_pricing_policy", {
    p_reason: reason ?? null,
    p_actor_user_id: actorUserId ?? null,
    p_actor_email: actorEmail ?? null,
    p_source: "admin_api",
  });
  if (error) {
    throw new Error(error.message || "Failed to rollback model pricing policy.");
  }
  clearRuntimeModelPricingPolicyCacheForTests();
  return mapMutationResult(normalizeRpcRow(data), "rejected");
};
