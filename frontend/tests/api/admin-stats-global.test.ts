import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/admin/stats/global";

const requireAdminUserMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

vi.mock("../../lib/server/api/auth", () => ({
  requireAdminUser: (...args: unknown[]) => requireAdminUserMock(...args),
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

describe("GET /api/admin/stats/global", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  });

  it("rejects non-GET methods", async () => {
    const req = { method: "POST", query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("returns a safe failure when admin auth verification throws", async () => {
    const authError = new Error("auth verifier exploded");
    requireAdminUserMock.mockRejectedValue(authError);

    const req = { method: "GET", query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        error: authError,
        routeLabel: "admin/stats/global.auth",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Unable to load admin stats." });
  });

  it("merges growth cohorts into the admin stats response", async () => {
    const rpcMock = vi.fn((name: string) => {
      if (name === "get_admin_global_stats_v1") {
        return Promise.resolve({
          data: {
            overview: {},
            models: [],
            workflows: {},
            assets: {},
            projects: {},
          },
          error: null,
        });
      }
      if (name === "get_admin_growth_stats_v1") {
        return Promise.resolve({
          data: {
            marketing: {
              summary: {},
              retention: {},
              attribution: {},
            },
            sales: {
              summary: {},
              highIntentUsers: [],
            },
          },
          error: null,
        });
      }
      if (name === "get_admin_generation_breakdown_v1") {
        return Promise.resolve({
          data: { summary: {}, users: [], modelMediaTypes: [] },
          error: null,
        });
      }
      if (name === "get_admin_first_value_funnel_v1") {
        return Promise.resolve({ data: { steps: [], gaps: [] }, error: null });
      }
      if (name === "get_admin_growth_cohorts_v1") {
        return Promise.resolve({
          data: {
            summary: {
              signedUpNotSubscribed: 2,
              notSubscribedNoGeneration: 1,
            },
            conversionTargetRows: [
              {
                userId: "user-1",
                email: "prospect@example.com",
                subscriptionBucket: "never_subscribed",
                generationBucket: "no_generation",
                recommendedCampaignBucket: "activate_first_generation",
              },
            ],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: new Error(`Unexpected RPC ${name}`) });
    });
    getSupabaseAdminMock.mockReturnValue({ rpc: rpcMock });

    const req = { method: "GET", query: {} };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(rpcMock).toHaveBeenCalledWith("get_admin_growth_cohorts_v1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        growth: expect.objectContaining({
          marketing: expect.objectContaining({
            cohorts: expect.objectContaining({
              summary: expect.objectContaining({ signedUpNotSubscribed: 2 }),
              conversionTargetRows: [expect.objectContaining({ email: "prospect@example.com" })],
            }),
          }),
          health: expect.objectContaining({
            cohortsSource: "rpc",
          }),
        }),
      })
    );
  });
});
