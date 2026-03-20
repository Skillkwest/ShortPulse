/**
 * Lifecycle and persistence helpers for admin user-health fleet scans.
 */
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import type { FleetRunRow, FleetSnapshotDraft, FleetTargetUser } from "./types";

type QueryError = {
  message?: string;
  code?: string;
};

type ScanRunStatus = "running" | "completed" | "partial" | "failed";

type StartRunResult =
  | { ok: true; runId: string }
  | { ok: false; reason: "already_running"; existingRunId: string | null };

const normalizeQueryError = (error: unknown): QueryError | null => {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  return {
    message: typeof record.message === "string" ? record.message : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
  };
};

const toNumber = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const normalizeTriggerSource = (value: unknown): "scheduled" | "manual" => {
  return value === "manual" ? "manual" : "scheduled";
};

const asObject = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const parseDrainageFromMetadata = (metadata: Record<string, unknown> | null) => {
  const enabledValue = metadata?.drainage_enabled;
  const scannedValue = metadata?.drainage_scanned;
  const releasedValue = metadata?.drainage_released;
  const errorsValue = metadata?.drainage_errors;
  const enabled = enabledValue === true;
  const scanned = Math.max(0, Math.trunc(toNumber(scannedValue)));
  const released = Math.max(0, Math.trunc(toNumber(releasedValue)));
  const errors = Math.max(0, Math.trunc(toNumber(errorsValue)));
  return {
    enabled,
    scanned,
    released,
    errors,
  };
};

const emptyDrainageTrend = () => ({
  previousRunId: null as string | null,
  scannedDelta: null as number | null,
  releasedDelta: null as number | null,
  errorsDelta: null as number | null,
});

export const parseFleetRunRow = (value: unknown): FleetRunRow | null => {
  const row = asObject(value);
  if (!row || typeof row.id !== "string") return null;
  const metadata = asObject(row.metadata);
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
    metadata,
    drainage: parseDrainageFromMetadata(metadata),
    drainageTrend: emptyDrainageTrend(),
  };
};

export const parseFleetTargetRows = (value: unknown): FleetTargetUser[] => {
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

export const startFleetScanRun = async ({
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

export const finishFleetScanRun = async ({
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

export const loadFleetTargetUsers = async ({
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
  return parseFleetTargetRows(response.data);
};

export const persistFleetSnapshotBatch = async ({
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
