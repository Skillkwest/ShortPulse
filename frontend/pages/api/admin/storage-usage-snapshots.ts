/**
 * Parked admin provider snapshot API.
 * Snapshot rows remain operator evidence only, and this route is inactive until reactivated.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type SnapshotSource = "manual" | "supabase_usage_page" | "supabase_export" | "api_import";

type StorageUsageSnapshotRequest = {
  snapshotMonth?: unknown;
  capturedAt?: unknown;
  source?: unknown;
  supabasePlan?: unknown;
  computePlan?: unknown;
  computeMonthlyCostCents?: unknown;
  storageUsedGb?: unknown;
  storageIncludedGb?: unknown;
  uncachedEgressGb?: unknown;
  cachedEgressGb?: unknown;
  uncachedEgressIncludedGb?: unknown;
  cachedEgressIncludedGb?: unknown;
  observedStorageOverageCostCents?: unknown;
  observedUncachedEgressOverageCostCents?: unknown;
  observedCachedEgressOverageCostCents?: unknown;
  notes?: unknown;
};

const SNAPSHOT_SOURCES = new Set<SnapshotSource>([
  "manual",
  "supabase_usage_page",
  "supabase_export",
  "api_import",
]);
const MAX_NOTES_LENGTH = 1000;
const ADMIN_STORAGE_SNAPSHOT_CAPTURE_ENABLED = false;
const ADMIN_STORAGE_DEACTIVATED_RESPONSE = {
  error: "Admin storage is currently deactivated.",
};

const normalizeText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const parseSource = (value: unknown): SnapshotSource | null => {
  const normalized = normalizeText(value);
  return normalized && SNAPSHOT_SOURCES.has(normalized as SnapshotSource)
    ? (normalized as SnapshotSource)
    : null;
};

const parseSnapshotMonth = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const monthMatch = normalized.match(/^(\d{4})-(\d{2})(?:-01)?$/);
  if (!monthMatch) return null;
  const month = Number(monthMatch[2]);
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  return `${monthMatch[1]}-${monthMatch[2]}-01`;
};

const parseIsoDate = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

const parseNonnegativeNumber = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
};

const parseNonnegativeInteger = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : null;
};

const parseOptionalNonnegativeInteger = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  return parseNonnegativeInteger(value);
};

const hasOptionalValue = (value: unknown): boolean =>
  value !== null && value !== undefined && value !== "";

const parseNotes = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  return normalized.slice(0, MAX_NOTES_LENGTH);
};

const invalid = (res: NextApiResponse, error: string) => res.status(400).json({ error });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!ADMIN_STORAGE_SNAPSHOT_CAPTURE_ENABLED) {
    return res.status(410).json(ADMIN_STORAGE_DEACTIVATED_RESPONSE);
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/storage-usage-snapshots.auth",
    });
    return res.status(500).json({ error: "Unable to capture storage usage snapshot." });
  }
  if (!adminUser) return;

  const body = (req.body ?? {}) as StorageUsageSnapshotRequest;
  const snapshotMonth = parseSnapshotMonth(body.snapshotMonth);
  const capturedAt = parseIsoDate(body.capturedAt);
  const source = parseSource(body.source);
  const computePlan = normalizeText(body.computePlan) ?? "medium";
  const computeMonthlyCostCents = parseNonnegativeInteger(body.computeMonthlyCostCents);
  const storageUsedGb = parseNonnegativeNumber(body.storageUsedGb);
  const storageIncludedGb = parseNonnegativeNumber(body.storageIncludedGb);
  const uncachedEgressGb = parseNonnegativeNumber(body.uncachedEgressGb);
  const cachedEgressGb = parseNonnegativeNumber(body.cachedEgressGb);
  const uncachedEgressIncludedGb = parseNonnegativeNumber(body.uncachedEgressIncludedGb);
  const cachedEgressIncludedGb = parseNonnegativeNumber(body.cachedEgressIncludedGb);
  const observedStorageOverageCostCents = parseOptionalNonnegativeInteger(
    body.observedStorageOverageCostCents
  );
  const observedUncachedEgressOverageCostCents = parseOptionalNonnegativeInteger(
    body.observedUncachedEgressOverageCostCents
  );
  const observedCachedEgressOverageCostCents = parseOptionalNonnegativeInteger(
    body.observedCachedEgressOverageCostCents
  );

  if (!snapshotMonth) return invalid(res, "snapshotMonth must be a YYYY-MM value.");
  if (!capturedAt) return invalid(res, "capturedAt must be a valid date.");
  if (!source) return invalid(res, "source must be a supported snapshot source.");
  if (computeMonthlyCostCents === null) {
    return invalid(res, "computeMonthlyCostCents must be a nonnegative integer.");
  }
  if (storageUsedGb === null) return invalid(res, "storageUsedGb must be a nonnegative number.");
  if (storageIncludedGb === null) {
    return invalid(res, "storageIncludedGb must be a nonnegative number.");
  }
  if (uncachedEgressGb === null) {
    return invalid(res, "uncachedEgressGb must be a nonnegative number.");
  }
  if (cachedEgressGb === null) {
    return invalid(res, "cachedEgressGb must be a nonnegative number.");
  }
  if (uncachedEgressIncludedGb === null) {
    return invalid(res, "uncachedEgressIncludedGb must be a nonnegative number.");
  }
  if (cachedEgressIncludedGb === null) {
    return invalid(res, "cachedEgressIncludedGb must be a nonnegative number.");
  }
  if (
    hasOptionalValue(body.observedStorageOverageCostCents) &&
    observedStorageOverageCostCents === null
  ) {
    return invalid(res, "observedStorageOverageCostCents must be a nonnegative integer.");
  }
  if (
    hasOptionalValue(body.observedUncachedEgressOverageCostCents) &&
    observedUncachedEgressOverageCostCents === null
  ) {
    return invalid(res, "observedUncachedEgressOverageCostCents must be a nonnegative integer.");
  }
  if (
    hasOptionalValue(body.observedCachedEgressOverageCostCents) &&
    observedCachedEgressOverageCostCents === null
  ) {
    return invalid(res, "observedCachedEgressOverageCostCents must be a nonnegative integer.");
  }

  const row = {
    snapshot_month: snapshotMonth,
    captured_at: capturedAt,
    source,
    supabase_plan: normalizeText(body.supabasePlan),
    compute_plan: computePlan,
    compute_monthly_cost_cents: computeMonthlyCostCents,
    storage_used_gb: storageUsedGb,
    storage_included_gb: storageIncludedGb,
    uncached_egress_gb: uncachedEgressGb,
    cached_egress_gb: cachedEgressGb,
    uncached_egress_included_gb: uncachedEgressIncludedGb,
    cached_egress_included_gb: cachedEgressIncludedGb,
    observed_storage_overage_cost_cents: observedStorageOverageCostCents,
    observed_uncached_egress_overage_cost_cents: observedUncachedEgressOverageCostCents,
    observed_cached_egress_overage_cost_cents: observedCachedEgressOverageCostCents,
    notes: parseNotes(body.notes),
  };

  try {
    const insertResult = await getSupabaseAdmin()
      .from("admin_storage_usage_snapshots")
      .insert(row)
      .select(
        "id, snapshot_month, captured_at, source, supabase_plan, compute_plan, compute_monthly_cost_cents"
      )
      .single();

    if (insertResult.error) {
      throw new Error(insertResult.error.message || "Unable to capture storage usage snapshot.");
    }

    return res.status(200).json({
      ok: true,
      snapshot: insertResult.data,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/storage-usage-snapshots",
      user: adminUser,
    });
    return res.status(500).json({ error: "Unable to capture storage usage snapshot." });
  }
}
