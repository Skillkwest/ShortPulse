import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";

describe("API proxy protections", () => {
  it("blocks direct /api/_utils/* access", async () => {
    const request = new NextRequest("http://localhost:3000/api/_utils/auth");
    const response = await proxy(request);
    expect(response.status).toBe(404);
  });

  it("keeps auth enforcement for protected API prefixes", async () => {
    const request = new NextRequest("http://localhost:3000/api/fal/seedream-status");
    const response = await proxy(request);
    expect(response.status).toBe(401);
  });

  it("enforces auth on /api/announcements/* routes", async () => {
    const request = new NextRequest("http://localhost:3000/api/announcements/active");
    const response = await proxy(request);
    expect(response.status).toBe(401);
  });

  it("enforces auth on the exact /api/projects collection route", async () => {
    const request = new NextRequest("http://localhost:3000/api/projects");
    const response = await proxy(request);
    expect(response.status).toBe(401);
  });

  it("allows webhook exceptions without bearer auth", async () => {
    const request = new NextRequest("http://localhost:3000/api/fal/webhook");
    const response = await proxy(request);
    expect(response.status).toBe(200);
  });

  it("passes internal reconciler route through to route-level secret auth", async () => {
    const request = new NextRequest("http://localhost:3000/api/internal/generation-recovery/run");
    const response = await proxy(request);
    expect(response.status).toBe(200);
  });

  it("injects authenticated user context headers for protected API requests", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "user-123",
        email: "user@example.com",
        app_metadata: { role: "admin", roles: ["operator"] },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const request = new NextRequest("http://localhost:3000/api/media/sign-batch", {
      headers: {
        authorization: "Bearer valid-token",
      },
    });
    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(response.headers.get("x-middleware-request-x-shortpulse-authenticated")).toBe("1");
    expect(response.headers.get("x-middleware-request-x-shortpulse-user-id")).toBe("user-123");
  });
});
