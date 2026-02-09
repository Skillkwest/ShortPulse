/**
 * Admin API: manually add/remove credits from a user account.
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { requireAdminUser } from "../../_utils/auth";
import { logApiRouteException } from "../../_utils/appErrorLogs";
import { getSupabaseAdmin } from "../../_utils/supabaseAdmin";
import { insertCreditLedgerEntry } from "../../_utils/creditLedger";

type AdjustRequest = {
  userId?: string;
  changeCents?: number;
  reason?: string;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminUser = await requireAdminUser(req, res);
  if (!adminUser) {
    return;
  }

  const { userId, changeCents, reason } = (req.body ?? {}) as AdjustRequest;
  const normalizedChange = Number(changeCents);
  const normalizedReason = (reason ?? "").trim();
  if (!userId) {
    return res.status(400).json({ error: "userId is required." });
  }
  if (!Number.isFinite(normalizedChange) || normalizedChange === 0) {
    return res.status(400).json({ error: "changeCents must be a non-zero number." });
  }
  if (!normalizedReason.length) {
    return res.status(400).json({ error: "reason is required." });
  }
  if (Math.abs(normalizedChange) > 1_000_000) {
    return res.status(400).json({ error: "changeCents exceeds safety limit." });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { error: insertError } = await insertCreditLedgerEntry({
      userId,
      changeCents: Math.trunc(normalizedChange),
      reason: normalizedReason,
      source: "admin_adjustment",
      sourceRef: `${Date.now()}-${adminUser.id}`,
      metadata: {
        admin_user_id: adminUser.id,
        admin_email: adminUser.email ?? null,
      },
      createdBy: adminUser.id,
    });

    if (insertError) {
      return res.status(400).json({ error: insertError.message });
    }

    const { data: balance } = await supabaseAdmin
      .from("ai_credit_balance")
      .select("balance_cents")
      .eq("user_id", userId)
      .maybeSingle();

    return res.status(200).json({
      ok: true,
      userId,
      balanceCents: Number(balance?.balance_cents ?? 0),
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
