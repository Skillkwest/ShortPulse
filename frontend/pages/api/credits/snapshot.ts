/**
 * Authenticated user credit snapshot.
 * Returns aggregate balance plus grant-lot-authoritative spendability fields.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireApiUser } from "../../../lib/server/api/auth";
import { logApiRouteException } from "../../../lib/server/api/appErrorLogs";
import { fetchCreditGrantSummaries } from "../../../lib/server/api/creditGrantSummary";
import { getSupabaseAdmin } from "../../../lib/server/api/supabaseAdmin";

type BalanceSnapshot = {
  availableCents: number;
  updatedAt: string | null;
  source: "balance_table";
};

const asFiniteNumber = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
};

const toCentsInt = (value: unknown): number => Math.trunc(asFiniteNumber(value));

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

  throw new Error(balanceError.message ?? "Unable to read credit balance.");
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let user;
  try {
    user = await requireApiUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "credits/snapshot.auth",
    });
    return res.status(500).json({
      error: "Unable to load credit snapshot.",
    });
  }
  if (!user) {
    return;
  }

  try {
    const [balanceSnapshot, grantSummaryResult] = await Promise.all([
      fetchBalanceSnapshot(user.id),
      fetchCreditGrantSummaries([user.id]),
    ]);
    if (grantSummaryResult.error) {
      throw new Error(grantSummaryResult.error.message ?? "Unable to read credit grant summary.");
    }

    const grantSummarySnapshot = grantSummaryResult.summariesByUserId.get(user.id);
    if (!grantSummarySnapshot) {
      throw new Error("Unable to read credit grant summary.");
    }

    const reservedCents = Math.max(0, grantSummarySnapshot.reservedCents);
    const spendableCents = Math.max(0, grantSummarySnapshot.spendableCents);

    return res.status(200).json({
      userId: user.id,
      availableCents: balanceSnapshot.availableCents,
      reservedCents,
      spendableCents,
      expiringCents: grantSummarySnapshot.expiringCents,
      nonExpiringCents: grantSummarySnapshot.nonExpiringCents,
      nextExpiringCents: grantSummarySnapshot.nextExpiringCents,
      nextExpiresAt: grantSummarySnapshot.nextExpiresAt,
      balanceUpdatedAt: balanceSnapshot.updatedAt,
      reservationsUpdatedAt: null,
      updatedAt: balanceSnapshot.updatedAt,
      reservationsSupported: true,
      grantsSupported: true,
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
