import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/stripe/checkout";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const stripePostFormMock = vi.fn();
const getCanonicalAppBaseUrlMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/stripe", () => ({
  stripePostForm: (...args: unknown[]) => stripePostFormMock(...args),
  getCanonicalAppBaseUrl: (...args: unknown[]) => getCanonicalAppBaseUrlMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/billing/stripe/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    getCanonicalAppBaseUrlMock.mockReturnValue("https://app.shortpulse.test");
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
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
                  is_active: true,
                  stripe_price_id: "price_123",
                  credit_amount_cents: 10000,
                },
                error: null,
              }),
            }),
          }),
        };
      }
      if (table === "billing_profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  stripe_customer_id: "cus_existing",
                  plan_id: "free",
                  subscription_status: "inactive",
                },
                error: null,
              }),
            }),
          }),
          upsert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    });

    getSupabaseAdminMock.mockReturnValue({ from: fromMock });
    stripePostFormMock.mockResolvedValueOnce({
      id: "sess_123",
      url: "https://stripe.test/sess_123",
    });

    const req = { method: "POST", body: { packageId: "pkg_studio_10000" } };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/checkout/sessions",
      expect.objectContaining({
        success_url: "https://app.shortpulse.test/profile?section=billing&checkout=success",
        cancel_url: "https://app.shortpulse.test/profile?section=billing&checkout=cancel",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
