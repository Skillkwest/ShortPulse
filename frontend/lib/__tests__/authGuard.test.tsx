import { renderHook } from "@testing-library/react";
import type { Session, User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ProtectedRouteSessionProvider } from "../protectedRouteSessionContext";
import { useProtectedRoute } from "../authGuard";

const useRouterMock = vi.hoisted(() => vi.fn());
const refreshSupabaseSessionMock = vi.hoisted(() => vi.fn());
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());

vi.mock("next/router", () => ({
  useRouter: (...args: unknown[]) => useRouterMock(...args),
}));

vi.mock("../supabaseClient", () => ({
  refreshSupabaseSession: (...args: unknown[]) => refreshSupabaseSessionMock(...args),
  useSupabaseSessionState: (...args: unknown[]) => useSupabaseSessionStateMock(...args),
}));

describe("useProtectedRoute", () => {
  it("uses the shared protected-route session context when a route gate already resolved auth", () => {
    const session = { access_token: "token-1", user: { id: "user-1" } } as Session;
    const user = { id: "user-1", email: "user@example.com" } as User;

    useRouterMock.mockReturnValue({
      asPath: "/profile",
      replace: vi.fn(),
    });
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: false,
      session: null,
      user: null,
    });

    const wrapper = ({ children }: { children: ReactNode }) => (
      <ProtectedRouteSessionProvider session={session} user={user}>
        {children}
      </ProtectedRouteSessionProvider>
    );

    const { result } = renderHook(() => useProtectedRoute(true), { wrapper });

    expect(result.current.loading).toBe(false);
    expect(result.current.session).toBe(session);
    expect(result.current.user).toBe(user);
    expect(useSupabaseSessionStateMock).toHaveBeenCalledWith({ enabled: false });
    expect(refreshSupabaseSessionMock).not.toHaveBeenCalled();
  });
});
