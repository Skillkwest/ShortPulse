import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/stripe/portal";
import { resetApiRateLimitForTests } from "../../lib/server/api/rateLimit";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const stripePostFormMock = vi.fn();
const getCanonicalAppBaseUrlMock = vi.fn();
const ensureStripeCustomerForUserMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
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

describe("POST /api/billing/stripe/portal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetApiRateLimitForTests();
    process.env.STRIPE_SECRET_KEY = "sk_test_key";
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    getCanonicalAppBaseUrlMock.mockReturnValue("https://app.shortpulse.test");
    ensureStripeCustomerForUserMock.mockResolvedValue("cus_123");
  });

  it("rejects non-POST methods", async () => {
    const req = { method: "GET", body: {} };
    const res = createMockResponse();
    await handler(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it("creates a portal session through bootstrap-safe customer resolution", async () => {
    const req = { method: "POST", body: {}, socket: { remoteAddress: "127.0.0.1" } };
    const res = createMockResponse();
    stripePostFormMock.mockResolvedValue({ id: "bps_1", url: "https://stripe.test/portal_1" });

    await handler(req as never, res as never);

    expect(ensureStripeCustomerForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      email: "user@example.com",
      displayName: null,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("uses canonical app base url for return_url", async () => {
    stripePostFormMock.mockResolvedValue({ id: "bps_1", url: "https://stripe.test/portal_1" });

    const req = { method: "POST", body: {}, socket: { remoteAddress: "127.0.0.1" } };
    const res = createMockResponse();
    await handler(req as never, res as never);

    expect(stripePostFormMock).toHaveBeenCalledWith(
      "/billing_portal/sessions",
      expect.objectContaining({
        return_url: "https://app.shortpulse.test/profile?section=credits",
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 500 when stripe customer bootstrap fails", async () => {
    ensureStripeCustomerForUserMock.mockRejectedValueOnce(new Error("bootstrap failed"));
    const req = { method: "POST", body: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to create billing portal session." });
  });

  it("rate limits repeated billing portal session attempts for the same authenticated user", async () => {
    stripePostFormMock.mockResolvedValue({ id: "bps_1", url: "https://stripe.test/portal_1" });

    for (let index = 0; index < 8; index += 1) {
      const req = { method: "POST", body: {}, socket: { remoteAddress: "127.0.0.1" } };
      const res = createMockResponse();
      await handler(req as never, res as never);
      expect(res.status).toHaveBeenCalledWith(200);
    }

    const blockedReq = { method: "POST", body: {}, socket: { remoteAddress: "127.0.0.1" } };
    const blockedRes = createMockResponse();

    await handler(blockedReq as never, blockedRes as never);

    expect(blockedRes.status).toHaveBeenCalledWith(429);
  });
});
