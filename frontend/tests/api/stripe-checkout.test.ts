import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/stripe/checkout";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const writeAppErrorLogMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const stripePostFormMock = vi.fn();
const getCanonicalAppBaseUrlMock = vi.fn();
const ensureStripeCustomerForUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
  writeAppErrorLog: (...args: unknown[]) => writeAppErrorLogMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/stripe", () => ({
  stripePostForm: (...args: unknown[]) => stripePostFormMock(...args),
  getCanonicalAppBaseUrl: (...args: unknown[]) => getCanonicalAppBaseUrlMock(...args),
}));

vi.mock("../../lib/server/api/stripeCustomer", () => ({
  ensureStripeCustomerForUser: (...args: unknown[]) => ensureStripeCustomerForUserMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn().mockReturnThis(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/billing/stripe/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    getCanonicalAppBaseUrlMock.mockReturnValue("https://app.shortpulse.test");
    ensureStripeCustomerForUserMock.mockResolvedValue("cus_existing");
    writeAppErrorLogMock.mockResolvedValue({ ok: true, skipped: false, id: null });
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("returns a safe checkout failure when auth verification throws unexpectedly", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = { method: "POST", body: { packageId: "pkg_studio_10000" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(ensureStripeCustomerForUserMock).not.toHaveBeenCalled();
    expect(stripePostFormMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "billing/stripe/checkout.auth",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to create checkout session." });
  });

  it("requires packageId", async () => {
    const req = { method: "POST", body: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "packageId is required." });
  });

  it("builds redirect URLs from canonical app base url", async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === "billing_credit_packages") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: "pkg_studio_10000",
                  display_name: "Studio 10,000",
                  is_active: true,
                  stripe_price_id: "price_123",
                  credit_amount_cents: 10000,
                  price_cents: 12900,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    getSupabaseAdminMock.mockReturnValue({ from: fromMock });
    stripePostFormMock.mockResolvedValueOnce({
      id: "sess_123",
      url: "https://stripe.test/sess_123",
    });

    const req = {
      method: "POST",
      body: { packageId: "pkg_studio_10000" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/checkout/sessions",
      expect.objectContaining({
        success_url: "https://app.shortpulse.test/profile?section=credits&checkout=success",
        cancel_url: "https://app.shortpulse.test/profile?section=credits&checkout=cancel",
        "metadata[credit_package_display_name]": "Studio 10,000",
        "metadata[credit_package_price_cents]": 12900,
      })
    );
    expect(ensureStripeCustomerForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      email: "user@example.com",
      displayName: null,
    });
    expect(writeAppErrorLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.billing.checkout_started",
        userId: "user-1",
        metadata: expect.objectContaining({
          event_name: "checkout_started",
          package_id: "pkg_studio_10000",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("allows AI Studio checkout to return to the active studio path", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "pkg_studio_10000",
                display_name: "Studio 10,000",
                is_active: true,
                stripe_price_id: "price_123",
                credit_amount_cents: 10000,
                price_cents: 12900,
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    stripePostFormMock.mockResolvedValueOnce({
      id: "sess_123",
      url: "https://stripe.test/sess_123",
    });

    const req = {
      method: "POST",
      body: {
        packageId: "pkg_studio_10000",
        returnPath: "/ai-studio?projectId=project-1&checkout=old",
      },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/checkout/sessions",
      expect.objectContaining({
        success_url:
          "https://app.shortpulse.test/ai-studio?projectId=project-1&checkout=credits_success",
        cancel_url:
          "https://app.shortpulse.test/ai-studio?projectId=project-1&checkout=credits_cancel",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("falls back to profile credits for unsafe checkout return paths", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "pkg_studio_10000",
                display_name: "Studio 10,000",
                is_active: true,
                stripe_price_id: "price_123",
                credit_amount_cents: 10000,
                price_cents: 12900,
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    stripePostFormMock.mockResolvedValueOnce({
      id: "sess_123",
      url: "https://stripe.test/sess_123",
    });

    const req = {
      method: "POST",
      body: {
        packageId: "pkg_studio_10000",
        returnPath: "https://evil.test/ai-studio",
      },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/checkout/sessions",
      expect.objectContaining({
        success_url: "https://app.shortpulse.test/profile?section=credits&checkout=success",
        cancel_url: "https://app.shortpulse.test/profile?section=credits&checkout=cancel",
      })
    );
  });

  it("fails closed with customer-safe copy when the credit package is unavailable", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "pkg_studio_10000",
                display_name: "Studio 10,000",
                is_active: true,
                stripe_price_id: null,
                credit_amount_cents: 10000,
                price_cents: 12900,
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const req = {
      method: "POST",
      body: { packageId: "pkg_studio_10000" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "This credit package is temporarily unavailable. Try again later.",
    });
    expect(ensureStripeCustomerForUserMock).not.toHaveBeenCalled();
    expect(stripePostFormMock).not.toHaveBeenCalled();
  });

  it("returns 500 when stripe customer bootstrap fails", async () => {
    ensureStripeCustomerForUserMock.mockRejectedValueOnce(new Error("bootstrap failed"));
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "pkg_studio_10000",
                display_name: "Studio 10,000",
                is_active: true,
                stripe_price_id: "price_123",
                credit_amount_cents: 10000,
                price_cents: 12900,
              },
              error: null,
            }),
          }),
        }),
      }),
    });

    const req = {
      method: "POST",
      body: { packageId: "pkg_studio_10000" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to create checkout session." });
  });

  it("rate limits repeated checkout session attempts for the same authenticated user", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: "pkg_studio_10000",
                display_name: "Studio 10,000",
                is_active: true,
                stripe_price_id: "price_123",
                credit_amount_cents: 10000,
                price_cents: 12900,
              },
              error: null,
            }),
          }),
        }),
      }),
    });
    stripePostFormMock.mockResolvedValue({
      id: "sess_123",
      url: "https://stripe.test/sess_123",
    });

    for (let index = 0; index < 5; index += 1) {
      const req = {
        method: "POST",
        body: { packageId: "pkg_studio_10000" },
        socket: { remoteAddress: "127.0.0.1" },
      };
      const res = createMockResponse();
      await handler(req as never, res as never);
      expect(res.status).toHaveBeenCalledWith(200);
    }

    const blockedReq = {
      method: "POST",
      body: { packageId: "pkg_studio_10000" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    const blockedRes = createMockResponse();

    await handler(blockedReq as never, blockedRes as never);

    expect(blockedRes.status).toHaveBeenCalledWith(429);
  });
});
