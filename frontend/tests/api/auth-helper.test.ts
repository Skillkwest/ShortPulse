/**
 * Auth helper coverage for proxy-first protected-route verification and token fallback behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOptionalApiUser,
  getOptionalApiUserResult,
  requireAdminUser,
  requireApiUser,
  resolveAdminAccessVia,
} from "../../lib/server/api/auth";
import {
  resetSupabaseUserVerificationCache,
  SUPABASE_USER_VERIFICATION_CACHE_TTL_MS,
} from "../../lib/server/api/authTokenVerifier";

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("auth helper protected-route auth behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSupabaseUserVerificationCache();
    vi.useRealTimers();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SHORTPULSE_TRUST_PROXY_AUTH_HEADERS = "false";
  });

  it("verifies bearer identity before reusing matching proxy-authenticated context", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "verified-user-id",
        email: "verified@example.com",
        app_metadata: { role: "member" },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      url: "/api/media/move",
      headers: {
        authorization: "Bearer valid-token",
        "x-shortpulse-authenticated": "1",
        "x-shortpulse-user-id": "verified-user-id",
        "x-shortpulse-user-email": "verified@example.com",
        "x-shortpulse-user-app-metadata": encodeURIComponent('{"role":"member"}'),
      },
    };

    const user = await getOptionalApiUser(req as never);

    expect(user?.id).toBe("verified-user-id");
    expect(user?.email).toBe("verified@example.com");
    expect(user?.app_metadata).toEqual({ role: "member" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("ignores spoofed proxy-authenticated identity when bearer verification resolves a different user", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "actual-user-id",
        email: "actual@example.com",
        app_metadata: { role: "member" },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      url: "/api/media/move",
      headers: {
        authorization: "Bearer valid-token",
        "x-shortpulse-authenticated": "1",
        "x-shortpulse-user-id": "spoofed-user-id",
        "x-shortpulse-user-email": "spoofed@example.com",
        "x-shortpulse-user-app-metadata": encodeURIComponent('{"role":"admin"}'),
      },
    };
    const res = createMockResponse();

    const user = await requireApiUser(req as never, res as never);

    expect(user).toEqual({
      id: "actual-user-id",
      email: "actual@example.com",
      app_metadata: { role: "member" },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("falls back to bearer verification when proxy context is unavailable", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "verified-user-id",
        email: "verified@example.com",
        app_metadata: { role: "member" },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      url: "/api/media/move",
      headers: {
        authorization: "Bearer valid-token",
      },
    };

    const user = await getOptionalApiUser(req as never);

    expect(user?.id).toBe("verified-user-id");
    expect(user?.email).toBe("verified@example.com");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("dedupes concurrent bearer verification for the same token", async () => {
    let releaseFetch: (() => void) | undefined;
    const fetchGate = new Promise<void>((resolve) => {
      releaseFetch = resolve;
    });
    const fetchMock = vi.fn(async () => {
      await fetchGate;
      return {
        ok: true,
        json: async () => ({
          id: "verified-user-id",
          email: "verified@example.com",
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      url: "/api/media/move",
      headers: {
        authorization: "Bearer valid-token",
      },
    };

    const firstLookup = getOptionalApiUser(req as never);
    const secondLookup = getOptionalApiUser(req as never);

    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    releaseFetch?.();

    await expect(firstLookup).resolves.toEqual(
      expect.objectContaining({
        id: "verified-user-id",
        email: "verified@example.com",
      })
    );
    await expect(secondLookup).resolves.toEqual(
      expect.objectContaining({
        id: "verified-user-id",
        email: "verified@example.com",
      })
    );
  });

  it("reuses a recent verified bearer identity briefly, then revalidates after the cache window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T00:00:00.000Z"));

    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "verified-user-id",
        email: "verified@example.com",
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      url: "/api/media/move",
      headers: {
        authorization: "Bearer valid-token",
      },
    };

    await getOptionalApiUser(req as never);
    await getOptionalApiUser(req as never);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(SUPABASE_USER_VERIFICATION_CACHE_TTL_MS + 1);

    await getOptionalApiUser(req as never);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("rejects protected-route proxy headers when bearer token is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const req = {
      url: "/api/media/move",
      headers: {
        "x-shortpulse-authenticated": "1",
        "x-shortpulse-user-id": "spoofed",
      },
    };
    const res = createMockResponse();

    const user = await requireApiUser(req as never, res as never);

    expect(user).toBeNull();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("authorizes admin users only after bearer verification confirms the proxy-authenticated identity", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "admin-1",
        email: "admin@example.com",
        app_metadata: { role: "admin", roles: ["operator"] },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const req = {
      url: "/api/admin/users",
      headers: {
        authorization: "Bearer valid-token",
        "x-shortpulse-authenticated": "1",
        "x-shortpulse-user-id": "admin-1",
        "x-shortpulse-user-email": "admin@example.com",
        "x-shortpulse-user-app-metadata": encodeURIComponent(
          '{"role":"admin","roles":["operator"]}'
        ),
      },
    };
    const res = createMockResponse();

    const adminUser = await requireAdminUser(req as never, res as never);

    expect(adminUser?.id).toBe("admin-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("does not let forged same-user proxy metadata supply admin authority", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "user-1",
        email: "user@example.com",
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    const req = {
      url: "/api/admin/users",
      headers: {
        authorization: "Bearer valid-token",
        "x-shortpulse-authenticated": "1",
        "x-shortpulse-user-id": "user-1",
        "x-shortpulse-user-email": "user@example.com",
        "x-shortpulse-user-app-metadata": encodeURIComponent('{"role":"admin"}'),
      },
    };
    const res = createMockResponse();

    const adminUser = await requireAdminUser(req as never, res as never);

    expect(adminUser).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden" });
  });

  it("does not resolve admin access from email alone when operator role is absent", () => {
    const accessVia = resolveAdminAccessVia({
      id: "user-allowlist",
      email: "admin@example.com",
      app_metadata: {},
      user_metadata: {},
    });
    expect(accessVia).toBe("none");
  });

  it("does not allow proxy-header trust even when the legacy env flag is enabled", async () => {
    process.env.SHORTPULSE_TRUST_PROXY_AUTH_HEADERS = "true";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      url: "/api/media/move",
      headers: {
        "x-shortpulse-authenticated": "1",
        "x-shortpulse-user-id": "proxy-user-1",
        "x-shortpulse-user-email": "proxy-user@example.com",
      },
    };
    const res = createMockResponse();

    const user = await requireApiUser(req as never, res as never);

    expect(user).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("does not allow proxy-header trust when bearer auth is missing", async () => {
    process.env.SHORTPULSE_TRUST_PROXY_AUTH_HEADERS = "true";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      url: "/api/media/move",
      headers: {
        "x-shortpulse-authenticated": "1",
        "x-shortpulse-user-id": "proxy-user-1",
      },
    };
    const res = createMockResponse();

    const user = await requireApiUser(req as never, res as never);

    expect(user).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 503 when bearer verification is temporarily unavailable", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      url: "/api/media/move",
      headers: {
        authorization: "Bearer maybe-valid-token",
      },
    };
    const res = createMockResponse();

    const user = await requireApiUser(req as never, res as never);

    expect(user).toBeNull();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Authentication verification is temporarily unavailable.",
      code: "AUTH_VERIFICATION_UNAVAILABLE",
    });
  });

  it("returns 503 when bearer verification returns an unreadable payload", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("invalid auth json");
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      url: "/api/media/move",
      headers: {
        authorization: "Bearer maybe-valid-token",
      },
    };
    const res = createMockResponse();

    const user = await requireApiUser(req as never, res as never);

    expect(user).toBeNull();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: "Authentication verification is temporarily unavailable.",
      code: "AUTH_VERIFICATION_UNAVAILABLE",
    });
  });

  it("preserves auth verification outage context for optional-auth callers", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      url: "/api/telemetry/growth",
      headers: {
        authorization: "Bearer maybe-valid-token",
      },
    };

    const result = await getOptionalApiUserResult(req as never);

    expect(result).toEqual({
      user: null,
      authVerificationUnavailable: true,
    });
  });
});
