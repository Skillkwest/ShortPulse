/**
 * Fleet-scale admin user-health scan and read services.
 * Uses compact set-based table scans for active users without calling deep per-user diagnostics in bulk.
 */
import { writeAppErrorLog } from "../api/appErrorLogs";
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import { evaluateFleetUserHealth } from "./policy";
import { readAdminUserHealthFleetRuntimeFlags } from "./runtime";
import type {
  FleetFinding,
  FleetRiskBand,
  FleetRunRow,
  FleetSnapshotDraft,
  FleetSnapshotRecord,
  FleetSummary,
  FleetTargetUser,
  FleetUserMetricInput,
} from "./types";

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

type StartRunResult =
  | { ok: true; runId: string }
  | { ok: false; reason: "already_running"; existingRunId: string | null };

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
  durationMs: number;
  errors: string[];
};

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

const toFleetRiskBand = (riskScore: number): FleetRiskBand => {
  if (riskScore >= 70) return "high";
  if (riskScore >= 40) return "medium";
  return "low";
};

const chunk = <T>(rows: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    out.push(rows.slice(index, index + size));
  }
  return out;
};

const normalizeTriggerSource = (value: unknown): "scheduled" | "manual" => {
  return value === "manual" ? "manual" : "scheduled";
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const parseRunRow = (value: unknown): FleetRunRow | null => {
  const row = asObject(value);
  if (!row || typeof row.id !== "string") return null;
  return {
    id: row.id,
    triggerSource: normalizeTriggerSource(row.trigger_source),
    status:
      row.status === "running" ||
      row.status === "completed" ||
      row.status === "partial" ||
      row.status === "failed"
        ? row.status
        : "failed",
    lookbackDays: Math.max(1, Math.trunc(toNumber(row.lookback_days))),
    activeWindowDays: Math.max(1, Math.trunc(toNumber(row.active_window_days))),
    retentionDays: Math.max(7, Math.trunc(toNumber(row.retention_days))),
    targetCount: Math.max(0, Math.trunc(toNumber(row.target_count))),
    processedCount: Math.max(0, Math.trunc(toNumber(row.processed_count))),
    failedCount: Math.max(0, Math.trunc(toNumber(row.failed_count))),
    partialData: Boolean(row.partial_data),
    startedAt: typeof row.started_at === "string" ? row.started_at : new Date().toISOString(),
    finishedAt: typeof row.finished_at === "string" ? row.finished_at : null,
    durationMs: Number.isFinite(toNumber(row.duration_ms))
      ? Math.trunc(toNumber(row.duration_ms))
      : null,
    errorSummary: typeof row.error_summary === "string" ? row.error_summary : null,
    metadata: asObject(row.metadata),
  };
};

const parseTargetRows = (value: unknown): FleetTargetUser[] => {
  if (!Array.isArray(value)) return [];
  const targets: FleetTargetUser[] = [];
  for (const item of value) {
    const row = asObject(item);
    if (!row || typeof row.user_id !== "string") continue;
    targets.push({
      userId: row.user_id,
      email: typeof row.email === "string" ? row.email : null,
      lastActivityAt: typeof row.last_activity_at === "string" ? row.last_activity_at : null,
    });
  }
  return targets;
};

const startRunningScan = async ({
  lookbackDays,
  activeWindowDays,
  retentionDays,
  triggerSource,
}: {
  lookbackDays: number;
  activeWindowDays: number;
  retentionDays: number;
  triggerSource: "scheduled" | "manual";
}): Promise<StartRunResult> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data, error } = await supabaseAdmin
    .from("admin_user_health_scan_runs")
    .insert({
      trigger_source: triggerSource,
      status: "running",
      lookback_days: lookbackDays,
      active_window_days: activeWindowDays,
      retention_days: retentionDays,
      target_count: 0,
      processed_count: 0,
      failed_count: 0,
      partial_data: false,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (!error && data?.id) {
    return { ok: true, runId: String(data.id) };
  }

  const normalizedError = normalizeQueryError(error);
  if (normalizedError && String(normalizedError.code ?? "") === "23505") {
    const existingRunResult = await supabaseAdmin
      .from("admin_user_health_scan_runs")
      .select("id")
      .eq("status", "running")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      ok: false,
      reason: "already_running",
      existingRunId:
        existingRunResult.data && typeof existingRunResult.data.id === "string"
          ? existingRunResult.data.id
          : null,
    };
  }

  throw new Error(normalizedError?.message || "Failed to start fleet health scan run.");
};

const finishScanRun = async ({
  runId,
  status,
  targetCount,
  processedCount,
  failedCount,
  partialData,
  startedAtMs,
  errorSummary,
  metadata,
}: {
  runId: string;
  status: ScanRunStatus;
  targetCount: number;
  processedCount: number;
  failedCount: number;
  partialData: boolean;
  startedAtMs: number;
  errorSummary: string | null;
  metadata: Record<string, unknown>;
}) => {
  const supabaseAdmin = getSupabaseAdmin();
  const durationMs = Math.max(0, Date.now() - startedAtMs);
  const { error } = await supabaseAdmin
    .from("admin_user_health_scan_runs")
    .update({
      status,
      target_count: targetCount,
      processed_count: processedCount,
      failed_count: failedCount,
      partial_data: partialData,
      finished_at: new Date().toISOString(),
      duration_ms: durationMs,
      error_summary: errorSummary,
      metadata,
    })
    .eq("id", runId);

  if (error) {
    throw new Error(error.message || "Failed to finalize fleet health scan run.");
  }
};

const loadTargetUsers = async ({
  activeWindowDays,
  maxUsers,
}: {
  activeWindowDays: number;
  maxUsers: number;
}) => {
  const supabaseAdmin = getSupabaseAdmin();
  const response = await supabaseAdmin.rpc("list_admin_user_health_active_targets", {
    p_active_days: activeWindowDays,
    p_limit: maxUsers,
  });
  if (response.error) {
    throw new Error(response.error.message || "Failed to resolve active target users.");
  }
  return parseTargetRows(response.data);
};

const persistSnapshotBatch = async ({
  runId,
  drafts,
}: {
  runId: string;
  drafts: FleetSnapshotDraft[];
}) => {
  if (!drafts.length) return;
  const supabaseAdmin = getSupabaseAdmin();

  const snapshotRows = drafts.map((draft) => ({
    run_id: runId,
    user_id: draft.userId,
    user_email: draft.userEmail,
    generated_at: draft.generatedAt,
    highest_severity: draft.highestSeverity,
    risk_score: draft.riskScore,
    spendable_cents: draft.spendableCents,
    reserved_cents: draft.reservedCents,
    fail_rate_24h_percent: draft.failRate24hPercent,
    fail_count_24h: draft.failCount24h,
    total_count_24h: draft.totalCount24h,
    stuck_generations_count: draft.stuckGenerationsCount,
    exhausted_queue_count: draft.exhaustedQueueCount,
    cost_without_success_cents: draft.costWithoutSuccessCents,
    cost_without_success_linked_cents: draft.costWithoutSuccessLinkedCents,
    cost_without_success_missing_linkage_cents: draft.costWithoutSuccessMissingLinkageCents,
    finding_count: draft.findingCount,
    partial_data: draft.partialData,
    metadata: draft.metadata,
  }));

  const insertSnapshots = await supabaseAdmin
    .from("admin_user_health_snapshots")
    .insert(snapshotRows)
    .select("id,user_id");

  if (insertSnapshots.error) {
    throw new Error(insertSnapshots.error.message || "Failed to persist fleet health snapshots.");
  }

  const insertedSnapshotRows = Array.isArray(insertSnapshots.data) ? insertSnapshots.data : [];
  const snapshotIdByUser = new Map<string, string>();
  for (const row of insertedSnapshotRows) {
    if (!row || typeof row !== "object") continue;
    const record = row as Record<string, unknown>;
    if (typeof record.user_id === "string" && typeof record.id === "string") {
      snapshotIdByUser.set(record.user_id, record.id);
    }
  }

  const findingRows: Array<Record<string, unknown>> = [];
  for (const draft of drafts) {
    const snapshotId = snapshotIdByUser.get(draft.userId);
    if (!snapshotId) continue;
    for (const finding of draft.findings) {
      findingRows.push({
        run_id: runId,
        snapshot_id: snapshotId,
        user_id: draft.userId,
        code: finding.code,
        severity: finding.severity,
        confidence: finding.confidence,
        summary: finding.summary,
        details: finding.details,
        recommended_actions: finding.recommendedActions,
        metadata: {},
      });
    }
  }

  if (!findingRows.length) return;

  const insertFindings = await supabaseAdmin
    .from("admin_user_health_snapshot_findings")
    .insert(findingRows);
  if (insertFindings.error) {
    throw new Error(insertFindings.error.message || "Failed to persist fleet health findings.");
  }
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

  const startRunResult = await startRunningScan({
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

  try {
    const targets = await loadTargetUsers({
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

        await persistSnapshotBatch({
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

    await finishScanRun({
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
      durationMs: Math.max(0, Date.now() - startedAtMs),
      errors: Array.from(new Set(runErrors)).slice(0, 12),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fleet scan failed.";
    await finishScanRun({
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
): Promise<FleetReadReport> => {
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

  const run = parseRunRow(runResult.data);
  if (!run) {
    return {
      run: null,
      summary: {
        criticalCount: 0,
        warningCount: 0,
        infoCount: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        totalCostWithoutSuccessCents: 0,
        totalStuckGenerations: 0,
        totalExhaustedQueueRows: 0,
      },
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
    };
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
    findings.push({
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
    findingsBySnapshotId.set(row.snapshot_id, findings);
  }

  const snapshots: FleetSnapshotRecord[] = snapshotRows
    .map((row) => {
      if (typeof row.id !== "string" || typeof row.user_id !== "string") return null;
      const findings = findingsBySnapshotId.get(row.id) ?? [];
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
      } satisfies FleetSnapshotRecord;
    })
    .filter((row): row is FleetSnapshotRecord => Boolean(row));

  const summary: FleetSummary = {
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
  };

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
