import { normalizePlanId } from "./catalog";

export const BYTES_PER_MIB = 1024 * 1024;
export const BYTES_PER_GIB = 1024 * 1024 * 1024;

const DEFAULT_PLAN_STORAGE_LIMITS: Record<string, number> = {
  free: 1 * BYTES_PER_GIB,
  media: 25 * BYTES_PER_GIB,
  studio: 100 * BYTES_PER_GIB,
  business: 500 * BYTES_PER_GIB,
};

export type MediaStorageQuotaSummary = {
  usedBytes: number;
  baseLimitBytes: number;
  addonLimitBytes: number;
  totalLimitBytes: number;
  remainingBytes: number;
  isOverLimit: boolean;
};

export const getDefaultPlanStorageLimitBytes = (planId: string | undefined | null): number =>
  DEFAULT_PLAN_STORAGE_LIMITS[normalizePlanId(planId)] ?? 0;

export const formatStorageBytes = (bytes: number): string => {
  const normalizedBytes = Math.max(0, Number.isFinite(bytes) ? bytes : 0);
  if (normalizedBytes >= BYTES_PER_GIB) {
    return `${(normalizedBytes / BYTES_PER_GIB).toFixed(1)} GB`;
  }
  return `${(normalizedBytes / BYTES_PER_MIB).toFixed(1)} MB`;
};

export const formatStorageUsageValue = (usedBytes: number, totalLimitBytes: number): string =>
  `${formatStorageBytes(usedBytes)} / ${formatStorageBytes(totalLimitBytes)}`;
