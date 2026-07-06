/**
 * Shared deep-diagnostics report assembly used by /api/admin/user-health.
 * Keeps the route focused on request/auth/data-loading concerns.
 */
import {
  computeStatusCounts,
  parseTimestamp,
  pushUniqueSteps,
  ratioPercent,
  type DeepLookupMode as LookupMode,
} from "./deep";
import {
  HOUR_MS,
  PRE_SUBMIT_RESERVED_HOLD_WARNING_MS,
  PROVIDER_ATTACHED_RESERVED_HOLD_CRITICAL_MS,
  STUCK_GENERATION_CRITICAL_MS,
  STUCK_GENERATION_WARNING_MS,
} from "./thresholds";
import type { CreditGrantSummary } from "../api/creditGrantSummary";

const DAY_MS = 24 * 60 * 60 * 1000;

type FindingSeverity = "info" | "warning" | "critical";
type FindingConfidence = "high" | "medium" | "low";

export type BalanceRow = {
  user_id: string;
  balance_cents: number | string | null;
  updated_at: string | null;
};

export type GenerationRow = {
  id: string;
  status: string | null;
  recovery_state?: string | null;
  provider: string | null;
  model_id: string | null;
  request_id: string | null;
  created_at: string | null;
  completed_at: string | null;
  failure_reason_code?: string | null;
  next_recovery_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type AttemptRow = {
  id: string;
  generation_id: string | null;
  provider_request_id: string | null;
  status: string | null;
  created_at: string | null;
};

export type OutputRow = {
  id: string;
  generation_id: string | null;
  media_file_id: string | null;
  created_at: string | null;
};

export type ProjectGenerationItemRow = {
  project_id: string | null;
  generation_id: string | null;
  user_id?: string | null;
};

export type GenerationProjectionProjectRow = {
  project_id: string | null;
  generation_id: string | null;
  user_id?: string | null;
};

export type GenerationProjectionBillingRow = {
  generation_id: string | null;
  source_ref: string | null;
  request_id: string | null;
  provider_request_id: string | null;
  status: string | null;
  task_state: string | null;
  result_urls?: unknown;
  preview_url?: string | null;
};

export type ReservationRow = {
  id: string;
  status: string | null;
  source_ref: string | null;
  provider_request_id: string | null;
  model_id: string | null;
  amount_cents: number | string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  released_at: string | null;
  captured_at: string | null;
};

export type NormalizedLedgerRow = {
  id: string;
  user_id: string;
  change_cents: number;
  reason: string;
  source: string;
  source_ref: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

export type HealthFinding = {
  code: string;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  summary: string;
  details: string;
  recommendedActions: string[];
};

export type WindowSummary = {
  window: "24h" | "7d" | "30d";
  totalDebitCents: number;
  generationDebitCents: number;
  nonGenerationDebitCents: number;
  avgPerDayCents: number;
};

export type AdminHealthResponse = {
  generatedAt: string;
  lookbackDays: number;
  target: {
    lookup: string;
    lookupMode: LookupMode;
    userId: string;
    email: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
  };
  compatibility: {
    generationsSelectUsed: string;
    attemptsSupported: boolean;
    outputsSupported: boolean;
    reservationsSupported: boolean;
    ledgerLegacySchema: boolean;
    warnings: string[];
  };
  credits: {
    availableCents: number;
    reservedCents: number;
    spendableCents: number;
    balanceUpdatedAt: string | null;
    totalGrantsCents: number;
    totalDebitsCentsAbs: number;
    generationDebitsCentsAbs: number;
  };
  drainage: {
    windows: WindowSummary[];
    dailyDebits: Array<{
      day: string;
      totalDebitCents: number;
      generationDebitCents: number;
    }>;
    topDebitSources: Array<{ source: string; cents: number }>;
    costWithoutSuccessfulGeneration: {
      debitCents: number;
      rowCount: number;
      sample: Array<{
        sourceRef: string | null;
        amountCents: number;
        reason: string;
        generationStatus: string | null;
        bucket: "linked_non_success_generation" | "missing_linkage_data";
      }>;
      linkedNonSuccessGeneration: {
        debitCents: number;
        rowCount: number;
        sample: Array<{
          sourceRef: string | null;
          amountCents: number;
          reason: string;
          generationStatus: string | null;
        }>;
      };
      missingLinkageData: {
        debitCents: number;
        rowCount: number;
        sample: Array<{
          sourceRef: string | null;
          amountCents: number;
          reason: string;
          generationStatus: string | null;
        }>;
      };
    };
  };
  generations: {
    total: number;
    byStatus: Record<string, number>;
    last24h: { total: number; success: number; fail: number; failRatePercent: number };
    last7d: { total: number; success: number; fail: number; failRatePercent: number };
    last30d: { total: number; success: number; fail: number; failRatePercent: number };
    topFailReasonsLookback: Array<{ reason: string; count: number }>;
    stuckOver1hCount: number;
    stuckOver1hSample: Array<{
      id: string;
      status: string | null;
      recoveryState: string | null;
      requestId: string | null;
      modelId: string | null;
      createdAt: string | null;
      ageHours: number | null;
      nextRecoveryAt: string | null;
    }>;
    successWithoutOutputCount: number;
    successWithoutOutputSample: Array<{
      id: string;
      requestId: string | null;
      modelId: string | null;
      completedAt: string | null;
    }>;
    projectScopedSuccessMissingAssociationCount: number;
    projectScopedSuccessMissingAssociationSample: Array<{
      id: string;
      projectId: string;
      requestId: string | null;
      modelId: string | null;
      completedAt: string | null;
    }>;
  };
  reservations: {
    total: number;
    byStatus: Record<string, number>;
    reservedWithProviderOver1hCount: number;
    reservedWithoutProviderOver15mCount: number;
    reservedLinkedTerminalGenerationCount: number;
    topCapturedModels: Array<{ modelId: string; cents: number }>;
  };
  findings: HealthFinding[];
  nextSteps: string[];
};

export type AdminHealthAuthUser = {
  id: string;
  email?: string | null;
  created_at?: string | null;
  last_sign_in_at?: string | null;
};

export type BuildAdminHealthResponseArgs = {
  lookup: string;
  lookupMode: LookupMode;
  lookbackDays: number;
  authUser: AdminHealthAuthUser;
  generationsSelectUsed: string;
  reservationsSupported: boolean;
  ledgerLegacySchema: boolean;
  compatibilityWarnings: string[];
  balance: BalanceRow | null;
  generations: GenerationRow[];
  attempts: AttemptRow[];
  outputs: OutputRow[];
  projectGenerationItems?: ProjectGenerationItemRow[];
  generationProjectionProjects?: GenerationProjectionProjectRow[];
  generationProjectionBillingRows?: GenerationProjectionBillingRow[];
  activeProjectIds?: string[];
  reservations: ReservationRow[];
  creditGrantSummary: CreditGrantSummary;
  ledger: NormalizedLedgerRow[];
  nowMs?: number;
};

const toDayKey = (timestampMs: number): string => new Date(timestampMs).toISOString().slice(0, 10);

const isUserAbandonedNoRefundGeneration = (row: GenerationRow | null | undefined): boolean => {
  if (!row) return false;
  const metadata = asRecord(row.metadata);
  return (
    row.failure_reason_code === "user_abandoned" ||
    metadata.user_abandoned === true ||
    metadata.abandoned_no_refund === true
  );
};

const buildWindowGenerationSummary = (rows: GenerationRow[]) => {
  const success = rows.filter((row) => row.status === "success").length;
  const fail = rows.filter(
    (row) => row.status === "fail" && !isUserAbandonedNoRefundGeneration(row)
  ).length;
  return {
    total: rows.length,
    success,
    fail,
    failRatePercent: ratioPercent(fail, rows.length),
  };
};

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const asTrimmedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const readGenerationProjectId = (row: GenerationRow): string | null => {
  const metadata = asRecord(row.metadata);
  const shortpulseContext = asRecord(metadata.shortpulse_context ?? metadata.shortpulseContext);
  return (
    asTrimmedString(metadata.project_id) ??
    asTrimmedString(metadata.projectId) ??
    asTrimmedString(shortpulseContext.project_id) ??
    asTrimmedString(shortpulseContext.projectId)
  );
};

const readGenerationSourceRef = (row: GenerationRow): string | null => {
  const metadata = asRecord(row.metadata);
  return asTrimmedString(metadata.source_ref);
};

export const buildAdminHealthResponse = ({
  lookup,
  lookupMode,
  lookbackDays,
  authUser,
  generationsSelectUsed,
  reservationsSupported,
  ledgerLegacySchema,
  compatibilityWarnings,
  balance,
  generations,
  attempts,
  outputs,
  projectGenerationItems = [],
  generationProjectionProjects = [],
  generationProjectionBillingRows = [],
  activeProjectIds,
  reservations,
  creditGrantSummary,
  ledger,
  nowMs = Date.now(),
}: BuildAdminHealthResponseArgs): AdminHealthResponse => {
  const availableCents = Number(balance?.balance_cents ?? 0);
  if (!creditGrantSummary) {
    throw new Error("Credit grant summary is required for admin health credit metrics.");
  }
  const reservedCents = creditGrantSummary.reservedCents;
  const spendableCents = creditGrantSummary.spendableCents;

  const generationById = new Map<string, GenerationRow>();
  generations.forEach((row) => {
    generationById.set(row.id, row);
  });

  const generationByRequestId = new Map<string, GenerationRow>();
  const generationBySourceRef = new Map<string, GenerationRow>();
  generations.forEach((row) => {
    if (!row.request_id) return;
    if (!generationByRequestId.has(row.request_id)) {
      generationByRequestId.set(row.request_id, row);
    }
  });
  generations.forEach((row) => {
    const sourceRef = readGenerationSourceRef(row);
    if (!sourceRef || generationBySourceRef.has(sourceRef)) return;
    generationBySourceRef.set(sourceRef, row);
  });

  const generationByAttemptProviderRequestId = new Map<string, GenerationRow>();
  const attemptCountByGenerationId = new Map<string, number>();
  attempts.forEach((row) => {
    if (row.generation_id) {
      attemptCountByGenerationId.set(
        row.generation_id,
        (attemptCountByGenerationId.get(row.generation_id) ?? 0) + 1
      );
    }
    if (!row.provider_request_id || !row.generation_id) return;
    const generation = generationById.get(row.generation_id);
    if (!generation) return;
    if (!generationByAttemptProviderRequestId.has(row.provider_request_id)) {
      generationByAttemptProviderRequestId.set(row.provider_request_id, generation);
    }
  });

  const outputCountByGenerationId = new Map<string, number>();
  outputs.forEach((row) => {
    if (!row.generation_id) return;
    outputCountByGenerationId.set(
      row.generation_id,
      (outputCountByGenerationId.get(row.generation_id) ?? 0) + 1
    );
  });

  const projectGenerationAssociationKeys = new Set<string>();
  [...projectGenerationItems, ...generationProjectionProjects].forEach((row) => {
    const projectId = asTrimmedString(row.project_id);
    const generationId = asTrimmedString(row.generation_id);
    if (!projectId || !generationId) return;
    projectGenerationAssociationKeys.add(`${projectId}:${generationId}`);
  });

  const reservationBySourceRef = new Map<string, ReservationRow>();
  reservations.forEach((row) => {
    if (!row.source_ref) return;
    if (!reservationBySourceRef.has(row.source_ref)) {
      reservationBySourceRef.set(row.source_ref, row);
    }
  });
  const projectionBillingBySourceRef = new Map<string, GenerationProjectionBillingRow>();
  const projectionBillingByProviderRequestId = new Map<string, GenerationProjectionBillingRow>();
  generationProjectionBillingRows.forEach((row) => {
    if (row.source_ref && !projectionBillingBySourceRef.has(row.source_ref)) {
      projectionBillingBySourceRef.set(row.source_ref, row);
    }
    if (
      row.provider_request_id &&
      !projectionBillingByProviderRequestId.has(row.provider_request_id)
    ) {
      projectionBillingByProviderRequestId.set(row.provider_request_id, row);
    }
    if (row.request_id && !projectionBillingByProviderRequestId.has(row.request_id)) {
      projectionBillingByProviderRequestId.set(row.request_id, row);
    }
  });
  const resolveBillingProjection = (
    sourceRef: string | null,
    providerRequestId: string | null
  ): GenerationProjectionBillingRow | null => {
    if (sourceRef) {
      const bySourceRef = projectionBillingBySourceRef.get(sourceRef);
      if (bySourceRef) return bySourceRef;
    }
    if (providerRequestId) {
      const byProviderRequestId = projectionBillingByProviderRequestId.get(providerRequestId);
      if (byProviderRequestId) return byProviderRequestId;
    }
    return null;
  };
  const hasSuccessfulProjectionMedia = (
    projection: GenerationProjectionBillingRow | null | undefined
  ): boolean => {
    const projectionStatus = projection?.task_state ?? projection?.status ?? null;
    const projectionResultUrls = Array.isArray(projection?.result_urls)
      ? projection.result_urls
      : [];
    return (
      projectionStatus === "success" &&
      (projectionResultUrls.length > 0 || Boolean(projection?.preview_url))
    );
  };
  const remainingRefundCentsBySourceRef = new Map<string, number>();
  ledger.forEach((row) => {
    if (row.change_cents <= 0 || !row.source_ref) return;
    if (row.source !== "generation_refund") return;
    remainingRefundCentsBySourceRef.set(
      row.source_ref,
      (remainingRefundCentsBySourceRef.get(row.source_ref) ?? 0) + row.change_cents
    );
  });

  const lookbackMs = lookbackDays * DAY_MS;
  const dailyDebitsMap = new Map<
    string,
    { totalDebitCents: number; generationDebitCents: number }
  >();
  const topDebitSourcesMap = new Map<string, number>();

  let totalGrantsCents = 0;
  let totalDebitsCentsAbs = 0;
  let generationDebitsCentsAbs = 0;
  let debits24h = 0;
  let generationDebits24h = 0;
  let debits7d = 0;
  let generationDebits7d = 0;
  let debits30d = 0;
  let generationDebits30d = 0;

  const costWithoutSuccessSample: AdminHealthResponse["drainage"]["costWithoutSuccessfulGeneration"]["sample"] =
    [];
  let costWithoutSuccessCents = 0;
  let costWithoutSuccessRows = 0;
  const linkedNonSuccessCostSample: AdminHealthResponse["drainage"]["costWithoutSuccessfulGeneration"]["linkedNonSuccessGeneration"]["sample"] =
    [];
  const missingLinkageCostSample: AdminHealthResponse["drainage"]["costWithoutSuccessfulGeneration"]["missingLinkageData"]["sample"] =
    [];
  let linkedNonSuccessCostCents = 0;
  let linkedNonSuccessCostRows = 0;
  let missingLinkageCostCents = 0;
  let missingLinkageCostRows = 0;

  ledger.forEach((row) => {
    const change = Number(row.change_cents ?? 0);
    const createdAtMs = parseTimestamp(row.created_at);
    if (change > 0) {
      totalGrantsCents += change;
      return;
    }
    if (change >= 0) return;

    let debitAbs = Math.abs(change);
    totalDebitsCentsAbs += debitAbs;
    if (row.source === "generation_charge") {
      generationDebitsCentsAbs += debitAbs;
    }

    if (createdAtMs !== null) {
      const ageMs = nowMs - createdAtMs;
      if (ageMs <= DAY_MS) {
        debits24h += debitAbs;
        if (row.source === "generation_charge") generationDebits24h += debitAbs;
      }
      if (ageMs <= 7 * DAY_MS) {
        debits7d += debitAbs;
        if (row.source === "generation_charge") generationDebits7d += debitAbs;
      }
      if (ageMs <= 30 * DAY_MS) {
        debits30d += debitAbs;
        if (row.source === "generation_charge") generationDebits30d += debitAbs;
      }
      if (ageMs <= lookbackMs) {
        const dayKey = toDayKey(createdAtMs);
        const existing = dailyDebitsMap.get(dayKey) ?? {
          totalDebitCents: 0,
          generationDebitCents: 0,
        };
        existing.totalDebitCents += debitAbs;
        if (row.source === "generation_charge") {
          existing.generationDebitCents += debitAbs;
        }
        dailyDebitsMap.set(dayKey, existing);

        const debitSource = row.source || "unknown";
        topDebitSourcesMap.set(debitSource, (topDebitSourcesMap.get(debitSource) ?? 0) + debitAbs);
      }
    }

    if (row.source === "generation_charge" && row.created_at) {
      const createdAtMsForCost = parseTimestamp(row.created_at);
      if (createdAtMsForCost !== null && nowMs - createdAtMsForCost <= lookbackMs) {
        if (row.source_ref) {
          const remainingRefund = remainingRefundCentsBySourceRef.get(row.source_ref) ?? 0;
          if (remainingRefund > 0) {
            const appliedRefund = Math.min(remainingRefund, debitAbs);
            remainingRefundCentsBySourceRef.set(row.source_ref, remainingRefund - appliedRefund);
            debitAbs -= appliedRefund;
          }
        }
        if (debitAbs <= 0) return;

        let generationStatus: string | null = null;
        let canonicalSuccessEvidence = false;
        let intentionalNoRefundAbandonment = false;
        let bucket: "linked_non_success_generation" | "missing_linkage_data" =
          "missing_linkage_data";
        let reason = "No linked reservation found for charge row.";
        if (row.source_ref) {
          const reservation = reservationBySourceRef.get(row.source_ref);
          const metadataProviderRequestId =
            typeof row.metadata?.provider_request_id === "string"
              ? row.metadata.provider_request_id
              : null;
          if (reservation?.provider_request_id) {
            const generation =
              generationByRequestId.get(reservation.provider_request_id) ??
              generationByRequestId.get(row.source_ref) ??
              generationByAttemptProviderRequestId.get(reservation.provider_request_id) ??
              generationBySourceRef.get(row.source_ref);
            const projection = resolveBillingProjection(
              row.source_ref,
              metadataProviderRequestId ?? reservation.provider_request_id
            );
            const projectionStatus = projection?.task_state ?? projection?.status ?? null;
            generationStatus = generation?.status ?? projectionStatus ?? null;
            const linkedGenerationSuccess = generation?.status === "success";
            canonicalSuccessEvidence =
              (generation?.id !== undefined &&
                (outputCountByGenerationId.get(generation.id) ?? 0) > 0) ||
              hasSuccessfulProjectionMedia(projection);
            intentionalNoRefundAbandonment = isUserAbandonedNoRefundGeneration(generation);
            if (
              linkedGenerationSuccess ||
              canonicalSuccessEvidence ||
              intentionalNoRefundAbandonment
            ) {
              reason = "";
            } else if (generationStatus) {
              reason = `Linked generation is ${generationStatus}.`;
              bucket = "linked_non_success_generation";
            } else {
              reason = "Linked provider request has no matching generation row.";
            }
          } else if (reservation) {
            reason = "Reservation has no provider_request_id linkage.";
          } else {
            const generation = generationBySourceRef.get(row.source_ref) ?? null;
            const projection = resolveBillingProjection(row.source_ref, metadataProviderRequestId);
            const projectionStatus = projection?.task_state ?? projection?.status ?? null;
            generationStatus = generation?.status ?? projectionStatus;
            canonicalSuccessEvidence =
              (generation?.id !== undefined &&
                (outputCountByGenerationId.get(generation.id) ?? 0) > 0) ||
              hasSuccessfulProjectionMedia(projection);
            intentionalNoRefundAbandonment = isUserAbandonedNoRefundGeneration(generation);
            reason = canonicalSuccessEvidence
              ? ""
              : generationStatus
                ? `Linked source_ref generation is ${generationStatus}.`
                : "No reservation linkage and no successful projection media found for charge row.";
            if (generationStatus) {
              bucket = "linked_non_success_generation";
            }
          }
        } else {
          reason = "Generation charge row has no source_ref.";
        }

        if (
          generationStatus !== "success" &&
          !canonicalSuccessEvidence &&
          !intentionalNoRefundAbandonment
        ) {
          costWithoutSuccessCents += debitAbs;
          costWithoutSuccessRows += 1;
          if (costWithoutSuccessSample.length < 20) {
            costWithoutSuccessSample.push({
              sourceRef: row.source_ref,
              amountCents: debitAbs,
              reason,
              generationStatus,
              bucket,
            });
          }
          if (bucket === "linked_non_success_generation") {
            linkedNonSuccessCostCents += debitAbs;
            linkedNonSuccessCostRows += 1;
            if (linkedNonSuccessCostSample.length < 20) {
              linkedNonSuccessCostSample.push({
                sourceRef: row.source_ref,
                amountCents: debitAbs,
                reason,
                generationStatus,
              });
            }
          } else {
            missingLinkageCostCents += debitAbs;
            missingLinkageCostRows += 1;
            if (missingLinkageCostSample.length < 20) {
              missingLinkageCostSample.push({
                sourceRef: row.source_ref,
                amountCents: debitAbs,
                reason,
                generationStatus,
              });
            }
          }
        }
      }
    }
  });

  const dailyDebits = Array.from(dailyDebitsMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, value]) => ({
      day,
      totalDebitCents: value.totalDebitCents,
      generationDebitCents: value.generationDebitCents,
    }));

  const topDebitSources = Array.from(topDebitSourcesMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([source, cents]) => ({ source, cents }));

  const windowSummaries: WindowSummary[] = [
    {
      window: "24h",
      totalDebitCents: debits24h,
      generationDebitCents: generationDebits24h,
      nonGenerationDebitCents: Math.max(0, debits24h - generationDebits24h),
      avgPerDayCents: Math.round(debits24h * 100) / 100,
    },
    {
      window: "7d",
      totalDebitCents: debits7d,
      generationDebitCents: generationDebits7d,
      nonGenerationDebitCents: Math.max(0, debits7d - generationDebits7d),
      avgPerDayCents: Math.round((debits7d / 7) * 100) / 100,
    },
    {
      window: "30d",
      totalDebitCents: debits30d,
      generationDebitCents: generationDebits30d,
      nonGenerationDebitCents: Math.max(0, debits30d - generationDebits30d),
      avgPerDayCents: Math.round((debits30d / 30) * 100) / 100,
    },
  ];

  const generationsByStatus = computeStatusCounts(generations);
  const recentByWindow = (days: number) =>
    generations.filter((row) => {
      const createdAtMs = parseTimestamp(row.created_at);
      return createdAtMs !== null && nowMs - createdAtMs <= days * DAY_MS;
    });

  const last24hGenerations = recentByWindow(1);
  const last7dGenerations = recentByWindow(7);
  const last30dGenerations = recentByWindow(30);

  const failReasonsMap = new Map<string, number>();
  generations.forEach((row) => {
    if (row.status !== "fail") return;
    const createdAtMs = parseTimestamp(row.created_at);
    if (createdAtMs === null || nowMs - createdAtMs > lookbackMs) return;
    const reason = row.failure_reason_code ?? "unknown";
    failReasonsMap.set(reason, (failReasonsMap.get(reason) ?? 0) + 1);
  });
  const topFailReasonsLookback = Array.from(failReasonsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([reason, count]) => ({ reason, count }));

  const delayedOver30m = generations.filter((row) => {
    const hasProviderIdentity =
      Boolean(row.request_id) || (attemptCountByGenerationId.get(row.id) ?? 0) > 0;
    if (!hasProviderIdentity) return false;
    const status = row.status ?? "";
    if (!["pending", "submitted", "running", "fail"].includes(status)) return false;
    const recoveryState = row.recovery_state ?? "none";
    if (!["queued", "recovering"].includes(recoveryState)) return false;
    const createdAtMs = parseTimestamp(row.created_at);
    if (createdAtMs === null) return false;
    return nowMs - createdAtMs >= STUCK_GENERATION_WARNING_MS;
  });

  const stuckOver1h = delayedOver30m.filter((row) => {
    const createdAtMs = parseTimestamp(row.created_at);
    if (createdAtMs === null) return false;
    return nowMs - createdAtMs >= STUCK_GENERATION_CRITICAL_MS;
  });

  const reservationsByStatus = computeStatusCounts(reservations);
  const reservedWithProviderOver1h = reservations.filter((row) => {
    if (row.status !== "reserved" || !row.provider_request_id) return false;
    const createdAtMs = parseTimestamp(row.created_at);
    if (createdAtMs === null) return false;
    return nowMs - createdAtMs >= PROVIDER_ATTACHED_RESERVED_HOLD_CRITICAL_MS;
  });
  const reservedWithoutProviderOver15m = reservations.filter((row) => {
    if (row.status !== "reserved" || row.provider_request_id) return false;
    const createdAtMs = parseTimestamp(row.created_at);
    if (createdAtMs === null) return false;
    return nowMs - createdAtMs >= PRE_SUBMIT_RESERVED_HOLD_WARNING_MS;
  });

  const generationForProviderRequestId = (
    providerRequestId: string | null
  ): GenerationRow | null => {
    if (!providerRequestId) return null;
    const projectionGenerationId =
      projectionBillingByProviderRequestId.get(providerRequestId)?.generation_id ?? null;
    return (
      generationByRequestId.get(providerRequestId) ??
      generationByAttemptProviderRequestId.get(providerRequestId) ??
      (projectionGenerationId ? (generationById.get(projectionGenerationId) ?? null) : null) ??
      null
    );
  };
  const reservedLinkedTerminalGeneration = reservations.filter((row) => {
    if (row.status !== "reserved" || !row.provider_request_id) return false;
    const generation = generationForProviderRequestId(row.provider_request_id);
    return generation?.status === "success" || generation?.status === "fail";
  });

  const capturedByModelMap = new Map<string, number>();
  reservations.forEach((row) => {
    if (row.status !== "captured") return;
    const modelId = row.model_id ?? "unknown";
    const amount = Math.abs(Number(row.amount_cents ?? 0));
    capturedByModelMap.set(modelId, (capturedByModelMap.get(modelId) ?? 0) + amount);
  });
  const topCapturedModels = Array.from(capturedByModelMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([modelId, cents]) => ({ modelId, cents }));

  const successWithoutOutputs = generations.filter(
    (row) => row.status === "success" && (outputCountByGenerationId.get(row.id) ?? 0) === 0
  );
  const successWithoutOutputsInLookback = successWithoutOutputs.filter((row) => {
    const terminalAtMs = parseTimestamp(row.completed_at) ?? parseTimestamp(row.created_at);
    return terminalAtMs !== null && nowMs - terminalAtMs <= lookbackMs;
  });
  const activeProjectIdSet = activeProjectIds ? new Set(activeProjectIds) : null;
  const projectScopedSuccessMissingAssociation = generations.filter((row) => {
    if (row.status !== "success") return false;
    const projectId = readGenerationProjectId(row);
    if (!projectId) return false;
    if (activeProjectIdSet && !activeProjectIdSet.has(projectId)) return false;
    return !projectGenerationAssociationKeys.has(`${projectId}:${row.id}`);
  });

  const findings: HealthFinding[] = [];
  const addFinding = (
    severity: FindingSeverity,
    confidence: FindingConfidence,
    code: string,
    summary: string,
    details: string,
    recommendedActions: string[]
  ) => {
    findings.push({ severity, confidence, code, summary, details, recommendedActions });
  };

  if (reservedWithProviderOver1h.length > 0 || reservedWithoutProviderOver15m.length > 0) {
    addFinding(
      "critical",
      "high",
      "ACTIVE_RESERVED_HOLDS",
      "Found aged active reservation holds.",
      `${reservedWithProviderOver1h.length} provider-attached holds are older than 1h; ${reservedWithoutProviderOver15m.length} pre-submit holds are older than 15m.`,
      [
        "Run /api/internal/generation-recovery/run and re-check reservation counts.",
        "Use /admin/generation-trace on affected source_ref/request_id values.",
        "Only after confirmation, use the guarded reservation tools tied to generation-trace evidence.",
      ]
    );
  } else if (reservedCents > 0) {
    addFinding(
      "warning",
      "medium",
      "ACTIVE_RESERVED_CREDITS",
      "User has active reserved credits.",
      `Reserved credits are ${reservedCents}.`,
      [
        "Verify this user still has active queued or running generations.",
        "If user is no longer active, trigger recovery pass and re-check.",
      ]
    );
  }

  if (reservedLinkedTerminalGeneration.length > 0) {
    addFinding(
      "critical",
      "high",
      "RESERVED_HOLD_LINKED_TERMINAL_GENERATION",
      "Reserved holds are linked to terminal generations.",
      `${reservedLinkedTerminalGeneration.length} reserved hold(s) have provider request ids that already map to success/fail generation rows.`,
      [
        "Run /api/internal/generation-recovery/run to settle terminal linked holds.",
        "Inspect affected source_ref/request_id pairs in /admin/generation-trace.",
        "Do not manually release until generation and ledger state agree.",
      ]
    );
  }

  if (stuckOver1h.length > 0) {
    addFinding(
      "critical",
      "high",
      "STUCK_GENERATIONS",
      "Stuck generations detected in queued/recovering states.",
      `${stuckOver1h.length} generation rows are older than 1h and still in queued/recovering states.`,
      [
        "Open /admin/generation-trace for one impacted generation/request.",
        "Run /api/admin/generation-recovery/replay for explicit stuck rows.",
        "Inspect provider status and failure codes before manual settlement actions.",
      ]
    );
  } else if (delayedOver30m.length > 0) {
    addFinding(
      "warning",
      "medium",
      "DELAYED_GENERATIONS",
      "Queued or recovering generations are aging past the normal recovery window.",
      `${delayedOver30m.length} generation rows are older than 30m and still in queued/recovering states.`,
      [
        "Run /api/internal/generation-recovery/run and verify rows converge.",
        "Inspect one affected row in /admin/generation-trace.",
        "If the same rows recur, audit scheduler health before changing cleanup thresholds.",
      ]
    );
  }

  if (successWithoutOutputsInLookback.length > 0) {
    addFinding(
      "critical",
      "high",
      "SUCCESS_WITHOUT_OUTPUTS",
      "Successful generations are missing canonical output rows.",
      `${successWithoutOutputsInLookback.length} success generation row(s) in the lookback window have no ai_generation_outputs rows, so they cannot reliably hydrate the reference grid. Total historical count: ${successWithoutOutputs.length}.`,
      [
        "Open /admin/generation-trace for the affected generation ids.",
        "Run targeted generation recovery/replay where provider media is still available.",
        "Audit provider persistence before marking additional rows successful.",
      ]
    );
  } else if (successWithoutOutputs.length > 0) {
    addFinding(
      "info",
      "medium",
      "HISTORICAL_SUCCESS_WITHOUT_OUTPUTS",
      "Historical successful generations are missing canonical output rows.",
      `${successWithoutOutputs.length} historical success generation row(s) have no ai_generation_outputs rows, but none are in the current lookback window.`,
      [
        "Treat these rows as historical restoration debt unless a user reports a specific missing artifact.",
        "Use targeted replay only for rows whose provider media is still available.",
      ]
    );
  }

  if (projectScopedSuccessMissingAssociation.length > 0) {
    addFinding(
      "critical",
      "high",
      "PROJECT_GENERATION_ASSOCIATION_DRIFT",
      "Project-scoped successful generations are missing project visibility links.",
      `${projectScopedSuccessMissingAssociation.length} project-scoped success row(s) have neither a generation_projection project_id nor a project_generation_items association.`,
      [
        "Backfill generation_projection.project_id for the listed project/generation pairs.",
        "Verify each active generation lane writes project_id into the canonical projection.",
        "Reload the affected project workspace after the projection is repaired.",
      ]
    );
  }

  const last24hSummary = buildWindowGenerationSummary(last24hGenerations);
  const last7dSummary = buildWindowGenerationSummary(last7dGenerations);
  const last30dSummary = buildWindowGenerationSummary(last30dGenerations);

  if (last24hSummary.failRatePercent >= 10) {
    addFinding(
      "warning",
      "medium",
      "HIGH_FAIL_RATE_24H",
      "24h generation fail rate is elevated.",
      `Last 24h fail rate is ${last24hSummary.failRatePercent.toFixed(2)}%.`,
      [
        "Break down failures by model and provider; compare with known provider incidents.",
        "Use /admin/errors and /admin/generation-trace for correlated request IDs.",
        "If model-specific, consider temporary traffic shift or model restrictions.",
      ]
    );
  }

  if (linkedNonSuccessCostCents > 0) {
    addFinding(
      "warning",
      "high",
      "CHARGED_LINKED_NON_SUCCESS_GENERATION",
      "Detected charges linked to non-success generation outcomes.",
      `${linkedNonSuccessCostRows} row(s) totaling ${linkedNonSuccessCostCents} credits in the lookback window are linked to generation rows that are not successful.`,
      [
        "Inspect affected source_ref rows in /admin/generation-trace and verify failure lifecycle.",
        "Confirm failure settlement policy and release/refund behavior for these rows.",
        "If customer-impacting, prepare targeted credit adjustment with source_ref evidence.",
      ]
    );
  }

  if (missingLinkageCostCents > 0) {
    addFinding(
      "warning",
      "medium",
      "CHARGED_MISSING_LINKAGE_DATA",
      "Detected charged rows with incomplete linkage data.",
      `${missingLinkageCostRows} row(s) totaling ${missingLinkageCostCents} credits in the lookback window cannot be confidently linked to a successful generation row.`,
      [
        "Inspect source_ref rows in /admin/generation-trace to confirm linkage gaps.",
        "Check reservation and ledger idempotency for affected source_ref keys.",
        "If confirmed customer-impacting, prepare targeted credit adjustment.",
      ]
    );
  }

  compatibilityWarnings.forEach((warningText, index) => {
    addFinding(
      "info",
      "high",
      `COMPATIBILITY_${index + 1}`,
      "Legacy schema compatibility fallback was used.",
      warningText,
      [
        "Plan migration parity updates for full-fidelity diagnostics.",
        "Re-run this health check after migration alignment.",
      ]
    );
  });

  if (findings.length === 0) {
    addFinding(
      "info",
      "medium",
      "HEALTHY_BASELINE",
      "No high-risk credit or generation health signals were detected.",
      "No stuck rows, no aged holds, and no settlement leakage were detected in this snapshot.",
      [
        "Keep monitoring via this report and /admin/errors.",
        "Re-run after major incidents or customer billing tickets.",
      ]
    );
  }

  const nextSteps = pushUniqueSteps(
    findings.flatMap((finding) => finding.recommendedActions).slice(0, 12)
  ).slice(0, 8);

  return {
    generatedAt: new Date(nowMs).toISOString(),
    lookbackDays,
    target: {
      lookup,
      lookupMode,
      userId: authUser.id,
      email: authUser.email ?? null,
      createdAt: authUser.created_at ?? null,
      lastSignInAt: authUser.last_sign_in_at ?? null,
    },
    compatibility: {
      generationsSelectUsed,
      attemptsSupported:
        attempts.length > 0 ||
        compatibilityWarnings.every((warning) => !warning.includes("generation_attempts")),
      outputsSupported:
        outputs.length > 0 ||
        compatibilityWarnings.every((warning) => !warning.includes("ai_generation_outputs")),
      reservationsSupported,
      ledgerLegacySchema,
      warnings: compatibilityWarnings,
    },
    credits: {
      availableCents,
      reservedCents,
      spendableCents,
      balanceUpdatedAt: balance?.updated_at ?? null,
      totalGrantsCents,
      totalDebitsCentsAbs,
      generationDebitsCentsAbs,
    },
    drainage: {
      windows: windowSummaries,
      dailyDebits,
      topDebitSources,
      costWithoutSuccessfulGeneration: {
        debitCents: costWithoutSuccessCents,
        rowCount: costWithoutSuccessRows,
        sample: costWithoutSuccessSample,
        linkedNonSuccessGeneration: {
          debitCents: linkedNonSuccessCostCents,
          rowCount: linkedNonSuccessCostRows,
          sample: linkedNonSuccessCostSample,
        },
        missingLinkageData: {
          debitCents: missingLinkageCostCents,
          rowCount: missingLinkageCostRows,
          sample: missingLinkageCostSample,
        },
      },
    },
    generations: {
      total: generations.length,
      byStatus: generationsByStatus,
      last24h: last24hSummary,
      last7d: last7dSummary,
      last30d: last30dSummary,
      topFailReasonsLookback,
      stuckOver1hCount: stuckOver1h.length,
      stuckOver1hSample: stuckOver1h.slice(0, 20).map((row) => {
        const createdAtMs = parseTimestamp(row.created_at);
        return {
          id: row.id,
          status: row.status ?? null,
          recoveryState: row.recovery_state ?? null,
          requestId: row.request_id ?? null,
          modelId: row.model_id ?? null,
          createdAt: row.created_at ?? null,
          ageHours:
            createdAtMs !== null ? Math.round(((nowMs - createdAtMs) / HOUR_MS) * 100) / 100 : null,
          nextRecoveryAt: row.next_recovery_at ?? null,
        };
      }),
      successWithoutOutputCount: successWithoutOutputs.length,
      successWithoutOutputSample: successWithoutOutputs.slice(0, 20).map((row) => ({
        id: row.id,
        requestId: row.request_id ?? null,
        modelId: row.model_id ?? null,
        completedAt: row.completed_at ?? null,
      })),
      projectScopedSuccessMissingAssociationCount: projectScopedSuccessMissingAssociation.length,
      projectScopedSuccessMissingAssociationSample: projectScopedSuccessMissingAssociation
        .slice(0, 20)
        .map((row) => ({
          id: row.id,
          projectId: readGenerationProjectId(row) ?? "",
          requestId: row.request_id ?? null,
          modelId: row.model_id ?? null,
          completedAt: row.completed_at ?? null,
        })),
    },
    reservations: {
      total: reservations.length,
      byStatus: reservationsByStatus,
      reservedWithProviderOver1hCount: reservedWithProviderOver1h.length,
      reservedWithoutProviderOver15mCount: reservedWithoutProviderOver15m.length,
      reservedLinkedTerminalGenerationCount: reservedLinkedTerminalGeneration.length,
      topCapturedModels,
    },
    findings,
    nextSteps,
  };
};
