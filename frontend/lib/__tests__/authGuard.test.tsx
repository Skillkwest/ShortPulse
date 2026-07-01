import { renderHook, waitFor } from "@testing-library/react";
import type { Session, User } from "@supabase/supabase-js";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProtectedRouteSessionProvider } from "../protectedRouteSessionContext";
import { useProtectedRoute } from "../authGuard";

const useRouterMock = vi.hoisted(() => vi.fn());
const refreshSupabaseSessionMock = vi.hoisted(() => vi.fn());
const useSupabaseSessionStateMock = vi.hoisted(() => vi.fn());
const primeSupabaseSessionMock = vi.hoisted(() => vi.fn());
const readPersistedSupabaseSessionHintMock = vi.hoisted(() => vi.fn());
const readAuthSessionLogoutEpochMock = vi.hoisted(() => vi.fn());

vi.mock("next/router", () => ({
  useRouter: (...args: unknown[]) => useRouterMock(...args),
}));

vi.mock("../supabaseClient", () => ({
  refreshSupabaseSession: (...args: unknown[]) => refreshSupabaseSessionMock(...args),
  useSupabaseSessionState: (...args: unknown[]) => useSupabaseSessionStateMock(...args),
  primeSupabaseSession: (...args: unknown[]) => primeSupabaseSessionMock(...args),
}));

vi.mock("../supabaseSessionHints", () => ({
  readPersistedSupabaseSessionHint: (...args: unknown[]) =>
    readPersistedSupabaseSessionHintMock(...args),
}));

vi.mock("../authSessionInvalidation", () => ({
  readAuthSessionLogoutEpoch: (...args: unknown[]) => readAuthSessionLogoutEpochMock(...args),
}));

describe("useProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useRouterMock.mockReturnValue({
      asPath: "/admin",
      replace: vi.fn(),
    });
    refreshSupabaseSessionMock.mockResolvedValue(null);
    readPersistedSupabaseSessionHintMock.mockReturnValue(false);
    readAuthSessionLogoutEpochMock.mockReturnValue(null);
    useSupabaseSessionStateMock.mockReturnValue({
      initialized: true,
      session: null,
      user: null,
    });
  });

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

  it("redirects logged-out browsers to login without attempting session recovery", async () => {
    const replaceMock = vi.fn();
    useRouterMock.mockReturnValue({
      asPath: "/admin",
      replace: replaceMock,
    });

    const { result } = renderHook(() => useProtectedRoute(true));

    expect(result.current).toEqual({
      session: null,
      user: null,
      loading: false,
    });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/log-in?next=%2Fadmin");
    });
    expect(readPersistedSupabaseSessionHintMock).toHaveBeenCalled();
    expect(refreshSupabaseSessionMock).not.toHaveBeenCalled();
  });

  it("attempts one persisted-session recovery before redirecting to login", async () => {
    const replaceMock = vi.fn();
    readPersistedSupabaseSessionHintMock.mockReturnValue(true);
    useRouterMock.mockReturnValue({
      asPath: "/admin/pricing",
      replace: replaceMock,
    });

    renderHook(() => useProtectedRoute(true));

    await waitFor(() => {
      expect(refreshSupabaseSessionMock).toHaveBeenCalledWith({
        preserveSnapshotOnError: true,
      });
    });
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/log-in?next=%2Fadmin%2Fpricing");
    });
  });

  it("can preserve a missing session after a route has its own runtime continuity authority", async () => {
    const replaceMock = vi.fn();
    useRouterMock.mockReturnValue({
      asPath: "/ai-studio",
      replace: replaceMock,
    });

    const { result } = renderHook(() =>
      useProtectedRoute(true, {
        missingSessionBehavior: "preserve",
      })
    );

    expect(result.current).toEqual({
      session: null,
      user: null,
      loading: false,
    });
    await waitFor(() => {
      expect(readPersistedSupabaseSessionHintMock).toHaveBeenCalled();
    });
    expect(refreshSupabaseSessionMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("still redirects preserved missing sessions when the browser has an explicit logout marker", async () => {
    const replaceMock = vi.fn();
    readAuthSessionLogoutEpochMock.mockReturnValue(1_782_857_000_000);
    useRouterMock.mockReturnValue({
      asPath: "/ai-studio",
      replace: replaceMock,
    });

    renderHook(() =>
      useProtectedRoute(true, {
        missingSessionBehavior: "preserve",
      })
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/log-in?next=%2Fai-studio");
    });
    expect(refreshSupabaseSessionMock).not.toHaveBeenCalled();
  });
});
