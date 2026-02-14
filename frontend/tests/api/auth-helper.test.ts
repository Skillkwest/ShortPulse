/**
 * Auth helper coverage for proxy-context trust and non-protected fallback verification.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOptionalApiUser, requireAdminUser, requireApiUser } from "../../lib/server/api/auth";

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("auth helper proxy context behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.SHORTPULSE_ADMIN_EMAILS = "admin@example.com";
  });

  it("uses middleware-injected context for protected routes without a second Supabase user lookup", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const appMetadata = encodeURIComponent(JSON.stringify({ role: "admin", roles: ["operator"] }));

    const req = {
      url: "/api/media/move",
      headers: {
        authorization: "Bearer valid-token",
        "x-shortpulse-authenticated": "1",
        "x-shortpulse-user-id": "user-123",
        "x-shortpulse-user-email": "admin@example.com",
        "x-shortpulse-user-app-metadata": appMetadata,
      },
    };

    const user = await getOptionalApiUser(req as never);

    expect(user).toEqual(
      expect.objectContaining({
        id: "user-123",
        email: "admin@example.com",
        app_metadata: expect.objectContaining({ role: "admin" }),
      })
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not trust spoofed proxy headers for non-protected routes", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const req = {
      url: "/api/log/client-error",
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

  it("authorizes admins from middleware context without additional network calls", async () => {
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
          JSON.stringify({ role: "admin", roles: ["operator"] })
        ),
      },
    };
    const res = createMockResponse();

    const adminUser = await requireAdminUser(req as never, res as never);

    expect(adminUser?.id).toBe("admin-1");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
