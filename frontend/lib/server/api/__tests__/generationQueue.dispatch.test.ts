import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchGenerationSubmitQueueBatch } from "../generationQueue/dispatch";

const getSupabaseAdminMock = vi.fn();
const logGenerationFailureMock = vi.fn();
const readFalRuntimeFlagsMock = vi.fn();
const releaseGenerationReservationBySourceRefMock = vi.fn();
const markGenerationReservationSubmittedMock = vi.fn();
const readActiveProviderCapacitySnapshotMock = vi.fn();
const getFalModelProfileByModelIdMock = vi.fn();
const dispatchProviderSubmitMock = vi.fn();
const resolveWebhookCallbackUrlMock = vi.fn();
const withWebhookTargetsMock = vi.fn();
const claimGenerationSubmitQueueBatchMock = vi.fn();
const markQueueItemExhaustedMock = vi.fn();
const releaseQueueLeaseBackToQueuedMock = vi.fn();
const removeQueueItemMock = vi.fn();
const updateQueueItemForRetryMock = vi.fn();

const buildMutationSuccess = (operation: "retry" | "exhaust" | "release" | "remove") => ({
  ok: true,
  operation,
  queueId: "queue-1",
  affectedCount: 1,
  reason: "applied",
  errorMessage: null,
});

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

vi.mock("../generationQueue/activeProviderCapacity", () => ({
  readActiveProviderCapacitySnapshot: (...args: unknown[]) =>
    readActiveProviderCapacitySnapshotMock(...args),
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

const createSupabaseAdminMock = () => {
  const generationRow = {
    id: "gen-1",
    status: "pending",
    request_id: null,
    metadata: {},
  };

  const aiGenerationsTable = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: generationRow, error: null })),
        })),
      })),
    })),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn(async () => ({ data: [{ id: generationRow.id }], error: null })),
        })),
      })),
    })),
  };

  const reservationsTable = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          not: vi.fn(async () => ({ data: [{ model_id: "fal-ai/nano-banana-pro" }], error: null })),
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

describe("generationQueue/dispatch no-capacity handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSupabaseAdminMock.mockReturnValue(createSupabaseAdminMock());
    markQueueItemExhaustedMock.mockResolvedValue(buildMutationSuccess("exhaust"));
    releaseQueueLeaseBackToQueuedMock.mockResolvedValue(buildMutationSuccess("release"));
    removeQueueItemMock.mockResolvedValue(buildMutationSuccess("remove"));
    updateQueueItemForRetryMock.mockResolvedValue(buildMutationSuccess("retry"));
    markGenerationReservationSubmittedMock.mockResolvedValue({
      status: "reserved",
      sourceRef: "source-1",
      message: null,
    });
    readFalRuntimeFlagsMock.mockReturnValue({
      videoQueueCompatNormalizationEnabled: true,
      queueEnabled: true,
      queueLeaseSeconds: 30,
      queueMaxAttempts: 5,
      queueBaseBackoffSeconds: 5,
      queueMaxWaitSeconds: 1200,
      runningExhaustMinAgeSeconds: 7200,
      providerAttachedReservationCleanupMinAgeSeconds: 7200,
      admission: {
        globalMax: 1,
        sharedProviderEnabled: false,
        sharedProviderGlobalMax: 3,
        tierLimits: {
          video_long: 2,
          image_heavy: 1,
          image_standard: 4,
        },
      },
      publicApiBaseUrl: null,
    });
    readActiveProviderCapacitySnapshotMock.mockResolvedValue({
      tier: "image_heavy",
      globalActive: 1,
      tierActive: 1,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    });
    getFalModelProfileByModelIdMock.mockReturnValue({ submitTargets: [] });
    resolveWebhookCallbackUrlMock.mockReturnValue(null);
    withWebhookTargetsMock.mockImplementation((targets: unknown) => targets);
  });

  it("requeues when capacity is full but queue age is still below max wait", async () => {
    claimGenerationSubmitQueueBatchMock.mockResolvedValue([
      {
        queueId: "queue-1",
        generationId: "gen-1",
        userId: "user-1",
        modelId: "fal-ai/nano-banana-pro",
        sourceRef: "source-1",
        submitRoute: "/api/fal/nano-banana-pro-submit",
        submitPayload: { prompt: "hello" },
        timeoutMs: 20_000,
        attempts: 0,
        status: "dispatching",
        nextAttemptAt: null,
        leaseUntil: new Date(Date.now() + 30_000).toISOString(),
        createdAt: new Date(Date.now() - 60_000).toISOString(),
      },
    ]);

    const result = await dispatchGenerationSubmitQueueBatch({
      req: undefined,
      routeLabel: "test/dispatch",
      limit: 1,
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        claimed: 1,
        requeuedNoCapacity: 1,
        exhausted: 0,
      })
    );
    expect(readActiveProviderCapacitySnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "fal",
        staleIgnoreMinAgeSeconds: 1200,
        activeGenerationStaleIgnoreMinAgeSeconds: 7200,
      })
    );
    expect(releaseQueueLeaseBackToQueuedMock).toHaveBeenCalledTimes(1);
    expect(markQueueItemExhaustedMock).not.toHaveBeenCalled();
    expect(releaseGenerationReservationBySourceRefMock).not.toHaveBeenCalled();
    expect(dispatchProviderSubmitMock).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).toHaveBeenCalled();
  });

  it("exhausts and releases when capacity is full beyond max wait", async () => {
    claimGenerationSubmitQueueBatchMock.mockResolvedValue([
      {
        queueId: "queue-1",
        generationId: "gen-1",
        userId: "user-1",
        modelId: "fal-ai/nano-banana-pro",
        sourceRef: "source-1",
        submitRoute: "/api/fal/nano-banana-pro-submit",
        submitPayload: { prompt: "hello" },
        timeoutMs: 20_000,
        attempts: 0,
        status: "dispatching",
        nextAttemptAt: null,
        leaseUntil: new Date(Date.now() + 30_000).toISOString(),
        createdAt: new Date(Date.now() - 2_000_000).toISOString(),
      },
    ]);

    const result = await dispatchGenerationSubmitQueueBatch({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "test/dispatch",
      limit: 1,
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        claimed: 1,
        requeuedNoCapacity: 0,
        exhausted: 1,
      })
    );
    expect(readActiveProviderCapacitySnapshotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "fal",
        staleIgnoreMinAgeSeconds: 1200,
        activeGenerationStaleIgnoreMinAgeSeconds: 7200,
      })
    );
    expect(markQueueItemExhaustedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        queueId: "queue-1",
        lastErrorCode: "QUEUE_WAIT_TIMEOUT",
      })
    );
    expect(releaseGenerationReservationBySourceRefMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRef: "source-1",
      })
    );
    expect(releaseQueueLeaseBackToQueuedMock).not.toHaveBeenCalled();
    expect(dispatchProviderSubmitMock).not.toHaveBeenCalled();
  });
});
