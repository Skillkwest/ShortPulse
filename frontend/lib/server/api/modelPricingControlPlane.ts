/**
 * Server-side helper seam for model pricing control-plane access.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  compactAdminPricingCustomRowsDocument,
  getDefaultAdminPricingCustomRowsDocument,
  type AdminPricingCustomRowsDocument,
} from "../../model-runtime/adminPricingCustomRows";
import {
  compactModelPricingPolicyDocument,
  getDefaultModelPricingPolicyDocument,
  type ModelPricingPolicyDocument,
} from "../../model-runtime/pricingPolicy";
import { materializeImageBilledCreditPolicy } from "../../model-runtime/materializeImageBilledCreditPolicy";
import { getSupabaseAdmin } from "./supabaseAdmin";

export type ActiveModelPricingPolicy = {
  activePolicyVersion: number;
  activePolicyVersionId: number;
  activePolicy: ModelPricingPolicyDocument;
  activeCustomRows: AdminPricingCustomRowsDocument;
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
  activePolicy: ModelPricingPolicyDocument | null;
  activeCustomRows: AdminPricingCustomRowsDocument | null;
  activePolicyUpdatedAt: string | null;
  activePolicyUpdatedByEmail: string | null;
  message: string | null;
};

export type RuntimeModelPricingPolicyResolution = {
  policy: ModelPricingPolicyDocument;
  customRows: AdminPricingCustomRowsDocument;
  activePolicyVersion: number | null;
  activePolicyVersionId: number | null;
  source: "control_plane";
  billingArtifactSource: "active_policy" | "legacy_v9_materialized";
  updatedAt: string | null;
  updatedByEmail: string | null;
};

const LEGACY_UNPUBLISHED_BILLING_POLICY_VERSION = 9;

export const resolveRuntimeBillingPolicyDocument = ({
  activePolicyVersion,
  activePolicy,
  activeCustomRows,
  requirePublishedBillingArtifact,
}: {
  activePolicyVersion: number;
  activePolicy: ModelPricingPolicyDocument;
  activeCustomRows: AdminPricingCustomRowsDocument;
  requirePublishedBillingArtifact: boolean;
}): Pick<RuntimeModelPricingPolicyResolution, "policy" | "billingArtifactSource"> => {
  if (
    requirePublishedBillingArtifact &&
    activePolicyVersion === LEGACY_UNPUBLISHED_BILLING_POLICY_VERSION
  ) {
    return {
      policy: materializeImageBilledCreditPolicy(activePolicy, activeCustomRows, {
        requireComplete: true,
      }),
      billingArtifactSource: "legacy_v9_materialized",
    };
  }
  return {
    policy: activePolicy,
    billingArtifactSource: "active_policy",
  };
};

type ModelPricingPolicyVersionRow = {
  id: number;
  version: number;
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
const APPLY_MODEL_PRICING_POLICY_RPC = "apply_model_pricing_policy";

const isApplyPolicyRpcSignatureMissError = (
  error: { message?: string; code?: string } | null
): boolean => {
  if (!error) return false;
  const normalizedCode = String(error.code ?? "").toUpperCase();
  return (
    normalizedCode === "PGRST202" ||
    normalizedCode === "42883" ||
    String(error.message ?? "").includes("apply_model_pricing_policy")
  );
};

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
    activeCustomRows: compactAdminPricingCustomRowsDocument(row.active_custom_rows),
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
  activePolicy: null,
  activeCustomRows: null,
  activePolicyUpdatedAt: null,
  activePolicyUpdatedByEmail: null,
  message: asNullableString(row?.message),
});

export const clearRuntimeModelPricingPolicyCacheForTests = (): void => {
  runtimePolicyCache = null;
};

export const ensureModelPricingControlPlaneInitialized = async ({
  supabaseAdmin = getSupabaseAdmin(),
  actorUserId = null,
  actorEmail = "system_seed",
}: {
  supabaseAdmin?: SupabaseClient;
  actorUserId?: string | null;
  actorEmail?: string | null;
} = {}): Promise<boolean> => {
  const existingRuntimeResult = await supabaseAdmin
    .from("model_pricing_policy_runtime")
    .select("singleton")
    .eq("singleton", true)
    .maybeSingle();

  if (existingRuntimeResult.error) {
    throw new Error(
      existingRuntimeResult.error.message || "Failed to inspect model pricing runtime row."
    );
  }
  if (existingRuntimeResult.data) return false;

  const latestVersionResult = await supabaseAdmin
    .from("model_pricing_policy_versions")
    .select("id, version")
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestVersionResult.error) {
    throw new Error(
      latestVersionResult.error.message || "Failed to inspect model pricing policy versions."
    );
  }

  let activeVersion = latestVersionResult.data as ModelPricingPolicyVersionRow | null;
  if (!activeVersion) {
    const insertVersionResult = await supabaseAdmin
      .from("model_pricing_policy_versions")
      .insert({
        version: 1,
        policy: getDefaultModelPricingPolicyDocument(),
        note: "baseline_seed_v1",
        created_by_user_id: actorUserId,
        created_by_email: actorEmail,
      })
      .select("id, version")
      .single();

    if (insertVersionResult.error) {
      throw new Error(
        insertVersionResult.error.message || "Failed to seed model pricing policy version."
      );
    }
    activeVersion = insertVersionResult.data as ModelPricingPolicyVersionRow;
  }

  const insertRuntimeResult = await supabaseAdmin.from("model_pricing_policy_runtime").upsert(
    {
      singleton: true,
      active_policy_version_id: activeVersion.id,
      last_known_safe_policy_version_id: activeVersion.id,
      updated_by_user_id: actorUserId,
      updated_by_email: actorEmail,
    },
    { onConflict: "singleton" }
  );

  if (insertRuntimeResult.error) {
    throw new Error(
      insertRuntimeResult.error.message || "Failed to seed model pricing runtime row."
    );
  }

  clearRuntimeModelPricingPolicyCacheForTests();
  return true;
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
  bypassCache = false,
  requirePublishedBillingArtifact = false,
}: {
  controlPlaneCacheTtlMs?: string | null;
  bypassCache?: boolean;
  requirePublishedBillingArtifact?: boolean;
} = {}): Promise<RuntimeModelPricingPolicyResolution> => {
  const hasAdminConfig =
    typeof process.env.NEXT_PUBLIC_SUPABASE_URL === "string" &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.trim().length > 0 &&
    typeof process.env.SUPABASE_SERVICE_ROLE_KEY === "string" &&
    process.env.SUPABASE_SERVICE_ROLE_KEY.trim().length > 0;
  if (!hasAdminConfig) {
    throw new Error("Model pricing control plane is not configured.");
  }

  const nowMs = Date.now();
  if (!bypassCache && runtimePolicyCache && runtimePolicyCache.expiresAtMs > nowMs) {
    const cached = runtimePolicyCache.value;
    if (cached) {
      const runtimePolicy = resolveRuntimeBillingPolicyDocument({
        activePolicyVersion: cached.activePolicyVersion,
        activePolicy: cached.activePolicy,
        activeCustomRows: cached.activeCustomRows,
        requirePublishedBillingArtifact,
      });
      return {
        policy: runtimePolicy.policy,
        customRows: cached.activeCustomRows,
        activePolicyVersion: cached.activePolicyVersion,
        activePolicyVersionId: cached.activePolicyVersionId,
        source: "control_plane",
        billingArtifactSource: runtimePolicy.billingArtifactSource,
        updatedAt: cached.updatedAt,
        updatedByEmail: cached.updatedByEmail,
      };
    }
  }

  let activePolicy = await fetchActiveModelPricingPolicy();
  if (!activePolicy) {
    await ensureModelPricingControlPlaneInitialized();
    activePolicy = await fetchActiveModelPricingPolicy();
  }
  runtimePolicyCache = {
    expiresAtMs: nowMs + resolveControlPlaneCacheTtlMs(controlPlaneCacheTtlMs),
    value: activePolicy,
  };
  if (!activePolicy) {
    throw new Error("No active model pricing policy is configured.");
  }
  const runtimePolicy = resolveRuntimeBillingPolicyDocument({
    activePolicyVersion: activePolicy.activePolicyVersion,
    activePolicy: activePolicy.activePolicy,
    activeCustomRows: activePolicy.activeCustomRows,
    requirePublishedBillingArtifact,
  });
  return {
    policy: runtimePolicy.policy,
    customRows: activePolicy.activeCustomRows,
    activePolicyVersion: activePolicy.activePolicyVersion,
    activePolicyVersionId: activePolicy.activePolicyVersionId,
    source: "control_plane",
    billingArtifactSource: runtimePolicy.billingArtifactSource,
    updatedAt: activePolicy.updatedAt,
    updatedByEmail: activePolicy.updatedByEmail,
  };
};

export const applyModelPricingPolicy = async ({
  policy,
  customRows = getDefaultAdminPricingCustomRowsDocument(),
  expectedActivePolicyVersionId,
  note,
  reason,
  actorUserId,
  actorEmail,
  supabaseAdmin = getSupabaseAdmin(),
}: {
  policy: ModelPricingPolicyDocument;
  customRows?: AdminPricingCustomRowsDocument;
  expectedActivePolicyVersionId: number;
  note?: string | null;
  reason?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  supabaseAdmin?: SupabaseClient;
}): Promise<ModelPricingPolicyMutationResult> => {
  const normalizedCustomRows = compactAdminPricingCustomRowsDocument(customRows);

  const applyPolicy = async () => {
    const { data, error } = await supabaseAdmin.rpc(APPLY_MODEL_PRICING_POLICY_RPC, {
      p_policy: compactModelPricingPolicyDocument(policy),
      p_custom_rows: normalizedCustomRows,
      p_expected_active_policy_version_id: expectedActivePolicyVersionId,
      p_note: note ?? null,
      p_reason: reason ?? null,
      p_actor_user_id: actorUserId ?? null,
      p_actor_email: actorEmail ?? null,
      p_source: "admin_api",
    });

    if (error) {
      if (isApplyPolicyRpcSignatureMissError(error)) {
        throw new Error(
          "Model pricing saves require the CAS control-plane SQL migration before they can be applied."
        );
      }
      throw new Error(error.message || "Failed to apply model pricing policy.");
    }
    return mapMutationResult(normalizeRpcRow(data), "rejected");
  };

  let result = await applyPolicy();
  if (result.status === "not_initialized") {
    await ensureModelPricingControlPlaneInitialized({
      supabaseAdmin,
      actorUserId: actorUserId ?? null,
      actorEmail: actorEmail ?? null,
    });
    result = await applyPolicy();
  }

  clearRuntimeModelPricingPolicyCacheForTests();
  if (result.status !== "activated") {
    return result;
  }

  const activePolicy = await fetchActiveModelPricingPolicy({ supabaseAdmin });
  return {
    ...result,
    activePolicy: activePolicy?.activePolicy ?? null,
    activeCustomRows: activePolicy?.activeCustomRows ?? null,
    activePolicyUpdatedAt: activePolicy?.updatedAt ?? null,
    activePolicyUpdatedByEmail: activePolicy?.updatedByEmail ?? null,
  };
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
