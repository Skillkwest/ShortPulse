import { afterEach, describe, expect, it, vi } from "vitest";
const logApiRouteExceptionMock = vi.hoisted(() => vi.fn());

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: logApiRouteExceptionMock,
}));

import handler from "../../pages/api/auth/callback-url";

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("auth callback url route", () => {
  afterEach(() => {
    delete process.env.APP_BASE_URL;
    delete process.env.SHORTPULSE_PUBLIC_API_BASE_URL;
    vi.unstubAllEnvs();
    logApiRouteExceptionMock.mockReset();
  });

  it("prefers the external request origin outside production when it differs from APP_BASE_URL", async () => {
    process.env.APP_BASE_URL = "https://app.shortpulse.test/base/path";
    const req = {
      method: "GET",
      query: { flow: "recovery", next: "/profile?section=account" },
      headers: {
        host: "internal.shortpulse.test:3000",
        "x-forwarded-host": "preview.shortpulse.test",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://preview.shortpulse.test/auth/callback?flow=recovery&next=%2Fprofile%3Fsection%3Daccount",
    });
  });

  it("uses SHORTPULSE_PUBLIC_API_BASE_URL when preview cannot resolve an external request host", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    process.env.SHORTPULSE_PUBLIC_API_BASE_URL = "https://preview.shortpulse.test/root/path";
    const req = {
      method: "GET",
      query: { flow: "recovery", next: "/dashboard" },
      headers: {
        host: "localhost:3000",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://preview.shortpulse.test/auth/callback?flow=recovery&next=%2Fdashboard",
    });
  });

  it("prefers the external request origin when APP_BASE_URL is loopback", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    process.env.APP_BASE_URL = "http://localhost:3000";
    const req = {
      method: "GET",
      query: { flow: "recovery", next: "/profile?section=account" },
      headers: {
        host: "internal.shortpulse.test",
        "x-forwarded-host": "www.shortpulse.ai",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://www.shortpulse.ai/auth/callback?flow=recovery&next=%2Fprofile%3Fsection%3Daccount",
    });
  });

  it("normalizes the approved production host even when the request arrives on the apex domain", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const req = {
      method: "GET",
      query: { flow: "recovery", next: "/dashboard" },
      headers: {
        host: "shortpulse.ai",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://www.shortpulse.ai/auth/callback?flow=recovery&next=%2Fdashboard",
    });
  });

  it("returns a canonical sign-in callback URL for Google OAuth", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const req = {
      method: "GET",
      query: { flow: "signin", next: "/profile?section=account", provider: "google" },
      headers: {
        host: "www.shortpulse.ai",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://www.shortpulse.ai/auth/callback?flow=signin&next=%2Fprofile%3Fsection%3Daccount&provider=google",
    });
  });

  it("fails closed in production when no approved public auth origin can be resolved", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    process.env.APP_BASE_URL = "https://preview.shortpulse.test";
    const req = {
      method: "GET",
      query: { flow: "recovery", next: "/dashboard" },
      headers: {
        host: "preview.shortpulse.test",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to resolve app origin." });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        routeLabel: "auth/callback-url",
        metadata: { auth_flow: "recovery" },
      })
    );
  });

  it("fails closed in production-built runtimes when forwarded host is unapproved", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const req = {
      method: "GET",
      query: { flow: "recovery", next: "/dashboard" },
      headers: {
        host: "internal.shortpulse.test",
        "x-forwarded-host": "evil.example",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to resolve app origin." });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        routeLabel: "auth/callback-url",
        metadata: { auth_flow: "recovery" },
      })
    );
  });

  it("fails when APP_BASE_URL and SHORTPULSE_PUBLIC_API_BASE_URL disagree", async () => {
    process.env.APP_BASE_URL = "https://app.shortpulse.test";
    process.env.SHORTPULSE_PUBLIC_API_BASE_URL = "https://preview.shortpulse.test";
    const req = {
      method: "GET",
      query: { flow: "recovery", next: "/dashboard" },
      headers: {
        host: "preview.shortpulse.test",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to resolve app origin." });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        routeLabel: "auth/callback-url",
        metadata: { auth_flow: "recovery" },
      })
    );
  });

  it("rejects invalid flows", async () => {
    const req = {
      method: "GET",
      query: { flow: "nope", next: "/dashboard" },
      headers: {
        host: "www.shortpulse.ai",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid auth callback flow." });
  });

  it("normalizes deprecated character aliases to AI Studio in callback URLs", async () => {
    process.env.APP_BASE_URL = "https://www.shortpulse.ai";
    const req = {
      method: "GET",
      query: { flow: "recovery", next: "/character" },
      headers: {
        host: "www.shortpulse.ai",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://www.shortpulse.ai/auth/callback?flow=recovery&next=%2Fai-studio",
    });
  });

  it("fails closed to the dashboard for backslash next paths that URL parsers can normalize cross-origin", async () => {
    process.env.APP_BASE_URL = "https://www.shortpulse.ai";
    const req = {
      method: "GET",
      query: { flow: "recovery", next: "/\\evil.example.com/account" },
      headers: {
        host: "www.shortpulse.ai",
        "x-forwarded-proto": "https",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      url: "https://www.shortpulse.ai/auth/callback?flow=recovery&next=%2Fdashboard",
    });
  });
});
