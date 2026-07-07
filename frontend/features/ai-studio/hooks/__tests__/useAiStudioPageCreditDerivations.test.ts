import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAiStudioPageCreditDerivations } from "../useAiStudioPageCreditDerivations";

describe("useAiStudioPageCreditDerivations", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("tracks pending holds against in-flight outputs and restores balance once they complete", () => {
    const { result, rerender } = renderHook(
      ({ inFlightOutputIds }: { inFlightOutputIds: Set<string> }) =>
        useAiStudioPageCreditDerivations({
          optimisticDebitEntries: [{ credits: 10, outputId: "out-1" }],
          inFlightOutputIds,
          balanceReservedCents: null,
          balanceCredits: 100,
          referenceGridPreconnectHintsEnabled: false,
        }),
      {
        initialProps: {
          inFlightOutputIds: new Set(["out-1"]),
        },
      }
    );

    expect(result.current.optimisticUncoveredDebitCredits).toBe(10);
    expect(result.current.pendingHoldCredits).toBe(10);
    expect(result.current.effectiveBalanceCredits).toBe(90);

    rerender({ inFlightOutputIds: new Set() });

    expect(result.current.optimisticUncoveredDebitCredits).toBe(0);
    expect(result.current.pendingHoldCredits).toBe(0);
    expect(result.current.effectiveBalanceCredits).toBe(100);
  });

  it("subtracts reserved credits before exposing uncovered optimistic holds", () => {
    const { result } = renderHook(() =>
      useAiStudioPageCreditDerivations({
        optimisticDebitEntries: [
          { credits: 10, outputId: "out-1" },
          { credits: 5, outputId: null },
        ],
        inFlightOutputIds: new Set(["out-1"]),
        balanceReservedCents: 12.8,
        balanceCredits: 100,
        referenceGridPreconnectHintsEnabled: false,
      })
    );

    expect(result.current.optimisticUncoveredDebitCredits).toBe(3);
    expect(result.current.pendingHoldCredits).toBe(15);
    expect(result.current.effectiveBalanceCredits).toBe(97);
  });

  it("does not double-subtract an optimistic hold from an already-captured spendable snapshot", () => {
    const { result } = renderHook(() =>
      useAiStudioPageCreditDerivations({
        optimisticDebitEntries: [{ credits: 7, outputId: "out-1" }],
        inFlightOutputIds: new Set(["out-1"]),
        balanceReservedCents: 0,
        balanceCredits: 1,
        referenceGridPreconnectHintsEnabled: false,
      })
    );

    expect(result.current.optimisticUncoveredDebitCredits).toBe(7);
    expect(result.current.pendingHoldCredits).toBe(7);
    expect(result.current.effectiveBalanceCredits).toBe(1);
  });

  it("continues subtracting optimistic holds when the spendable snapshot still covers them", () => {
    const { result } = renderHook(() =>
      useAiStudioPageCreditDerivations({
        optimisticDebitEntries: [{ credits: 7, outputId: "out-1" }],
        inFlightOutputIds: new Set(["out-1"]),
        balanceReservedCents: 0,
        balanceCredits: 8,
        referenceGridPreconnectHintsEnabled: false,
      })
    );

    expect(result.current.optimisticUncoveredDebitCredits).toBe(7);
    expect(result.current.pendingHoldCredits).toBe(7);
    expect(result.current.effectiveBalanceCredits).toBe(1);
  });

  it("preserves low settled balances when a stale optimistic hold is larger than the snapshot", () => {
    const { result } = renderHook(() =>
      useAiStudioPageCreditDerivations({
        optimisticDebitEntries: [{ credits: 7, outputId: "out-1" }],
        inFlightOutputIds: new Set(["out-1"]),
        balanceReservedCents: 0,
        balanceCredits: 3,
        referenceGridPreconnectHintsEnabled: false,
      })
    );

    expect(result.current.optimisticUncoveredDebitCredits).toBe(7);
    expect(result.current.pendingHoldCredits).toBe(7);
    expect(result.current.effectiveBalanceCredits).toBe(3);
  });

  it("derives the preconnect origin only when enabled and the Supabase URL is valid", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co/storage/v1");

    const enabled = renderHook(() =>
      useAiStudioPageCreditDerivations({
        optimisticDebitEntries: [],
        inFlightOutputIds: new Set(),
        balanceReservedCents: null,
        balanceCredits: null,
        referenceGridPreconnectHintsEnabled: true,
      })
    );
    expect(enabled.result.current.referenceGridPreconnectOrigin).toBe(
      "https://example.supabase.co"
    );

    const disabled = renderHook(() =>
      useAiStudioPageCreditDerivations({
        optimisticDebitEntries: [],
        inFlightOutputIds: new Set(),
        balanceReservedCents: null,
        balanceCredits: null,
        referenceGridPreconnectHintsEnabled: false,
      })
    );
    expect(disabled.result.current.referenceGridPreconnectOrigin).toBeNull();
  });
});
