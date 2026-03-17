/**
 * Read-side report assembly for admin user-health fleet scans.
 */
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { parseFleetRunRow } from "./fleetPersistence";
import type {
  FleetFinding,
  FleetRiskBand,
  FleetRunRow,
  FleetSnapshotRecord,
  FleetSummary,
} from "./types";

export type FleetReadFilters = {
  runId?: string | null;
  page: number;
  perPage: number;
  severity: "all" | "critical" | "warning" | "info";
  findingCode: string;
  riskBand: "all" | FleetRiskBand;
  search: string;
};

export type FleetReadReport = {
  run: FleetRunRow | null;
  summary: FleetSummary;
  snapshots: FleetSnapshotRecord[];
  pagination: {
    page: number;
    perPage: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  health: {
    degraded: boolean;
    reason: string | null;
  };
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const toFleetRiskBand = (riskScore: number): FleetRiskBand => {
  if (riskScore >= 70) return "high";
  if (riskScore >= 40) return "medium";
  return "low";
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const emptySummary = (): FleetSummary => ({
  criticalCount: 0,
  warningCount: 0,
  infoCount: 0,
  highRiskCount: 0,
  mediumRiskCount: 0,
  lowRiskCount: 0,
  totalCostWithoutSuccessCents: 0,
  totalStuckGenerations: 0,
  totalExhaustedQueueRows: 0,
});

const emptyReport = (filters: FleetReadFilters): FleetReadReport => ({
  run: null,
  summary: emptySummary(),
  snapshots: [],
  pagination: {
    page: filters.page,
    perPage: filters.perPage,
    totalCount: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
  },
  health: {
    degraded: false,
    reason: null,
  },
});

const parseFinding = (row: Record<string, unknown>): FleetFinding => ({
  code: typeof row.code === "string" ? row.code : "UNKNOWN",
  severity:
    row.severity === "critical" || row.severity === "warning" || row.severity === "info"
      ? row.severity
      : "info",
  confidence:
    row.confidence === "high" || row.confidence === "medium" || row.confidence === "low"
      ? row.confidence
      : "low",
  summary: typeof row.summary === "string" ? row.summary : "",
  details: typeof row.details === "string" ? row.details : "",
  recommendedActions: Array.isArray(row.recommended_actions)
    ? row.recommended_actions.filter((item): item is string => typeof item === "string")
    : [],
});

const parseSnapshotRecord = ({
  row,
  run,
  findings,
}: {
  row: Record<string, unknown>;
  run: FleetRunRow;
  findings: FleetFinding[];
}): FleetSnapshotRecord | null => {
  if (typeof row.id !== "string" || typeof row.user_id !== "string") return null;
  const riskScore = Math.max(0, Math.min(100, Math.trunc(toNumber(row.risk_score))));
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: typeof row.user_email === "string" ? row.user_email : null,
    generatedAt: typeof row.generated_at === "string" ? row.generated_at : run.startedAt,
    highestSeverity:
      row.highest_severity === "critical" ||
      row.highest_severity === "warning" ||
      row.highest_severity === "info"
        ? row.highest_severity
        : "info",
    riskScore,
    riskBand: toFleetRiskBand(riskScore),
    spendableCents: Math.max(0, Math.trunc(toNumber(row.spendable_cents))),
    reservedCents: Math.max(0, Math.trunc(toNumber(row.reserved_cents))),
    failRate24hPercent: Math.round(toNumber(row.fail_rate_24h_percent) * 100) / 100,
    failCount24h: Math.max(0, Math.trunc(toNumber(row.fail_count_24h))),
    totalCount24h: Math.max(0, Math.trunc(toNumber(row.total_count_24h))),
    stuckGenerationsCount: Math.max(0, Math.trunc(toNumber(row.stuck_generations_count))),
    exhaustedQueueCount: Math.max(0, Math.trunc(toNumber(row.exhausted_queue_count))),
    costWithoutSuccessCents: Math.max(0, Math.trunc(toNumber(row.cost_without_success_cents))),
    costWithoutSuccessLinkedCents: Math.max(
      0,
      Math.trunc(toNumber(row.cost_without_success_linked_cents))
    ),
    costWithoutSuccessMissingLinkageCents: Math.max(
      0,
      Math.trunc(toNumber(row.cost_without_success_missing_linkage_cents))
    ),
    partialData: Boolean(row.partial_data),
    findingCount: Math.max(0, Math.trunc(toNumber(row.finding_count ?? findings.length))),
    findings,
  };
};

const buildSummary = (snapshots: FleetSnapshotRecord[]): FleetSummary => ({
  criticalCount: snapshots.filter((snapshot) => snapshot.highestSeverity === "critical").length,
  warningCount: snapshots.filter((snapshot) => snapshot.highestSeverity === "warning").length,
  infoCount: snapshots.filter((snapshot) => snapshot.highestSeverity === "info").length,
  highRiskCount: snapshots.filter((snapshot) => snapshot.riskBand === "high").length,
  mediumRiskCount: snapshots.filter((snapshot) => snapshot.riskBand === "medium").length,
  lowRiskCount: snapshots.filter((snapshot) => snapshot.riskBand === "low").length,
  totalCostWithoutSuccessCents: snapshots.reduce(
    (sum, snapshot) => sum + snapshot.costWithoutSuccessCents,
    0
  ),
  totalStuckGenerations: snapshots.reduce(
    (sum, snapshot) => sum + snapshot.stuckGenerationsCount,
    0
  ),
  totalExhaustedQueueRows: snapshots.reduce(
    (sum, snapshot) => sum + snapshot.exhaustedQueueCount,
    0
  ),
});

export const readFleetReport = async (filters: FleetReadFilters): Promise<FleetReadReport> => {
  const supabaseAdmin = getSupabaseAdmin();

  const runResult = filters.runId
    ? await supabaseAdmin
        .from("admin_user_health_scan_runs")
        .select("*")
        .eq("id", filters.runId)
        .maybeSingle()
    : await supabaseAdmin
        .from("admin_user_health_scan_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();

  if (runResult.error) {
    throw new Error(runResult.error.message || "Failed to load fleet scan run.");
  }

  const run = parseFleetRunRow(runResult.data);
  if (!run) {
    return emptyReport(filters);
  }

  const snapshotResult = await supabaseAdmin
    .from("admin_user_health_snapshots")
    .select("*")
    .eq("run_id", run.id)
    .order("risk_score", { ascending: false })
    .order("generated_at", { ascending: false })
    .limit(5000);

  if (snapshotResult.error) {
    throw new Error(snapshotResult.error.message || "Failed to load fleet snapshots.");
  }

  const findingResult = await supabaseAdmin
    .from("admin_user_health_snapshot_findings")
    .select("snapshot_id,code,severity,confidence,summary,details,recommended_actions")
    .eq("run_id", run.id)
    .limit(25000);

  if (findingResult.error) {
    throw new Error(findingResult.error.message || "Failed to load fleet findings.");
  }

  const snapshotRows = Array.isArray(snapshotResult.data)
    ? snapshotResult.data
        .map((row) => asObject(row))
        .filter((row): row is Record<string, unknown> => Boolean(row))
    : [];

  const findingsBySnapshotId = new Map<string, FleetFinding[]>();
  const findingRows = Array.isArray(findingResult.data)
    ? findingResult.data
        .map((row) => asObject(row))
        .filter((row): row is Record<string, unknown> => Boolean(row))
    : [];

  for (const row of findingRows) {
    if (typeof row.snapshot_id !== "string") continue;
    const findings = findingsBySnapshotId.get(row.snapshot_id) ?? [];
    findings.push(parseFinding(row));
    findingsBySnapshotId.set(row.snapshot_id, findings);
  }

  const snapshots = snapshotRows
    .map((row) =>
      parseSnapshotRecord({
        row,
        run,
        findings: findingsBySnapshotId.get(String(row.id ?? "")) ?? [],
      })
    )
    .filter((row): row is FleetSnapshotRecord => Boolean(row));

  const summary = buildSummary(snapshots);
  const normalizedSearch = filters.search.trim().toLowerCase();
  const normalizedFindingCode = filters.findingCode.trim().toLowerCase();

  const filtered = snapshots.filter((snapshot) => {
    if (filters.severity !== "all" && snapshot.highestSeverity !== filters.severity) {
      return false;
    }
    if (filters.riskBand !== "all" && snapshot.riskBand !== filters.riskBand) {
      return false;
    }
    if (normalizedFindingCode) {
      const hasFindingCode = snapshot.findings.some(
        (finding) => finding.code.toLowerCase() === normalizedFindingCode
      );
      if (!hasFindingCode) return false;
    }
    if (normalizedSearch) {
      const userIdMatch = snapshot.userId.toLowerCase().includes(normalizedSearch);
      const userEmailMatch = (snapshot.userEmail ?? "").toLowerCase().includes(normalizedSearch);
      if (!userIdMatch && !userEmailMatch) return false;
    }
    return true;
  });

  const totalCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / filters.perPage));
  const page = totalCount > 0 ? Math.min(filters.page, totalPages) : 1;
  const offset = (page - 1) * filters.perPage;
  const paged = filtered.slice(offset, offset + filters.perPage);

  const degradedReasons: string[] = [];
  if (snapshots.length >= 5000) {
    degradedReasons.push(
      "Snapshot row cap reached for this run; narrow filters or reduce cohort size."
    );
  }
  if (findingRows.length >= 25000) {
    degradedReasons.push(
      "Finding row cap reached for this run; finding filters may be incomplete."
    );
  }

  return {
    run,
    summary,
    snapshots: paged,
    pagination: {
      page,
      perPage: filters.perPage,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    health: {
      degraded: degradedReasons.length > 0,
      reason: degradedReasons.length ? degradedReasons.join(" ") : null,
    },
  };
};
