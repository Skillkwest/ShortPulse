/**
 * Shared recurring storage entitlement and add-on eligibility rules.
 * Keep this matrix in sync with the billing catalog guardrails before exposing new add-ons.
 */
export const BYTES_PER_GIB = 1024 * 1024 * 1024;

export const PLAN_STORAGE_LIMIT_BYTES_BY_ID: Record<string, number> = {
  free: 0,
  starter: 5 * BYTES_PER_GIB,
  media: 25 * BYTES_PER_GIB,
  studio: 75 * BYTES_PER_GIB,
  business: 150 * BYTES_PER_GIB,
};

export const normalizeBillingPlanId = (planId: string | null | undefined): string => {
  const normalizedPlanId = typeof planId === "string" ? planId.trim().toLowerCase() : "";
  return PLAN_STORAGE_LIMIT_BYTES_BY_ID[normalizedPlanId] != null ? normalizedPlanId : "free";
};

export const SELF_SERVE_STORAGE_ADDON_IDS = [
  "storage_10gb",
  "storage_50gb",
  "storage_100gb",
  "storage_250gb",
] as const;

export const MANUAL_REVIEW_STORAGE_ADDON_IDS = ["storage_500gb"] as const;
export const CURRENT_BILLABLE_STORAGE_ADDON_STATUSES = [
  "active",
  "trialing",
  "past_due",
  "unpaid",
] as const;

const SELF_SERVE_STORAGE_ADDONS_BY_PLAN: Record<string, readonly string[]> = {
  starter: ["storage_10gb"],
  media: ["storage_10gb", "storage_50gb"],
  studio: ["storage_10gb", "storage_50gb", "storage_100gb"],
  business: ["storage_10gb", "storage_50gb", "storage_100gb", "storage_250gb"],
};

export const STORAGE_ADDON_LIMIT_BYTES_BY_ID: Record<string, number> = {
  storage_25gb: 25 * BYTES_PER_GIB,
  storage_10gb: 10 * BYTES_PER_GIB,
  storage_50gb: 50 * BYTES_PER_GIB,
  storage_100gb: 100 * BYTES_PER_GIB,
  storage_250gb: 250 * BYTES_PER_GIB,
  storage_500gb: 500 * BYTES_PER_GIB,
};

export type StorageAddonEligibilityReason =
  | "paid_plan_required"
  | "manual_review_required"
  | "unknown_storage_addon"
  | "plan_ineligible"
  | null;

export type StorageAddonEligibility = {
  isPaidPlan: boolean;
  isKnownStorageAddon: boolean;
  isManualReviewOnly: boolean;
  isSelfServe: boolean;
  isEligible: boolean;
  allowedAddonIds: string[];
  maxSelfServeStorageBytes: number;
  reason: StorageAddonEligibilityReason;
};

export const normalizeStorageAddonId = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const isCurrentBillableStorageAddonStatus = (status: string | null | undefined): boolean => {
  return CURRENT_BILLABLE_STORAGE_ADDON_STATUSES.includes(
    String(status ?? "").toLowerCase() as (typeof CURRENT_BILLABLE_STORAGE_ADDON_STATUSES)[number]
  );
};

export const isPaidStorageAddonPlan = (planId: string | null | undefined): boolean => {
  const normalizedPlanId = normalizeBillingPlanId(planId);
  return normalizedPlanId !== "free";
};

export const isSelfServeStorageAddon = (storageAddonId: string | null | undefined): boolean =>
  SELF_SERVE_STORAGE_ADDON_IDS.includes(
    normalizeStorageAddonId(storageAddonId) as (typeof SELF_SERVE_STORAGE_ADDON_IDS)[number]
  );

export const isManualReviewStorageAddon = (storageAddonId: string | null | undefined): boolean =>
  MANUAL_REVIEW_STORAGE_ADDON_IDS.includes(
    normalizeStorageAddonId(storageAddonId) as (typeof MANUAL_REVIEW_STORAGE_ADDON_IDS)[number]
  );

export const getAllowedSelfServeStorageAddonIds = (planId: string | null | undefined): string[] => {
  const normalizedPlanId = normalizeBillingPlanId(planId);
  return [...(SELF_SERVE_STORAGE_ADDONS_BY_PLAN[normalizedPlanId] ?? [])];
};

export const getMaximumSelfServeStorageAddonBytes = (planId: string | null | undefined): number => {
  return getAllowedSelfServeStorageAddonIds(planId).reduce(
    (maxBytes, storageAddonId) =>
      Math.max(maxBytes, STORAGE_ADDON_LIMIT_BYTES_BY_ID[storageAddonId] ?? 0),
    0
  );
};

export const resolveStorageAddonEligibility = ({
  planId,
  storageAddonId,
}: {
  planId: string | null | undefined;
  storageAddonId: string | null | undefined;
}): StorageAddonEligibility => {
  const normalizedStorageAddonId = normalizeStorageAddonId(storageAddonId);
  const allowedAddonIds = getAllowedSelfServeStorageAddonIds(planId);
  const isPaidPlan = isPaidStorageAddonPlan(planId);
  const isManualReviewOnly = isManualReviewStorageAddon(normalizedStorageAddonId);
  const isSelfServe = isSelfServeStorageAddon(normalizedStorageAddonId);
  const isKnownStorageAddon = isSelfServe || isManualReviewOnly;
  const isEligible =
    isPaidPlan && isSelfServe && allowedAddonIds.includes(normalizedStorageAddonId);
  const maxSelfServeStorageBytes = getMaximumSelfServeStorageAddonBytes(planId);

  let reason: StorageAddonEligibilityReason = null;
  if (!isPaidPlan) {
    reason = "paid_plan_required";
  } else if (isManualReviewOnly) {
    reason = "manual_review_required";
  } else if (!isKnownStorageAddon) {
    reason = "unknown_storage_addon";
  } else if (!isEligible) {
    reason = "plan_ineligible";
  }

  return {
    isPaidPlan,
    isKnownStorageAddon,
    isManualReviewOnly,
    isSelfServe,
    isEligible,
    allowedAddonIds,
    maxSelfServeStorageBytes,
    reason,
  };
};
