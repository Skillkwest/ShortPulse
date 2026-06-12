import { renderHook, waitFor } from "@testing-library/react";
import type { Session, User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProtectedRouteSessionProvider,
  useResolvedProtectedSessionState,
} from "../protectedRouteSessionContext";

const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());
const primeSupabaseSessionMock = vi.hoisted(() => vi.fn());

vi.mock("../supabaseClient", async () => {
  const actual = await vi.importActual<typeof import("../supabaseClient")>("../supabaseClient");
  return {
    ...actual,
    primeSupabaseSession: (...args: unknown[]) => primeSupabaseSessionMock(...args),
    useSupabaseSessionState: (...args: unknown[]) => useSupabaseSessionStateMock(...args),
  };
});

describe("useResolvedProtectedSessionState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    primeSupabaseSessionMock.mockReset();
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: null,
    });
  });

  it("reuses the protected-route session context when a gate already resolved auth", () => {
    const session = { access_token: "token-1", user: { id: "user-1" } } as Session;
    const user = { id: "user-1", email: "user@example.com" } as User;

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ProtectedRouteSessionProvider session={session} user={user}>
        {children}
      </ProtectedRouteSessionProvider>
    );

    const { result } = renderHook(() => useResolvedProtectedSessionState(), { wrapper });

    expect(result.current).toEqual({
      initialized: true,
      session,
      user,
    });
    expect(useSupabaseSessionStateMock).toHaveBeenCalledWith({ enabled: false });
  });

  it("primes the shared Supabase session store from the protected-route session", async () => {
    const session = { access_token: "token-1", user: { id: "user-1" } } as Session;
    const user = { id: "user-1", email: "user@example.com" } as User;

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ProtectedRouteSessionProvider session={session} user={user}>
        {children}
      </ProtectedRouteSessionProvider>
    );

    renderHook(() => useResolvedProtectedSessionState(), { wrapper });

    await waitFor(() => {
      expect(primeSupabaseSessionMock).toHaveBeenCalledWith(session);
    });
  });

  it("falls back to the shared Supabase session store outside protected gates", () => {
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: false,
      session: null,
      user: null,
    });

    const { result } = renderHook(() => useResolvedProtectedSessionState());

    expect(result.current).toEqual({
      initialized: false,
      session: null,
      user: null,
    });
    expect(useSupabaseSessionStateMock).toHaveBeenCalledWith({ enabled: true });
  });
});
