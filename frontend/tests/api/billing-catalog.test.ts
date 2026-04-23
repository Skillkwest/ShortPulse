import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/billing/catalog";

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

describe("GET /api/billing/catalog", () => {
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

  it("returns active plans and credit packages from one backend payload", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: (table: string) => {
        if (table === "billing_plans") {
          return {
            select: () => ({
              eq: () => ({
                order: async () => ({
                  data: [
                    {
                      id: "free",
                      display_name: "Free",
                      monthly_price_cents: 0,
                      monthly_credits_cents: 100,
                      is_active: true,
                    },
                    {
                      id: "studio",
                      display_name: "Studio",
                      monthly_price_cents: 3900,
                      monthly_credits_cents: 3000,
                      is_active: true,
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === "billing_credit_packages") {
          return {
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
          };
        }

        throw new Error(`Unexpected table ${table}`);
      },
    });

    const req = { method: "GET" };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      plans: [
        {
          id: "free",
          display_name: "Free",
          monthly_price_cents: 0,
          monthly_credits_cents: 100,
          is_active: true,
        },
        {
          id: "studio",
          display_name: "Studio",
          monthly_price_cents: 3900,
          monthly_credits_cents: 3000,
          is_active: true,
        },
      ],
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
});
