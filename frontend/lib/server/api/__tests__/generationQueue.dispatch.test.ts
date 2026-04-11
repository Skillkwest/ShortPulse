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
const readQueuedWebhookCallbackUrlMock = vi.fn();
const resolveWebhookCallbackUrlMock = vi.fn();
const withWebhookTargetsMock = vi.fn();
const claimGenerationSubmitQueueBatchMock = vi.fn();
const commitQueuedGenerationDispatchSuccessMock = vi.fn();
const markQueueItemExhaustedMock = vi.fn();
const releaseQueueLeaseBackToQueuedMock = vi.fn();
const removeQueueItemMock = vi.fn();
const updateQueueItemForRetryMock = vi.fn();
const applyAcceptedRunningGenerationTransitionMock = vi.fn();
const applyGenerationLifecycleTransitionMock = vi.fn();
const readRecoveryBackpressureDecisionMock = vi.fn();

const buildMutationSuccess = (operation: "retry" | "exhaust" | "release" | "remove") => ({
  ok: true,
  operation,
  queueId: "queue-1",
  affectedCount: 1,
  reason: "applied",
  errorMessage: null,
});

const buildCommitSuccess = ({
  sourceRef = "source-1",
  attemptId = "attempt-1",
  attemptNumber = 1,
}: {
  sourceRef?: string;
  attemptId?: string;
  attemptNumber?: number;
} = {}) => ({
  ok: true,
  status: "committed" as const,
  stage: "post_submit_commit" as const,
  code: null,
  sourceRef,
  attemptId,
  attemptNumber,
  message: null,
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

vi.mock("../generationAdmission/recoveryBackpressure", () => ({
  readRecoveryBackpressureDecision: (...args: unknown[]) =>
    readRecoveryBackpressureDecisionMock(...args),
  shouldEmitRecoveryBackpressureTelemetry: vi.fn(() => true),
}));

vi.mock("../../falIntegration/modelProfiles", () => ({
  getFalModelProfileByModelId: (...args: unknown[]) => getFalModelProfileByModelIdMock(...args),
}));

vi.mock("../../providerIntegration/submitProviderDispatcher", () => ({
  dispatchProviderSubmit: (...args: unknown[]) => dispatchProviderSubmitMock(...args),
}));

vi.mock("../generationAcceptedTransitionService", () => ({
  applyAcceptedRunningGenerationTransition: (...args: unknown[]) =>
    applyAcceptedRunningGenerationTransitionMock(...args),
}));

vi.mock("../generationLifecycleTransitionService", () => ({
  applyGenerationLifecycleTransition: (...args: unknown[]) =>
    applyGenerationLifecycleTransitionMock(...args),
}));

vi.mock("../falSubmitTargeting", () => ({
  readQueuedWebhookCallbackUrl: (...args: unknown[]) => readQueuedWebhookCallbackUrlMock(...args),
  resolveWebhookCallbackUrl: (...args: unknown[]) => resolveWebhookCallbackUrlMock(...args),
  withWebhookTargets: (...args: unknown[]) => withWebhookTargetsMock(...args),
}));

vi.mock("../generationQueue/service", () => ({
  claimGenerationSubmitQueueBatch: (...args: unknown[]) =>
    claimGenerationSubmitQueueBatchMock(...args),
  commitQueuedGenerationDispatchSuccess: (...args: unknown[]) =>
    commitQueuedGenerationDispatchSuccessMock(...args),
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
    process.env.FAL_KEY = "test-fal-key";
    getSupabaseAdminMock.mockReturnValue(createSupabaseAdminMock());
    markQueueItemExhaustedMock.mockResolvedValue(buildMutationSuccess("exhaust"));
    releaseQueueLeaseBackToQueuedMock.mockResolvedValue(buildMutationSuccess("release"));
    removeQueueItemMock.mockResolvedValue(buildMutationSuccess("remove"));
    updateQueueItemForRetryMock.mockResolvedValue(buildMutationSuccess("retry"));
    commitQueuedGenerationDispatchSuccessMock.mockImplementation(
      async ({ sourceRef }: { sourceRef: string }) => buildCommitSuccess({ sourceRef })
    );
    markGenerationReservationSubmittedMock.mockImplementation(
      async ({ sourceRef }: { sourceRef: string }) => ({
        status: "reserved",
        sourceRef,
        message: null,
      })
    );
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
    readQueuedWebhookCallbackUrlMock.mockReturnValue(null);
    resolveWebhookCallbackUrlMock.mockReturnValue(null);
    withWebhookTargetsMock.mockImplementation((targets: unknown) => targets);
    applyAcceptedRunningGenerationTransitionMock.mockResolvedValue({ ok: true });
    applyGenerationLifecycleTransitionMock.mockResolvedValue({ ok: true });
    readRecoveryBackpressureDecisionMock.mockResolvedValue({
      level: 0,
      requestedGlobalMax: 3,
      effectiveGlobalMax: 3,
      reduction: 0,
      signals: {
        staleProviderAttachedReservations: 0,
        staleRecoverableGenerations: 0,
        recentQueueWaitTimeouts: 0,
        recentRecoveryP95Ms: null,
      },
    });
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
    expect(claimGenerationSubmitQueueBatchMock).toHaveBeenCalledTimes(1);
  });

  it("exhausts and releases when capacity is full beyond max wait", async () => {
    claimGenerationSubmitQueueBatchMock.mockResolvedValueOnce([
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
    claimGenerationSubmitQueueBatchMock.mockResolvedValueOnce([]);

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
    expect(claimGenerationSubmitQueueBatchMock).toHaveBeenCalledTimes(2);
  });

  it("applies shared-provider recovery backpressure during capacity checks", async () => {
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
        globalMax: 4,
        sharedProviderEnabled: true,
        sharedProviderGlobalMax: 3,
        tierLimits: {
          video_long: 2,
          image_heavy: 3,
          image_standard: 4,
        },
      },
      publicApiBaseUrl: null,
    });
    readRecoveryBackpressureDecisionMock.mockResolvedValueOnce({
      level: 1,
      requestedGlobalMax: 3,
      effectiveGlobalMax: 2,
      reduction: 1,
      signals: {
        staleProviderAttachedReservations: 12,
        staleRecoverableGenerations: 0,
        recentQueueWaitTimeouts: 0,
        recentRecoveryP95Ms: null,
      },
    });
    readActiveProviderCapacitySnapshotMock
      .mockResolvedValueOnce({
        tier: "image_heavy",
        globalActive: 1,
        tierActive: 1,
        staleIgnoredGlobal: 0,
        staleIgnoredTier: 0,
      })
      .mockResolvedValueOnce({
        tier: "image_heavy",
        globalActive: 2,
        tierActive: 1,
        staleIgnoredGlobal: 0,
        staleIgnoredTier: 0,
      });
    claimGenerationSubmitQueueBatchMock.mockResolvedValueOnce([
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
      })
    );
    expect(readRecoveryBackpressureDecisionMock).toHaveBeenCalledWith({
      provider: "fal",
      requestedGlobalMax: 3,
    });
    expect(dispatchProviderSubmitMock).not.toHaveBeenCalled();
    expect(logGenerationFailureMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.queue.dispatch.recovery_backpressure_applied",
      })
    );
  });

  it("reuses a per-user capacity snapshot across same-batch claims when both items can dispatch", async () => {
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
        globalMax: 4,
        sharedProviderEnabled: false,
        sharedProviderGlobalMax: 4,
        tierLimits: {
          video_long: 2,
          image_heavy: 3,
          image_standard: 4,
        },
      },
      publicApiBaseUrl: null,
    });
    readActiveProviderCapacitySnapshotMock.mockResolvedValue({
      tier: "image_standard",
      globalActive: 0,
      tierActive: 0,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    });
    getFalModelProfileByModelIdMock.mockReturnValue({
      submitTargets: [{ url: "https://queue.fal.run/test" }],
    });
    dispatchProviderSubmitMock
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: { request_id: "req-1" },
        providerRequestId: "req-1",
        targetUrl: "https://queue.fal.run/test",
        targetIndex: 0,
      })
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: { request_id: "req-2" },
        providerRequestId: "req-2",
        targetUrl: "https://queue.fal.run/test",
        targetIndex: 0,
      });
    claimGenerationSubmitQueueBatchMock
      .mockResolvedValueOnce([
        {
          queueId: "queue-1",
          generationId: "gen-1",
          userId: "user-1",
          modelId: "fal-ai/nano-banana-pro",
          sourceRef: "source-1",
          submitRoute: "/api/fal/nano-banana-pro-submit",
          submitPayload: { prompt: "hello-1" },
          timeoutMs: 20_000,
          attempts: 0,
          status: "dispatching",
          nextAttemptAt: null,
          leaseUntil: new Date(Date.now() + 30_000).toISOString(),
          createdAt: new Date(Date.now() - 60_000).toISOString(),
        },
        {
          queueId: "queue-2",
          generationId: "gen-2",
          userId: "user-1",
          modelId: "fal-ai/nano-banana-pro",
          sourceRef: "source-2",
          submitRoute: "/api/fal/nano-banana-pro-submit",
          submitPayload: { prompt: "hello-2" },
          timeoutMs: 20_000,
          attempts: 0,
          status: "dispatching",
          nextAttemptAt: null,
          leaseUntil: new Date(Date.now() + 30_000).toISOString(),
          createdAt: new Date(Date.now() - 60_000).toISOString(),
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await dispatchGenerationSubmitQueueBatch({
      req: undefined,
      routeLabel: "test/dispatch",
      limit: 2,
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        claimed: 2,
        submitted: 2,
        requeuedNoCapacity: 0,
      })
    );
    expect(readActiveProviderCapacitySnapshotMock).toHaveBeenCalledTimes(1);
    expect(dispatchProviderSubmitMock).toHaveBeenCalledTimes(2);
  });

  it("prefers the queued webhook callback URL over worker runtime flags", async () => {
    readActiveProviderCapacitySnapshotMock.mockResolvedValueOnce({
      tier: "image_standard",
      globalActive: 0,
      tierActive: 0,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    });
    getFalModelProfileByModelIdMock.mockReturnValue({
      submitTargets: [{ url: "https://queue.fal.run/test" }],
    });
    readQueuedWebhookCallbackUrlMock.mockReturnValue(
      "https://shortpulse-git-working-development-kirk-artmans-projects.vercel.app/api/fal/webhook"
    );
    resolveWebhookCallbackUrlMock.mockReturnValue(
      "https://shortpulse-sleepyseamonster-kirk-artmans-projects.vercel.app/api/fal/webhook"
    );
    dispatchProviderSubmitMock.mockResolvedValueOnce({
      response: { ok: true, status: 200 },
      data: { request_id: "req-1" },
      providerRequestId: "req-1",
      targetUrl:
        "https://queue.fal.run/test?fal_webhook=https%3A%2F%2Fshortpulse-git-working-development-kirk-artmans-projects.vercel.app%2Fapi%2Ffal%2Fwebhook",
      targetIndex: 0,
    });
    claimGenerationSubmitQueueBatchMock
      .mockResolvedValueOnce([
        {
          queueId: "queue-1",
          generationId: "gen-1",
          userId: "user-1",
          modelId: "fal-ai/nano-banana-pro",
          sourceRef: "source-1",
          submitRoute: "/api/fal/nano-banana-pro-submit",
          submitPayload: { prompt: "hello-1" },
          timeoutMs: 20_000,
          attempts: 0,
          status: "dispatching",
          generationMetadata: {
            fal_webhook_callback_url:
              "https://shortpulse-git-working-development-kirk-artmans-projects.vercel.app/api/fal/webhook",
          },
          nextAttemptAt: null,
          leaseUntil: new Date(Date.now() + 30_000).toISOString(),
          createdAt: new Date(Date.now() - 60_000).toISOString(),
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await dispatchGenerationSubmitQueueBatch({
      req: undefined,
      routeLabel: "test/dispatch",
      limit: 1,
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        claimed: 1,
        submitted: 1,
      })
    );
    expect(readQueuedWebhookCallbackUrlMock).toHaveBeenCalledWith({
      fal_webhook_callback_url:
        "https://shortpulse-git-working-development-kirk-artmans-projects.vercel.app/api/fal/webhook",
    });
    expect(resolveWebhookCallbackUrlMock).not.toHaveBeenCalled();
    expect(withWebhookTargetsMock).toHaveBeenCalledWith(
      expect.any(Array),
      "https://shortpulse-git-working-development-kirk-artmans-projects.vercel.app/api/fal/webhook"
    );
  });

  it("enforces local reservation limits across same-batch claims without rereading capacity", async () => {
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
        sharedProviderGlobalMax: 4,
        tierLimits: {
          video_long: 2,
          image_heavy: 3,
          image_standard: 4,
        },
      },
      publicApiBaseUrl: null,
    });
    readActiveProviderCapacitySnapshotMock.mockResolvedValue({
      tier: "image_standard",
      globalActive: 0,
      tierActive: 0,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    });
    getFalModelProfileByModelIdMock.mockReturnValue({
      submitTargets: [{ url: "https://queue.fal.run/test" }],
    });
    dispatchProviderSubmitMock.mockResolvedValue({
      response: { ok: true, status: 200 },
      data: { request_id: "req-1" },
      providerRequestId: "req-1",
      targetUrl: "https://queue.fal.run/test",
      targetIndex: 0,
    });
    claimGenerationSubmitQueueBatchMock
      .mockResolvedValueOnce([
        {
          queueId: "queue-1",
          generationId: "gen-1",
          userId: "user-1",
          modelId: "fal-ai/nano-banana-pro",
          sourceRef: "source-1",
          submitRoute: "/api/fal/nano-banana-pro-submit",
          submitPayload: { prompt: "hello-1" },
          timeoutMs: 20_000,
          attempts: 0,
          status: "dispatching",
          nextAttemptAt: null,
          leaseUntil: new Date(Date.now() + 30_000).toISOString(),
          createdAt: new Date(Date.now() - 60_000).toISOString(),
        },
        {
          queueId: "queue-2",
          generationId: "gen-2",
          userId: "user-1",
          modelId: "fal-ai/nano-banana-pro",
          sourceRef: "source-2",
          submitRoute: "/api/fal/nano-banana-pro-submit",
          submitPayload: { prompt: "hello-2" },
          timeoutMs: 20_000,
          attempts: 0,
          status: "dispatching",
          nextAttemptAt: null,
          leaseUntil: new Date(Date.now() + 30_000).toISOString(),
          createdAt: new Date(Date.now() - 60_000).toISOString(),
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await dispatchGenerationSubmitQueueBatch({
      req: undefined,
      routeLabel: "test/dispatch",
      limit: 2,
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        claimed: 2,
        submitted: 1,
        requeuedNoCapacity: 1,
      })
    );
    expect(readActiveProviderCapacitySnapshotMock).toHaveBeenCalledTimes(1);
    expect(dispatchProviderSubmitMock).toHaveBeenCalledTimes(1);
    expect(releaseQueueLeaseBackToQueuedMock).toHaveBeenCalledTimes(1);
  });

  it("keeps refilling queued work within the same run while passes make forward progress", async () => {
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
        globalMax: 4,
        sharedProviderEnabled: false,
        sharedProviderGlobalMax: 4,
        tierLimits: {
          video_long: 2,
          image_heavy: 3,
          image_standard: 4,
        },
      },
      publicApiBaseUrl: null,
    });
    readActiveProviderCapacitySnapshotMock.mockResolvedValue({
      tier: "image_standard",
      globalActive: 0,
      tierActive: 0,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    });
    getFalModelProfileByModelIdMock.mockReturnValue({
      submitTargets: [{ url: "https://queue.fal.run/test" }],
    });
    dispatchProviderSubmitMock
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: { request_id: "req-1" },
        providerRequestId: "req-1",
        targetUrl: "https://queue.fal.run/test",
        targetIndex: 0,
      })
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: { request_id: "req-2" },
        providerRequestId: "req-2",
        targetUrl: "https://queue.fal.run/test",
        targetIndex: 0,
      });
    claimGenerationSubmitQueueBatchMock
      .mockResolvedValueOnce([
        {
          queueId: "queue-1",
          generationId: "gen-1",
          userId: "user-1",
          modelId: "fal-ai/nano-banana-pro",
          sourceRef: "source-1",
          submitRoute: "/api/fal/nano-banana-pro-submit",
          submitPayload: { prompt: "hello-1" },
          timeoutMs: 20_000,
          attempts: 0,
          status: "dispatching",
          nextAttemptAt: null,
          leaseUntil: new Date(Date.now() + 30_000).toISOString(),
          createdAt: new Date(Date.now() - 60_000).toISOString(),
        },
      ])
      .mockResolvedValueOnce([
        {
          queueId: "queue-2",
          generationId: "gen-1",
          userId: "user-1",
          modelId: "fal-ai/nano-banana-pro",
          sourceRef: "source-2",
          submitRoute: "/api/fal/nano-banana-pro-submit",
          submitPayload: { prompt: "hello-2" },
          timeoutMs: 20_000,
          attempts: 0,
          status: "dispatching",
          nextAttemptAt: null,
          leaseUntil: new Date(Date.now() + 30_000).toISOString(),
          createdAt: new Date(Date.now() - 60_000).toISOString(),
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await dispatchGenerationSubmitQueueBatch({
      req: undefined,
      routeLabel: "test/dispatch",
      limit: 1,
      userId: "user-1",
    });

    expect(result).toEqual(
      expect.objectContaining({
        claimed: 2,
        submitted: 2,
        requeuedNoCapacity: 0,
        exhausted: 0,
      })
    );
    expect(claimGenerationSubmitQueueBatchMock).toHaveBeenCalledTimes(3);
    expect(dispatchProviderSubmitMock).toHaveBeenCalledTimes(2);
  });

  it("stops refilling after the max pass cap even when each pass makes forward progress", async () => {
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
        globalMax: 4,
        sharedProviderEnabled: false,
        sharedProviderGlobalMax: 4,
        tierLimits: {
          video_long: 2,
          image_heavy: 3,
          image_standard: 4,
        },
      },
      publicApiBaseUrl: null,
    });
    readActiveProviderCapacitySnapshotMock.mockResolvedValue({
      tier: "image_standard",
      globalActive: 0,
      tierActive: 0,
      staleIgnoredGlobal: 0,
      staleIgnoredTier: 0,
    });
    getFalModelProfileByModelIdMock.mockReturnValue({
      submitTargets: [{ url: "https://queue.fal.run/test" }],
    });
    dispatchProviderSubmitMock.mockImplementation(async () => ({
      response: { ok: true, status: 200 },
      data: { request_id: `req-${dispatchProviderSubmitMock.mock.calls.length}` },
      providerRequestId: `req-${dispatchProviderSubmitMock.mock.calls.length}`,
      targetUrl: "https://queue.fal.run/test",
      targetIndex: 0,
    }));
    claimGenerationSubmitQueueBatchMock.mockImplementation(async () => [
      {
        queueId: `queue-${claimGenerationSubmitQueueBatchMock.mock.calls.length}`,
        generationId: "gen-1",
        userId: "user-1",
        modelId: "fal-ai/nano-banana-pro",
        sourceRef: `source-${claimGenerationSubmitQueueBatchMock.mock.calls.length}`,
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
        claimed: 4,
        submitted: 4,
      })
    );
    expect(claimGenerationSubmitQueueBatchMock).toHaveBeenCalledTimes(4);
    expect(dispatchProviderSubmitMock).toHaveBeenCalledTimes(4);
  });

  it("reuses shared-admission capacity snapshots across same-batch claims", async () => {
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
        globalMax: 4,
        sharedProviderEnabled: true,
        sharedProviderGlobalMax: 10,
        tierLimits: {
          video_long: 2,
          image_heavy: 3,
          image_standard: 4,
        },
      },
      publicApiBaseUrl: null,
    });

    getFalModelProfileByModelIdMock.mockReturnValue({
      submitTargets: [{ url: "https://queue.fal.run/test" }],
    });
    dispatchProviderSubmitMock
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: { request_id: "req-1" },
        providerRequestId: "req-1",
        targetUrl: "https://queue.fal.run/test",
        targetIndex: 0,
      })
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: { request_id: "req-2" },
        providerRequestId: "req-2",
        targetUrl: "https://queue.fal.run/test",
        targetIndex: 0,
      });
    claimGenerationSubmitQueueBatchMock
      .mockResolvedValueOnce([
        {
          queueId: "queue-1",
          generationId: "gen-1",
          userId: "user-1",
          modelId: "fal-ai/nano-banana-pro",
          sourceRef: "source-1",
          submitRoute: "/api/fal/nano-banana-pro-submit",
          submitPayload: { prompt: "hello-1" },
          timeoutMs: 20_000,
          attempts: 0,
          status: "dispatching",
          nextAttemptAt: null,
          leaseUntil: new Date(Date.now() + 30_000).toISOString(),
          createdAt: new Date(Date.now() - 60_000).toISOString(),
        },
        {
          queueId: "queue-2",
          generationId: "gen-2",
          userId: "user-1",
          modelId: "fal-ai/nano-banana-pro",
          sourceRef: "source-2",
          submitRoute: "/api/fal/nano-banana-pro-submit",
          submitPayload: { prompt: "hello-2" },
          timeoutMs: 20_000,
          attempts: 0,
          status: "dispatching",
          nextAttemptAt: null,
          leaseUntil: new Date(Date.now() + 30_000).toISOString(),
          createdAt: new Date(Date.now() - 60_000).toISOString(),
        },
      ])
      .mockResolvedValueOnce([]);

    const startedScopes: Array<string | null> = [];
    let releaseSnapshots: (() => void) | null = null;
    const snapshotBarrier = new Promise<void>((resolve) => {
      releaseSnapshots = resolve;
    });
    readActiveProviderCapacitySnapshotMock.mockImplementation(async ({ userId }) => {
      startedScopes.push((userId as string | null | undefined) ?? null);
      await snapshotBarrier;
      return {
        tier: "image_heavy",
        globalActive: 0,
        tierActive: 0,
        staleIgnoredGlobal: 0,
        staleIgnoredTier: 0,
      };
    });

    const dispatchPromise = dispatchGenerationSubmitQueueBatch({
      req: undefined,
      routeLabel: "test/dispatch",
      limit: 2,
      userId: "user-1",
    });

    await vi.waitFor(() => {
      expect(startedScopes).toHaveLength(2);
    });
    expect(new Set(startedScopes)).toEqual(new Set(["user-1", null]));

    const release = releaseSnapshots as (() => void) | null;
    if (release) {
      release();
    }
    await expect(dispatchPromise).resolves.toEqual(
      expect.objectContaining({
        claimed: 2,
        submitted: 2,
      })
    );
    expect(readActiveProviderCapacitySnapshotMock).toHaveBeenCalledTimes(2);
  });
});
