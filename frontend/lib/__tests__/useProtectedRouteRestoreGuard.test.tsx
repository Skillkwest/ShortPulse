import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthRetryableFetchError, AuthSessionMissingError } from "@supabase/supabase-js";
import { useProtectedRouteRestoreGuard } from "../useProtectedRouteRestoreGuard";

const replaceReceiverMock = vi.hoisted(() => vi.fn());
const replaceMock = vi.hoisted(() => vi.fn());
const routerMock = vi.hoisted(() => ({
  replace: replaceMock,
}));
const readSupabaseSessionMock = vi.hoisted(() => vi.fn());
const refreshSupabaseSessionMock = vi.hoisted(() => vi.fn());
const clearSupabaseSessionSnapshotMock = vi.hoisted(() => vi.fn());
const isSessionOlderThanLogoutEpochMock = vi.hoisted(() => vi.fn());
const clearLogoutEpochWhenSessionIsFreshMock = vi.hoisted(() => vi.fn());

vi.mock("next/router", () => ({
  useRouter: () => routerMock,
}));

vi.mock("../supabaseClient", () => ({
  readSupabaseSession: (...args: unknown[]) => readSupabaseSessionMock(...args),
  refreshSupabaseSession: (...args: unknown[]) => refreshSupabaseSessionMock(...args),
  clearSupabaseSessionSnapshot: (...args: unknown[]) => clearSupabaseSessionSnapshotMock(...args),
  isSupabaseAbortError: (error: unknown) =>
    error instanceof Error &&
    (error.name === "AbortError" || error.message.toLowerCase().includes("signal is aborted")),
}));

vi.mock("../authSessionInvalidation", () => ({
  isSessionOlderThanLogoutEpoch: (...args: unknown[]) => isSessionOlderThanLogoutEpochMock(...args),
  clearLogoutEpochWhenSessionIsFresh: (...args: unknown[]) =>
    clearLogoutEpochWhenSessionIsFreshMock(...args),
}));

describe("useProtectedRouteRestoreGuard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    replaceMock.mockImplementation(function (this: unknown, href: string) {
      replaceReceiverMock(this, href);
    });
    readSupabaseSessionMock.mockResolvedValue({
      access_token: "token",
      user: { id: "user-1" },
    });
    refreshSupabaseSessionMock.mockResolvedValue({
      access_token: "token",
      user: { id: "user-1" },
    });
    isSessionOlderThanLogoutEpochMock.mockReturnValue(false);
  });

  it("force-refreshes the current session before clearing the checking state", async () => {
    const { result } = renderHook(() =>
      useProtectedRouteRestoreGuard({ enabled: true, nextPath: "/ai-studio" })
    );

    expect(result.current.checking).toBe(true);
    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });

    expect(readSupabaseSessionMock).toHaveBeenCalledWith({ forceRefresh: true });
    expect(clearLogoutEpochWhenSessionIsFreshMock).toHaveBeenCalledWith(
      expect.objectContaining({ access_token: "token" })
    );
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("clears local session authority and redirects when the session is missing", async () => {
    readSupabaseSessionMock.mockResolvedValue(null);

    renderHook(() =>
      useProtectedRouteRestoreGuard({ enabled: true, nextPath: "/profile?section=credits" })
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/log-in?next=%2Fprofile%3Fsection%3Dcredits");
    });
    expect(replaceReceiverMock).toHaveBeenCalledWith(
      routerMock,
      "/log-in?next=%2Fprofile%3Fsection%3Dcredits"
    );
    expect(clearSupabaseSessionSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it("can clear local session authority without redirecting for public session-aware routes", async () => {
    readSupabaseSessionMock.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useProtectedRouteRestoreGuard({
        enabled: true,
        nextPath: "/dashboard",
        missingSessionBehavior: "clear",
      })
    );

    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });
    expect(clearSupabaseSessionSnapshotMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it("clears local session authority and redirects when the session predates logout", async () => {
    isSessionOlderThanLogoutEpochMock.mockReturnValue(true);

    renderHook(() => useProtectedRouteRestoreGuard({ enabled: true, nextPath: "/ai-studio" }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/log-in?next=%2Fai-studio");
    });
    expect(clearSupabaseSessionSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it("does not mark protected content as checking for non-BFCache pagehide", async () => {
    const { result } = renderHook(() =>
      useProtectedRouteRestoreGuard({ enabled: true, nextPath: "/ai-studio" })
    );
    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });

    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(result.current.checking).toBe(false);
  });

  it("does not unmount protected content when the browser stores the page in BFCache", async () => {
    const { result } = renderHook(() =>
      useProtectedRouteRestoreGuard({ enabled: true, nextPath: "/ai-studio" })
    );
    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });
    const pageHideEvent = new Event("pagehide") as PageTransitionEvent;
    Object.defineProperty(pageHideEvent, "persisted", {
      configurable: true,
      value: true,
    });

    act(() => {
      window.dispatchEvent(pageHideEvent);
    });

    expect(result.current.checking).toBe(false);
  });

  it("blocks revalidation when the browser restores a BFCache page", async () => {
    const { result } = renderHook(() =>
      useProtectedRouteRestoreGuard({ enabled: true, nextPath: "/ai-studio" })
    );
    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });
    const pageShowEvent = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(pageShowEvent, "persisted", {
      configurable: true,
      value: true,
    });
    vi.clearAllMocks();
    let resolveRestoreCheck: (session: unknown) => void = () => undefined;
    readSupabaseSessionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveRestoreCheck = resolve;
      })
    );

    act(() => {
      window.dispatchEvent(pageShowEvent);
    });

    expect(result.current.checking).toBe(true);
    await waitFor(() => {
      expect(readSupabaseSessionMock).toHaveBeenCalledWith({ forceRefresh: true });
    });
    expect(refreshSupabaseSessionMock).not.toHaveBeenCalled();

    act(() => {
      resolveRestoreCheck({
        access_token: "bfcache-token",
        user: { id: "user-1" },
      });
    });

    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });
  });

  it("revalidates silently when a hidden tab becomes visible again", async () => {
    const { result } = renderHook(() =>
      useProtectedRouteRestoreGuard({ enabled: true, nextPath: "/ai-studio" })
    );
    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });
    vi.clearAllMocks();
    let resolveVisibleCheck: (session: unknown) => void = () => undefined;
    readSupabaseSessionMock.mockReturnValue(
      new Promise((resolve) => {
        resolveVisibleCheck = resolve;
      })
    );
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(readSupabaseSessionMock).toHaveBeenCalledWith();
    expect(refreshSupabaseSessionMock).not.toHaveBeenCalled();
    expect(result.current.checking).toBe(false);
    expect(replaceMock).not.toHaveBeenCalled();

    act(() => {
      resolveVisibleCheck({
        access_token: "fresh-token",
        user: { id: "user-1" },
      });
    });

    await waitFor(() => {
      expect(clearLogoutEpochWhenSessionIsFreshMock).toHaveBeenCalledWith(
        expect.objectContaining({ access_token: "fresh-token" })
      );
    });
    expect(result.current.checking).toBe(false);
  });

  it("preserves mounted protected content when visible-tab revalidation has a transient session-read failure", async () => {
    const { result } = renderHook(() =>
      useProtectedRouteRestoreGuard({ enabled: true, nextPath: "/ai-studio" })
    );
    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });
    vi.clearAllMocks();
    readSupabaseSessionMock.mockRejectedValue(new AuthRetryableFetchError("Failed to fetch", 0));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(readSupabaseSessionMock).toHaveBeenCalledWith();
    });
    expect(refreshSupabaseSessionMock).not.toHaveBeenCalled();
    expect(result.current.checking).toBe(false);
    expect(replaceMock).not.toHaveBeenCalled();
    expect(clearSupabaseSessionSnapshotMock).not.toHaveBeenCalled();
  });

  it("redirects from visible-tab revalidation when Supabase reports the session is missing", async () => {
    const { result } = renderHook(() =>
      useProtectedRouteRestoreGuard({ enabled: true, nextPath: "/ai-studio" })
    );
    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });
    vi.clearAllMocks();
    readSupabaseSessionMock.mockRejectedValue(new AuthSessionMissingError());
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/log-in?next=%2Fai-studio");
    });
    expect(clearSupabaseSessionSnapshotMock).toHaveBeenCalledTimes(1);
  });

  it("redirects from a silent visible-tab revalidation when the session is missing", async () => {
    const { result } = renderHook(() =>
      useProtectedRouteRestoreGuard({ enabled: true, nextPath: "/ai-studio" })
    );
    await waitFor(() => {
      expect(result.current.checking).toBe(false);
    });
    vi.clearAllMocks();
    readSupabaseSessionMock.mockResolvedValue(null);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(result.current.checking).toBe(false);
    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/log-in?next=%2Fai-studio");
    });
    expect(clearSupabaseSessionSnapshotMock).toHaveBeenCalledTimes(1);
  });
});
