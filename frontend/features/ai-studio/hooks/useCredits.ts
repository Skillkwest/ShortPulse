/**
 * Client-side credit tracking backed by Supabase.
 * Reads from `ai_credit_balance`.
 */
import { useCallback, useEffect, useState } from "react";
import { ensureSupabaseClient } from "../../../lib/supabaseClient";

type BalanceState = {
  cents: number | null;
  updatedAt: string | null;
  loading: boolean;
  error: string | null;
};

type BalanceSnapshot = {
  cents: number;
  updatedAt: string | null;
};

type BalanceQueryAttempt = {
  select: string;
};

let preferredBalanceQueryAttempt: BalanceQueryAttempt | null = null;
let skipBalanceTableProbe = false;
let preferLegacyLedgerQuery = false;

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

const fetchUserId = async () => {
  const supabase = ensureSupabaseClient();
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (!sessionError && sessionData.session?.user?.id) {
    return sessionData.session.user.id;
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error(error?.message || "No Supabase user");
  return data.user.id;
};

const queryBalanceRow = async ({ userId, select }: { userId: string; select: string }) => {
  const supabase = ensureSupabaseClient();
  return supabase
    .from("ai_credit_balance")
    .select(select)
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
};

const fetchBalanceFromTable = async (userId: string): Promise<BalanceSnapshot | null> => {
  if (skipBalanceTableProbe) {
    return null;
  }

  const attempts: BalanceQueryAttempt[] = [
    { select: "balance_cents, updated_at" },
    { select: "balance_cents" },
  ];

  const orderedAttempts = preferredBalanceQueryAttempt
    ? [
        preferredBalanceQueryAttempt,
        ...attempts.filter((attempt) => attempt.select !== preferredBalanceQueryAttempt?.select),
      ]
    : attempts;

  let sawSchemaCompatibilityError = false;

  for (const attempt of orderedAttempts) {
    const { data, error } = await queryBalanceRow({
      userId,
      select: attempt.select,
    });
    if (error) {
      sawSchemaCompatibilityError =
        sawSchemaCompatibilityError || isSchemaCompatibilityError(error.message);
      continue;
    }

    preferredBalanceQueryAttempt = attempt;
    const row = (data as Record<string, unknown> | null) ?? null;
    if (!row || row.balance_cents == null) return null;

    return {
      cents: Number(row.balance_cents ?? 0),
      updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    };
  }

  preferredBalanceQueryAttempt = null;
  if (sawSchemaCompatibilityError) {
    // Legacy DBs may miss credit-balance relation/columns; avoid repeating guaranteed 400 probes.
    skipBalanceTableProbe = true;
  }
  return null;
};

const fetchLedgerBalanceCents = async (userId: string) => {
  const supabase = ensureSupabaseClient();

  if (!preferLegacyLedgerQuery) {
    const { data: richData, error: richError } = await supabase
      .from("ai_credit_ledger")
      .select("change_cents, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (!richError) {
      const rows = Array.isArray(richData) ? richData : [];
      const cents = rows.reduce((sum, row) => sum + Number(row.change_cents ?? 0), 0);
      const updatedAt =
        rows.length > 0 && typeof rows[0].created_at === "string" ? rows[0].created_at : null;
      return { cents, updatedAt };
    }

    if (isSchemaCompatibilityError(richError.message)) {
      // Cache legacy mode to avoid retrying a known-missing created_at shape every refresh.
      preferLegacyLedgerQuery = true;
    }
  }

  // Legacy fallback: some deployments may not expose created_at in RLS/view responses.
  const { data: legacyData, error: legacyError } = await supabase
    .from("ai_credit_ledger")
    .select("change_cents")
    .eq("user_id", userId);

  if (legacyError) {
    throw new Error(legacyError.message);
  }

  const legacyRows = Array.isArray(legacyData) ? legacyData : [];
  const cents = legacyRows.reduce((sum, row) => sum + Number(row.change_cents ?? 0), 0);
  return {
    cents,
    updatedAt: null,
  };
};

const fetchBalanceCents = async (
  userId: string,
  options?: {
    preferLedger?: boolean;
  }
) => {
  if (options?.preferLedger) {
    const ledgerSnapshot = await fetchLedgerBalanceCents(userId);
    return {
      cents: ledgerSnapshot.cents,
      updatedAt: ledgerSnapshot.updatedAt,
    };
  }

  const tableSnapshot = await fetchBalanceFromTable(userId);
  if (tableSnapshot) {
    return tableSnapshot;
  }

  // Fallback for environments where balance materialization is missing/stale/broken.
  const ledgerSnapshot = await fetchLedgerBalanceCents(userId);
  return {
    cents: ledgerSnapshot.cents,
    updatedAt: ledgerSnapshot.updatedAt,
  };
};

export const useCredits = () => {
  const [balance, setBalance] = useState<BalanceState>({
    cents: null,
    updatedAt: null,
    loading: true,
    error: null,
  });
  const [userId, setUserId] = useState<string | null>(null);

  const refresh = useCallback(
    async (options?: { silent?: boolean; preferLedger?: boolean }): Promise<number | null> => {
      const silent = options?.silent ?? false;
      try {
        if (!silent) {
          setBalance((prev) => ({ ...prev, loading: true, error: null }));
        }
        const id = userId ?? (await fetchUserId());
        if (!userId) setUserId(id);

        const next = await fetchBalanceCents(id, {
          preferLedger: options?.preferLedger ?? false,
        });
        setBalance({ cents: next.cents, updatedAt: next.updatedAt, loading: false, error: null });
        return next.cents;
      } catch (error) {
        setBalance((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Balance error",
        }));
        return null;
      }
    },
    [userId]
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
    balanceUpdatedAt: balance.updatedAt,
    balanceLoading: balance.loading,
    balanceError: balance.error,
    refreshBalance: refresh,
  };
};
