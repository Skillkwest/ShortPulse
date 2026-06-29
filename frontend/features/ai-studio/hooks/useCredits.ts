/**
 * Client-side credit tracking backed by the authenticated credit snapshot API.
 * Uses direct ledger reads only when callers explicitly opt into the legacy fallback path.
 */
import { useCallback, useEffect, useState } from "react";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import { fetchWithAuth } from "../../../lib/authenticatedFetch";
import { useResolvedProtectedSessionState } from "../../../lib/protectedRouteSessionContext";
import {
  incrementFreezeInvestigationCounter,
  setFreezeInvestigationGauge,
} from "../logic/freezeInvestigationTelemetry";

type BalanceState = {
  ownerUserId: string | null;
  cents: number | null;
  reservedCents: number | null;
  updatedAt: string | null;
  loading: boolean;
  error: string | null;
};

type BalanceSnapshot = {
  cents: number;
  updatedAt: string | null;
};

type BalanceCommitSnapshot = {
  cents: number;
  updatedAt: string | null;
  reservedCents: number | null;
  source: "snapshot" | "fallback";
};

type BalanceQueryAttempt = {
  select: string;
};

type RefreshBalanceOptions = {
  silent?: boolean;
  preferLedger?: boolean;
  beforeCommit?: (snapshot: BalanceCommitSnapshot) => void;
};

type CreditSnapshotApiResponse = {
  spendableCents: number;
  reservedCents: number;
  updatedAt: string | null;
};

let preferredBalanceQueryAttempt: BalanceQueryAttempt | null = null;
let skipBalanceTableProbe = false;
let preferLegacyLedgerQuery = false;
let creditSnapshotRetryAfterMs = 0;
let creditSnapshotInFlightPromise: Promise<CreditSnapshotApiResponse | null> | null = null;
const CREDIT_SNAPSHOT_RETRY_BACKOFF_MS = 30_000;
const CREDIT_SNAPSHOT_IDLE_REFRESH_INTERVAL_MS = 120_000;
const CREDIT_SNAPSHOT_TRANSIENT_RETRY_DELAY_MS = 750;
const CREDIT_SNAPSHOT_RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

const createBalanceState = (
  ownerUserId: string | null,
  options?: {
    cents?: number | null;
    reservedCents?: number | null;
    updatedAt?: string | null;
    loading?: boolean;
    error?: string | null;
  }
): BalanceState => ({
  ownerUserId,
  cents: options?.cents ?? null,
  reservedCents: options?.reservedCents ?? null,
  updatedAt: options?.updatedAt ?? null,
  loading: options?.loading ?? false,
  error: options?.error ?? null,
});

export const resetUseCreditsTestState = () => {
  preferredBalanceQueryAttempt = null;
  skipBalanceTableProbe = false;
  preferLegacyLedgerQuery = false;
  creditSnapshotRetryAfterMs = 0;
  creditSnapshotInFlightPromise = null;
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

const queryBalanceRow = async ({ userId, select }: { userId: string; select: string }) => {
  const supabase = ensureSupabaseQueryClient();
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
  const supabase = ensureSupabaseQueryClient();

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

const asNumber = (value: unknown): number | null => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const parseCreditSnapshot = (payload: unknown): CreditSnapshotApiResponse | null => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const row = payload as Record<string, unknown>;
  const spendableCents = asNumber(row.spendableCents);
  const reservedCents = asNumber(row.reservedCents);
  if (spendableCents == null || reservedCents == null) {
    return null;
  }
  return {
    spendableCents: Math.trunc(spendableCents),
    reservedCents: Math.max(0, Math.trunc(reservedCents)),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : null,
  };
};

const waitForCreditSnapshotRetry = async (): Promise<void> => {
  await new Promise((resolve) => {
    window.setTimeout(resolve, CREDIT_SNAPSHOT_TRANSIENT_RETRY_DELAY_MS);
  });
};

const requestCreditSnapshot = async (): Promise<Response> =>
  await fetchWithAuth("/api/credits/snapshot", {
    method: "GET",
    cache: "no-store",
    headers: {
      "cache-control": "no-cache",
      pragma: "no-cache",
    },
    shortpulseLogScope: "generation",
    shortpulseSkipErrorLogging: true,
    shortpulseRetryNetworkOnce: true,
  });

const fetchCreditSnapshot = async (): Promise<CreditSnapshotApiResponse | null> => {
  if (creditSnapshotRetryAfterMs > Date.now()) {
    return null;
  }
  if (creditSnapshotInFlightPromise) {
    return await creditSnapshotInFlightPromise;
  }

  const request = (async () => {
    try {
      let response = await requestCreditSnapshot();
      if (!response.ok && CREDIT_SNAPSHOT_RETRYABLE_STATUSES.has(response.status)) {
        await waitForCreditSnapshotRetry();
        response = await requestCreditSnapshot();
      }
      if (!response.ok) {
        creditSnapshotRetryAfterMs = Date.now() + CREDIT_SNAPSHOT_RETRY_BACKOFF_MS;
        return null;
      }
      const payload = await response.json();
      creditSnapshotRetryAfterMs = 0;
      return parseCreditSnapshot(payload);
    } catch {
      creditSnapshotRetryAfterMs = Date.now() + CREDIT_SNAPSHOT_RETRY_BACKOFF_MS;
      return null;
    }
  })();

  creditSnapshotInFlightPromise = request;
  try {
    return await request;
  } finally {
    if (creditSnapshotInFlightPromise === request) {
      creditSnapshotInFlightPromise = null;
    }
  }
};

export const useCredits = ({ enabled = true }: { enabled?: boolean } = {}) => {
  incrementFreezeInvestigationCounter("credits.render");
  const { initialized, user } = useResolvedProtectedSessionState({
    enabled,
  });
  const currentUserId = enabled ? (user?.id ?? null) : null;
  const [balance, setBalance] = useState<BalanceState>(() =>
    createBalanceState(currentUserId, { loading: true })
  );

  const refresh = useCallback(
    async (options?: RefreshBalanceOptions): Promise<number | null> => {
      incrementFreezeInvestigationCounter("credits.refresh.calls");
      setFreezeInvestigationGauge("credits.refresh.silent", options?.silent ?? false);
      const silent = options?.silent ?? false;
      try {
        if (!enabled) {
          setBalance(createBalanceState(null, { loading: false, error: null }));
          return null;
        }
        if (!silent) {
          setBalance((prev) => ({ ...prev, loading: true, error: null }));
        }
        const id = currentUserId;
        if (!id) {
          return null;
        }

        const preferLedger = options?.preferLedger ?? false;
        const snapshot = preferLedger ? null : await fetchCreditSnapshot();
        if (snapshot) {
          incrementFreezeInvestigationCounter("credits.refresh.snapshotSuccess");
        } else if (!preferLedger) {
          incrementFreezeInvestigationCounter("credits.refresh.snapshotMiss");
        }
        if (!snapshot && !preferLedger) {
          setBalance((prev) => {
            const preserveCurrentUserBalance = prev.ownerUserId === id;
            return createBalanceState(id, {
              cents: preserveCurrentUserBalance ? prev.cents : null,
              reservedCents: preserveCurrentUserBalance ? prev.reservedCents : null,
              updatedAt: preserveCurrentUserBalance ? prev.updatedAt : null,
              loading: false,
              error: "Unable to load spendable credit snapshot.",
            });
          });
          return null;
        }
        const next: BalanceCommitSnapshot = snapshot
          ? {
              cents: snapshot.spendableCents,
              reservedCents: snapshot.reservedCents,
              updatedAt: snapshot.updatedAt,
              source: "snapshot",
            }
          : {
              ...(await fetchBalanceCents(id, { preferLedger: true })),
              reservedCents: null,
              source: "fallback",
            };
        if (typeof options?.beforeCommit === "function") {
          options.beforeCommit(next);
        }
        setBalance(
          createBalanceState(id, {
            cents: next.cents,
            reservedCents: next.reservedCents,
            updatedAt: next.updatedAt,
            loading: false,
            error: null,
          })
        );
        return next.cents;
      } catch (error) {
        incrementFreezeInvestigationCounter("credits.refresh.error");
        setBalance((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : "Balance error",
        }));
        return null;
      }
    },
    [currentUserId, enabled]
  );

  useEffect(() => {
    setFreezeInvestigationGauge("credits.loading", balance.loading);
    setFreezeInvestigationGauge("credits.error", balance.error ?? null);
    setFreezeInvestigationGauge("credits.cents", balance.cents);
  }, [balance.cents, balance.error, balance.loading]);

  useEffect(() => {
    if (!enabled) {
      setBalance(createBalanceState(null, { loading: false, error: null }));
      return;
    }
    if (balance.ownerUserId === currentUserId) return;
    setBalance(
      createBalanceState(currentUserId, {
        loading: Boolean(currentUserId) || !initialized,
      })
    );
  }, [balance.ownerUserId, currentUserId, enabled, initialized]);

  useEffect(() => {
    if (!enabled) return;
    refresh();
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled) return;
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
  }, [enabled, refresh]);

  useEffect(() => {
    if (!enabled || !currentUserId) return;
    const intervalId = window.setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void refresh({ silent: true });
    }, CREDIT_SNAPSHOT_IDLE_REFRESH_INTERVAL_MS);
    return () => window.clearInterval(intervalId);
  }, [currentUserId, enabled, refresh]);

  const exposingCurrentUserBalance = balance.ownerUserId === currentUserId;

  if (!enabled) {
    return {
      balanceCents: null,
      balanceReservedCents: null,
      balanceUpdatedAt: null,
      balanceLoading: false,
      balanceError: null,
      refreshBalance: refresh,
    };
  }

  return {
    balanceCents: exposingCurrentUserBalance ? balance.cents : null,
    balanceReservedCents: exposingCurrentUserBalance ? balance.reservedCents : null,
    balanceUpdatedAt: exposingCurrentUserBalance ? balance.updatedAt : null,
    balanceLoading: exposingCurrentUserBalance
      ? balance.loading
      : Boolean(currentUserId) || !initialized,
    balanceError: exposingCurrentUserBalance ? balance.error : null,
    refreshBalance: refresh,
  };
};
