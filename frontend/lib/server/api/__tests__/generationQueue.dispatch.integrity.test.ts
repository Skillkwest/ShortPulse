import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchGenerationSubmitQueueBatch } from "../generationQueue/dispatch";

const getSupabaseAdminMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const readFalRuntimeFlagsMock = vi.fn();
const releaseGenerationReservationBySourceRefMock = vi.fn();
const markGenerationReservationSubmittedMock = vi.fn();
const resolveGenerationAdmissionTierMock = vi.fn();
const getFalModelProfileByModelIdMock = vi.fn();
const dispatchProviderSubmitMock = vi.fn();
const resolveWebhookCallbackUrlMock = vi.fn();
const withWebhookTargetsMock = vi.fn();
const claimGenerationSubmitQueueBatchMock = vi.fn();
const markQueueItemExhaustedMock = vi.fn();
const releaseQueueLeaseBackToQueuedMock = vi.fn();
const removeQueueItemMock = vi.fn();
const updateQueueItemForRetryMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../appErrorLogs", () => ({
  logGenerationFailure: (...args: unknown[]) => logGenerationFailureMock(...args),
}));

vi.mock("../falRuntimeFlags", () => ({
  readFalRuntimeFlags: (...args: unknown[]) => readFalRuntimeFlagsMock(...args),
}));

vi.mock("../generationBilling/reservationRpcAdapter", () => ({
  markGenerationReservationSubmitted: (...args: unknown[]) =>
    markGenerationReservationSubmittedMock(...args),
  releaseGenerationReservationBySourceRef: (...args: unknown[]) =>
    releaseGenerationReservationBySourceRefMock(...args),
}));

vi.mock("../../../model-runtime/generationAdmissionTiers", () => ({
  resolveGenerationAdmissionTier: (...args: unknown[]) =>
    resolveGenerationAdmissionTierMock(...args),
}));

vi.mock("../../falIntegration/modelProfiles", () => ({
  getFalModelProfileByModelId: (...args: unknown[]) => getFalModelProfileByModelIdMock(...args),
}));

vi.mock("../../providerIntegration/submitProviderDispatcher", () => ({
  dispatchProviderSubmit: (...args: unknown[]) => dispatchProviderSubmitMock(...args),
}));

vi.mock("../falSubmitTargeting", () => ({
  resolveWebhookCallbackUrl: (...args: unknown[]) => resolveWebhookCallbackUrlMock(...args),
  withWebhookTargets: (...args: unknown[]) => withWebhookTargetsMock(...args),
}));

vi.mock("../generationQueue/service", () => ({
  claimGenerationSubmitQueueBatch: (...args: unknown[]) =>
    claimGenerationSubmitQueueBatchMock(...args),
  markQueueItemExhausted: (...args: unknown[]) => markQueueItemExhaustedMock(...args),
  releaseQueueLeaseBackToQueued: (...args: unknown[]) => releaseQueueLeaseBackToQueuedMock(...args),
  removeQueueItem: (...args: unknown[]) => removeQueueItemMock(...args),
  updateQueueItemForRetry: (...args: unknown[]) => updateQueueItemForRetryMock(...args),
}));

const queueItem = {
  queueId: "queue-1",
  generationId: "gen-1",
  userId: "user-1",
  modelId: "fal-ai/nano-banana-pro",
  sourceRef: "source-1",
  submitRoute: "/api/fal/nano-banana-pro-submit",
  submitPayload: { prompt: "hello" },
  timeoutMs: 20_000,
  attempts: 0,
  status: "dispatching" as const,
  nextAttemptAt: null,
  leaseUntil: new Date(Date.now() + 30_000).toISOString(),
  createdAt: new Date(Date.now() - 10_000).toISOString(),
};

const mutationSuccess = (operation: "retry" | "exhaust" | "release" | "remove") => ({
  ok: true,
  operation,
  queueId: "queue-1",
  affectedCount: 1,
  reason: "applied",
  errorMessage: null,
});

const createSupabaseAdminMock = ({
  generationUpdateError,
  existingRequestId,
  provider,
}: {
  generationUpdateError?: string;
  existingRequestId?: string | null;
  provider?: string | null;
}) => {
  const aiGenerationsTable = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: {
              id: "gen-1",
              status: "pending",
              request_id: existingRequestId ?? null,
              provider: provider ?? null,
              metadata: {},
            },
            error: null,
          })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(async () => ({
            data: generationUpdateError ? null : [{ id: "gen-1" }],
            error: generationUpdateError ? { message: generationUpdateError } : null,
          })),
        })),
      })),
    })),
  };

  const reservationsTable = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          not: vi.fn(async () => ({ data: [], error: null })),
        })),
      })),
    })),
  };

  return {
    from: vi.fn((tableName: string) => {
      if (tableName === "ai_generations") return aiGenerationsTable;
      if (tableName === "ai_credit_reservations") return reservationsTable;
      throw new Error(`Unexpected table: ${tableName}`);
    }),
  };
};

describe("generationQueue/dispatch transition integrity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FAL_KEY = "test-fal-key";
    getSupabaseAdminMock.mockReturnValue(createSupabaseAdminMock({}));
    readFalRuntimeFlagsMock.mockReturnValue({
      queueEnabled: true,
      queueLeaseSeconds: 30,
      queueMaxAttempts: 5,
      queueBaseBackoffSeconds: 5,
      queueMaxWaitSeconds: 1200,
      admission: {
        globalMax: 8,
        tierLimits: {
          video_long: 2,
          image_heavy: 3,
          image_standard: 4,
        },
      },
      publicApiBaseUrl: null,
    });
    claimGenerationSubmitQueueBatchMock.mockResolvedValue([queueItem]);
    resolveGenerationAdmissionTierMock.mockReturnValue("image_standard");
    getFalModelProfileByModelIdMock.mockReturnValue({
      submitTargets: [{ route: "/api/fal/nano-banana-pro-submit", url: "https://fal.test" }],
    });
    resolveWebhookCallbackUrlMock.mockReturnValue(null);
    withWebhookTargetsMock.mockImplementation((targets: unknown) => targets);
    dispatchProviderSubmitMock.mockResolvedValue({
      response: { ok: true, status: 200 },
      data: { request_id: "req-1" },
      providerRequestId: "req-1",
      targetUrl: "https://fal.test",
      targetIndex: 0,
    });
    markGenerationReservationSubmittedMock.mockResolvedValue({
      status: "reserved",
      sourceRef: "source-1",
      message: null,
    });
    markQueueItemExhaustedMock.mockResolvedValue(mutationSuccess("exhaust"));
    releaseQueueLeaseBackToQueuedMock.mockResolvedValue(mutationSuccess("release"));
    removeQueueItemMock.mockResolvedValue(mutationSuccess("remove"));
    updateQueueItemForRetryMock.mockResolvedValue(mutationSuccess("retry"));
  });

  it("exhausts without releasing reservation when generation running update fails post-submit", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({ generationUpdateError: "write failed" })
    );

    const result = await dispatchGenerationSubmitQueueBatch({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "test/dispatch-integrity",
      limit: 1,
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        claimed: 1,
        exhausted: 1,
        errors: 1,
      })
    );
    expect(markQueueItemExhaustedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastErrorCode: "GENERATION_MARK_RUNNING_DB_ERROR",
      })
    );
    expect(releaseGenerationReservationBySourceRefMock).not.toHaveBeenCalled();
    expect(updateQueueItemForRetryMock).not.toHaveBeenCalled();
  });

  it("retries queue item when reservation submit returns retryable failure", async () => {
    markGenerationReservationSubmittedMock.mockResolvedValue({
      status: "failed",
      sourceRef: "source-1",
      message: "rpc timeout",
    });

    const result = await dispatchGenerationSubmitQueueBatch({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "test/dispatch-integrity",
      limit: 1,
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        claimed: 1,
        retried: 1,
        exhausted: 0,
        errors: 1,
      })
    );
    expect(updateQueueItemForRetryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastErrorCode: "RESERVATION_SUBMIT_FAILED",
      })
    );
    expect(removeQueueItemMock).not.toHaveBeenCalled();
    expect(releaseGenerationReservationBySourceRefMock).not.toHaveBeenCalled();
  });

  it("reconciles reservation then removes queue item when generation already has request id", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({ existingRequestId: "req-existing" })
    );

    const result = await dispatchGenerationSubmitQueueBatch({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "test/dispatch-integrity",
      limit: 1,
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        claimed: 1,
        skipped: 1,
        retried: 0,
        exhausted: 0,
      })
    );
    expect(markGenerationReservationSubmittedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "req-existing",
      })
    );
    expect(removeQueueItemMock).toHaveBeenCalledTimes(1);
    expect(dispatchProviderSubmitMock).not.toHaveBeenCalled();
  });

  it("retries existing-request reconciliation when reservation submit fails", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createSupabaseAdminMock({ existingRequestId: "req-existing" })
    );
    markGenerationReservationSubmittedMock.mockResolvedValue({
      status: "failed",
      sourceRef: "source-1",
      message: "rpc timeout",
    });

    const result = await dispatchGenerationSubmitQueueBatch({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "test/dispatch-integrity",
      limit: 1,
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        claimed: 1,
        retried: 1,
        exhausted: 0,
        errors: 1,
      })
    );
    expect(updateQueueItemForRetryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastErrorCode: "RESERVATION_SUBMIT_FAILED",
      })
    );
    expect(removeQueueItemMock).not.toHaveBeenCalled();
    expect(dispatchProviderSubmitMock).not.toHaveBeenCalled();
  });

  it("fails closed without dispatch when queued generation provider is kie but runtime targets are unavailable", async () => {
    process.env.KIE_API_KEY = "test-kie-key";
    getSupabaseAdminMock.mockReturnValue(createSupabaseAdminMock({ provider: "kie" }));

    const result = await dispatchGenerationSubmitQueueBatch({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "test/dispatch-integrity",
      limit: 1,
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        claimed: 1,
        exhausted: 1,
        submitted: 0,
      })
    );
    expect(markQueueItemExhaustedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastErrorCode: "KIE_RUNTIME_DISABLED",
      })
    );
    expect(dispatchProviderSubmitMock).not.toHaveBeenCalled();
    delete process.env.KIE_API_KEY;
  });

  it("dispatches queued kie generation when runtime allowlist and submit targets are configured", async () => {
    process.env.KIE_API_KEY = "test-kie-key";
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    process.env.SHORTPULSE_KIE_SUBMIT_URLS = "https://queue.kie.ai/v1/jobs";
    getSupabaseAdminMock.mockReturnValue(createSupabaseAdminMock({ provider: "kie" }));
    claimGenerationSubmitQueueBatchMock.mockResolvedValue([
      {
        ...queueItem,
        modelId: "kie-ai/veo-3.1-fast-i2v",
        submitPayload: {
          prompt: "hello",
          image_url: "https://cdn.shortpulse.test/input.png",
        },
      },
    ]);

    const result = await dispatchGenerationSubmitQueueBatch({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "test/dispatch-integrity",
      limit: 1,
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        claimed: 1,
        submitted: 1,
        exhausted: 0,
      })
    );
    expect(dispatchProviderSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
        targets: [{ submitUrl: "https://queue.kie.ai/v1/jobs" }],
      })
    );
    expect(withWebhookTargetsMock).not.toHaveBeenCalled();
    expect(markQueueItemExhaustedMock).not.toHaveBeenCalled();

    delete process.env.KIE_API_KEY;
    delete process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED;
    delete process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST;
    delete process.env.SHORTPULSE_KIE_SUBMIT_URLS;
  });

  it("dispatches queued kie generation using model-catalog submit defaults when env submit urls are unset", async () => {
    process.env.KIE_API_KEY = "test-kie-key";
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    delete process.env.SHORTPULSE_KIE_SUBMIT_URLS;

    getSupabaseAdminMock.mockReturnValue(createSupabaseAdminMock({ provider: "kie" }));
    claimGenerationSubmitQueueBatchMock.mockResolvedValue([
      {
        ...queueItem,
        modelId: "kie-ai/veo-3.1-fast-i2v",
        submitPayload: {
          prompt: "hello",
          image_url: "https://cdn.shortpulse.test/input.png",
        },
      },
    ]);

    const result = await dispatchGenerationSubmitQueueBatch({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "test/dispatch-integrity",
      limit: 1,
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        claimed: 1,
        submitted: 1,
        exhausted: 0,
      })
    );
    expect(dispatchProviderSubmitMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "kie",
        modelId: "kie-ai/veo-3.1-fast-i2v",
        targets: [{ submitUrl: "https://api.kie.ai/api/v1/veo/generate" }],
      })
    );

    delete process.env.KIE_API_KEY;
    delete process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED;
    delete process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST;
  });

  it("fails closed before provider submit when queued payload violates the shared contract", async () => {
    claimGenerationSubmitQueueBatchMock.mockResolvedValue([
      {
        ...queueItem,
        submitPayload: {
          prompt: "hello",
          unexpected_debug_flag: true,
        },
      },
    ]);

    const result = await dispatchGenerationSubmitQueueBatch({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "test/dispatch-integrity",
      limit: 1,
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        claimed: 1,
        exhausted: 1,
        submitted: 0,
      })
    );
    expect(markQueueItemExhaustedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastErrorCode: "QUEUE_PAYLOAD_CONTRACT_VIOLATION",
      })
    );
    expect(releaseGenerationReservationBySourceRefMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "Auto-release: queued submit payload violated dispatch contract.",
      })
    );
    expect(dispatchProviderSubmitMock).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.queue.dispatch.exhausted",
        statusCode: 400,
        metadata: expect.objectContaining({
          error_code: "QUEUE_PAYLOAD_CONTRACT_VIOLATION",
        }),
      })
    );
  });

  it("applies deterministic jittered retry backoff within bounded delay", async () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, "random");
    try {
      vi.setSystemTime(new Date("2026-03-01T00:00:00.000Z"));
      dispatchProviderSubmitMock.mockResolvedValue({
        response: { ok: false, status: 429 },
        data: { code: "rate_limit", message: "Slow down" },
        providerRequestId: null,
        targetUrl: "https://fal.test",
        targetIndex: 0,
      });

      randomSpy.mockReturnValue(0);
      await dispatchGenerationSubmitQueueBatch({
        req: { method: "GET", headers: {} } as never,
        routeLabel: "test/dispatch-integrity",
        limit: 1,
        userId: "user-1",
      });
      expect(updateQueueItemForRetryMock).toHaveBeenCalledTimes(1);
      const lowJitterCall = updateQueueItemForRetryMock.mock.calls[0]?.[0];
      const lowDelayMs = Date.parse(String(lowJitterCall?.nextAttemptAt)) - Date.now();
      expect(lowDelayMs).toBeGreaterThanOrEqual(8_000);
      expect(lowDelayMs).toBeLessThanOrEqual(12_000);
      expect(lowDelayMs).toBe(8_000);

      updateQueueItemForRetryMock.mockClear();
      randomSpy.mockReturnValue(1);
      await dispatchGenerationSubmitQueueBatch({
        req: { method: "GET", headers: {} } as never,
        routeLabel: "test/dispatch-integrity",
        limit: 1,
        userId: "user-1",
      });
      expect(updateQueueItemForRetryMock).toHaveBeenCalledTimes(1);
      const highJitterCall = updateQueueItemForRetryMock.mock.calls[0]?.[0];
      const highDelayMs = Date.parse(String(highJitterCall?.nextAttemptAt)) - Date.now();
      expect(highDelayMs).toBeGreaterThanOrEqual(8_000);
      expect(highDelayMs).toBeLessThanOrEqual(12_000);
      expect(highDelayMs).toBe(12_000);
    } finally {
      randomSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("emits lease-timeout warning telemetry when lease budget is near submit timeout", async () => {
    readFalRuntimeFlagsMock.mockReturnValue({
      queueEnabled: true,
      queueLeaseSeconds: 18,
      queueMaxAttempts: 5,
      queueBaseBackoffSeconds: 5,
      queueMaxWaitSeconds: 1200,
      admission: {
        globalMax: 8,
        tierLimits: {
          video_long: 2,
          image_heavy: 3,
          image_standard: 4,
        },
      },
      publicApiBaseUrl: null,
    });

    await dispatchGenerationSubmitQueueBatch({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "test/dispatch-integrity",
      limit: 1,
      userId: "user-1",
    });

    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.queue.dispatch.lease_timeout_ratio_warn",
        message: "Queue lease duration is close to submit timeout budget.",
        metadata: expect.objectContaining({
          queue_lease_seconds: 18,
          submit_timeout_ms: 20_000,
          warn_ratio: 0.8,
        }),
      })
    );
  });
});
