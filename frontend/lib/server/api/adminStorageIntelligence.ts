/**
 * Builds admin-only storage intelligence rows from aggregate, browser-safe sources.
 */
import { BYTES_PER_GIB } from "../../billing/storageAddonEligibility";
import type {
  AdminStorageAccountHealth,
  AdminStorageAccountHealthRow,
  AdminStorageAccountOpportunityType,
  AdminStorageEconomicsFunnel,
  AdminStorageEvidenceRow,
  AdminStorageLifecycleAction,
  AdminStorageLifecycleHealth,
  AdminStorageLifecycleRow,
  AdminStorageProviderUsage,
  AdminStorageTrend,
} from "../../../features/admin/types";

export type AdminStorageAccountHealthInput = {
  userId: string;
  planId: string;
  baseLimitBytes: number;
  addonLimitBytes: number;
  trackedBytes: number;
  activeAddons: unknown[];
};

type QueryResult<T> = {
  data: T[] | null;
  error: { message?: string } | null;
};

type LifecycleSummaryRpcRow = {
  manifest_action?: unknown;
  manifest_reason?: unknown;
  safe_path_class?: unknown;
  object_count?: unknown;
  objects_missing_size_metadata?: unknown;
  total_mb?: unknown;
  oldest_object_created_at?: unknown;
  newest_object_created_at?: unknown;
  youngest_age_days?: unknown;
  oldest_age_days?: unknown;
};

type RpcCapableClient = {
  rpc?: (
    functionName: string,
    params: Record<string, unknown>
  ) => Promise<QueryResult<LifecycleSummaryRpcRow>>;
};

type StorageEvidenceSource = "live_storage_metadata" | "product_tracked";

const toCount = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
};

const toNullableNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const textOr = (value: unknown, fallback: string): string =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

const nullableText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const usagePct = (trackedBytes: number, limitBytes: number): number | null => {
  if (limitBytes <= 0) return trackedBytes > 0 ? null : 0;
  return (trackedBytes / limitBytes) * 100;
};

const opportunityDetails = (types: AdminStorageAccountOpportunityType[]): string => {
  if (types.includes("over_quota")) return "Account is over its tracked storage limit.";
  if (types.includes("near_quota")) return "Account is near its tracked storage limit.";
  if (types.includes("addon_opportunity")) return "High tracked usage without an active add-on.";
  if (types.includes("addon_underused")) return "Active add-on has low tracked usage so far.";
  if (types.includes("baseline_usage"))
    return "Tracked storage exists without a base/add-on limit.";
  return "Top tracked storage account.";
};

const buildAccountHealthRow = (
  account: AdminStorageAccountHealthInput
): AdminStorageAccountHealthRow => {
  const limitBytes = account.baseLimitBytes + account.addonLimitBytes;
  const pct = usagePct(account.trackedBytes, limitBytes);
  const opportunityTypes: AdminStorageAccountOpportunityType[] = ["top_storage"];
  if (limitBytes <= 0 && account.trackedBytes > 0) opportunityTypes.push("baseline_usage");
  if (limitBytes > 0 && account.trackedBytes > limitBytes) opportunityTypes.push("over_quota");
  if (pct !== null && pct >= 80 && account.trackedBytes <= limitBytes)
    opportunityTypes.push("near_quota");
  if (account.trackedBytes >= 0.8 * BYTES_PER_GIB && account.activeAddons.length === 0) {
    opportunityTypes.push("addon_opportunity");
  }
  if (account.activeAddons.length > 0 && limitBytes > 0 && pct !== null && pct < 10) {
    opportunityTypes.push("addon_underused");
  }

  return {
    userId: account.userId,
    userEmail: null,
    planId: account.planId,
    trackedBytes: account.trackedBytes,
    totalLimitBytes: limitBytes,
    usagePct: pct,
    activeAddonCount: account.activeAddons.length,
    opportunityTypes,
    details: opportunityDetails(opportunityTypes),
  };
};

/**
 * Builds browser-safe account decision rows from already-loaded admin storage state.
 */
export const buildAdminStorageAccountHealth = (
  accounts: AdminStorageAccountHealthInput[]
): AdminStorageAccountHealth => {
  const rows = accounts
    .filter((account) => account.trackedBytes > 0)
    .map(buildAccountHealthRow)
    .sort((left, right) => right.trackedBytes - left.trackedBytes);

  return {
    topStorageAccounts: rows.slice(0, 10),
    quotaPressureAccounts: rows
      .filter(
        (row) =>
          row.opportunityTypes.includes("over_quota") ||
          row.opportunityTypes.includes("near_quota") ||
          row.opportunityTypes.includes("baseline_usage")
      )
      .slice(0, 10),
    addonOpportunityAccounts: rows
      .filter(
        (row) =>
          row.opportunityTypes.includes("addon_opportunity") ||
          row.opportunityTypes.includes("addon_underused")
      )
      .slice(0, 10),
  };
};

const normalizeLifecycleAction = (value: unknown): AdminStorageLifecycleAction => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (raw === "protected" || raw === "delete_candidate" || raw === "manual_review_required") {
    return raw;
  }
  if (raw === "integrity_problem") return "integrity_problem";
  return "unknown";
};

const toLifecycleRow = (row: LifecycleSummaryRpcRow): AdminStorageLifecycleRow => ({
  manifestAction: normalizeLifecycleAction(row.manifest_action),
  manifestReason: textOr(row.manifest_reason, "unknown"),
  safePathClass: textOr(row.safe_path_class, "unknown"),
  objectCount: toCount(row.object_count),
  objectsMissingSizeMetadata: toCount(row.objects_missing_size_metadata),
  totalMb: toNumber(row.total_mb),
  oldestObjectCreatedAt: nullableText(row.oldest_object_created_at),
  newestObjectCreatedAt: nullableText(row.newest_object_created_at),
  youngestAgeDays: toNullableNumber(row.youngest_age_days),
  oldestAgeDays: toNullableNumber(row.oldest_age_days),
});

const buildLifecycleHealthFromRows = (
  rows: AdminStorageLifecycleRow[],
  cleanupTtlDays: number
): AdminStorageLifecycleHealth => {
  const totals = rows.reduce(
    (acc, row) => {
      acc.totalObjectCount += row.objectCount;
      acc.totalMb += row.totalMb;
      if (row.manifestAction === "delete_candidate") {
        acc.deleteCandidateObjectCount += row.objectCount;
        acc.deleteCandidateMb += row.totalMb;
      } else if (row.manifestAction === "manual_review_required") {
        acc.manualReviewObjectCount += row.objectCount;
        acc.manualReviewMb += row.totalMb;
      } else if (row.manifestAction === "integrity_problem") {
        acc.integrityProblemObjectCount += row.objectCount;
        acc.integrityProblemMb += row.totalMb;
      } else {
        acc.protectedObjectCount += row.objectCount;
        acc.protectedMb += row.totalMb;
      }
      return acc;
    },
    {
      totalObjectCount: 0,
      totalMb: 0,
      protectedObjectCount: 0,
      protectedMb: 0,
      deleteCandidateObjectCount: 0,
      deleteCandidateMb: 0,
      manualReviewObjectCount: 0,
      manualReviewMb: 0,
      integrityProblemObjectCount: 0,
      integrityProblemMb: 0,
    }
  );

  return {
    source: "lifecycle_rpc",
    status: "current",
    cleanupTtlDays,
    ...totals,
    rows: rows
      .sort((left, right) => right.totalMb - left.totalMb || right.objectCount - left.objectCount)
      .slice(0, 12),
    reason: null,
  };
};

const unavailableLifecycleHealth = (reason: string): AdminStorageLifecycleHealth => ({
  source: "unavailable",
  status: "unavailable",
  cleanupTtlDays: null,
  totalObjectCount: 0,
  totalMb: 0,
  protectedObjectCount: 0,
  protectedMb: 0,
  deleteCandidateObjectCount: 0,
  deleteCandidateMb: 0,
  manualReviewObjectCount: 0,
  manualReviewMb: 0,
  integrityProblemObjectCount: 0,
  integrityProblemMb: 0,
  rows: [],
  reason,
});

/**
 * Loads aggregate lifecycle health without exposing raw paths, user ids, or signed URLs.
 */
export const loadAdminStorageLifecycleHealth = async (
  supabaseAdmin: unknown
): Promise<AdminStorageLifecycleHealth> => {
  const rpcClient = supabaseAdmin as RpcCapableClient;
  if (typeof rpcClient.rpc !== "function") {
    return unavailableLifecycleHealth("Lifecycle summary RPC is not available in this runtime.");
  }

  try {
    const result = await rpcClient.rpc("get_media_storage_lifecycle_summary", {
      p_cleanup_ttl_days: 7,
    });
    if (result.error) {
      return unavailableLifecycleHealth(
        result.error.message || "Lifecycle summary RPC returned an error."
      );
    }
    const rows = Array.isArray(result.data) ? result.data.map(toLifecycleRow) : [];
    return buildLifecycleHealthFromRows(rows, 7);
  } catch (error) {
    return unavailableLifecycleHealth(
      error instanceof Error ? error.message : "Lifecycle summary RPC failed."
    );
  }
};

export const buildAdminStorageTrend = (): AdminStorageTrend => ({
  source: "unavailable",
  status: "unavailable",
  snapshots: [],
  reason: "Historical aggregate storage snapshots are not wired yet.",
});

/**
 * Describes metric authority so the admin UI can show what each number proves.
 */
export const buildAdminStorageEvidenceRows = ({
  storageSource,
  providerUsage,
  hasProviderSnapshot,
  funnel,
  lifecycleHealth,
}: {
  storageSource: StorageEvidenceSource;
  providerUsage: AdminStorageProviderUsage;
  hasProviderSnapshot: boolean;
  funnel: AdminStorageEconomicsFunnel;
  lifecycleHealth: AdminStorageLifecycleHealth;
}): AdminStorageEvidenceRow[] => [
  {
    metricKey: "product_tracked_storage",
    label: "Product-tracked storage",
    source: "product_tracked",
    status: "current",
    capturedAt: null,
    details: "Summed from media_files.file_size and used for customer quota decisions.",
  },
  {
    metricKey: "provider_storage",
    label: "Provider storage",
    source: storageSource,
    status: providerUsage.status === "unavailable" ? "unavailable" : providerUsage.status,
    capturedAt: providerUsage.capturedAt,
    details:
      storageSource === "live_storage_metadata"
        ? "Summed from Supabase storage.objects metadata through the admin service-role client."
        : "Using product-tracked bytes because storage.objects metadata was not readable.",
  },
  {
    metricKey: "provider_egress",
    label: "Provider egress and overage",
    source: hasProviderSnapshot ? "provider_snapshot" : "configured_estimate",
    status:
      providerUsage.status === "unavailable"
        ? "unavailable"
        : hasProviderSnapshot
          ? providerUsage.status
          : "estimated",
    capturedAt: providerUsage.capturedAt,
    details: hasProviderSnapshot
      ? "Latest admin provider snapshot row supplies egress, included quota, and observed overage evidence."
      : "Egress uses configured defaults because no provider snapshot row is available.",
  },
  {
    metricKey: "addon_revenue",
    label: "Storage add-on MRR",
    source: "local_billing_rows",
    status: "current",
    capturedAt: null,
    details: "Computed from current local subscription storage add-on rows and catalog offers.",
  },
  {
    metricKey: "addon_funnel",
    label: "Storage add-on funnel",
    source: funnel.source === "app_error_events" ? "app_error_events" : "unavailable",
    status: funnel.source === "app_error_events" ? "current" : "unavailable",
    capturedAt: null,
    details: "Sanitized storage add-on telemetry only; no payment details or storage paths.",
  },
  {
    metricKey: "lifecycle_health",
    label: "Lifecycle health",
    source: lifecycleHealth.source,
    status: lifecycleHealth.status,
    capturedAt: null,
    details:
      lifecycleHealth.source === "lifecycle_rpc"
        ? "Aggregate dry-run lifecycle classes from service-role-only diagnostics."
        : (lifecycleHealth.reason ?? "Lifecycle health is unavailable."),
  },
];
