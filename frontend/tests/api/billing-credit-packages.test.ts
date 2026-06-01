import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/credit-packages";

const requireApiUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireApiUser: (...args: unknown[]) => requireApiUserMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
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
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns active credit packages", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                {
                  id: "growth_2000",
                  display_name: "Growth 2,000",
                  credit_amount_cents: 2000,
                  price_cents: 2600,
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
          id: "growth_2000",
          display_name: "Growth 2,000",
          credit_amount_cents: 2000,
          price_cents: 2600,
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
