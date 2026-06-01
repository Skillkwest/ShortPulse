import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";
import { resetSupabaseUserVerificationCache } from "../../lib/server/api/authTokenVerifier";

describe("API proxy protections", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSupabaseUserVerificationCache();
  });

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

  it("enforces auth on direct OpenAI image routes", async () => {
    const request = new NextRequest("http://localhost:3000/api/openai/image-generate");
    const response = await proxy(request);
    expect(response.status).toBe(401);
  });

  it("enforces auth on the Kie upload helper route", async () => {
    const request = new NextRequest("http://localhost:3000/api/kie/upload-url");
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

  it("reuses recent Supabase verification results across repeated protected proxy requests", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "user-123",
        email: "user@example.com",
        app_metadata: { role: "member" },
      }),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const firstRequest = new NextRequest("http://localhost:3000/api/media/sign-batch", {
      headers: {
        authorization: "Bearer valid-token",
      },
    });
    const secondRequest = new NextRequest("http://localhost:3000/api/media/sign-batch", {
      headers: {
        authorization: "Bearer valid-token",
      },
    });

    const firstResponse = await proxy(firstRequest);
    const secondResponse = await proxy(secondRequest);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 503 when auth verification is unavailable for a protected API request", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);

    try {
      const request = new NextRequest("http://localhost:3000/api/media/sign-batch", {
        headers: {
          authorization: "Bearer maybe-valid-token",
        },
      });
      const response = await proxy(request);

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({
        error: "Authentication verification is temporarily unavailable.",
        code: "AUTH_VERIFICATION_UNAVAILABLE",
      });
    } finally {
      consoleErrorMock.mockRestore();
    }
  });

  it("returns a structured 500 when protected proxy header shaping throws unexpectedly", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://supabase.example.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: "user-123",
        email: "user@example.com",
        app_metadata: circular,
      }),
    }));
    const consoleErrorMock = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", fetchMock);

    try {
      const request = new NextRequest("http://localhost:3000/api/media/sign-batch", {
        headers: {
          authorization: "Bearer valid-token",
          "x-shortpulse-request-id": "req-123",
        },
      });
      const response = await proxy(request);

      expect(response.status).toBe(500);
      await expect(response.json()).resolves.toEqual({
        error: "Protected API proxy failed.",
        code: "AUTH_PROXY_RUNTIME_FAILURE",
      });
    } finally {
      consoleErrorMock.mockRestore();
    }
  });
});
