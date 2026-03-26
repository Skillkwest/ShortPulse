import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProtectedRoute } from "../authGuard";

const replaceMock = vi.hoisted(() => vi.fn());
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());

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
  });

  it("redirects to auth when no session exists", async () => {
    const { result } = renderHook(() => useProtectedRoute(true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(replaceMock).toHaveBeenCalledWith("/auth?next=%2Fai-studio");
  });

  it("does nothing when protection is disabled", async () => {
    const { result } = renderHook(() => useProtectedRoute(false));

    await act(async () => {});
    expect(result.current.loading).toBe(false);
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
