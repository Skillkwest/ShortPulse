import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchGenerationSubmitQueueBatch } from "../generationQueue/dispatch";

const getSupabaseAdminMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const readFalRuntimeFlagsMock = vi.fn();
const releaseGenerationReservationBySourceRefMock = vi.fn();
const markGenerationReservationSubmittedMock = vi.fn();
const resolveGenerationAdmissionTierMock = vi.fn();
const getFalModelProfileByModelIdMock = vi.fn();
const submitWithFallbackTargetsMock = vi.fn();
const resolveWebhookCallbackUrlMock = vi.fn();
const readProviderRequestIdMock = vi.fn();
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

vi.mock("../../falIntegration/submitEngine", () => ({
  submitWithFallbackTargets: (...args: unknown[]) => submitWithFallbackTargetsMock(...args),
}));

vi.mock("../falSubmitTargeting", () => ({
  resolveWebhookCallbackUrl: (...args: unknown[]) => resolveWebhookCallbackUrlMock(...args),
  readProviderRequestId: (...args: unknown[]) => readProviderRequestIdMock(...args),
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
}: {
  generationUpdateError?: string;
  existingRequestId?: string | null;
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
    submitWithFallbackTargetsMock.mockResolvedValue({
      response: { ok: true, status: 200 },
      data: { request_id: "req-1" },
      targetUrl: "https://fal.test",
      targetIndex: 0,
    });
    readProviderRequestIdMock.mockReturnValue("req-1");
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
    expect(submitWithFallbackTargetsMock).not.toHaveBeenCalled();
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
    expect(submitWithFallbackTargetsMock).not.toHaveBeenCalled();
  });
});
