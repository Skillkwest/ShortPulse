/**
 * Server helpers for reading grant-lot credit spendability summaries.
 */
import { getSupabaseAdmin } from "./supabaseAdmin";

type GrantSummaryRpcRow = {
  spendable_cents?: number | string | null;
  reserved_cents?: number | string | null;
  expiring_cents?: number | string | null;
  non_expiring_cents?: number | string | null;
  next_expiring_cents?: number | string | null;
  next_expires_at?: string | null;
};

export type CreditGrantSummary = {
  spendableCents: number;
  reservedCents: number;
  expiringCents: number;
  nonExpiringCents: number;
  nextExpiringCents: number;
  nextExpiresAt: string | null;
};

type CreditGrantSummaryResult = {
  supported: boolean;
  summariesByUserId: Map<string, CreditGrantSummary>;
  error: { message?: string; code?: string } | null;
};

const toCentsInt = (value: unknown): number => {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
};

const normalizeGrantSummaryRow = (row: GrantSummaryRpcRow): CreditGrantSummary => ({
  spendableCents: Math.max(0, toCentsInt(row?.spendable_cents)),
  reservedCents: Math.max(0, toCentsInt(row?.reserved_cents)),
  expiringCents: Math.max(0, toCentsInt(row?.expiring_cents)),
  nonExpiringCents: Math.max(0, toCentsInt(row?.non_expiring_cents)),
  nextExpiringCents: Math.max(0, toCentsInt(row?.next_expiring_cents)),
  nextExpiresAt: typeof row?.next_expires_at === "string" ? row.next_expires_at : null,
});

export const fetchCreditGrantSummaries = async (
  userIds: string[]
): Promise<CreditGrantSummaryResult> => {
  const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
  const summariesByUserId = new Map<string, CreditGrantSummary>();
  if (!uniqueUserIds.length) {
    return { supported: true, summariesByUserId, error: null };
  }

  const rpcClient = getSupabaseAdmin() as unknown as {
    rpc: (
      name: string,
      params: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
  };

  for (const userId of uniqueUserIds) {
    const { data, error } = await rpcClient.rpc("get_credit_grant_summary", {
      p_user_id: userId,
    });
    if (error) {
      return { supported: false, summariesByUserId: new Map(), error };
    }

    const row = Array.isArray(data) ? (data[0] as GrantSummaryRpcRow | undefined) : null;
    if (!row) {
      continue;
    }
    summariesByUserId.set(userId, normalizeGrantSummaryRow(row));
  }

  return { supported: true, summariesByUserId, error: null };
};
