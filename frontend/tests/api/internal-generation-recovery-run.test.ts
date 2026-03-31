import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "../../pages/api/internal/generation-recovery/run";

const getSupabaseAdminMock = vi.fn();
const logApiRouteExceptionMock = vi.fn();
const dispatchGenerationSubmitQueueBatchMock = vi.fn();
const repairGenerationRequestIdsFromReservationsMock = vi.fn();

vi.mock("../../lib/server/api/supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../../lib/server/api/appErrorLogs", () => ({
  logApiRouteException: (...args: unknown[]) => logApiRouteExceptionMock(...args),
}));

vi.mock("../../lib/server/api/generationQueue/dispatch", () => ({
  dispatchGenerationSubmitQueueBatch: (...args: unknown[]) =>
    dispatchGenerationSubmitQueueBatchMock(...args),
}));

vi.mock("../../lib/server/api/generationQueue/requestIdRepair", () => ({
  repairGenerationRequestIdsFromReservations: (...args: unknown[]) =>
    repairGenerationRequestIdsFromReservationsMock(...args),
}));

const createMockResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

type SupabaseMock = {
  rpc: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  updateEq2: ReturnType<typeof vi.fn>;
};

const createSupabaseMock = (): SupabaseMock => {
  const updateEq2 = vi.fn(async () => ({ error: null }));
  const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
  const update = vi.fn(() => ({ eq: updateEq1 }));
  const from = vi.fn(() => ({ update }));
  const rpc = vi.fn(async (functionName: string) => {
    if (functionName === "release_stale_generation_reservations") {
      return {
        data: [{ scanned_count: 7, released_count: 3, error_count: 0 }],
        error: null,
      };
    }
    return {
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
    };
  });
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
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "false";
    dispatchGenerationSubmitQueueBatchMock.mockReset();
    repairGenerationRequestIdsFromReservationsMock.mockReset();
    repairGenerationRequestIdsFromReservationsMock.mockResolvedValue({
      scanned: 0,
      repaired: 0,
      errors: 0,
    });
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

  it("rejects GET because the recovery runner mutates state", async () => {
    const req = {
      method: "GET",
      headers: {
        authorization: "Bearer cron-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.json).toHaveBeenCalledWith({ error: "Method not allowed" });
  });

  it("accepts bearer token auth with CRON_SECRET fallback when route secret is unset", async () => {
    delete process.env.SHORTPULSE_FAL_RECONCILER_CRON_SECRET;
    process.env.CRON_SECRET = "vercel-cron-secret";

    const supabase = createSupabaseMock();
    getSupabaseAdminMock.mockReturnValue({
      rpc: supabase.rpc,
      from: supabase.from,
    });

    const req = {
      method: "POST",
      headers: {
        authorization: "Bearer vercel-cron-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
      })
    );
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
      "release_stale_generation_reservations",
      expect.objectContaining({
        p_limit: 200,
        p_min_age_seconds: 900,
      })
    );
    expect(supabase.rpc).toHaveBeenCalledWith(
      "claim_generation_recovery_batch",
      expect.objectContaining({
        p_limit: 10,
        p_max_attempts: 5,
        p_min_age_seconds: 0,
      })
    );
    expect(repairGenerationRequestIdsFromReservationsMock).toHaveBeenCalledWith({
      limit: 10,
    });
    expect(supabase.updateEq2).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        claimed: 1,
        reservationCleanupScanned: 7,
        reservationCleanupReleased: 3,
        reservationCleanupErrors: 0,
      })
    );
  });

  it("continues recovery when reservation cleanup RPC fails", async () => {
    const supabase = createSupabaseMock();
    supabase.rpc = vi.fn(async (functionName: string) => {
      if (functionName === "release_stale_generation_reservations") {
        return {
          data: null,
          error: { message: "cleanup unavailable" },
        };
      }
      return {
        data: [],
        error: null,
      };
    });
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

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationCleanupScanned: 0,
        reservationCleanupReleased: 0,
        reservationCleanupErrors: 1,
      })
    );
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "internal/generation-recovery/run",
        metadata: expect.objectContaining({
          stage: "reservation_cleanup",
        }),
      })
    );
  });

  it("records queue dispatch errors and continues recovery", async () => {
    process.env.SHORTPULSE_FAL_QUEUE_ENABLED = "true";
    dispatchGenerationSubmitQueueBatchMock.mockRejectedValueOnce(new Error("claim failed"));

    const supabase = createSupabaseMock();
    supabase.rpc = vi.fn(async (functionName: string) => {
      if (functionName === "release_stale_generation_reservations") {
        return {
          data: [{ scanned_count: 1, released_count: 0, error_count: 0 }],
          error: null,
        };
      }
      if (functionName === "claim_generation_recovery_batch") {
        return { data: [], error: null };
      }
      return { data: [], error: null };
    });
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

    expect(dispatchGenerationSubmitQueueBatchMock).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        queueDispatchErrors: 1,
      })
    );
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "internal/generation-recovery/run",
        metadata: expect.objectContaining({
          stage: "queue_dispatch",
        }),
      })
    );
  });

  it("logs and continues when request-id repair throws", async () => {
    repairGenerationRequestIdsFromReservationsMock.mockRejectedValueOnce(
      new Error("repair unavailable")
    );

    const supabase = createSupabaseMock();
    supabase.rpc = vi.fn(async (functionName: string) => {
      if (functionName === "release_stale_generation_reservations") {
        return {
          data: [{ scanned_count: 0, released_count: 0, error_count: 0 }],
          error: null,
        };
      }
      if (functionName === "claim_generation_recovery_batch") {
        return { data: [], error: null };
      }
      return { data: [], error: null };
    });
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

    expect(repairGenerationRequestIdsFromReservationsMock).toHaveBeenCalledWith({
      limit: 10,
    });
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "internal/generation-recovery/run",
        metadata: expect.objectContaining({
          stage: "request_id_repair_batch",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("runs request-id repair before claiming the recovery batch", async () => {
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

    expect(repairGenerationRequestIdsFromReservationsMock).toHaveBeenCalledWith({
      limit: 10,
    });
    const repairOrder =
      repairGenerationRequestIdsFromReservationsMock.mock.invocationCallOrder[0] ??
      Number.MAX_SAFE_INTEGER;
    const claimCallIndex = supabase.rpc.mock.calls.findIndex(
      (call) => (call[0] as string | undefined) === "claim_generation_recovery_batch"
    );
    expect(claimCallIndex).toBeGreaterThan(-1);
    const claimOrder = supabase.rpc.mock.invocationCallOrder[claimCallIndex] ?? 0;
    expect(repairOrder).toBeLessThan(claimOrder);
  });

  it("uses compare-and-set fallback claims when RPC claim fails", async () => {
    process.env.SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST = "fal-ai/non-match";

    const fallbackRows = [
      {
        id: "gen-1",
        user_id: "user-1",
        request_id: "req-1",
        provider: "fal",
        model_id: "fal-ai/model-a",
        status: "running",
        recovery_state: "queued",
        recovery_attempts: 0,
      },
      {
        id: "gen-2",
        user_id: "user-2",
        request_id: "req-2",
        provider: "fal",
        model_id: "fal-ai/model-b",
        status: "running",
        recovery_state: "queued",
        recovery_attempts: null,
      },
    ];

    const fallbackSelectBuilder: {
      ilike: ReturnType<typeof vi.fn>;
      in: ReturnType<typeof vi.fn>;
      lte: ReturnType<typeof vi.fn>;
      or: ReturnType<typeof vi.fn>;
      lt: ReturnType<typeof vi.fn>;
      order: ReturnType<typeof vi.fn>;
      limit: ReturnType<typeof vi.fn>;
    } = {
      ilike: vi.fn(),
      in: vi.fn(),
      lte: vi.fn(),
      or: vi.fn(),
      lt: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(),
    };
    fallbackSelectBuilder.ilike.mockReturnValue(fallbackSelectBuilder);
    fallbackSelectBuilder.in.mockReturnValue(fallbackSelectBuilder);
    fallbackSelectBuilder.lte.mockReturnValue(fallbackSelectBuilder);
    fallbackSelectBuilder.or.mockReturnValue(fallbackSelectBuilder);
    fallbackSelectBuilder.lt.mockReturnValue(fallbackSelectBuilder);
    fallbackSelectBuilder.order.mockReturnValue(fallbackSelectBuilder);
    fallbackSelectBuilder.limit.mockResolvedValue({
      data: fallbackRows,
      error: null,
    });

    const updateSelectMock = vi
      .fn()
      .mockResolvedValueOnce({ data: [{ id: "gen-1" }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    const recoveryAttemptSelectBuilder = {
      select: updateSelectMock,
    };
    const updateOr = {
      eq: vi.fn(() => recoveryAttemptSelectBuilder),
      is: vi.fn(() => recoveryAttemptSelectBuilder),
    };
    const updateLte = { or: vi.fn(() => updateOr) };
    const updateLt = { lte: vi.fn(() => updateLte) };
    const updateIlike = { lt: vi.fn(() => updateLt) };
    const updateEq5 = { ilike: vi.fn(() => updateIlike) };
    const updateEq4 = { eq: vi.fn(() => updateEq5) };
    const updateEq3 = { eq: vi.fn(() => updateEq4) };
    const updateEq2 = { eq: vi.fn(() => updateEq3) };
    const updateEq1 = { eq: vi.fn(() => updateEq2) };
    const from = vi.fn(() => ({
      select: vi.fn(() => fallbackSelectBuilder),
      update: vi.fn(() => updateEq1),
    }));

    const rpc = vi.fn(async (functionName: string) => {
      if (functionName === "release_stale_generation_reservations") {
        return {
          data: [{ scanned_count: 0, released_count: 0, error_count: 0 }],
          error: null,
        };
      }
      if (functionName === "claim_generation_recovery_batch") {
        return {
          data: null,
          error: { message: "rpc unavailable" },
        };
      }
      return { data: [], error: null };
    });

    getSupabaseAdminMock.mockReturnValue({ rpc, from });

    const req = {
      method: "POST",
      headers: {
        "x-shortpulse-cron-secret": "cron-secret",
      },
    };
    const res = createMockResponse();

    await handler(req as never, res as never);

    expect(updateSelectMock).toHaveBeenCalledTimes(2);
    expect(updateOr.eq).toHaveBeenCalledWith("recovery_attempts", 0);
    expect(updateOr.is).toHaveBeenCalledWith("recovery_attempts", null);
    expect(logApiRouteExceptionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        routeLabel: "internal/generation-recovery/run",
        metadata: expect.objectContaining({
          stage: "claim_generation_recovery_batch_rpc",
        }),
      })
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        claimed: 1,
      })
    );
  });

  it("requeues allowlist-skipped recoveries without consuming retry budget", async () => {
    process.env.SHORTPULSE_FAL_INTEGRATION_MODEL_ALLOWLIST = "fal-ai/non-match";

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

    expect(supabase.updateEq2).toHaveBeenCalledWith("user_id", "user-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        ok: true,
        claimed: 1,
        skipped: 1,
        errors: 0,
      })
    );
  });
});
