/**
 * Client-side credit tracking backed by Supabase.
 * Reads from `ai_credit_balance`.
 */
import { useCallback, useEffect, useState } from "react";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";

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

export const useCredits = () => {
  const [balance, setBalance] = useState<BalanceState>({ cents: null, loading: true, error: null });
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(
    async (options?: { silent?: boolean }): Promise<number | null> => {
      const silent = options?.silent ?? false;
      try {
        if (!silent) {
          setBalance((prev) => ({ ...prev, loading: true, error: null }));
        }
        const id = userId ?? (await fetchUserId());
        if (!userId) setUserId(id);

        const cents = await fetchBalanceCents(id);
        setBalance({ cents, loading: false, error: null });
        return cents;
      } catch (error) {
        setBalance({ cents: null, loading: false, error: error instanceof Error ? error.message : "Balance error" });
        return null;
      }
    },
    [userId],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => {
      void refresh({ silent: true });
    };

    const onVisibilityChange = () => {
      if (typeof document === "undefined" || document.visibilityState !== "visible") return;
      void refresh({ silent: true });
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refresh]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh({ silent: true });
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, [refresh]);

  return {
    balanceCents: balance.cents,
    balanceLoading: balance.loading,
    balanceError: balance.error,
    refreshBalance: refresh,
  };
};
