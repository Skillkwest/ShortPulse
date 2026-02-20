import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/internal/generation-recovery/run";

const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

const createSupabaseMock = () => {
  const updateEq2 = vi.fn(async () => ({ error: null }));
  const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
  const update = vi.fn(() => ({ eq: updateEq1 }));
  const from = vi.fn(() => ({ update }));
  const rpc = vi.fn(async () => ({
    data: [
      {
        id: "gen-1",
        user_id: "user-1",
        request_id: "req-1",
        model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        status: "fail",
        recovery_state: "recovering",
        recovery_attempts: 1,
      },
    ],
    error: null,
  }));
  return { rpc, from, updateEq2 };
};

describe("POST /api/internal/generation-recovery/run", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SHORTPULSE_FAL_RECONCILER_ENABLED = "true";
    process.env.SHORTPULSE_FAL_RECONCILER_CRON_SECRET = "cron-secret";
    process.env.SHORTPULSE_FAL_RECONCILER_BATCH_SIZE = "10";
    process.env.SHORTPULSE_FAL_RECONCILER_MAX_ATTEMPTS = "5";
    process.env.SHORTPULSE_FAL_RECONCILER_MIN_AGE_SECONDS = "0";
    process.env.SHORTPULSE_FAL_INTEGRATION_MODE = "on";
    process.env.SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST = "*";
  });

  it("requires the cron secret", async () => {
    const req = {
      method: "POST",
      headers: {},
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });

  it("claims and requeues recovery candidates", async () => {
    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({
      rpc: supabase.rpc,
      from: supabase.from,
    });

    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "cron-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(supabase.rpc).toHaveBeenCalledWith(
      "claim_generation_recovery_batch",
      expect.objectContaining({
        p_limit: 10,
        p_max_attempts: 5,
        p_min_age_seconds: 0,
      })
    );
    expect(supabase.updateEq2).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        claimed: 1,
      })
    );
  });
});
