import {
  normalizeBillingPlanId,
  PLAN_STORAGE_LIMIT_BYTES_BY_ID,
} from "../../lib/billing/storageAddonEligibility";

export const BYTES_PER_MIB = 1024 * 1024;
export const BYTES_PER_GIB = 1024 * 1024 * 1024;

export type MediaStorageQuotaSummary = {
  usedBytes: number;
  baseLimitBytes: number;
  addonLimitBytes: number;
  totalLimitBytes: number;
  remainingBytes: number;
  isOverLimit: boolean;
};

export const getDefaultPlanStorageLimitBytes = (planId: string | undefined | null): number =>
  PLAN_STORAGE_LIMIT_BYTES_BY_ID[normalizeBillingPlanId(planId)] ?? 0;

export const formatStorageBytes = (bytes: number): string => {
  const normalizedBytes = Math.max(0, Number.isFinite(bytes) ? bytes : 0);
  if (normalizedBytes >= BYTES_PER_GIB) {
    const gibValue = normalizedBytes / BYTES_PER_GIB;
    return Number.isInteger(gibValue) ? `${gibValue} GB` : `${gibValue.toFixed(1)} GB`;
  }
  return `${(normalizedBytes / BYTES_PER_MIB).toFixed(1)} MB`;
};

export const formatStorageUsageValue = (usedBytes: number, totalLimitBytes: number): string =>
  `${formatStorageBytes(usedBytes)} / ${formatStorageBytes(totalLimitBytes)}`;
