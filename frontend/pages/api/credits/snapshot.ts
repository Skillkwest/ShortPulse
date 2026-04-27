/**
 * Authenticated user credit snapshot.
 * Returns available balance plus currently reserved (pending hold) credits.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type BalanceSnapshot = {
  availableCents: number;
  updatedAt: string | null;
  source: "balance_table" | "ledger_fallback";
};

type ReservationSnapshot = {
  reservedCents: number;
  updatedAt: string | null;
  reservationsSupported: boolean;
};

const isSchemaCompatibilityError = (message: string) => {
  const text = message.toLowerCase();
  return (
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("schema cache") ||
    text.includes("failed to parse select parameter") ||
    text.includes("column")
  );
};

const asFiniteNumber = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toCentsInt = (value: unknown): number => Math.trunc(asFiniteNumber(value));

const resolveLatestTimestamp = (first: string | null, second: string | null): string | null => {
  if (!first) return second;
  if (!second) return first;
  return Date.parse(first) >= Date.parse(second) ? first : second;
};

const fetchBalanceSnapshot = async (userId: string): Promise<BalanceSnapshot> => {
  const supabaseAdmin = getSupabaseAdmin();
  const { data: balanceRow, error: balanceError } = await supabaseAdmin
    .from("ai_credit_balance")
    .select("balance_cents, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (!balanceError) {
    return {
      availableCents: toCentsInt((balanceRow as Record<string, unknown> | null)?.balance_cents),
      updatedAt:
        typeof (balanceRow as Record<string, unknown> | null)?.updated_at === "string"
          ? ((balanceRow as Record<string, unknown>).updated_at as string)
          : null,
      source: "balance_table",
    };
  }

  if (!isSchemaCompatibilityError(balanceError.message ?? "")) {
    throw new Error(balanceError.message ?? "Unable to read credit balance.");
  }

  const { data: ledgerRows, error: ledgerError } = await supabaseAdmin
    .from("ai_credit_ledger")
    .select("change_cents, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!ledgerError) {
    const rows = Array.isArray(ledgerRows) ? (ledgerRows as Array<Record<string, unknown>>) : [];
    const availableCents = rows.reduce((sum, row) => sum + toCentsInt(row.change_cents), 0);
    const updatedAt =
      typeof rows[0]?.created_at === "string" ? (rows[0].created_at as string) : null;
    return {
      availableCents,
      updatedAt,
      source: "ledger_fallback",
    };
  }

  if (!isSchemaCompatibilityError(ledgerError.message ?? "")) {
    throw new Error(ledgerError.message ?? "Unable to read credit ledger.");
  }

  const { data: legacyRows, error: legacyError } = await supabaseAdmin
    .from("ai_credit_ledger")
    .select("change_cents")
    .eq("user_id", userId);

  if (legacyError) {
    throw new Error(legacyError.message ?? "Unable to read legacy credit ledger.");
  }

  const rows = Array.isArray(legacyRows) ? (legacyRows as Array<Record<string, unknown>>) : [];
  const availableCents = rows.reduce((sum, row) => sum + toCentsInt(row.change_cents), 0);
  return {
    availableCents,
    updatedAt: null,
    source: "ledger_fallback",
  };
};

const fetchReservationSnapshot = async (userId: string): Promise<ReservationSnapshot> => {
  const supabaseAdmin = getSupabaseAdmin();

  const { data, error } = await supabaseAdmin
    .from("ai_credit_reservations")
    .select("amount_cents, updated_at")
    .eq("user_id", userId)
    .eq("status", "reserved")
    .order("updated_at", { ascending: false });

  if (!error) {
    const rows = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
    const reservedCents = rows.reduce(
      (sum, row) => sum + Math.abs(toCentsInt(row.amount_cents)),
      0
    );
    const updatedAt =
      typeof rows[0]?.updated_at === "string" ? (rows[0].updated_at as string) : null;
    return {
      reservedCents,
      updatedAt,
      reservationsSupported: true,
    };
  }

  if (!isSchemaCompatibilityError(error.message ?? "")) {
    throw new Error(error.message ?? "Unable to read active credit reservations.");
  }

  return {
    reservedCents: 0,
    updatedAt: null,
    reservationsSupported: false,
  };
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const user = await requireApiUser(req, res);
  if (!user) {
    return;
  }

  try {
    const [balanceSnapshot, reservationSnapshot] = await Promise.all([
      fetchBalanceSnapshot(user.id),
      fetchReservationSnapshot(user.id),
    ]);

    const spendableCents = Math.max(
      0,
      balanceSnapshot.availableCents - reservationSnapshot.reservedCents
    );

    return res.status(200).json({
      userId: user.id,
      availableCents: balanceSnapshot.availableCents,
      reservedCents: reservationSnapshot.reservedCents,
      spendableCents,
      balanceUpdatedAt: balanceSnapshot.updatedAt,
      reservationsUpdatedAt: reservationSnapshot.updatedAt,
      updatedAt: resolveLatestTimestamp(balanceSnapshot.updatedAt, reservationSnapshot.updatedAt),
      reservationsSupported: reservationSnapshot.reservationsSupported,
      source: balanceSnapshot.source,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "credits/snapshot",
      user,
    });
    return res.status(500).json({
      error: "Unable to load credit snapshot.",
    });
  }
}
