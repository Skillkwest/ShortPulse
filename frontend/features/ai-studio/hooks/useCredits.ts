/**
 * Client-side credit tracking backed by Supabase.
 * Assumes ledger/view tables exist with RLS enabled for per-user access.
 */
import { useCallback, useEffect, useState } from "react";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";

const INITIAL_SEED_CENTS = 100000; // 1000 credits at 1 cent each

type BalanceState = {
  cents: number | null;
  loading: boolean;
  error: string | null;
};

const fetchUserId = async () => {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(error?.message || "No Supabase user");
  return data.user.id;
};

const fetchBalanceCents = async (userId: string) => {
  const supabase = ensureSupabaseClient();
  const { data, error } = await supabase
    .from("ai_credit_balance")
    .select("balance_cents")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.balance_cents ?? 0;
};

const ledgerHasEntries = async (userId: string) => {
  const supabase = ensureSupabaseClient();
  const { count, error } = await supabase
    .from("ai_credit_ledger")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
};

const insertLedger = async (userId: string, changeCents: number, reason: string, refId?: string) => {
  const supabase = ensureSupabaseClient();
  const { error } = await supabase.from("ai_credit_ledger").insert({
    user_id: userId,
    change_cents: changeCents,
    reason,
    ref_id: refId ?? null,
  });
  if (error) throw new Error(error.message);
};

export const useCredits = () => {
  const [balance, setBalance] = useState<BalanceState>({ cents: null, loading: true, error: null });
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(
    async (seedIfEmpty = false) => {
      try {
        setBalance((prev) => ({ ...prev, loading: true, error: null }));
        const id = userId ?? (await fetchUserId());
        if (!userId) setUserId(id);

        if (seedIfEmpty && !(await ledgerHasEntries(id))) {
          await insertLedger(id, INITIAL_SEED_CENTS, "Initial seed");
        }

        const cents = await fetchBalanceCents(id);
        setBalance({ cents, loading: false, error: null });
      } catch (error) {
        setBalance({ cents: null, loading: false, error: error instanceof Error ? error.message : "Balance error" });
      }
    },
    [userId],
  );

  useEffect(() => {
    refresh(true);
  }, [refresh]);

  const debit = useCallback(
    async (costCents: number, reason: string, refId?: string) => {
      if (!userId) return;
      await insertLedger(userId, -Math.abs(costCents), reason, refId);
      await refresh(false);
    },
    [refresh, userId],
  );

  return {
    balanceCents: balance.cents,
    balanceLoading: balance.loading,
    balanceError: balance.error,
    refreshBalance: refresh,
    debit,
  };
};
