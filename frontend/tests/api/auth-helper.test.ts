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

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("auth helper protected-route auth behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SHORTPULSE_ADMIN_EMAILS = "admin@example.com";
    process.env.SHORTPULSE_TRUST_PROXY_AUTH_HEADERS = "false";
  });

  it("reuses proxy-authenticated context on protected routes without re-verifying the bearer", async () => {
    const fetchMock = vi.fn();
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
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("authorizes admin users from proxy-authenticated identity context", async () => {
    const fetchMock = vi.fn();
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
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("resolves allowlist admin access when operator role is absent", () => {
    const accessVia = resolveAdminAccessVia({
      id: "user-allowlist",
      email: "admin@example.com",
      app_metadata: {},
      user_metadata: {},
    });
    expect(accessVia).toBe("allowlist");
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
