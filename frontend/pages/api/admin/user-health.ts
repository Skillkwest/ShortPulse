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
  isSchemaCompatibilityError,
  normalizeQueryError,
  type DeepLookupMode as LookupMode,
  type DeepQueryError as QueryError,
} from "../../../lib/server/adminUserHealth/deep";
import {
  buildAdminHealthResponse,
  type AdminHealthResponse,
  type BalanceRow,
  type GenerationRow,
  type NormalizedLedgerRow,
  type QueueRow,
  type ReservationRow,
} from "../../../lib/server/adminUserHealth/deepReport";
import { resolveAdminHealthAuthUser } from "../../../lib/server/adminUserHealth/targetLookup";

const DB_PAGE_SIZE = 1000;
const DB_MAX_PAGES = 50;

type AdminHealthRequest = {
  lookup: string;
  lookupMode?: LookupMode;
  lookbackDays?: number;
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
  res: NextApiResponse<AdminHealthResponse | { error: string }>
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

    if (!generationsResult.supported) {
      compatibilityWarnings.push(
        "ai_generations schema is incompatible with expected diagnostics fields; generation analysis is partial."
      );
    }

    if (balanceResult.error) {
      throw new Error(balanceResult.error.message || "Failed to load ai_credit_balance.");
    }
    const balanceRows = (balanceResult.data ?? []) as BalanceRow[];
    const response = buildAdminHealthResponse({
      lookup,
      lookupMode,
      lookbackDays,
      authUser,
      generationsSelectUsed: generationsResult.selectUsed,
      reservationsSupported: reservationsResult.supported,
      queueSupported: queueResult.supported,
      ledgerLegacySchema: ledgerResult.legacySchema,
      compatibilityWarnings,
      balance: balanceRows[0] ?? null,
      generations: generationsResult.rows,
      reservations: reservationsResult.rows,
      queueRows: queueResult.rows,
      ledger: ledgerResult.rows,
    });

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
