/**
 * Covers the public Google OAuth handoff preflight route's URL boundary,
 * customer-facing outage response, and abuse guard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logApiRouteExceptionMock = vi.hoisted(() => vi.fn());
const enforceApiRateLimitMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: logApiRouteExceptionMock,
}));
vi.mock("../../lib/server/api/rateLimit", () => ({
  enforceApiRateLimit: (...args: unknown[]) => enforceApiRateLimitMock(...args),
}));

import handler from "../../pages/api/auth/oauth-handoff-preflight";

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("auth OAuth handoff preflight route", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co");
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ status: 302 });
    vi.stubGlobal("fetch", fetchMock);
    logApiRouteExceptionMock.mockReset();
    logApiRouteExceptionMock.mockResolvedValue(undefined);
    enforceApiRateLimitMock.mockReset();
    enforceApiRateLimitMock.mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("accepts the configured Supabase Google authorize URL when it redirects to the provider", async () => {
    const req = {
      method: "POST",
      body: {
        url: "https://project.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fwww.shortpulse.ai%2Fauth%2Fcallback",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/auth/v1/authorize?provider=google&redirect_to=https%3A%2F%2Fwww.shortpulse.ai%2Fauth%2Fcallback",
      expect.objectContaining({
        method: "GET",
        redirect: "manual",
      })
    );
    expect(enforceApiRateLimitMock).toHaveBeenCalledWith(
      req,
      res,
      expect.objectContaining({
        keyPrefix: "auth.oauth-handoff-preflight",
        maxRequests: 30,
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true });
  });

  it("rejects non-Supabase handoff URLs without fetching them", async () => {
    const req = {
      method: "POST",
      body: {
        url: "https://evil.example/auth/v1/authorize?provider=google",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: "Invalid Google sign-in handoff URL.",
    });
  });

  it("stops before fetching Supabase when the public handoff preflight is rate limited", async () => {
    enforceApiRateLimitMock.mockReturnValueOnce(false);
    const req = {
      method: "POST",
      body: {
        url: "https://project.supabase.co/auth/v1/authorize?provider=google",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(enforceApiRateLimitMock).toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it("returns a customer-facing unavailable response when Supabase authorize is down", async () => {
    fetchMock.mockResolvedValueOnce({ status: 522 });
    const req = {
      method: "POST",
      body: {
        url: "https://project.supabase.co/auth/v1/authorize?provider=google",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      error: "Google sign-in is temporarily unavailable. Please try again in a few minutes.",
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        routeLabel: "auth/oauth-handoff-preflight",
        metadata: { status: 522 },
      })
    );
  });

  it("allows only POST", async () => {
    const req = {
      method: "GET",
      body: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
    expect(enforceApiRateLimitMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
