/**
 * AI Studio page credit derivation hook.
 * Centralizes hold, effective-balance, and preconnect origin policy used by the page shell.
 */
import { useMemo } from "react";

type OptimisticDebitEntry = {
  credits: number;
  outputId: string | null;
  createdAtMs?: number;
};

type UseAiStudioPageCreditDerivationsParams = {
  optimisticDebitEntries: OptimisticDebitEntry[];
  inFlightOutputIds: Set<string>;
  balanceReservedCents: number | null;
  balanceCredits: number | null;
  referenceGridPreconnectHintsEnabled: boolean;
};

/**
 * Returns page-level credit hold totals and optional preconnect origin for AI Studio shell rendering.
 */
export const useAiStudioPageCreditDerivations = ({
  optimisticDebitEntries,
  inFlightOutputIds,
  balanceReservedCents,
  balanceCredits,
  referenceGridPreconnectHintsEnabled,
}: UseAiStudioPageCreditDerivationsParams) => {
  const optimisticUncoveredDebitCredits = useMemo(() => {
    const optimisticInFlightDebitCredits = optimisticDebitEntries.reduce((sum, entry) => {
      if (entry.outputId == null) return sum + entry.credits;
      if (inFlightOutputIds.has(entry.outputId)) return sum + entry.credits;
      return sum;
    }, 0);
    const reservedCredits = Math.max(0, Math.floor(balanceReservedCents ?? 0));
    return Math.max(0, optimisticInFlightDebitCredits - reservedCredits);
  }, [balanceReservedCents, inFlightOutputIds, optimisticDebitEntries]);

  const pendingHoldCredits = useMemo(() => {
    const reservedCredits = Math.max(0, Math.floor(balanceReservedCents ?? 0));
    return reservedCredits + optimisticUncoveredDebitCredits;
  }, [balanceReservedCents, optimisticUncoveredDebitCredits]);

  const effectiveBalanceCredits = useMemo(() => {
    if (balanceCredits == null) return null;
    return Math.max(0, balanceCredits - optimisticUncoveredDebitCredits);
  }, [balanceCredits, optimisticUncoveredDebitCredits]);

  const referenceGridPreconnectOrigin = useMemo(() => {
    if (!referenceGridPreconnectHintsEnabled) return null;
    const rawSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    if (!rawSupabaseUrl) return null;
    try {
      return new URL(rawSupabaseUrl).origin;
    } catch {
      return null;
    }
  }, [referenceGridPreconnectHintsEnabled]);

  return {
    optimisticUncoveredDebitCredits,
    pendingHoldCredits,
    effectiveBalanceCredits,
    referenceGridPreconnectOrigin,
  };
};
