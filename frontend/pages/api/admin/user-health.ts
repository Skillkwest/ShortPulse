/**
 * Admin API: user health diagnostics for generation and credit-drain analysis.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";
import {
  DEFAULT_DEEP_LOOKBACK_DAYS,
  MAX_DEEP_LOOKBACK_DAYS,
  asLookupMode,
  asPositiveInt,
  asSingleString,
  computeStatusCounts,
  isSchemaCompatibilityError,
  normalizeQueryError,
  parseTimestamp,
  pushUniqueSteps,
  ratioPercent,
  type DeepLookupMode as LookupMode,
  type DeepQueryError as QueryError,
} from "../../../lib/server/adminUserHealth/deep";
import { resolveAdminHealthAuthUser } from "../../../lib/server/adminUserHealth/targetLookup";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DB_PAGE_SIZE = 1000;
const DB_MAX_PAGES = 50;

type FindingSeverity = "info" | "warning" | "critical";
type FindingConfidence = "high" | "medium" | "low";

type AdminHealthRequest = {
  lookup: string;
  lookupMode?: LookupMode;
  lookbackDays?: number;
};

type BalanceRow = {
  user_id: string;
  balance_cents: number | string | null;
  updated_at: string | null;
};

type GenerationRow = {
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
};

type ReservationRow = {
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

type QueueRow = {
  id: string;
  generation_id: string | null;
  status: string | null;
  model_id: string | null;
  source_ref: string | null;
  attempts: number | null;
  created_at: string | null;
  updated_at: string | null;
  last_error_code: string | null;
};

type RichLedgerRow = {
  id: string;
  user_id: string;
  change_cents: number | string | null;
  reason: string | null;
  source: string | null;
  source_ref: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

type LegacyLedgerRow = {
  id: string;
  user_id: string;
  change_cents: number | string | null;
  reason: string | null;
  ref_id: string | null;
  created_at: string | null;
};

type NormalizedLedgerRow = {
  id: string;
  user_id: string;
  change_cents: number;
  reason: string;
  source: string;
  source_ref: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

type HealthFinding = {
  code: string;
  severity: FindingSeverity;
  confidence: FindingConfidence;
  summary: string;
  details: string;
  recommendedActions: string[];
};

type WindowSummary = {
  window: "24h" | "7d" | "30d";
  totalDebitCents: number;
  generationDebitCents: number;
  nonGenerationDebitCents: number;
  avgPerDayCents: number;
};

type HealthResponse = {
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
    reservationsSupported: boolean;
    queueSupported: boolean;
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
    stuckOver2hCount: number;
    stuckOver2hSample: Array<{
      id: string;
      status: string | null;
      recoveryState: string | null;
      requestId: string | null;
      modelId: string | null;
      createdAt: string | null;
      ageHours: number | null;
      nextRecoveryAt: string | null;
    }>;
  };
  reservations: {
    total: number;
    byStatus: Record<string, number>;
    reservedWithProviderOver2hCount: number;
    reservedWithoutProviderOver15mCount: number;
    topCapturedModels: Array<{ modelId: string; cents: number }>;
  };
  queue: {
    total: number;
    byStatus: Record<string, number>;
    exhaustedCount: number;
    exhaustedWithReleasedReservationCount: number;
    exhaustedWithChargeCount: number;
    oldestCreatedAt: string | null;
    recentExhaustedSample: Array<{
      queueId: string;
      sourceRef: string | null;
      modelId: string | null;
      errorCode: string | null;
      generationStatus: string | null;
      reservationStatus: string | null;
      chargeCount: number;
      createdAt: string | null;
    }>;
  };
  findings: HealthFinding[];
  nextSteps: string[];
};

const toDayKey = (timestampMs: number): string => new Date(timestampMs).toISOString().slice(0, 10);

const fetchAllRowsForSelect = async <TRow>(
  fetchPage: (
    from: number,
    to: number
  ) => Promise<{ data: TRow[] | null; error: QueryError | null }>
): Promise<{ rows: TRow[]; error: QueryError | null }> => {
  const rows: TRow[] = [];
  for (let page = 0; page < DB_MAX_PAGES; page += 1) {
    const from = page * DB_PAGE_SIZE;
    const to = from + DB_PAGE_SIZE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) {
      return { rows: [], error };
    }
    const pageRows = Array.isArray(data) ? data : [];
    rows.push(...pageRows);
    if (pageRows.length < DB_PAGE_SIZE) break;
  }
  return { rows, error: null };
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse | { error: string }>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) return;

  const body = (req.body ?? {}) as Partial<AdminHealthRequest>;
  const lookup = asSingleString(body.lookup).trim();
  const lookupMode = asLookupMode(body.lookupMode);
  const lookbackDays = Math.min(
    MAX_DEEP_LOOKBACK_DAYS,
    asPositiveInt(body.lookbackDays, DEFAULT_DEEP_LOOKBACK_DAYS)
  );

  if (!lookup) {
    return res.status(400).json({ error: "lookup is required." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const compatibilityWarnings: string[] = [];

    const authUser = await resolveAdminHealthAuthUser({
      supabaseAdmin,
      lookup,
      lookupMode,
    });

    if (!authUser) {
      return res.status(404).json({ error: "User not found." });
    }

    const userId = authUser.id;

    const [balanceResult, generationsResult, reservationsResult, queueResult, ledgerResult] =
      await Promise.all([
        supabaseAdmin
          .from("ai_credit_balance")
          .select("user_id, balance_cents, updated_at")
          .eq("user_id", userId)
          .limit(1),
        (async () => {
          const generationSelectFallbacks = [
            "id,status,recovery_state,provider,model_id,request_id,created_at,completed_at,failure_reason_code,next_recovery_at",
            "id,status,recovery_state,provider,model_id,request_id,created_at,completed_at,next_recovery_at",
            "id,status,provider,model_id,request_id,created_at,completed_at",
          ];
          for (const selectExpression of generationSelectFallbacks) {
            const rowsResult = await fetchAllRowsForSelect<GenerationRow>(async (from, to) => {
              const query = supabaseAdmin
                .from("ai_generations")
                .select(selectExpression)
                .eq("user_id", userId)
                .order("created_at", { ascending: false })
                .range(from, to);
              const { data, error } = await query;
              return {
                data: (data as GenerationRow[] | null) ?? null,
                error: normalizeQueryError(error),
              };
            });
            if (!rowsResult.error) {
              return {
                supported: true,
                selectUsed: selectExpression,
                rows: rowsResult.rows,
              };
            }
            if (!isSchemaCompatibilityError(rowsResult.error)) {
              throw new Error(rowsResult.error.message || "Failed to load ai_generations.");
            }
          }
          return {
            supported: false,
            selectUsed: "",
            rows: [] as GenerationRow[],
          };
        })(),
        (async () => {
          const selectExpression =
            "id,status,source_ref,provider_request_id,model_id,amount_cents,metadata,created_at,released_at,captured_at";
          const rowsResult = await fetchAllRowsForSelect<ReservationRow>(async (from, to) => {
            const query = supabaseAdmin
              .from("ai_credit_reservations")
              .select(selectExpression)
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .range(from, to);
            const { data, error } = await query;
            return {
              data: (data as ReservationRow[] | null) ?? null,
              error: normalizeQueryError(error),
            };
          });
          if (!rowsResult.error) {
            return {
              supported: true,
              rows: rowsResult.rows,
            };
          }
          if (isSchemaCompatibilityError(rowsResult.error)) {
            compatibilityWarnings.push(
              "ai_credit_reservations is unavailable or legacy in this environment; hold diagnostics are partial."
            );
            return {
              supported: false,
              rows: [] as ReservationRow[],
            };
          }
          throw new Error(rowsResult.error.message || "Failed to load ai_credit_reservations.");
        })(),
        (async () => {
          const selectExpression =
            "id,generation_id,status,model_id,source_ref,attempts,created_at,updated_at,last_error_code";
          const rowsResult = await fetchAllRowsForSelect<QueueRow>(async (from, to) => {
            const query = supabaseAdmin
              .from("ai_generation_submit_queue")
              .select(selectExpression)
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .range(from, to);
            const { data, error } = await query;
            return { data: (data as QueueRow[] | null) ?? null, error: normalizeQueryError(error) };
          });
          if (!rowsResult.error) {
            return {
              supported: true,
              rows: rowsResult.rows,
            };
          }
          if (isSchemaCompatibilityError(rowsResult.error)) {
            compatibilityWarnings.push(
              "ai_generation_submit_queue is unavailable in this environment; queue diagnostics are partial."
            );
            return {
              supported: false,
              rows: [] as QueueRow[],
            };
          }
          throw new Error(rowsResult.error.message || "Failed to load ai_generation_submit_queue.");
        })(),
        (async () => {
          const richSelect = "id,user_id,change_cents,reason,source,source_ref,metadata,created_at";
          const richRows = await fetchAllRowsForSelect<RichLedgerRow>(async (from, to) => {
            const query = supabaseAdmin
              .from("ai_credit_ledger")
              .select(richSelect)
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .range(from, to);
            const { data, error } = await query;
            return {
              data: (data as RichLedgerRow[] | null) ?? null,
              error: normalizeQueryError(error),
            };
          });
          if (!richRows.error) {
            const normalizedRows: NormalizedLedgerRow[] = richRows.rows.map((row) => ({
              id: String(row.id),
              user_id: String(row.user_id),
              change_cents: Number(row.change_cents ?? 0),
              reason: row.reason ?? "",
              source: row.source ?? "system",
              source_ref: row.source_ref ?? null,
              metadata: row.metadata ?? null,
              created_at: row.created_at ?? null,
            }));
            return { legacySchema: false, rows: normalizedRows };
          }

          if (!isSchemaCompatibilityError(richRows.error)) {
            throw new Error(richRows.error.message || "Failed to load ai_credit_ledger.");
          }

          const legacySelect = "id,user_id,change_cents,reason,ref_id,created_at";
          const legacyRows = await fetchAllRowsForSelect<LegacyLedgerRow>(async (from, to) => {
            const query = supabaseAdmin
              .from("ai_credit_ledger")
              .select(legacySelect)
              .eq("user_id", userId)
              .order("created_at", { ascending: false })
              .range(from, to);
            const { data, error } = await query;
            return {
              data: (data as LegacyLedgerRow[] | null) ?? null,
              error: normalizeQueryError(error),
            };
          });
          if (legacyRows.error) {
            throw new Error(legacyRows.error.message || "Failed to load ai_credit_ledger.");
          }
          compatibilityWarnings.push(
            "ai_credit_ledger is using a legacy schema (ref_id fallback); some attribution is reduced."
          );
          const normalizedRows: NormalizedLedgerRow[] = legacyRows.rows.map((row) => ({
            id: String(row.id),
            user_id: String(row.user_id),
            change_cents: Number(row.change_cents ?? 0),
            reason: row.reason ?? "",
            source: "legacy",
            source_ref: row.ref_id ?? null,
            metadata: null,
            created_at: row.created_at ?? null,
          }));
          return { legacySchema: true, rows: normalizedRows };
        })(),
      ]);

    const generationsSupported = generationsResult.supported;
    if (!generationsSupported) {
      compatibilityWarnings.push(
        "ai_generations schema is incompatible with expected diagnostics fields; generation analysis is partial."
      );
    }

    const generations = generationsResult.rows;
    const reservations = reservationsResult.rows;
    const queueRows = queueResult.rows;
    const ledger = ledgerResult.rows;

    if (balanceResult.error) {
      throw new Error(balanceResult.error.message || "Failed to load ai_credit_balance.");
    }
    const balanceRows = (balanceResult.data ?? []) as BalanceRow[];
    const balance = balanceRows[0] ?? null;
    const availableCents = Number(balance?.balance_cents ?? 0);
    const reservedCents = reservations
      .filter((row) => row.status === "reserved")
      .reduce((sum, row) => sum + Math.abs(Number(row.amount_cents ?? 0)), 0);
    const spendableCents = Math.max(0, availableCents - reservedCents);

    const generationByRequestId = new Map<string, GenerationRow>();
    generations.forEach((row) => {
      if (!row.request_id) return;
      if (!generationByRequestId.has(row.request_id)) {
        generationByRequestId.set(row.request_id, row);
      }
    });

    const reservationBySourceRef = new Map<string, ReservationRow>();
    reservations.forEach((row) => {
      if (!row.source_ref) return;
      if (!reservationBySourceRef.has(row.source_ref)) {
        reservationBySourceRef.set(row.source_ref, row);
      }
    });

    const generationChargeCountBySourceRef = new Map<string, number>();
    ledger.forEach((row) => {
      if (row.source !== "generation_charge" || !row.source_ref) return;
      generationChargeCountBySourceRef.set(
        row.source_ref,
        (generationChargeCountBySourceRef.get(row.source_ref) ?? 0) + 1
      );
    });

    const nowMs = Date.now();
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

    const costWithoutSuccessSample: Array<{
      sourceRef: string | null;
      amountCents: number;
      reason: string;
      generationStatus: string | null;
      bucket: "linked_non_success_generation" | "missing_linkage_data";
    }> = [];
    let costWithoutSuccessCents = 0;
    let costWithoutSuccessRows = 0;
    const linkedNonSuccessCostSample: Array<{
      sourceRef: string | null;
      amountCents: number;
      reason: string;
      generationStatus: string | null;
    }> = [];
    const missingLinkageCostSample: Array<{
      sourceRef: string | null;
      amountCents: number;
      reason: string;
      generationStatus: string | null;
    }> = [];
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

      const debitAbs = Math.abs(change);
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
          topDebitSourcesMap.set(
            debitSource,
            (topDebitSourcesMap.get(debitSource) ?? 0) + debitAbs
          );
        }
      }

      if (row.source === "generation_charge" && row.created_at) {
        const createdAtMsForCost = parseTimestamp(row.created_at);
        if (createdAtMsForCost !== null && nowMs - createdAtMsForCost <= lookbackMs) {
          let generationStatus: string | null = null;
          let bucket: "linked_non_success_generation" | "missing_linkage_data" =
            "missing_linkage_data";
          let reason = "No linked reservation found for charge row.";
          if (row.source_ref) {
            const reservation = reservationBySourceRef.get(row.source_ref);
            if (reservation?.provider_request_id) {
              const generation = generationByRequestId.get(reservation.provider_request_id);
              generationStatus = generation?.status ?? null;
              if (generationStatus === "success") {
                reason = "";
              } else if (generationStatus) {
                reason = `Linked generation is ${generationStatus}.`;
                bucket = "linked_non_success_generation";
              } else {
                reason = "Linked provider request has no matching generation row.";
              }
            } else if (reservation) {
              reason = "Reservation has no provider_request_id linkage.";
            }
          } else {
            reason = "Generation charge row has no source_ref.";
          }

          if (generationStatus !== "success") {
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

    const buildWindowGenerationSummary = (rows: GenerationRow[]) => {
      const success = rows.filter((row) => row.status === "success").length;
      const fail = rows.filter((row) => row.status === "fail").length;
      return {
        total: rows.length,
        success,
        fail,
        failRatePercent: ratioPercent(fail, rows.length),
      };
    };

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

    const stuckOver2h = generations.filter((row) => {
      if (!row.request_id) return false;
      const status = row.status ?? "";
      if (!["pending", "submitted", "running", "fail"].includes(status)) return false;
      const recoveryState = row.recovery_state ?? "none";
      if (!["queued", "recovering"].includes(recoveryState)) return false;
      const createdAtMs = parseTimestamp(row.created_at);
      if (createdAtMs === null) return false;
      return nowMs - createdAtMs >= 2 * HOUR_MS;
    });

    const reservationsByStatus = computeStatusCounts(reservations);
    const reservedWithProviderOver2h = reservations.filter((row) => {
      if (row.status !== "reserved" || !row.provider_request_id) return false;
      const createdAtMs = parseTimestamp(row.created_at);
      if (createdAtMs === null) return false;
      return nowMs - createdAtMs >= 2 * HOUR_MS;
    });
    const reservedWithoutProviderOver15m = reservations.filter((row) => {
      if (row.status !== "reserved" || row.provider_request_id) return false;
      const createdAtMs = parseTimestamp(row.created_at);
      if (createdAtMs === null) return false;
      return nowMs - createdAtMs >= 15 * 60 * 1000;
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

    const queueByStatus = computeStatusCounts(queueRows);
    const exhaustedQueueRows = queueRows.filter((row) => row.status === "exhausted");
    const exhaustedQueueSample = exhaustedQueueRows.slice(0, 20).map((row) => {
      const reservation = row.source_ref ? reservationBySourceRef.get(row.source_ref) : undefined;
      const generation = row.generation_id
        ? generations.find((generationRow) => generationRow.id === row.generation_id)
        : undefined;
      const chargeCount = row.source_ref
        ? (generationChargeCountBySourceRef.get(row.source_ref) ?? 0)
        : 0;
      return {
        queueId: row.id,
        sourceRef: row.source_ref ?? null,
        modelId: row.model_id ?? null,
        errorCode: row.last_error_code ?? null,
        generationStatus: generation?.status ?? null,
        reservationStatus: reservation?.status ?? null,
        chargeCount,
        createdAt: row.created_at ?? null,
      };
    });

    const exhaustedWithReleasedReservationCount = exhaustedQueueRows.filter((row) => {
      if (!row.source_ref) return false;
      const reservation = reservationBySourceRef.get(row.source_ref);
      return reservation?.status === "released";
    }).length;
    const exhaustedWithChargeCount = exhaustedQueueRows.filter((row) => {
      if (!row.source_ref) return false;
      return (generationChargeCountBySourceRef.get(row.source_ref) ?? 0) > 0;
    }).length;

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

    if (reservedWithProviderOver2h.length > 0 || reservedWithoutProviderOver15m.length > 0) {
      addFinding(
        "critical",
        "high",
        "ACTIVE_RESERVED_HOLDS",
        "Found aged active reservation holds.",
        `${reservedWithProviderOver2h.length} provider-attached holds are older than 2h; ${reservedWithoutProviderOver15m.length} pre-submit holds are older than 15m.`,
        [
          "Run /api/internal/generation-recovery/run and re-check reservation counts.",
          "Use /admin/generation-trace on affected source_ref/request_id values.",
          "Only after confirmation, use guarded remediation from sql/check_generation_queue_blockers.sql.",
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

    if (stuckOver2h.length > 0) {
      addFinding(
        "critical",
        "high",
        "STUCK_GENERATIONS",
        "Stuck generations detected in queued/recovering states.",
        `${stuckOver2h.length} generation rows are older than 2h and still in queued/recovering states.`,
        [
          "Open /admin/generation-trace for one impacted generation/request.",
          "Run /api/admin/generation-recovery/replay for explicit stuck rows.",
          "Inspect provider status and failure codes before manual settlement actions.",
        ]
      );
    }

    if (buildWindowGenerationSummary(last24hGenerations).failRatePercent >= 10) {
      const failRate = buildWindowGenerationSummary(last24hGenerations).failRatePercent;
      addFinding(
        "warning",
        "medium",
        "HIGH_FAIL_RATE_24H",
        "24h generation fail rate is elevated.",
        `Last 24h fail rate is ${failRate.toFixed(2)}%.`,
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

    if (exhaustedQueueRows.length > 0) {
      const exhaustedSeverity: FindingSeverity =
        exhaustedQueueRows.length >= 25 ? "warning" : "info";
      const exhaustedConfidence: FindingConfidence =
        exhaustedWithChargeCount > 0 ? "high" : exhaustedSeverity === "warning" ? "medium" : "low";
      addFinding(
        exhaustedSeverity,
        exhaustedConfidence,
        "EXHAUSTED_QUEUE_ROWS",
        "Exhausted queue rows present for this user.",
        `${exhaustedQueueRows.length} exhausted queue rows found; ${exhaustedWithReleasedReservationCount} already released reservations and ${exhaustedWithChargeCount} with charges.`,
        [
          "Confirm exhausted rows are expected historical artifacts vs current incident.",
          "If fresh/excessive, inspect queue dispatch limits and provider availability.",
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

    const response: HealthResponse = {
      generatedAt: new Date(nowMs).toISOString(),
      lookbackDays,
      target: {
        lookup,
        lookupMode,
        userId,
        email: authUser.email ?? null,
        createdAt: authUser.created_at ?? null,
        lastSignInAt: authUser.last_sign_in_at ?? null,
      },
      compatibility: {
        generationsSelectUsed: generationsResult.selectUsed,
        reservationsSupported: reservationsResult.supported,
        queueSupported: queueResult.supported,
        ledgerLegacySchema: ledgerResult.legacySchema,
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
        last24h: buildWindowGenerationSummary(last24hGenerations),
        last7d: buildWindowGenerationSummary(last7dGenerations),
        last30d: buildWindowGenerationSummary(last30dGenerations),
        topFailReasonsLookback,
        stuckOver2hCount: stuckOver2h.length,
        stuckOver2hSample: stuckOver2h.slice(0, 20).map((row) => {
          const createdAtMs = parseTimestamp(row.created_at);
          return {
            id: row.id,
            status: row.status ?? null,
            recoveryState: row.recovery_state ?? null,
            requestId: row.request_id ?? null,
            modelId: row.model_id ?? null,
            createdAt: row.created_at ?? null,
            ageHours:
              createdAtMs !== null
                ? Math.round(((nowMs - createdAtMs) / HOUR_MS) * 100) / 100
                : null,
            nextRecoveryAt: row.next_recovery_at ?? null,
          };
        }),
      },
      reservations: {
        total: reservations.length,
        byStatus: reservationsByStatus,
        reservedWithProviderOver2hCount: reservedWithProviderOver2h.length,
        reservedWithoutProviderOver15mCount: reservedWithoutProviderOver15m.length,
        topCapturedModels,
      },
      queue: {
        total: queueRows.length,
        byStatus: queueByStatus,
        exhaustedCount: exhaustedQueueRows.length,
        exhaustedWithReleasedReservationCount,
        exhaustedWithChargeCount,
        oldestCreatedAt: queueRows.length
          ? queueRows.reduce<string | null>((oldest, row) => {
              if (!row.created_at) return oldest;
              if (!oldest) return row.created_at;
              return row.created_at < oldest ? row.created_at : oldest;
            }, null)
          : null,
        recentExhaustedSample: exhaustedQueueSample,
      },
      findings,
      nextSteps,
    };

    return res.status(200).json(response);
  } catch (error) {
    await logApiRouteException({
      req,
      routeLabel: "admin/user-health",
      error,
      metadata: {
        lookup,
        lookup_mode: lookupMode,
        lookback_days: lookbackDays,
      },
      user: adminUser,
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to run user health diagnostics.",
    });
  }
}
