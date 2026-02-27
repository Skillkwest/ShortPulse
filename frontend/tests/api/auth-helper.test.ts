/**
 * Auth helper coverage for token-first route verification and proxy metadata behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getOptionalApiUser,
  requireAdminUser,
  requireApiUser,
  resolveAdminAccessVia,
} from "../../lib/server/api/auth";

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("auth helper token-first behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SHORTPULSE_ADMIN_EMAILS = "admin@example.com";
    process.env.SHORTPULSE_TRUST_PROXY_AUTH_HEADERS = "false";
  });

  it("verifies bearer auth and ignores mismatched proxy identity", async () => {
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
        "x-shortpulse-user-id": "spoofed-user",
        "x-shortpulse-user-email": "spoofed@example.com",
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

  it("authorizes admin users from verified bearer identity", async () => {
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
        "x-shortpulse-user-id": "spoofed-admin-id",
      },
    };
    const res = createMockResponse();

    const adminUser = await requireAdminUser(req as never, res as never);

    expect(adminUser?.id).toBe("admin-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
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

  it("allows emergency proxy-header trust only when explicitly enabled and bearer is absent", async () => {
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

    expect(user?.id).toBe("proxy-user-1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("does not fallback to proxy headers when bearer verification fails", async () => {
    process.env.SHORTPULSE_TRUST_PROXY_AUTH_HEADERS = "true";
    const fetchMock = vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const req = {
      url: "/api/media/move",
      headers: {
        authorization: "Bearer invalid-token",
        "x-shortpulse-authenticated": "1",
        "x-shortpulse-user-id": "proxy-user-1",
      },
    };
    const res = createMockResponse();

    const user = await requireApiUser(req as never, res as never);

    expect(user).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
