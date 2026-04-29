/**
 * Shared single-account user-health snapshot loading.
 * Used by the admin route and the operator CLI so the same read path stays canonical.
 */
import { getSupabaseAdmin } from "../api/supabaseAdmin";
import {
  DEFAULT_DEEP_LOOKBACK_DAYS,
  isSchemaCompatibilityError,
  normalizeQueryError,
  type DeepLookupMode as LookupMode,
} from "./deep";
import {
  type AttemptRow,
  buildAdminHealthResponse,
  type AdminHealthResponse,
  type BalanceRow,
  type GenerationRow,
  type NormalizedLedgerRow,
  type OutputRow,
  type ProjectGenerationItemRow,
  type ReservationRow,
} from "./deepReport";
import { resolveAdminHealthAuthUser } from "./targetLookup";

const DB_PAGE_SIZE = 1000;
const DB_MAX_PAGES = 50;
const DB_IN_CLAUSE_BATCH_SIZE = 100;

type QueryError = {
  message?: string;
  code?: string;
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

type FetchPageResult<TRow> = Promise<{ data: TRow[] | null; error: QueryError | null }>;

const fetchAllRowsForSelect = async <TRow>(
  fetchPage: (from: number, to: number) => FetchPageResult<TRow>
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

const chunkArray = <T>(values: T[], size: number): T[][] => {
  if (size <= 0) return [values];
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
};

/**
 * Load one account health snapshot using the same read path as the admin route.
 */
export const loadAdminHealthSnapshot = async ({
  lookup,
  lookupMode,
  lookbackDays = DEFAULT_DEEP_LOOKBACK_DAYS,
  nowMs = Date.now(),
}: {
  lookup: string;
  lookupMode: LookupMode;
  lookbackDays?: number;
  nowMs?: number;
}): Promise<AdminHealthResponse> => {
  const supabaseAdmin = getSupabaseAdmin();
  const compatibilityWarnings: string[] = [];

  const authUser = await resolveAdminHealthAuthUser({
    lookup,
    lookupMode,
  });

  if (!authUser) {
    throw new Error("User not found.");
  }

  const userId = authUser.id;

  const [balanceResult, generationsResult, reservationsResult, ledgerResult] = await Promise.all([
    supabaseAdmin
      .from("ai_credit_balance")
      .select("user_id, balance_cents, updated_at")
      .eq("user_id", userId)
      .limit(1),
    (async () => {
      const generationSelectFallbacks = [
        "id,status,recovery_state,provider,model_id,request_id,created_at,completed_at,failure_reason_code,next_recovery_at,metadata",
        "id,status,recovery_state,provider,model_id,request_id,created_at,completed_at,next_recovery_at,metadata",
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

  const balanceError = normalizeQueryError(balanceResult.error);
  if (balanceError) {
    throw new Error(balanceError.message || "Failed to load ai_credit_balance.");
  }
  const balanceRows = (balanceResult.data ?? []) as BalanceRow[];
  const generationIds = generationsResult.rows.map((row) => row.id).filter(Boolean);

  const attemptsResult = generationIds.length
    ? await (async () => {
        const rows: AttemptRow[] = [];
        for (const generationIdChunk of chunkArray(generationIds, DB_IN_CLAUSE_BATCH_SIZE)) {
          const batchResult = await fetchAllRowsForSelect<AttemptRow>(async (from, to) => {
            const query = supabaseAdmin
              .from("generation_attempts")
              .select("id,generation_id,provider_request_id,status,created_at")
              .in("generation_id", generationIdChunk)
              .order("created_at", { ascending: false })
              .range(from, to);
            const { data, error } = await query;
            return {
              data: (data as AttemptRow[] | null) ?? null,
              error: normalizeQueryError(error),
            };
          });
          if (batchResult.error) {
            return batchResult;
          }
          rows.push(...batchResult.rows);
        }
        return { rows, error: null as QueryError | null };
      })()
    : { rows: [] as AttemptRow[], error: null };

  const attemptsError = normalizeQueryError(attemptsResult.error);
  if (attemptsError) {
    if (isSchemaCompatibilityError(attemptsError)) {
      compatibilityWarnings.push(
        "generation_attempts is unavailable in this environment; provider-linkage diagnostics are partial."
      );
    } else {
      throw new Error(attemptsError.message || "Failed to load generation_attempts.");
    }
  }

  const outputsResult = generationIds.length
    ? await (async () => {
        const rows: OutputRow[] = [];
        for (const generationIdChunk of chunkArray(generationIds, DB_IN_CLAUSE_BATCH_SIZE)) {
          const batchResult = await fetchAllRowsForSelect<OutputRow>(async (from, to) => {
            const query = supabaseAdmin
              .from("ai_generation_outputs")
              .select("id,generation_id,media_file_id,created_at")
              .in("generation_id", generationIdChunk)
              .order("created_at", { ascending: false })
              .range(from, to);
            const { data, error } = await query;
            return {
              data: (data as OutputRow[] | null) ?? null,
              error: normalizeQueryError(error),
            };
          });
          if (batchResult.error) {
            return batchResult;
          }
          rows.push(...batchResult.rows);
        }
        return { rows, error: null as QueryError | null };
      })()
    : { rows: [] as OutputRow[], error: null };

  const outputsError = normalizeQueryError(outputsResult.error);
  if (outputsError) {
    if (isSchemaCompatibilityError(outputsError)) {
      compatibilityWarnings.push(
        "ai_generation_outputs is unavailable in this environment; persisted-success diagnostics are partial."
      );
    } else {
      throw new Error(outputsError.message || "Failed to load ai_generation_outputs.");
    }
  }

  const projectGenerationItemsResult = generationIds.length
    ? await (async () => {
        const rows: ProjectGenerationItemRow[] = [];
        for (const generationIdChunk of chunkArray(generationIds, DB_IN_CLAUSE_BATCH_SIZE)) {
          const batchResult = await fetchAllRowsForSelect<ProjectGenerationItemRow>(
            async (from, to) => {
              const query = supabaseAdmin
                .from("project_generation_items")
                .select("project_id,generation_id,user_id")
                .eq("user_id", userId)
                .in("generation_id", generationIdChunk)
                .range(from, to);
              const { data, error } = await query;
              return {
                data: (data as ProjectGenerationItemRow[] | null) ?? null,
                error: normalizeQueryError(error),
              };
            }
          );
          if (batchResult.error) {
            return batchResult;
          }
          rows.push(...batchResult.rows);
        }
        return { rows, error: null as QueryError | null };
      })()
    : { rows: [] as ProjectGenerationItemRow[], error: null };

  const projectGenerationItemsError = normalizeQueryError(projectGenerationItemsResult.error);
  if (projectGenerationItemsError) {
    if (isSchemaCompatibilityError(projectGenerationItemsError)) {
      compatibilityWarnings.push(
        "project_generation_items is unavailable in this environment; project-association diagnostics are partial."
      );
    } else {
      throw new Error(
        projectGenerationItemsError.message || "Failed to load project_generation_items."
      );
    }
  }

  const generationProjectIds = Array.from(
    new Set(
      generationsResult.rows.map(readGenerationProjectId).filter((id): id is string => Boolean(id))
    )
  );
  const activeProjectIdsResult = generationProjectIds.length
    ? await (async () => {
        const rows: string[] = [];
        for (const projectIdChunk of chunkArray(generationProjectIds, DB_IN_CLAUSE_BATCH_SIZE)) {
          const { data, error } = await supabaseAdmin
            .from("projects")
            .select("id")
            .eq("user_id", userId)
            .in("id", projectIdChunk);
          const normalizedError = normalizeQueryError(error);
          if (normalizedError) {
            return { rows: [], error: normalizedError };
          }
          rows.push(
            ...((data as Array<{ id?: unknown }> | null) ?? [])
              .map((row) => asTrimmedString(row.id))
              .filter((id): id is string => Boolean(id))
          );
        }
        return { rows, error: null as QueryError | null };
      })()
    : { rows: [] as string[], error: null };

  if (activeProjectIdsResult.error) {
    if (isSchemaCompatibilityError(activeProjectIdsResult.error)) {
      compatibilityWarnings.push(
        "projects is unavailable in this environment; project-association diagnostics may include deleted project metadata."
      );
    } else {
      throw new Error(activeProjectIdsResult.error.message || "Failed to load projects.");
    }
  }

  return buildAdminHealthResponse({
    lookup,
    lookupMode,
    lookbackDays,
    authUser,
    generationsSelectUsed: generationsResult.selectUsed,
    reservationsSupported: reservationsResult.supported,
    ledgerLegacySchema: ledgerResult.legacySchema,
    compatibilityWarnings,
    balance: balanceRows[0] ?? null,
    generations: generationsResult.rows,
    attempts: attemptsResult.error ? [] : attemptsResult.rows,
    outputs: outputsResult.error ? [] : outputsResult.rows,
    projectGenerationItems: projectGenerationItemsResult.error
      ? []
      : projectGenerationItemsResult.rows,
    activeProjectIds: activeProjectIdsResult.error ? undefined : activeProjectIdsResult.rows,
    reservations: reservationsResult.rows,
    ledger: ledgerResult.rows,
    nowMs,
  });
};

export default {
  loadAdminHealthSnapshot,
};
