/**
 * Regression tests for authenticated credit loading.
 * Verifies account-visible balances stay snapshot-backed, user-scoped, and safe under failures.
 */
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session, User } from "@supabase/supabase-js";
import { resetUseCreditsTestState, useCredits } from "../useCredits";
import { ensureSupabaseQueryClient, useSupabaseSessionState } from "../../../../lib/supabaseClient";
import { fetchWithAuth } from "../../../../lib/authenticatedFetch";

vi.mock("../../../../lib/supabaseClient", async () => {
  const actual = await vi.importActual("../../../../lib/supabaseClient");
  return {
    ...actual,
    ensureSupabaseQueryClient: vi.fn(),
    useSupabaseSessionState: vi.fn(),
  };
});

vi.mock("../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));

const ensureSupabaseQueryClientMock = vi.mocked(ensureSupabaseQueryClient);
const fetchWithAuthMock = vi.mocked(fetchWithAuth);
const useSupabaseSessionStateMock = vi.mocked(useSupabaseSessionState);

const createSessionState = (
  userId: string | null,
  options?: {
    initialized?: boolean;
  }
) => ({
  initialized: options?.initialized ?? true,
  session: userId
    ? ({
        access_token: `token-${userId}`,
        user: { id: userId } as User,
      } as Session)
    : null,
  user: userId ? ({ id: userId } as User) : null,
});

describe("useCredits", () => {
  let sessionState: ReturnType<typeof createSessionState>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    resetUseCreditsTestState();
    sessionState = createSessionState("user-123");
    useSupabaseSessionStateMock.mockImplementation(() => sessionState);
  });

  afterEach(() => {
    vi.useRealTimers();
    window.sessionStorage.clear();
    window.history.pushState(null, "", "/");
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("loads spendable balance from the authenticated snapshot API without browser balance fallbacks", async () => {
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        spendableCents: 900,
        reservedCents: 120,
        updatedAt: "2026-02-15T20:00:00.000Z",
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useCredits());

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });

    expect(result.current.balanceCents).toBe(900);
    expect(result.current.balanceReservedCents).toBe(120);
    expect(ensureSupabaseQueryClientMock).not.toHaveBeenCalled();
    expect(useSupabaseSessionStateMock).toHaveBeenCalled();
  });

  it("waits for an initialized authenticated session before automatic credit refreshes", async () => {
    sessionState = createSessionState("user-123", { initialized: false });
    const addWindowListenerSpy = vi.spyOn(window, "addEventListener");
    const addDocumentListenerSpy = vi.spyOn(document, "addEventListener");
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        spendableCents: 900,
        reservedCents: 120,
        updatedAt: "2026-02-15T20:00:00.000Z",
      }),
    } as unknown as Response);

    const { result, rerender } = renderHook(() => useCredits());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(fetchWithAuthMock).not.toHaveBeenCalled();
    expect(addWindowListenerSpy.mock.calls.some(([eventName]) => eventName === "focus")).toBe(
      false
    );
    expect(
      addDocumentListenerSpy.mock.calls.some(([eventName]) => eventName === "visibilitychange")
    ).toBe(false);
    expect(setIntervalSpy).not.toHaveBeenCalled();
    expect(result.current.balanceLoading).toBe(true);

    await act(async () => {
      const refreshed = await result.current.refreshBalance({ silent: true });
      expect(refreshed).toBe(900);
    });
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);

    fetchWithAuthMock.mockClear();
    sessionState = createSessionState("user-123");
    rerender();

    await waitFor(() => expect(fetchWithAuthMock).toHaveBeenCalledTimes(1));
    expect(addWindowListenerSpy.mock.calls.some(([eventName]) => eventName === "focus")).toBe(true);
    expect(
      addDocumentListenerSpy.mock.calls.some(([eventName]) => eventName === "visibilitychange")
    ).toBe(true);
    expect(setIntervalSpy).toHaveBeenCalled();

    addWindowListenerSpy.mockRestore();
    addDocumentListenerSpy.mockRestore();
    setIntervalSpy.mockRestore();
  });

  it("preserves the last known good spendable balance when snapshot refresh fails", async () => {
    fetchWithAuthMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        spendableCents: 900,
        reservedCents: 120,
        updatedAt: "2026-02-15T20:00:00.000Z",
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useCredits());

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });
    expect(result.current.balanceCents).toBe(900);
    expect(result.current.balanceReservedCents).toBe(120);

    fetchWithAuthMock.mockRejectedValueOnce(new Error("snapshot unavailable"));

    await act(async () => {
      const refreshed = await result.current.refreshBalance({ silent: true });
      expect(refreshed).toBeNull();
    });

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });
    expect(result.current.balanceCents).toBe(900);
    expect(result.current.balanceReservedCents).toBe(120);
    expect(result.current.balanceError).toBe("Unable to load spendable credit snapshot.");
    expect(ensureSupabaseQueryClientMock).not.toHaveBeenCalled();
  });

  it("retries a transient snapshot service failure before surfacing a balance error", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          spendableCents: 875,
          reservedCents: 25,
          updatedAt: "2026-02-15T20:00:00.000Z",
        }),
      } as unknown as Response);

    const { result } = renderHook(() => useCredits());

    await waitFor(
      () => {
        expect(result.current.balanceLoading).toBe(false);
      },
      { timeout: 2_000 }
    );

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
    expect(result.current.balanceCents).toBe(875);
    expect(result.current.balanceReservedCents).toBe(25);
    expect(result.current.balanceError).toBeNull();
    expect(ensureSupabaseQueryClientMock).not.toHaveBeenCalled();
  });

  it("hides the previous user's balance and reloads when the authenticated user changes", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          spendableCents: 900,
          reservedCents: 120,
          updatedAt: "2026-02-15T20:00:00.000Z",
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          spendableCents: 450,
          reservedCents: 30,
          updatedAt: "2026-02-16T20:00:00.000Z",
        }),
      } as unknown as Response);

    const { result, rerender } = renderHook(() => useCredits());

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });
    expect(result.current.balanceCents).toBe(900);

    sessionState = createSessionState("user-456");
    rerender();

    expect(result.current.balanceCents).toBeNull();
    expect(result.current.balanceReservedCents).toBeNull();
    expect(result.current.balanceLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });
    expect(result.current.balanceCents).toBe(450);
    expect(result.current.balanceReservedCents).toBe(30);
  });

  it("keeps browser credit refreshes on the authenticated snapshot route even when spendable drops", async () => {
    fetchWithAuthMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          spendableCents: 980,
          reservedCents: 20,
          updatedAt: "2026-02-15T20:00:00.000Z",
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          spendableCents: 0,
          reservedCents: 640,
          updatedAt: "2026-02-15T20:30:00.000Z",
        }),
      } as unknown as Response);

    ensureSupabaseQueryClientMock.mockImplementation(() => {
      throw new Error("Browser credit table reads are not allowed.");
    });

    const { result } = renderHook(() => useCredits());

    await waitFor(() => {
      expect(result.current.balanceLoading).toBe(false);
    });
    expect(result.current.balanceCents).toBe(980);
    expect(result.current.balanceReservedCents).toBe(20);

    await act(async () => {
      const refreshed = await result.current.refreshBalance({
        silent: true,
        beforeCommit: (snapshot) => {
          expect(snapshot.source).toBe("snapshot");
        },
      });
      expect(refreshed).toBe(0);
    });

    expect(result.current.balanceCents).toBe(0);
    expect(result.current.balanceReservedCents).toBe(640);
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(2);
    expect(ensureSupabaseQueryClientMock).not.toHaveBeenCalled();
  });

  it("dedupes overlapping credit snapshot refreshes into one authenticated request", async () => {
    let resolveSnapshot!: (value: Response) => void;
    fetchWithAuthMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSnapshot = resolve as (value: Response) => void;
        })
    );

    const first = renderHook(() => useCredits());
    const second = renderHook(() => useCredits());

    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);

    resolveSnapshot({
      ok: true,
      json: async () => ({
        spendableCents: 900,
        reservedCents: 120,
        updatedAt: "2026-02-15T20:00:00.000Z",
      }),
    } as unknown as Response);

    await waitFor(() => {
      expect(first.result.current.balanceLoading).toBe(false);
      expect(second.result.current.balanceLoading).toBe(false);
    });

    expect(first.result.current.balanceCents).toBe(900);
    expect(second.result.current.balanceCents).toBe(900);
    expect(first.result.current.balanceReservedCents).toBe(120);
    expect(second.result.current.balanceReservedCents).toBe(120);
  });

  it("keeps idle credit polling sparse and skips hidden tabs", async () => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    let idleRefreshCallback: (() => void) | null = null;
    let idleRefreshDelayMs: number | undefined;
    const setIntervalSpy = vi.spyOn(window, "setInterval").mockImplementation((handler, delay) => {
      if (typeof handler === "function") {
        idleRefreshCallback = handler as () => void;
      }
      idleRefreshDelayMs = typeof delay === "number" ? delay : undefined;
      return 1 as unknown as ReturnType<typeof window.setInterval>;
    });
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        spendableCents: 900,
        reservedCents: 120,
        updatedAt: "2026-02-15T20:00:00.000Z",
      }),
    } as unknown as Response);

    const { result } = renderHook(() => useCredits());

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.balanceLoading).toBe(false);
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);
    expect(idleRefreshDelayMs).toBe(120_000);

    fetchWithAuthMock.mockClear();
    await act(async () => {
      idleRefreshCallback?.();
      await Promise.resolve();
    });
    expect(fetchWithAuthMock).toHaveBeenCalledTimes(1);

    fetchWithAuthMock.mockClear();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    act(() => {
      idleRefreshCallback?.();
    });
    expect(fetchWithAuthMock).not.toHaveBeenCalled();

    setIntervalSpy.mockRestore();
  });

  it("defers idle credit polling while AI Studio is under pressure quarantine", async () => {
    window.history.pushState(null, "", "/ai-studio");
    window.sessionStorage.setItem(
      "shortpulse.ai_studio.pressure_quarantine.v1",
      JSON.stringify({
        expiresAt: Date.now() + 60_000,
        level: 2,
        reason: "heap_pressure",
        updatedAt: Date.now(),
      })
    );
    let idleRefreshCallback: (() => void) | null = null;
    const setIntervalSpy = vi.spyOn(window, "setInterval").mockImplementation((handler) => {
      if (typeof handler === "function") {
        idleRefreshCallback = handler as () => void;
      }
      return 1 as unknown as ReturnType<typeof window.setInterval>;
    });
    fetchWithAuthMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        spendableCents: 900,
        reservedCents: 120,
        updatedAt: "2026-02-15T20:00:00.000Z",
      }),
    } as unknown as Response);

    renderHook(() => useCredits());

    await waitFor(() => expect(fetchWithAuthMock).toHaveBeenCalledTimes(1));
    fetchWithAuthMock.mockClear();

    act(() => {
      idleRefreshCallback?.();
    });

    expect(fetchWithAuthMock).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });
});
