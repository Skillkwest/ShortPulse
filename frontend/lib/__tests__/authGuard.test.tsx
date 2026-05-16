import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProtectedRoute } from "../authGuard";

const replaceMock = vi.hoisted(() => vi.fn());
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());
const refreshSupabaseSessionMock = vi.hoisted(() => vi.fn());

vi.mock("next/router", () => ({
  useRouter: () => ({
    asPath: "/ai-studio",
    replace: replaceMock,
  }),
}));

vi.mock("../supabaseClient", async () => {
  const actual = await vi.importActual<typeof import("../supabaseClient")>("../supabaseClient");
  return {
    ...actual,
    useSupabaseSessionState: (...args: unknown[]) => useSupabaseSessionStateMock(...args),
    refreshSupabaseSession: (...args: unknown[]) => refreshSupabaseSessionMock(...args),
  };
});

describe("useProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: null,
    });
    refreshSupabaseSessionMock.mockResolvedValue(null);
  });

  it("attempts one recovery refresh before redirecting to auth when no session exists", async () => {
    let resolveRefresh: (() => void) | null = null;
    refreshSupabaseSessionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRefresh = () => resolve(null);
        })
    );
    const { result } = renderHook(() => useProtectedRoute(true));

    await waitFor(() => {
      expect(refreshSupabaseSessionMock).toHaveBeenCalledWith({
        preserveSnapshotOnError: true,
      });
    });
    expect(replaceMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveRefresh?.();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(replaceMock).toHaveBeenCalledWith("/auth?next=%2Fai-studio");
  });

  it("does not redirect when the recovery refresh restores the session", async () => {
    let snapshot = {
      initialized: true,
      session: null,
      user: null,
    };
    useSupabaseSessionStateMock.mockImplementation(() => snapshot);
    refreshSupabaseSessionMock.mockImplementation(async () => {
      snapshot = {
        initialized: true,
        session: { user: { id: "user-1" } },
        user: { id: "user-1" },
      } as never;
      return snapshot.session;
    });

    const { result, rerender } = renderHook(() => useProtectedRoute(true));

    await waitFor(() => {
      expect(refreshSupabaseSessionMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await Promise.resolve();
    });
    rerender();

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.session).toEqual({ user: { id: "user-1" } });
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("does nothing when protection is disabled", async () => {
    const { result } = renderHook(() => useProtectedRoute(false));

    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(replaceMock).not.toHaveBeenCalled();
    expect(refreshSupabaseSessionMock).not.toHaveBeenCalled();
  });
});
