import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/credit-packages";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const resolveCreditTopUpEligibilityForUserMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/creditTopUpEligibility", () => ({
  CREDIT_TOP_UP_REQUIRES_SUBSCRIPTION_MESSAGE:
    "Choose a paid subscription plan before buying credit top-ups.",
  resolveCreditTopUpEligibilityForUser: (...args: unknown[]) =>
    resolveCreditTopUpEligibilityForUserMock(...args),
}));

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe("GET /api/billing/credit-packages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireApiUserMock.mockResolvedValue({ id: "user-1", email: "user@example.com" });
    resolveCreditTopUpEligibilityForUserMock.mockResolvedValue({
      eligible: true,
      contractId: "contract-1",
    });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns a safe credit-package failure when auth verification throws unexpectedly", async () => {
    requireApiUserMock.mockRejectedValueOnce(new Error("auth verifier exploded"));
    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith({
      req,
      error: expect.any(Error),
      routeLabel: "billing/credit-packages.auth",
    });
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to load credit packages.",
    });
  });

  it("blocks credit packages for users without an active paid subscription contract", async () => {
    resolveCreditTopUpEligibilityForUserMock.mockResolvedValueOnce({
      eligible: false,
      reason: "missing_subscription_contract",
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(resolveCreditTopUpEligibilityForUserMock).toHaveBeenCalledWith("user-1");
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: "Choose a paid subscription plan before buying credit top-ups.",
    });
  });

  it("returns active credit packages", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                {
                  id: "2500",
                  display_name: "2,500 credits",
                  credit_amount_cents: 2500,
                  price_cents: 9900,
                  sort_order: 20,
                },
              ],
              error: null,
            }),
          }),
        }),
      }),
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      packages: [
        {
          id: "2500",
          display_name: "2,500 credits",
          credit_amount_cents: 2500,
          price_cents: 9900,
          sort_order: 20,
        },
      ],
    });
  });

  it("logs and sanitizes backend package lookup failures", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: null,
              error: { message: "relation billing_credit_packages does not exist" },
            }),
          }),
        }),
      }),
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        req,
        routeLabel: "billing/credit-packages",
        user: expect.objectContaining({ id: "user-1" }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "Unable to load credit packages.",
    });
  });
});
