import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = process.env;

describe("supabaseClient session reads", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    process.env = {
      ...ORIGINAL_ENV,
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.doUnmock("@supabase/supabase-js");
    vi.resetModules();
    process.env = ORIGINAL_ENV;
  });

  it("uses Supabase refreshSession when force-refreshing the access token", async () => {
    const getSessionMock = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "stale-token",
          user: { id: "user-1" },
        },
      },
      error: null,
    });
    const refreshSessionMock = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "fresh-token",
          user: { id: "user-1" },
        },
      },
      error: null,
    });

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => ({
        auth: {
          getSession: getSessionMock,
          onAuthStateChange: vi.fn(),
          refreshSession: refreshSessionMock,
        },
      })),
    }));

    const { readSupabaseAccessToken } = await import("../supabaseClient");

    await expect(readSupabaseAccessToken()).resolves.toBe("stale-token");
    await expect(readSupabaseAccessToken({ forceRefresh: true })).resolves.toBe("fresh-token");

    expect(getSessionMock).toHaveBeenCalledTimes(1);
    expect(refreshSessionMock).toHaveBeenCalledTimes(1);
  });

  it("swallows aborted bootstrap session reads inside the shared session hook", async () => {
    const abortError = new Error("signal is aborted without reason");
    abortError.name = "AbortError";
    const getSessionMock = vi.fn().mockRejectedValue(abortError);

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => ({
        auth: {
          getSession: getSessionMock,
          onAuthStateChange: vi.fn(),
          refreshSession: vi.fn(),
        },
      })),
    }));

    const { useSupabaseSessionState } = await import("../supabaseClient");

    const { result } = renderHook(() => useSupabaseSessionState());

    await waitFor(() => {
      expect(result.current.initialized).toBe(true);
    });
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });

  it("stays fully idle when the shared session hook is explicitly disabled", async () => {
    const getSessionMock = vi.fn();
    const onAuthStateChangeMock = vi.fn();

    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => ({
        auth: {
          getSession: getSessionMock,
          onAuthStateChange: onAuthStateChangeMock,
          refreshSession: vi.fn(),
        },
      })),
    }));

    const { useSupabaseSessionState } = await import("../supabaseClient");

    const { result } = renderHook(() => useSupabaseSessionState({ enabled: false }));

    expect(result.current).toEqual({
      initialized: false,
      session: null,
      user: null,
    });
    expect(getSessionMock).not.toHaveBeenCalled();
    expect(onAuthStateChangeMock).not.toHaveBeenCalled();
  });

  it("detects a persisted Supabase auth payload in localStorage as a bootstrap hint", async () => {
    const storageKey = ["sb", "example", "auth", "token"].join("-");
    const getItemSpy = vi
      .spyOn(window.localStorage.__proto__, "getItem")
      .mockImplementation((...args: unknown[]) =>
        args[0] === storageKey
          ? JSON.stringify({
              currentSession: {
                access_token: "token-1",
                refresh_token: "refresh-1",
              },
            })
          : null
      );

    const { readPersistedSupabaseSessionHint } = await import("../supabaseClient");

    expect(readPersistedSupabaseSessionHint()).toBe(true);
    expect(getItemSpy).toHaveBeenCalledWith(storageKey);
  });

  it("treats an already-primed in-memory session as a bootstrap hint", async () => {
    vi.doMock("@supabase/supabase-js", () => ({
      createClient: vi.fn(() => ({
        auth: {
          getSession: vi.fn(),
          onAuthStateChange: vi.fn(),
          refreshSession: vi.fn(),
        },
      })),
    }));

    const { primeSupabaseSession, readSupabaseSessionBootstrapHint } =
      await import("../supabaseClient");

    primeSupabaseSession({
      access_token: "token-1",
      user: { id: "user-1" },
    } as never);

    expect(readSupabaseSessionBootstrapHint()).toBe(true);
  });
});
