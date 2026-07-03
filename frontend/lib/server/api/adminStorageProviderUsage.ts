/**
 * Resolves provider-side Supabase usage snapshots for the Admin Storage economics surface.
 * Snapshot rows are operator evidence for bill pressure; they do not control customer entitlements.
 */
import type {
  AdminStorageEconomicsAssumptions,
  AdminStorageProviderUsage,
} from "../../../features/admin/types";

export type AdminStorageUsageSnapshotRow = {
  snapshot_month: string | null;
  captured_at: string | null;
  source: string | null;
  supabase_plan: string | null;
  compute_plan: string | null;
  compute_monthly_cost_cents: number | null;
  storage_used_gb: number | string | null;
  storage_included_gb: number | string | null;
  uncached_egress_gb: number | string | null;
  cached_egress_gb: number | string | null;
  uncached_egress_included_gb: number | string | null;
  cached_egress_included_gb: number | string | null;
  observed_storage_overage_cost_cents: number | null;
  observed_uncached_egress_overage_cost_cents: number | null;
  observed_cached_egress_overage_cost_cents: number | null;
  notes: string | null;
};

const PROVIDER_USAGE_STALE_DAYS = 14;

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const toCount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};

const toTextOrNull = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const pct = (used: number, included: number): number | null =>
  included > 0 ? (used / included) * 100 : null;

const toIsoDate = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const toSnapshotMonth = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const projectMonthEndGb = (
  valueGb: number,
  snapshotMonth: string | null,
  capturedAt: string | null
): number | null => {
  if (!snapshotMonth || !capturedAt) return null;
  const monthStart = new Date(`${snapshotMonth}T00:00:00.000Z`);
  const captured = new Date(capturedAt);
  if (Number.isNaN(monthStart.getTime()) || Number.isNaN(captured.getTime())) return null;
  if (
    captured.getUTCFullYear() !== monthStart.getUTCFullYear() ||
    captured.getUTCMonth() !== monthStart.getUTCMonth()
  ) {
    return valueGb;
  }
  const elapsedDays = Math.max(1, captured.getUTCDate());
  const daysInMonth = new Date(
    monthStart.getUTCFullYear(),
    monthStart.getUTCMonth() + 1,
    0
  ).getUTCDate();
  return (valueGb / elapsedDays) * daysInMonth;
};

const sourceForRow = (value: string | null): AdminStorageProviderUsage["source"] => {
  if (
    value === "manual" ||
    value === "supabase_usage_page" ||
    value === "supabase_export" ||
    value === "api_import"
  ) {
    return value;
  }
  return "unavailable";
};

const estimateStorageOverageCostCents = (
  usedGb: number,
  includedGb: number,
  assumptions: AdminStorageEconomicsAssumptions
): number => Math.round(Math.max(0, usedGb - includedGb) * assumptions.storageCostPerGbMonth * 100);

const estimateEgressOverageCostCents = (
  usedGb: number,
  includedGb: number,
  costPerGb: number
): number => Math.round(Math.max(0, usedGb - includedGb) * costPerGb * 100);

/**
 * Builds the provider usage payload consumed by /admin/storage.
 */
export const buildAdminStorageProviderUsage = ({
  row,
  assumptions,
  productTrackedBytes,
  now = new Date(),
}: {
  row: AdminStorageUsageSnapshotRow | null;
  assumptions: AdminStorageEconomicsAssumptions;
  productTrackedBytes: number;
  now?: Date;
}): AdminStorageProviderUsage => {
  if (!row) {
    return {
      status: "unavailable",
      source: "unavailable",
      snapshotMonth: null,
      capturedAt: null,
      supabasePlan: null,
      computePlan: assumptions.computePlan,
      computeMonthlyCostCents: assumptions.computeMonthlyCostCents,
      storageUsedGb: 0,
      storageIncludedGb: 0,
      storageQuotaUsedPct: null,
      projectedStorageUsedGb: null,
      uncachedEgressGb: 0,
      cachedEgressGb: 0,
      totalEgressGb: 0,
      uncachedEgressIncludedGb: 0,
      cachedEgressIncludedGb: 0,
      uncachedEgressQuotaUsedPct: null,
      cachedEgressQuotaUsedPct: null,
      projectedUncachedEgressGb: null,
      projectedCachedEgressGb: null,
      egressMultiple: null,
      estimatedStorageOverageCostCents: 0,
      estimatedUncachedEgressOverageCostCents: 0,
      estimatedCachedEgressOverageCostCents: 0,
      estimatedTotalOverageCostCents: 0,
      observedTotalOverageCostCents: null,
      notes: null,
    };
  }

  const snapshotMonth = toSnapshotMonth(row.snapshot_month);
  const capturedAt = toIsoDate(row.captured_at);
  const capturedMs = capturedAt ? Date.parse(capturedAt) : Number.NaN;
  const staleCutoffMs = PROVIDER_USAGE_STALE_DAYS * 24 * 60 * 60 * 1000;
  const status =
    Number.isFinite(capturedMs) && now.getTime() - capturedMs <= staleCutoffMs
      ? "current"
      : "stale";
  const storageUsedGb = toNumber(row.storage_used_gb);
  const storageIncludedGb = toNumber(row.storage_included_gb);
  const uncachedEgressGb = toNumber(row.uncached_egress_gb);
  const cachedEgressGb = toNumber(row.cached_egress_gb);
  const totalEgressGb = uncachedEgressGb + cachedEgressGb;
  const uncachedEgressIncludedGb = toNumber(row.uncached_egress_included_gb);
  const cachedEgressIncludedGb = toNumber(row.cached_egress_included_gb);
  const estimatedStorageOverageCostCents = estimateStorageOverageCostCents(
    storageUsedGb,
    storageIncludedGb,
    assumptions
  );
  const estimatedUncachedEgressOverageCostCents = estimateEgressOverageCostCents(
    uncachedEgressGb,
    uncachedEgressIncludedGb,
    assumptions.uncachedEgressCostPerGb
  );
  const estimatedCachedEgressOverageCostCents = estimateEgressOverageCostCents(
    cachedEgressGb,
    cachedEgressIncludedGb,
    assumptions.cachedEgressCostPerGb
  );
  const observedTotalOverageCostCents =
    row.observed_storage_overage_cost_cents == null &&
    row.observed_uncached_egress_overage_cost_cents == null &&
    row.observed_cached_egress_overage_cost_cents == null
      ? null
      : toCount(row.observed_storage_overage_cost_cents) +
        toCount(row.observed_uncached_egress_overage_cost_cents) +
        toCount(row.observed_cached_egress_overage_cost_cents);
  const trackedGb = productTrackedBytes > 0 ? productTrackedBytes / (1024 * 1024 * 1024) : 0;

  return {
    status,
    source: sourceForRow(row.source),
    snapshotMonth,
    capturedAt,
    supabasePlan: toTextOrNull(row.supabase_plan),
    computePlan: toTextOrNull(row.compute_plan) ?? assumptions.computePlan,
    computeMonthlyCostCents: toCount(row.compute_monthly_cost_cents),
    storageUsedGb,
    storageIncludedGb,
    storageQuotaUsedPct: pct(storageUsedGb, storageIncludedGb),
    projectedStorageUsedGb: projectMonthEndGb(storageUsedGb, snapshotMonth, capturedAt),
    uncachedEgressGb,
    cachedEgressGb,
    totalEgressGb,
    uncachedEgressIncludedGb,
    cachedEgressIncludedGb,
    uncachedEgressQuotaUsedPct: pct(uncachedEgressGb, uncachedEgressIncludedGb),
    cachedEgressQuotaUsedPct: pct(cachedEgressGb, cachedEgressIncludedGb),
    projectedUncachedEgressGb: projectMonthEndGb(uncachedEgressGb, snapshotMonth, capturedAt),
    projectedCachedEgressGb: projectMonthEndGb(cachedEgressGb, snapshotMonth, capturedAt),
    egressMultiple: trackedGb > 0 ? totalEgressGb / trackedGb : null,
    estimatedStorageOverageCostCents,
    estimatedUncachedEgressOverageCostCents,
    estimatedCachedEgressOverageCostCents,
    estimatedTotalOverageCostCents:
      estimatedStorageOverageCostCents +
      estimatedUncachedEgressOverageCostCents +
      estimatedCachedEgressOverageCostCents,
    observedTotalOverageCostCents,
    notes: toTextOrNull(row.notes),
  };
};
