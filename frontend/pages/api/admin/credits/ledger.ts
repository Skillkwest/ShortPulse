/**
 * Admin API: credit ledger transactions for a specific user.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const ALL_LEDGER_PAGE_SIZE = 1000;

type LedgerRow = {
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

type QueryError = {
  message?: string;
  code?: string;
} | null;

const asPositiveInt = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.trunc(parsed));
};

const asSingleString = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return "";
};

const normalizeSourceFilter = (value: unknown): string => {
  const normalized = asSingleString(value).trim().toLowerCase();
  if (!normalized || normalized === "all") return "";
  return normalized.slice(0, 64);
};

const parseNumberOrNull = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeQueryError = (error: unknown): QueryError => {
  if (!error || typeof error !== "object") return null;
  const record = error as Record<string, unknown>;
  return {
    message: typeof record.message === "string" ? record.message : undefined,
    code: typeof record.code === "string" ? record.code : undefined,
  };
};

const isMissingLedgerColumnError = (error: QueryError): boolean => {
  if (!error) return false;
  const code = String(error.code ?? "").toUpperCase();
  if (code === "42703" || code === "PGRST204") return true;

  const message = String(error.message ?? "");
  return (
    /column .*ai_credit_ledger.*does not exist/i.test(message) ||
    /could not find the '.*' column of 'ai_credit_ledger'/i.test(message)
  );
};

const parsePricingBreakdown = (metadata: Record<string, unknown> | null) => {
  const rawBreakdown =
    metadata && typeof metadata.pricing_breakdown === "object" && metadata.pricing_breakdown
      ? (metadata.pricing_breakdown as Record<string, unknown>)
      : null;
  if (!rawBreakdown) return null;

  const usdRaw = parseNumberOrNull(rawBreakdown.usd_raw ?? rawBreakdown.usdRaw);
  const rawCredits = parseNumberOrNull(rawBreakdown.raw_credits ?? rawBreakdown.rawCredits);
  const billedCredits = parseNumberOrNull(
    rawBreakdown.billed_credits ?? rawBreakdown.billedCredits
  );
  const billedUsd = parseNumberOrNull(rawBreakdown.billed_usd ?? rawBreakdown.billedUsd);

  if (usdRaw == null && rawCredits == null && billedCredits == null && billedUsd == null) {
    return null;
  }

  return {
    usdRaw,
    rawCredits,
    billedCredits,
    billedUsd,
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/credits/ledger.auth",
    });
    return res.status(500).json({ error: "Unable to load credit transactions." });
  }
  if (!adminUser) {
    return;
  }

  const userId = asSingleString(req.query.userId).trim();
  if (!userId) {
    return res.status(400).json({ error: "userId is required." });
  }

  const requestedLimit = asSingleString(req.query.limit).trim().toLowerCase();
  const readAll = requestedLimit === "all";
  const numericLimit = Math.min(MAX_LIMIT, asPositiveInt(req.query.limit, DEFAULT_LIMIT));
  const limit = readAll ? null : numericLimit;
  const sourceFilter = normalizeSourceFilter(req.query.source);

  try {
    const supabaseAdmin = getSupabaseAdmin();
    let richRows: LedgerRow[] = [];
    let richError: unknown = null;

    if (readAll) {
      for (let offset = 0; ; offset += ALL_LEDGER_PAGE_SIZE) {
        let richQuery = supabaseAdmin
          .from("ai_credit_ledger")
          .select("id, user_id, change_cents, reason, source, source_ref, metadata, created_at")
          .eq("user_id", userId);
        if (sourceFilter) {
          richQuery = richQuery.eq("source", sourceFilter);
        }
        const richResult = await richQuery
          .order("created_at", { ascending: false })
          .range(offset, offset + ALL_LEDGER_PAGE_SIZE - 1);
        if (richResult.error) {
          richError = richResult.error;
          break;
        }
        const pageRows = (richResult.data ?? []) as LedgerRow[];
        richRows = richRows.concat(pageRows);
        if (pageRows.length < ALL_LEDGER_PAGE_SIZE) break;
      }
    } else {
      let richQuery = supabaseAdmin
        .from("ai_credit_ledger")
        .select("id, user_id, change_cents, reason, source, source_ref, metadata, created_at")
        .eq("user_id", userId);
      if (sourceFilter) {
        richQuery = richQuery.eq("source", sourceFilter);
      }
      const richResult = await richQuery
        .order("created_at", { ascending: false })
        .limit(numericLimit);
      richRows = (richResult.data ?? []) as LedgerRow[];
      richError = richResult.error;
    }

    const normalizedRichError = normalizeQueryError(richError);
    if (!normalizedRichError) {
      const transactions = richRows.map((row) => {
        const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : null;
        return {
          id: String(row.id),
          userId: String(row.user_id),
          changeCents: Number(row.change_cents ?? 0),
          reason: row.reason ?? "",
          source: row.source ?? "system",
          sourceRef: row.source_ref ?? null,
          pricingBreakdown: parsePricingBreakdown(metadata),
          createdAt: row.created_at ?? null,
        };
      });

      return res.status(200).json({
        userId,
        limit: limit ?? "all",
        source: sourceFilter || null,
        transactions,
      });
    }

    if (!isMissingLedgerColumnError(normalizedRichError)) {
      return res.status(500).json({
        error: normalizedRichError.message || "Unable to load credit transactions.",
      });
    }

    if (sourceFilter) {
      // Legacy ledger schemas do not expose `source`; all legacy reads are treated as source=legacy.
      return res.status(200).json({
        userId,
        limit: limit ?? "all",
        source: sourceFilter,
        transactions: [],
      });
    }
    let legacyRows: LegacyLedgerRow[] = [];
    let legacyError: unknown = null;

    if (readAll) {
      for (let offset = 0; ; offset += ALL_LEDGER_PAGE_SIZE) {
        const legacyResult = await supabaseAdmin
          .from("ai_credit_ledger")
          .select("id, user_id, change_cents, reason, ref_id, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .range(offset, offset + ALL_LEDGER_PAGE_SIZE - 1);
        if (legacyResult.error) {
          legacyError = legacyResult.error;
          break;
        }
        const pageRows = (legacyResult.data ?? []) as LegacyLedgerRow[];
        legacyRows = legacyRows.concat(pageRows);
        if (pageRows.length < ALL_LEDGER_PAGE_SIZE) break;
      }
    } else {
      const legacyResult = await supabaseAdmin
        .from("ai_credit_ledger")
        .select("id, user_id, change_cents, reason, ref_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(numericLimit);
      legacyRows = (legacyResult.data ?? []) as LegacyLedgerRow[];
      legacyError = legacyResult.error;
    }

    const normalizedLegacyError = normalizeQueryError(legacyError);
    if (normalizedLegacyError) {
      return res.status(500).json({
        error: normalizedLegacyError.message || "Unable to load credit transactions.",
      });
    }

    const transactions = legacyRows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      changeCents: Number(row.change_cents ?? 0),
      reason: row.reason ?? "",
      source: "legacy",
      sourceRef: row.ref_id ?? null,
      pricingBreakdown: null,
      createdAt: row.created_at ?? null,
    }));

    return res.status(200).json({ userId, limit: limit ?? "all", source: null, transactions });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/credits/ledger",
      user: adminUser,
      metadata: {
        target_user_id: userId,
        limit: limit ?? "all",
        source_filter: sourceFilter || null,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Unable to load credit transactions.",
    });
  }
}
