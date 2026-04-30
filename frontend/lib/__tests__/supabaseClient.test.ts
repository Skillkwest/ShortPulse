import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = process.env;

describe("supabaseClient session reads", () => {
  beforeEach(() => {
    vi.resetModules();
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
});
