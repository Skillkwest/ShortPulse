/**
 * Fleet-scale admin user-health scan and read services.
 * Uses compact set-based table scans for active users without calling deep per-user diagnostics in bulk.
 */
import { writeAppErrorLog } from "../api/appErrorLogs";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import {
  finishFleetScanRun,
  loadFleetTargetUsers,
  persistFleetSnapshotBatch,
  startFleetScanRun,
} from "./fleetPersistence";
import { readFleetReport, type FleetReadFilters, type FleetReadReport } from "./fleetReport";
import { evaluateFleetUserHealth } from "./policy";
import { readAdminUserHealthFleetRuntimeFlags } from "./runtime";
import type { FleetSnapshotDraft, FleetTargetUser, FleetUserMetricInput } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

type QueryError = {
  message?: string;
  code?: string;
};

type BalanceRow = {
  user_id: string;
  balance_cents: number | string | null;
};

type ReservationRow = {
  user_id: string;
  status: string | null;
  source_ref: string | null;
  provider_request_id: string | null;
  amount_cents: number | string | null;
  created_at: string | null;
};

type GenerationRow = {
  user_id: string;
  status: string | null;
  recovery_state: string | null;
  request_id: string | null;
  created_at: string | null;
};

type QueueRow = {
  user_id: string;
  status: string | null;
};

type RichLedgerRow = {
  user_id: string;
  change_cents: number | string | null;
  source: string | null;
  source_ref: string | null;
  reason: string | null;
  created_at: string | null;
};

type LegacyLedgerRow = {
  user_id: string;
  change_cents: number | string | null;
  ref_id: string | null;
  reason: string | null;
  created_at: string | null;
};

type NormalizedLedgerRow = {
  user_id: string;
  change_cents: number;
  source: string;
  source_ref: string | null;
  reason: string;
  created_at: string | null;
};

type ScanRunStatus = "running" | "completed" | "partial" | "failed";

type FleetDrainageSummary = {
  enabled: boolean;
  scanned: number;
  released: number;
  errors: number;
};

export type FleetScanRunResult = {
  ok: boolean;
  runId: string | null;
  status: ScanRunStatus;
  targeted: number;
  processed: number;
  failed: number;
  partial: boolean;
  criticalUsers: number;
  warningUsers: number;
  totalCostWithoutSuccessCents: number;
  drainage: FleetDrainageSummary;
  durationMs: number;
  errors: string[];
};

const normalizeQueryError = (error: unknown): QueryError | null => {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  return {
    message: typeof record.message === "string" ? record.message : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
  };
};

const isSchemaCompatibilityError = (error: QueryError | null): boolean => {
  if (!error) return false;
  const code = String(error.code ?? "").toUpperCase();
  if (code === "42703" || code === "PGRST204" || code === "42P01") return true;
  const message = String(error.message ?? "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find the") ||
    message.includes("schema cache") ||
    message.includes("failed to parse select parameter")
  );
};

const parseTimestamp = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const chunk = <T>(rows: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    out.push(rows.slice(index, index + size));
  }
  return out;
};

const parseDrainageMetrics = (
  value: unknown
): { scanned: number; released: number; errors: number } => {
  const row =
    Array.isArray(value) && value.length > 0 && value[0] && typeof value[0] === "object"
      ? (value[0] as Record<string, unknown>)
      : value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;

  if (!row) {
    return { scanned: 0, released: 0, errors: 0 };
  }

  const scanned = Math.max(0, Math.trunc(toNumber(row.scanned_count ?? row.scanned)));
  const released = Math.max(0, Math.trunc(toNumber(row.released_count ?? row.released)));
  const errors = Math.max(0, Math.trunc(toNumber(row.error_count ?? row.errors)));
  return { scanned, released, errors };
};

const runFleetDrainage = async (): Promise<{
  summary: FleetDrainageSummary;
  warnings: string[];
}> => {
  const flags = readAdminUserHealthFleetRuntimeFlags();
  const summary: FleetDrainageSummary = {
    enabled: flags.drainageEnabled || flags.drainageProviderAttachedEnabled,
    scanned: 0,
    released: 0,
    errors: 0,
  };
  if (!summary.enabled) {
    return { summary, warnings: [] };
  }

  const supabaseAdmin = getSupabaseAdmin();
  const warnings: string[] = [];

  if (flags.drainageEnabled) {
    try {
      const response = await supabaseAdmin.rpc("release_stale_generation_reservations", {
        p_limit: flags.drainageBatchSize,
        p_min_age_seconds: flags.drainageMinAgeSeconds,
      });
      if (response.error) {
        summary.errors += 1;
        warnings.push(
          `Fleet drainage failed for release_stale_generation_reservations: ${
            response.error.message || "unknown error"
          }`
        );
      } else {
        const metrics = parseDrainageMetrics(response.data);
        summary.scanned += metrics.scanned;
        summary.released += metrics.released;
        summary.errors += metrics.errors;
      }
    } catch (error) {
      summary.errors += 1;
      warnings.push(
        `Fleet drainage failed for release_stale_generation_reservations: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }
  }

  if (flags.drainageProviderAttachedEnabled) {
    try {
      const response = await supabaseAdmin.rpc(
        "release_stale_provider_attached_generation_reservations",
        {
          p_limit: flags.drainageBatchSize,
          p_min_age_seconds: flags.drainageProviderAttachedMinAgeSeconds,
          p_orphan_min_age_seconds: flags.drainageProviderAttachedOrphanMinAgeSeconds,
        }
      );
      if (response.error) {
        summary.errors += 1;
        warnings.push(
          `Fleet drainage failed for release_stale_provider_attached_generation_reservations: ${
            response.error.message || "unknown error"
          }`
        );
      } else {
        const metrics = parseDrainageMetrics(response.data);
        summary.scanned += metrics.scanned;
        summary.released += metrics.released;
        summary.errors += metrics.errors;
      }
    } catch (error) {
      summary.errors += 1;
      warnings.push(
        `Fleet drainage failed for release_stale_provider_attached_generation_reservations: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    }
  }

  return { summary, warnings };
};

const evaluateCostWithoutSuccess = ({
  userId,
  ledgerRows,
  reservationBySourceRef,
  generationByRequestId,
}: {
  userId: string;
  ledgerRows: NormalizedLedgerRow[];
  reservationBySourceRef: Map<string, ReservationRow>;
  generationByRequestId: Map<string, string | null>;
}) => {
  let total = 0;
  let linked = 0;
  let missing = 0;

  for (const row of ledgerRows) {
    if (row.user_id !== userId) continue;
    if (row.source !== "generation_charge") continue;
    if (row.change_cents >= 0) continue;

    const debitAbs = Math.abs(row.change_cents);
    let bucket: "linked" | "missing" = "missing";
    let generationStatus: string | null = null;

    if (row.source_ref) {
      const reservation = reservationBySourceRef.get(row.source_ref);
      if (reservation?.provider_request_id) {
        generationStatus = generationByRequestId.get(reservation.provider_request_id) ?? null;
        if (generationStatus && generationStatus !== "success") {
          bucket = "linked";
        }
      }
    }

    if (generationStatus === "success") {
      continue;
    }

    total += debitAbs;
    if (bucket === "linked") {
      linked += debitAbs;
    } else {
      missing += debitAbs;
    }
  }

  return {
    total,
    linked,
    missing,
  };
};

const loadChunkMetrics = async ({
  targets,
  lookbackStartIso,
  nowMs,
}: {
  targets: FleetTargetUser[];
  lookbackStartIso: string;
  nowMs: number;
}): Promise<{
  drafts: FleetSnapshotDraft[];
  warnings: string[];
}> => {
  const supabaseAdmin = getSupabaseAdmin();
  const userIds = targets.map((target) => target.userId);
  const userIdSet = new Set(userIds);
  const compatibilityWarnings = new Set<string>();

  const [
    balanceResult,
    reservationResult,
    generationResult,
    stuckGenerationResult,
    queueResult,
    ledgerResult,
  ] = await Promise.all([
    supabaseAdmin.from("ai_credit_balance").select("user_id,balance_cents").in("user_id", userIds),
    supabaseAdmin
      .from("ai_credit_reservations")
      .select("user_id,status,source_ref,provider_request_id,amount_cents,created_at")
      .in("user_id", userIds)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("ai_generations")
      .select("user_id,status,recovery_state,request_id,created_at")
      .in("user_id", userIds)
      .gte("created_at", lookbackStartIso)
      .order("created_at", { ascending: false }),
    supabaseAdmin
      .from("ai_generations")
      .select("user_id,status,recovery_state,request_id,created_at")
      .in("user_id", userIds)
      .in("status", ["pending", "submitted", "running", "fail"])
      .in("recovery_state", ["queued", "recovering"])
      .lte("created_at", new Date(nowMs - 2 * HOUR_MS).toISOString()),
    supabaseAdmin
      .from("ai_generation_submit_queue")
      .select("user_id,status")
      .in("user_id", userIds)
      .gte("created_at", lookbackStartIso),
    (async () => {
      const rich = await supabaseAdmin
        .from("ai_credit_ledger")
        .select("user_id,change_cents,source,source_ref,reason,created_at")
        .in("user_id", userIds)
        .lt("change_cents", 0)
        .gte("created_at", lookbackStartIso)
        .order("created_at", { ascending: false });
      if (!rich.error) {
        const rows = Array.isArray(rich.data)
          ? rich.data.map((row) => ({
              user_id: String((row as RichLedgerRow).user_id),
              change_cents: toNumber((row as RichLedgerRow).change_cents),
              source: (row as RichLedgerRow).source ?? "system",
              source_ref: (row as RichLedgerRow).source_ref ?? null,
              reason: (row as RichLedgerRow).reason ?? "",
              created_at: (row as RichLedgerRow).created_at ?? null,
            }))
          : [];
        return { rows, warning: null };
      }

      const richError = normalizeQueryError(rich.error);
      if (!isSchemaCompatibilityError(richError)) {
        throw new Error(richError?.message || "Failed to load ai_credit_ledger.");
      }

      const legacy = await supabaseAdmin
        .from("ai_credit_ledger")
        .select("user_id,change_cents,ref_id,reason,created_at")
        .in("user_id", userIds)
        .lt("change_cents", 0)
        .gte("created_at", lookbackStartIso)
        .order("created_at", { ascending: false });
      if (legacy.error) {
        throw new Error(legacy.error.message || "Failed to load ai_credit_ledger.");
      }
      const rows = Array.isArray(legacy.data)
        ? legacy.data.map((row) => ({
            user_id: String((row as LegacyLedgerRow).user_id),
            change_cents: toNumber((row as LegacyLedgerRow).change_cents),
            source: "legacy",
            source_ref: (row as LegacyLedgerRow).ref_id ?? null,
            reason: (row as LegacyLedgerRow).reason ?? "",
            created_at: (row as LegacyLedgerRow).created_at ?? null,
          }))
        : [];

      return {
        rows,
        warning:
          "ai_credit_ledger is using a legacy schema in this environment; cost-without-success detection may be partial.",
      };
    })(),
  ]);

  const balanceError = normalizeQueryError(balanceResult.error);
  if (balanceError) {
    throw new Error(balanceError.message || "Failed to load ai_credit_balance.");
  }

  const reservationError = normalizeQueryError(reservationResult.error);
  const reservationRows: ReservationRow[] = [];
  if (reservationError) {
    if (isSchemaCompatibilityError(reservationError)) {
      compatibilityWarnings.add(
        "ai_credit_reservations is unavailable or schema-incompatible; reservation and linkage metrics are partial."
      );
    } else {
      throw new Error(reservationError.message || "Failed to load ai_credit_reservations.");
    }
  } else if (Array.isArray(reservationResult.data)) {
    reservationRows.push(...(reservationResult.data as ReservationRow[]));
  }

  const generationError = normalizeQueryError(generationResult.error);
  const generationRows: GenerationRow[] = [];
  if (generationError) {
    if (isSchemaCompatibilityError(generationError)) {
      compatibilityWarnings.add(
        "ai_generations is schema-incompatible in this environment; generation/fail-rate metrics are partial."
      );
    } else {
      throw new Error(generationError.message || "Failed to load ai_generations.");
    }
  } else if (Array.isArray(generationResult.data)) {
    generationRows.push(...(generationResult.data as GenerationRow[]));
  }

  const stuckGenerationError = normalizeQueryError(stuckGenerationResult.error);
  const stuckGenerationRows: GenerationRow[] = [];
  if (stuckGenerationError) {
    if (isSchemaCompatibilityError(stuckGenerationError)) {
      compatibilityWarnings.add(
        "ai_generations.recovery_state is unavailable in this environment; stuck-generation metrics are partial."
      );
    } else {
      throw new Error(stuckGenerationError.message || "Failed to load stuck generation rows.");
    }
  } else if (Array.isArray(stuckGenerationResult.data)) {
    stuckGenerationRows.push(...(stuckGenerationResult.data as GenerationRow[]));
  }

  const queueError = normalizeQueryError(queueResult.error);
  const queueRows: QueueRow[] = [];
  if (queueError) {
    if (isSchemaCompatibilityError(queueError)) {
      compatibilityWarnings.add(
        "ai_generation_submit_queue is unavailable in this environment; queue diagnostics are partial."
      );
    } else {
      throw new Error(queueError.message || "Failed to load ai_generation_submit_queue.");
    }
  } else if (Array.isArray(queueResult.data)) {
    queueRows.push(...(queueResult.data as QueueRow[]));
  }

  if (ledgerResult.warning) {
    compatibilityWarnings.add(ledgerResult.warning);
  }

  const balanceByUser = new Map<string, number>();
  for (const row of (balanceResult.data ?? []) as BalanceRow[]) {
    if (!row || !userIdSet.has(String(row.user_id))) continue;
    balanceByUser.set(String(row.user_id), Math.max(0, Math.trunc(toNumber(row.balance_cents))));
  }

  const reservedByUser = new Map<string, number>();
  const reservedWithProviderOver2hByUser = new Map<string, number>();
  const reservedWithoutProviderOver15mByUser = new Map<string, number>();
  const reservationBySourceRef = new Map<string, ReservationRow>();
  for (const row of reservationRows) {
    const userId = String(row.user_id);
    if (!userIdSet.has(userId)) continue;

    if (row.status === "reserved") {
      const amount = Math.abs(Math.trunc(toNumber(row.amount_cents)));
      reservedByUser.set(userId, (reservedByUser.get(userId) ?? 0) + amount);

      const createdAtMs = parseTimestamp(row.created_at);
      if (row.provider_request_id) {
        if (createdAtMs !== null && nowMs - createdAtMs >= 2 * HOUR_MS) {
          reservedWithProviderOver2hByUser.set(
            userId,
            (reservedWithProviderOver2hByUser.get(userId) ?? 0) + 1
          );
        }
      } else if (createdAtMs !== null && nowMs - createdAtMs >= 15 * MINUTE_MS) {
        reservedWithoutProviderOver15mByUser.set(
          userId,
          (reservedWithoutProviderOver15mByUser.get(userId) ?? 0) + 1
        );
      }
    }

    if (row.source_ref && !reservationBySourceRef.has(row.source_ref)) {
      reservationBySourceRef.set(row.source_ref, row);
    }
  }

  const generationByRequestId = new Map<string, string | null>();
  const failCount24hByUser = new Map<string, number>();
  const totalCount24hByUser = new Map<string, number>();
  for (const row of generationRows) {
    const userId = String(row.user_id);
    if (!userIdSet.has(userId)) continue;

    if (row.request_id && !generationByRequestId.has(row.request_id)) {
      generationByRequestId.set(row.request_id, row.status ?? null);
    }

    const createdAtMs = parseTimestamp(row.created_at);
    if (createdAtMs === null || nowMs - createdAtMs > DAY_MS) continue;

    totalCount24hByUser.set(userId, (totalCount24hByUser.get(userId) ?? 0) + 1);
    if (row.status === "fail") {
      failCount24hByUser.set(userId, (failCount24hByUser.get(userId) ?? 0) + 1);
    }
  }

  const stuckCountByUser = new Map<string, number>();
  for (const row of stuckGenerationRows) {
    const userId = String(row.user_id);
    if (!userIdSet.has(userId)) continue;
    stuckCountByUser.set(userId, (stuckCountByUser.get(userId) ?? 0) + 1);
  }

  const exhaustedQueueCountByUser = new Map<string, number>();
  for (const row of queueRows) {
    const userId = String(row.user_id);
    if (!userIdSet.has(userId)) continue;
    if (row.status === "exhausted") {
      exhaustedQueueCountByUser.set(userId, (exhaustedQueueCountByUser.get(userId) ?? 0) + 1);
    }
  }

  const ledgerRows = ledgerResult.rows;
  const drafts: FleetSnapshotDraft[] = targets.map((target) => {
    const availableCents = balanceByUser.get(target.userId) ?? 0;
    const reservedCents = reservedByUser.get(target.userId) ?? 0;
    const spendableCents = Math.max(0, availableCents - reservedCents);

    const failCount24h = failCount24hByUser.get(target.userId) ?? 0;
    const totalCount24h = totalCount24hByUser.get(target.userId) ?? 0;
    const failRate24hPercent =
      totalCount24h > 0 ? Math.round((failCount24h / totalCount24h) * 10000) / 100 : 0;

    const costWithoutSuccess = evaluateCostWithoutSuccess({
      userId: target.userId,
      ledgerRows,
      reservationBySourceRef,
      generationByRequestId,
    });

    const metricInput: FleetUserMetricInput = {
      userId: target.userId,
      email: target.email,
      generatedAt: new Date(nowMs).toISOString(),
      spendableCents,
      reservedCents,
      failRate24hPercent,
      failCount24h,
      totalCount24h,
      stuckGenerationsCount: stuckCountByUser.get(target.userId) ?? 0,
      exhaustedQueueCount: exhaustedQueueCountByUser.get(target.userId) ?? 0,
      reservedWithProviderOver2hCount: reservedWithProviderOver2hByUser.get(target.userId) ?? 0,
      reservedWithoutProviderOver15mCount:
        reservedWithoutProviderOver15mByUser.get(target.userId) ?? 0,
      costWithoutSuccessCents: costWithoutSuccess.total,
      costWithoutSuccessLinkedCents: costWithoutSuccess.linked,
      costWithoutSuccessMissingLinkageCents: costWithoutSuccess.missing,
      partialData: compatibilityWarnings.size > 0,
      compatibilityWarnings: Array.from(compatibilityWarnings.values()),
    };

    const evaluation = evaluateFleetUserHealth(metricInput);
    return {
      userId: target.userId,
      userEmail: target.email,
      generatedAt: metricInput.generatedAt,
      highestSeverity: evaluation.highestSeverity,
      riskScore: evaluation.riskScore,
      spendableCents,
      reservedCents,
      failRate24hPercent,
      failCount24h,
      totalCount24h,
      stuckGenerationsCount: metricInput.stuckGenerationsCount,
      exhaustedQueueCount: metricInput.exhaustedQueueCount,
      costWithoutSuccessCents: metricInput.costWithoutSuccessCents,
      costWithoutSuccessLinkedCents: metricInput.costWithoutSuccessLinkedCents,
      costWithoutSuccessMissingLinkageCents: metricInput.costWithoutSuccessMissingLinkageCents,
      partialData: metricInput.partialData,
      findingCount: evaluation.findings.length,
      findings: evaluation.findings,
      nextSteps: evaluation.nextSteps,
      metadata: {
        riskBand: evaluation.riskBand,
      },
    };
  });

  return {
    drafts,
    warnings: Array.from(compatibilityWarnings.values()),
  };
};

const maybeEscalateIncidents = async ({
  runId,
  drafts,
}: {
  runId: string;
  drafts: FleetSnapshotDraft[];
}) => {
  const flags = readAdminUserHealthFleetRuntimeFlags();
  if (!flags.incidentsEnabled) return;

  const actionable = drafts
    .filter((draft) => {
      if (draft.riskScore >= flags.criticalRiskThreshold) return true;
      if (
        draft.highestSeverity === "warning" &&
        draft.costWithoutSuccessCents >= flags.warningCostWithoutSuccessThresholdCents
      ) {
        return true;
      }
      return false;
    })
    .slice(0, 100);

  for (const draft of actionable) {
    const topFinding = draft.findings[0];
    const message =
      topFinding?.summary ||
      `User health fleet alert for ${draft.userEmail ?? draft.userId} (risk ${draft.riskScore}).`;

    await writeAppErrorLog({
      source: "ops.user_health_fleet",
      scope: "generation",
      severity: draft.highestSeverity === "critical" ? "high" : "medium",
      message,
      route: "/api/internal/admin-user-health-fleet/run",
      userId: draft.userId,
      userEmail: draft.userEmail,
      metadata: {
        run_id: runId,
        risk_score: draft.riskScore,
        highest_severity: draft.highestSeverity,
        finding_codes: draft.findings.map((finding) => finding.code).slice(0, 10),
        cost_without_success_cents: draft.costWithoutSuccessCents,
        stuck_generations_count: draft.stuckGenerationsCount,
        exhausted_queue_count: draft.exhaustedQueueCount,
      },
    });
  }
};

const maybeEscalateDrainageErrors = async ({
  runId,
  summary,
}: {
  runId: string;
  summary: FleetDrainageSummary;
}) => {
  const flags = readAdminUserHealthFleetRuntimeFlags();
  if (!flags.incidentsEnabled) return;
  if (summary.errors <= 0) return;

  await writeAppErrorLog({
    source: "ops.user_health_fleet",
    scope: "generation",
    severity: "medium",
    message: `Fleet drainage reported ${summary.errors} error(s).`,
    route: "/api/internal/admin-user-health-fleet/run",
    metadata: {
      run_id: runId,
      drainage_enabled: summary.enabled,
      drainage_scanned: summary.scanned,
      drainage_released: summary.released,
      drainage_errors: summary.errors,
    },
  });
};

/**
 * Execute one fleet health scan and persist run/snapshot/finding outputs.
 */
export const runAdminUserHealthFleetScan = async ({
  triggerSource,
}: {
  triggerSource: "scheduled" | "manual";
}): Promise<FleetScanRunResult> => {
  const flags = readAdminUserHealthFleetRuntimeFlags();
  const startedAtMs = Date.now();
  const defaultDrainageSummary: FleetDrainageSummary = {
    enabled: flags.drainageEnabled || flags.drainageProviderAttachedEnabled,
    scanned: 0,
    released: 0,
    errors: 0,
  };

  const startRunResult = await startFleetScanRun({
    lookbackDays: flags.lookbackDays,
    activeWindowDays: flags.activeWindowDays,
    retentionDays: flags.retentionDays,
    triggerSource,
  });

  if (!startRunResult.ok) {
    return {
      ok: false,
      runId: startRunResult.existingRunId,
      status: "running",
      targeted: 0,
      processed: 0,
      failed: 0,
      partial: true,
      criticalUsers: 0,
      warningUsers: 0,
      totalCostWithoutSuccessCents: 0,
      drainage: defaultDrainageSummary,
      durationMs: Math.max(0, Date.now() - startedAtMs),
      errors: ["A fleet scan run is already active."],
    };
  }

  const runId = startRunResult.runId;
  const runErrors: string[] = [];

  let targetCount = 0;
  let processedCount = 0;
  let failedCount = 0;
  let partialData = false;
  let criticalUsers = 0;
  let warningUsers = 0;
  let totalCostWithoutSuccessCents = 0;
  let drainageSummary: FleetDrainageSummary = defaultDrainageSummary;

  try {
    const drainageResult = await runFleetDrainage();
    drainageSummary = drainageResult.summary;
    if (drainageResult.warnings.length > 0) {
      partialData = true;
      runErrors.push(...drainageResult.warnings);
    }

    const targets = await loadFleetTargetUsers({
      activeWindowDays: flags.activeWindowDays,
      maxUsers: flags.maxUsersPerRun,
    });
    targetCount = targets.length;

    const lookbackStartIso = new Date(Date.now() - flags.lookbackDays * DAY_MS).toISOString();
    const targetChunks = chunk(targets, flags.pageSize);

    const allDraftsForEscalation: FleetSnapshotDraft[] = [];

    for (const targetChunk of targetChunks) {
      if (Date.now() - startedAtMs > flags.timeBudgetMs) {
        partialData = true;
        runErrors.push("Scan time budget reached before processing all target users.");
        failedCount += targetChunk.length;
        continue;
      }

      try {
        const chunkResult = await loadChunkMetrics({
          targets: targetChunk,
          lookbackStartIso,
          nowMs: Date.now(),
        });

        if (chunkResult.warnings.length > 0) {
          partialData = true;
          runErrors.push(...chunkResult.warnings);
        }

        await persistFleetSnapshotBatch({
          runId,
          drafts: chunkResult.drafts,
        });

        allDraftsForEscalation.push(...chunkResult.drafts);
        processedCount += chunkResult.drafts.length;

        for (const draft of chunkResult.drafts) {
          if (draft.highestSeverity === "critical") {
            criticalUsers += 1;
          } else if (draft.highestSeverity === "warning") {
            warningUsers += 1;
          }
          totalCostWithoutSuccessCents += draft.costWithoutSuccessCents;
          if (draft.partialData) {
            partialData = true;
          }
        }
      } catch (chunkError) {
        failedCount += targetChunk.length;
        partialData = true;
        runErrors.push(chunkError instanceof Error ? chunkError.message : "Chunk scan failed.");
      }
    }

    await maybeEscalateIncidents({
      runId,
      drafts: allDraftsForEscalation,
    });

    try {
      await maybeEscalateDrainageErrors({
        runId,
        summary: drainageSummary,
      });
    } catch {
      partialData = true;
      runErrors.push("Drainage incident escalation failed.");
    }

    try {
      await getSupabaseAdmin().rpc("prune_admin_user_health_history", {
        p_retention_days: flags.retentionDays,
      });
    } catch {
      partialData = true;
      runErrors.push("Retention prune call failed; scan results were still persisted.");
    }

    const status: ScanRunStatus =
      processedCount === 0 && failedCount > 0
        ? "failed"
        : partialData || failedCount > 0
          ? "partial"
          : "completed";

    await finishFleetScanRun({
      runId,
      status,
      targetCount,
      processedCount,
      failedCount,
      partialData,
      startedAtMs,
      errorSummary: runErrors.length ? runErrors.slice(0, 6).join(" | ") : null,
      metadata: {
        critical_users: criticalUsers,
        warning_users: warningUsers,
        total_cost_without_success_cents: totalCostWithoutSuccessCents,
        drainage_enabled: drainageSummary.enabled,
        drainage_scanned: drainageSummary.scanned,
        drainage_released: drainageSummary.released,
        drainage_errors: drainageSummary.errors,
      },
    });

    return {
      ok: status !== "failed",
      runId,
      status,
      targeted: targetCount,
      processed: processedCount,
      failed: failedCount,
      partial: partialData || status === "partial",
      criticalUsers,
      warningUsers,
      totalCostWithoutSuccessCents,
      drainage: drainageSummary,
      durationMs: Math.max(0, Date.now() - startedAtMs),
      errors: Array.from(new Set(runErrors)).slice(0, 12),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fleet scan failed.";
    await finishFleetScanRun({
      runId,
      status: "failed",
      targetCount,
      processedCount,
      failedCount: Math.max(failedCount, targetCount - processedCount),
      partialData: true,
      startedAtMs,
      errorSummary: message,
      metadata: {
        critical_users: criticalUsers,
        warning_users: warningUsers,
        total_cost_without_success_cents: totalCostWithoutSuccessCents,
        drainage_enabled: drainageSummary.enabled,
        drainage_scanned: drainageSummary.scanned,
        drainage_released: drainageSummary.released,
        drainage_errors: drainageSummary.errors,
      },
    });
    throw error;
  }
};

/**
 * Read latest (or selected) fleet run with snapshots/findings and server-side pagination.
 */
export const readAdminUserHealthFleetReport = async (
  filters: FleetReadFilters
): Promise<FleetReadReport> => readFleetReport(filters);
