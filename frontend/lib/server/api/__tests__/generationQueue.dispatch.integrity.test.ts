import { beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchGenerationSubmitQueueBatch } from "../generationQueue/dispatch";
import type { ClaimedGenerationQueueItem } from "../generationQueue/service";

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
const applyAcceptedRunningGenerationTransitionMock = vi.fn();
const ensureAcceptedRunningGenerationAttemptMock = vi.fn();
const updateGenerationAttemptStateMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();

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

vi.mock("../generationAcceptedTransitionService", () => ({
  applyAcceptedRunningGenerationTransition: (...args: unknown[]) =>
    applyAcceptedRunningGenerationTransitionMock(...args),
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

vi.mock("../generationAttempts", () => ({
  ensureAcceptedRunningGenerationAttempt: (...args: unknown[]) =>
    ensureAcceptedRunningGenerationAttemptMock(...args),
  updateGenerationAttemptState: (...args: unknown[]) => updateGenerationAttemptStateMock(...args),
}));

vi.mock("../generationProjection", () => ({
  upsertGenerationProjection: (...args: unknown[]) => upsertGenerationProjectionMock(...args),
}));

const queueItem: ClaimedGenerationQueueItem = {
  queueId: "queue-1",
  generationId: "gen-1",
  userId: "user-1",
  modelId: "fal-ai/nano-banana-pro",
  generationProvider: null,
  generationRequestId: null,
  generationMetadata: {},
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

const seedClaimGenerationSubmitQueueBatches = (
  ...batches: Array<readonly (typeof queueItem)[]>
) => {
  claimGenerationSubmitQueueBatchMock.mockReset();
  for (const batch of batches) {
    claimGenerationSubmitQueueBatchMock.mockResolvedValueOnce([...batch]);
  }
  claimGenerationSubmitQueueBatchMock.mockResolvedValue([]);
};

const createSupabaseAdminMock = ({
  generationUpdateError,
  existingRequestId,
  provider,
  generationMetadataSourceRef,
  queueEnqueuedAt,
}: {
  generationUpdateError?: string;
  existingRequestId?: string | null;
  provider?: string | null;
  generationMetadataSourceRef?: string | null;
  queueEnqueuedAt?: string | null;
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
              metadata: {
                ...(generationMetadataSourceRef ? { source_ref: generationMetadataSourceRef } : {}),
                ...(queueEnqueuedAt ? { queue_enqueued_at: queueEnqueuedAt } : {}),
              },
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
      videoQueueCompatNormalizationEnabled: true,
      queueEnabled: true,
      queueLeaseSeconds: 30,
      queueMaxAttempts: 5,
      queueBaseBackoffSeconds: 5,
      queueMaxWaitSeconds: 1200,
      runningExhaustMinAgeSeconds: 7200,
      providerAttachedReservationCleanupMinAgeSeconds: 7200,
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
    seedClaimGenerationSubmitQueueBatches([queueItem]);
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
      providerDiagnostics: {
        attemptsTried: 1,
        fallbackCount: 0,
        targetCount: 1,
        totalDurationMs: 50,
      },
    });
    markGenerationReservationSubmittedMock.mockImplementation(
      async ({ sourceRef }: { sourceRef: string }) => ({
        status: "reserved",
        sourceRef,
        message: null,
      })
    );
    markQueueItemExhaustedMock.mockResolvedValue(mutationSuccess("exhaust"));
    releaseQueueLeaseBackToQueuedMock.mockResolvedValue(mutationSuccess("release"));
    removeQueueItemMock.mockResolvedValue(mutationSuccess("remove"));
    updateQueueItemForRetryMock.mockResolvedValue(mutationSuccess("retry"));
    applyAcceptedRunningGenerationTransitionMock.mockResolvedValue({ ok: true });
    ensureAcceptedRunningGenerationAttemptMock.mockResolvedValue({
      ok: true,
      attemptId: "attempt-1",
      attemptNumber: 1,
    });
    updateGenerationAttemptStateMock.mockResolvedValue({ ok: true });
    upsertGenerationProjectionMock.mockResolvedValue(undefined);
  });

  it("exhausts legacy raw video payloads when queue compatibility normalization is disabled", async () => {
    readFalRuntimeFlagsMock.mockReturnValue({
      videoQueueCompatNormalizationEnabled: false,
      queueEnabled: true,
      queueLeaseSeconds: 30,
      queueMaxAttempts: 5,
      queueBaseBackoffSeconds: 5,
      queueMaxWaitSeconds: 1200,
      runningExhaustMinAgeSeconds: 7200,
      providerAttachedReservationCleanupMinAgeSeconds: 7200,
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
    seedClaimGenerationSubmitQueueBatches([
      {
        ...queueItem,
        modelId: "fal-ai/veo3.1/image-to-video",
        submitPayload: {
          prompt: "queued clip",
          imageUrl: "https://cdn.shortpulse.test/ref.png",
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
      })
    );
    expect(markQueueItemExhaustedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastErrorCode: "VIDEO_QUEUE_COMPAT_DISABLED",
      })
    );
    expect(dispatchProviderSubmitMock).not.toHaveBeenCalled();
  });

  it("exhausts without releasing reservation when generation running update fails post-submit", async () => {
    applyAcceptedRunningGenerationTransitionMock.mockResolvedValueOnce({
      ok: false,
      error: "write failed",
      stage: "generation",
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

  it("exhausts without releasing reservation when generation attempt write fails post-submit", async () => {
    applyAcceptedRunningGenerationTransitionMock.mockResolvedValueOnce({
      ok: false,
      error: "attempt_insert_failed",
      stage: "record",
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
        exhausted: 1,
        errors: 1,
      })
    );
    expect(markQueueItemExhaustedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastErrorCode: "GENERATION_ATTEMPT_RECORD_FAILED",
      })
    );
    expect(releaseGenerationReservationBySourceRefMock).not.toHaveBeenCalled();
    expect(updateQueueItemForRetryMock).not.toHaveBeenCalled();
  });

  it("exhausts without releasing reservation when generation attempt running update fails post-submit", async () => {
    applyAcceptedRunningGenerationTransitionMock.mockResolvedValueOnce({
      ok: false,
      error: "attempt_running_update_failed",
      stage: "running",
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
        exhausted: 1,
        errors: 1,
      })
    );
    expect(markQueueItemExhaustedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastErrorCode: "GENERATION_ATTEMPT_RUNNING_FAILED",
      })
    );
    expect(releaseGenerationReservationBySourceRefMock).not.toHaveBeenCalled();
    expect(updateQueueItemForRetryMock).not.toHaveBeenCalled();
    expect(removeQueueItemMock).not.toHaveBeenCalled();
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
    seedClaimGenerationSubmitQueueBatches([
      {
        ...queueItem,
        generationRequestId: "req-existing",
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
    expect(updateGenerationAttemptStateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        providerRequestId: "req-existing",
        userId: "user-1",
        status: "running",
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        provider: "fal",
        requestId: "req-existing",
        providerRequestId: "req-existing",
        status: "ready",
        taskState: "running",
        queueState: "dispatched",
        publicationState: "pending",
      })
    );
    expect(ensureAcceptedRunningGenerationAttemptMock).not.toHaveBeenCalled();
    expect(removeQueueItemMock).toHaveBeenCalledTimes(1);
    expect(removeQueueItemMock.mock.invocationCallOrder[0]).toBeLessThan(
      upsertGenerationProjectionMock.mock.invocationCallOrder[0]
    );
    expect(dispatchProviderSubmitMock).not.toHaveBeenCalled();
  });

  it("retries existing-request reconciliation when attempt running update fails", async () => {
    seedClaimGenerationSubmitQueueBatches([
      {
        ...queueItem,
        generationRequestId: "req-existing",
      },
    ]);
    updateGenerationAttemptStateMock.mockResolvedValueOnce({
      ok: false,
      error: "attempt_state_update_failed",
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
        lastErrorCode: "GENERATION_ATTEMPT_RUNNING_FAILED",
      })
    );
    expect(removeQueueItemMock).not.toHaveBeenCalled();
    expect(dispatchProviderSubmitMock).not.toHaveBeenCalled();
  });

  it("retries existing-request reconciliation when reservation submit fails", async () => {
    seedClaimGenerationSubmitQueueBatches([
      {
        ...queueItem,
        generationRequestId: "req-existing",
      },
    ]);
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

  it("fails closed before provider submit when generation metadata source_ref mismatches the queue item", async () => {
    seedClaimGenerationSubmitQueueBatches([
      {
        ...queueItem,
        generationMetadata: {
          source_ref: "source-other",
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
        errors: 1,
      })
    );
    expect(markQueueItemExhaustedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastErrorCode: "QUEUE_IDENTITY_MISMATCH",
      })
    );
    expect(releaseGenerationReservationBySourceRefMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "Auto-release: queue dispatch identity mismatch.",
      })
    );
    expect(dispatchProviderSubmitMock).not.toHaveBeenCalled();
  });

  it("fails closed without dispatch when queued generation provider is kie but runtime targets are unavailable", async () => {
    process.env.KIE_API_KEY = "test-kie-key";
    seedClaimGenerationSubmitQueueBatches([
      {
        ...queueItem,
        generationProvider: "kie",
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
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date("2026-03-01T00:00:10.000Z"));
      seedClaimGenerationSubmitQueueBatches([
        {
          ...queueItem,
          modelId: "kie-ai/veo-3.1-fast-i2v",
          generationProvider: "kie",
          generationMetadata: {
            queue_enqueued_at: "2026-03-01T00:00:00.000Z",
          },
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
      expect(markGenerationReservationSubmittedMock).toHaveBeenCalledWith(
        expect.objectContaining({
          providerRequestId: "req-1",
          metadata: {
            queue_id: "queue-1",
          },
        })
      );
      expect(withWebhookTargetsMock).not.toHaveBeenCalled();
      expect(markQueueItemExhaustedMock).not.toHaveBeenCalled();
      expect(applyAcceptedRunningGenerationTransitionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          attemptInput: expect.objectContaining({
            generationId: "gen-1",
            userId: "user-1",
            providerRequestId: "req-1",
            dispatchSource: "queued_submit",
            metadata: expect.objectContaining({
              generation_submit_authority: "worker",
            }),
          }),
        })
      );
      expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          generationId: "gen-1",
          userId: "user-1",
          provider: "kie",
          requestId: "req-1",
          providerRequestId: "req-1",
          status: "ready",
          taskState: "running",
          queueState: "dispatched",
          publicationState: "pending",
        })
      );
      expect(removeQueueItemMock.mock.invocationCallOrder[0]).toBeLessThan(
        upsertGenerationProjectionMock.mock.invocationCallOrder[0]
      );
      expect(logGenerationFailureMock).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          source: "telemetry.queue.dispatch.submitted",
          metadata: expect.objectContaining({
            queue_latency_ms: 10_000,
            queue_latency_seconds: 10,
            dispatch_stage_timings_ms: expect.objectContaining({
              capacityCheck: expect.any(Number),
              providerKeyRead: expect.any(Number),
              targetResolution: expect.any(Number),
              payloadPreparation: expect.any(Number),
              providerSubmit: expect.any(Number),
              reservationSubmit: expect.any(Number),
              generationTransition: expect.any(Number),
              projectionSync: expect.any(Number),
              queueRemove: expect.any(Number),
            }),
            provider_submit_diagnostics: expect.any(Object),
          }),
        })
      );
    } finally {
      delete process.env.KIE_API_KEY;
      delete process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED;
      delete process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST;
      delete process.env.SHORTPULSE_KIE_SUBMIT_URLS;
      vi.useRealTimers();
    }
  });

  it("dispatches queued kie generation using model-catalog submit defaults when env submit urls are unset", async () => {
    process.env.KIE_API_KEY = "test-kie-key";
    process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED = "true";
    process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST = "kie-ai/veo-3.1-fast-i2v";
    delete process.env.SHORTPULSE_KIE_SUBMIT_URLS;

    seedClaimGenerationSubmitQueueBatches([
      {
        ...queueItem,
        modelId: "kie-ai/veo-3.1-fast-i2v",
        generationProvider: "kie",
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
    expect(applyAcceptedRunningGenerationTransitionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        attemptInput: expect.objectContaining({
          generationId: "gen-1",
          userId: "user-1",
          providerRequestId: "req-1",
          dispatchSource: "queued_submit",
        }),
      })
    );

    delete process.env.KIE_API_KEY;
    delete process.env.SHORTPULSE_KIE_INTEGRATION_ENABLED;
    delete process.env.SHORTPULSE_KIE_MODEL_ALLOWLIST;
  });

  it("fails closed after provider acceptance when reservation source_ref mismatches the queue item", async () => {
    markGenerationReservationSubmittedMock.mockResolvedValue({
      status: "reserved",
      sourceRef: "source-other",
      message: null,
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
        exhausted: 1,
        submitted: 0,
        errors: 1,
      })
    );
    expect(dispatchProviderSubmitMock).toHaveBeenCalledTimes(1);
    expect(markQueueItemExhaustedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        lastErrorCode: "QUEUE_IDENTITY_MISMATCH",
      })
    );
    expect(releaseGenerationReservationBySourceRefMock).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: "Auto-release: queue dispatch identity mismatch.",
      })
    );
    expect(updateQueueItemForRetryMock).not.toHaveBeenCalled();
  });

  it("fails closed before provider submit when queued payload violates the shared contract", async () => {
    seedClaimGenerationSubmitQueueBatches([
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

    const supabaseAdmin = getSupabaseAdminMock.mock.results.at(-1)?.value as {
      from: (tableName: string) => { update: ReturnType<typeof vi.fn> };
    };
    const aiGenerationsUpdateMock = supabaseAdmin.from("ai_generations").update;
    expect(aiGenerationsUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "fail",
        failure_reason_code: "queue_dispatch_exhausted",
        error_message: "Generation failed queue contract validation before provider submit.",
        recovery_state: "exhausted",
        next_recovery_at: null,
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
      seedClaimGenerationSubmitQueueBatches([queueItem]);
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
      seedClaimGenerationSubmitQueueBatches([queueItem]);
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

  it("continues processing later claimed items while earlier projection sync tail work is pending", async () => {
    let signalFirstProjectionStarted: (() => void) | null = null;
    const firstProjectionStarted = new Promise<void>((resolve) => {
      signalFirstProjectionStarted = resolve;
    });
    let releaseFirstProjection: (() => void) | null = null;
    const firstProjectionPending = new Promise<void>((resolve) => {
      releaseFirstProjection = resolve;
    });

    seedClaimGenerationSubmitQueueBatches([
      {
        ...queueItem,
        queueId: "queue-1",
        generationId: "gen-1",
        userId: "user-1",
        sourceRef: "source-1",
      },
      {
        ...queueItem,
        queueId: "queue-2",
        generationId: "gen-2",
        userId: "user-2",
        sourceRef: "source-2",
      },
    ]);

    dispatchProviderSubmitMock
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: { request_id: "req-1" },
        providerRequestId: "req-1",
        targetUrl: "https://fal.test",
        targetIndex: 0,
        providerDiagnostics: {
          attemptsTried: 1,
          fallbackCount: 0,
          targetCount: 1,
          totalDurationMs: 50,
        },
      })
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: { request_id: "req-2" },
        providerRequestId: "req-2",
        targetUrl: "https://fal.test",
        targetIndex: 0,
        providerDiagnostics: {
          attemptsTried: 1,
          fallbackCount: 0,
          targetCount: 1,
          totalDurationMs: 60,
        },
      });

    upsertGenerationProjectionMock
      .mockImplementationOnce(async () => {
        signalFirstProjectionStarted?.();
        await firstProjectionPending;
      })
      .mockResolvedValueOnce(undefined);

    const dispatchPromise = dispatchGenerationSubmitQueueBatch({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "test/dispatch-integrity",
      limit: 2,
      userId: null,
    });

    await firstProjectionStarted;
    await vi.waitFor(() => {
      expect(dispatchProviderSubmitMock).toHaveBeenCalledTimes(2);
    });

    releaseFirstProjection?.();

    await expect(dispatchPromise).resolves.toEqual(
      expect.objectContaining({
        claimed: 2,
        submitted: 2,
        exhausted: 0,
      })
    );
  });

  it("continues processing later claimed items while earlier generation transition work is pending", async () => {
    let signalFirstTransitionStarted: (() => void) | null = null;
    const firstTransitionStarted = new Promise<void>((resolve) => {
      signalFirstTransitionStarted = resolve;
    });
    let releaseFirstTransition: (() => void) | null = null;
    const firstTransitionPending = new Promise<void>((resolve) => {
      releaseFirstTransition = resolve;
    });

    seedClaimGenerationSubmitQueueBatches([
      {
        ...queueItem,
        queueId: "queue-1",
        generationId: "gen-1",
        userId: "user-1",
        sourceRef: "source-1",
      },
      {
        ...queueItem,
        queueId: "queue-2",
        generationId: "gen-2",
        userId: "user-1",
        sourceRef: "source-2",
      },
    ]);

    dispatchProviderSubmitMock
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: { request_id: "req-1" },
        providerRequestId: "req-1",
        targetUrl: "https://fal.test",
        targetIndex: 0,
        providerDiagnostics: {
          attemptsTried: 1,
          fallbackCount: 0,
          targetCount: 1,
          totalDurationMs: 50,
        },
      })
      .mockResolvedValueOnce({
        response: { ok: true, status: 200 },
        data: { request_id: "req-2" },
        providerRequestId: "req-2",
        targetUrl: "https://fal.test",
        targetIndex: 0,
        providerDiagnostics: {
          attemptsTried: 1,
          fallbackCount: 0,
          targetCount: 1,
          totalDurationMs: 60,
        },
      });

    applyAcceptedRunningGenerationTransitionMock
      .mockImplementationOnce(async () => {
        signalFirstTransitionStarted?.();
        await firstTransitionPending;
        return { ok: true };
      })
      .mockResolvedValueOnce({ ok: true });

    const dispatchPromise = dispatchGenerationSubmitQueueBatch({
      req: { method: "GET", headers: {} } as never,
      routeLabel: "test/dispatch-integrity",
      limit: 2,
      userId: null,
    });

    await firstTransitionStarted;
    await vi.waitFor(() => {
      expect(dispatchProviderSubmitMock).toHaveBeenCalledTimes(2);
    });

    releaseFirstTransition?.();

    await expect(dispatchPromise).resolves.toEqual(
      expect.objectContaining({
        claimed: 2,
        submitted: 2,
        exhausted: 0,
      })
    );
  });

  it("emits lease-timeout warning telemetry when lease budget is near submit timeout", async () => {
    readFalRuntimeFlagsMock.mockReturnValue({
      videoQueueCompatNormalizationEnabled: true,
      queueEnabled: true,
      queueLeaseSeconds: 18,
      queueMaxAttempts: 5,
      queueBaseBackoffSeconds: 5,
      queueMaxWaitSeconds: 1200,
      runningExhaustMinAgeSeconds: 7200,
      providerAttachedReservationCleanupMinAgeSeconds: 7200,
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
