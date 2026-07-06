/**
 * Admin API: manually add/remove credits from a user account.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../../../lib/server/api/auth";
import { logApiRouteException } from "../../../../lib/server/api/appErrorLogs";
import { getSupabaseAdmin } from "../../../../lib/server/api/supabaseAdmin";
import { debitAccountCredits, grantAccountCredits } from "../../../../lib/server/api/creditLedger";

type AdjustRequest = {
  userId?: string;
  changeCents?: number;
  reason?: string;
  idempotencyKey?: string;
};

const DEFAULT_REASON = "Manual admin dashboard adjustment";
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9:_-]{8,128}$/;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let adminUser: Awaited<ReturnType<typeof requireAdminUser>>;
  try {
    adminUser = await requireAdminUser(req, res);
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/credits/adjust.auth",
    });
    return res.status(500).json({ error: "Credit adjustment failed." });
  }
  if (!adminUser) {
    return;
  }

  const { userId, changeCents, reason, idempotencyKey } = (req.body ?? {}) as AdjustRequest;
  const normalizedChange = Number(changeCents);
  const normalizedReason = (reason ?? "").trim();
  const effectiveReason = normalizedReason || DEFAULT_REASON;
  const normalizedIdempotencyKey = (idempotencyKey ?? "").trim();
  if (!userId) {
    return res.status(400).json({ error: "userId is required." });
  }
  if (!Number.isFinite(normalizedChange) || normalizedChange === 0) {
    return res.status(400).json({ error: "changeCents must be a non-zero number." });
  }
  if (Math.abs(normalizedChange) > 1_000_000) {
    return res.status(400).json({ error: "changeCents exceeds safety limit." });
  }
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalizedIdempotencyKey)) {
    return res.status(400).json({ error: "idempotencyKey is required." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const adjustmentCents = Math.trunc(normalizedChange);
    const adjustmentOptions = {
      userId,
      amountCents: Math.abs(adjustmentCents),
      reason: effectiveReason,
      source: "admin_adjustment",
      sourceRef: `admin_adjustment:${adminUser.id}:${normalizedIdempotencyKey}`,
      metadata: {
        admin_user_id: adminUser.id,
        admin_email: adminUser.email ?? null,
        admin_adjustment_idempotency_key: normalizedIdempotencyKey,
      },
      createdBy: adminUser.id,
    };
    const ledgerResult =
      adjustmentCents > 0
        ? await grantAccountCredits({
            ...adjustmentOptions,
            creditKind: "admin_adjustment",
            expiresAt: null,
          })
        : await debitAccountCredits(adjustmentOptions);

    if (ledgerResult.error) {
      return res.status(400).json({ error: ledgerResult.error.message });
    }

    const { data: balance, error: balanceError } = await supabaseAdmin
      .from("ai_credit_balance")
      .select("balance_cents")
      .eq("user_id", userId)
      .maybeSingle();
    if (balanceError) {
      throw new Error(balanceError.message || "Failed to read updated credit balance.");
    }

    return res.status(200).json({
      ok: true,
      userId,
      balanceCents: Number(balance?.balance_cents ?? 0),
      status: ledgerResult.status ?? (adjustmentCents > 0 ? "granted" : "debited"),
      ledgerId: ledgerResult.ledgerId ?? null,
      grantId: ledgerResult.grantId ?? null,
    });
  } catch (error) {
    await logApiRouteException({
      req,
      error,
      routeLabel: "admin/credits/adjust",
      user: adminUser,
      metadata: {
        target_user_id: userId,
      },
    });
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Credit adjustment failed.",
    });
  }
}
