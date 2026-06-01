import { renderHook } from "@testing-library/react";
import type { Session, User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ProtectedRouteSessionProvider,
  useResolvedProtectedSessionState,
} from "../protectedRouteSessionContext";

const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());

vi.mock("../supabaseClient", async () => {
  const actual = await vi.importActual<typeof import("../supabaseClient")>("../supabaseClient");
  return {
    ...actual,
    useSupabaseSessionState: (...args: unknown[]) => useSupabaseSessionStateMock(...args),
  };
});

describe("useResolvedProtectedSessionState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
