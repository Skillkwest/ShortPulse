import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/billing/portal";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const stripePostFormMock = vi.fn();
const getCanonicalAppBaseUrlMock = vi.fn();
const ensureStripeCustomerForUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
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

vi.mock("../../lib/server/api/stripeCustomer", () => ({
  ensureStripeCustomerForUser: (...args: unknown[]) => ensureStripeCustomerForUserMock(...args),
}));

const createMockResponse = () => ({
  setHeader: vi.fn(),
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("POST /api/admin/billing/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
    getCanonicalAppBaseUrlMock.mockReturnValue("https://app.shortpulse.test");
    ensureStripeCustomerForUserMock.mockResolvedValue("cus_123");
    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: { id: "user-1", email: "user@example.com" } },
            error: null,
          }),
        },
      },
    });
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.setHeader).toHaveBeenCalledWith("Allow", "POST");
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("creates a Stripe billing portal session for the selected account", async () => {
    stripePostFormMock.mockResolvedValue({ id: "bps_1", url: "https://stripe.test/portal_1" });

    const req = { method: "POST", body: { userId: "user-1" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(ensureStripeCustomerForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      email: "user@example.com",
    });
    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/billing_portal/sessions",
      expect.objectContaining({
        customer: "cus_123",
        return_url: "https://app.shortpulse.test/admin",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ portalUrl: "https://stripe.test/portal_1" });
  });

  it("returns 404 when the target user does not exist", async () => {
    getSupabaseAdminMock.mockReturnValue({
      auth: {
        admin: {
          getUserById: vi.fn().mockResolvedValue({
            data: { user: null },
            error: null,
          }),
        },
      },
    });

    const req = { method: "POST", body: { userId: "missing-user" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "User not found." });
  });

  it("returns 500 when customer bootstrap fails", async () => {
    ensureStripeCustomerForUserMock.mockRejectedValueOnce(new Error("bootstrap failed"));

    const req = { method: "POST", body: { userId: "user-1" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "bootstrap failed" });
  });
});
