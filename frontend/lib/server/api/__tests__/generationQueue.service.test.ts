import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimGenerationSubmitQueueBatch,
  commitQueuedGenerationDispatchSuccess,
  readGenerationQueueStatus,
  removeQueueItem,
  updateQueueItemForRetry,
} from "../generationQueue/service";

const getSupabaseAdminMock = vi.fn();
const lookupLatestGenerationAttemptMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../generationAttempts", () => ({
  lookupLatestGenerationAttempt: (...args: unknown[]) => lookupLatestGenerationAttemptMock(...args),
}));

describe("generationQueue/service.claimGenerationSubmitQueueBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("throws when claim RPC returns an error", async () => {
    getSupabaseAdminMock.mockReturnValue({
      rpc: vi.fn(async () => ({
        data: null,
        error: {
          code: "0A000",
          message: "FOR UPDATE is not allowed with window functions",
          details: null,
          hint: null,
        },
      })),
    });

    await expect(
      claimGenerationSubmitQueueBatch({
        limit: 1,
        leaseSeconds: 30,
      })
    ).rejects.toThrow("claim_generation_submit_queue_batch failed");
  });

  it("returns parsed claimed items from RPC payload", async () => {
    getSupabaseAdminMock.mockReturnValue({
      rpc: vi.fn(async () => ({
        data: [
          {
            queue_id: "queue-1",
            generation_id: "gen-1",
            user_id: "user-1",
            model_id: "fal-ai/bytedance/seedream/v4.5/edit",
            source_ref: "src-1",
            submit_route: "/api/fal/seedream-edit-submit",
            submit_payload: { prompt: "hello" },
            timeout_ms: 20000,
            attempts: 0,
            status: "dispatching",
            next_attempt_at: null,
            lease_until: "2026-02-26T15:00:00.000Z",
            created_at: "2026-02-26T14:59:00.000Z",
          },
        ],
        error: null,
      })),
    });

    await expect(
      claimGenerationSubmitQueueBatch({
        limit: 1,
        leaseSeconds: 30,
      })
    ).resolves.toEqual([
      expect.objectContaining({
        queueId: "queue-1",
        generationId: "gen-1",
        userId: "user-1",
        sourceRef: "src-1",
        status: "dispatching",
      }),
    ]);
  });

  it("retries once when the claim RPC hits a dispatching-user unique collision", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({
        data: null,
        error: {
          code: "23505",
          message:
            'duplicate key value violates unique constraint "ux_ai_generation_submit_queue_dispatching_user"',
          details: null,
          hint: null,
        },
      })
      .mockResolvedValueOnce({
        data: [
          {
            queue_id: "queue-1",
            generation_id: "gen-1",
            user_id: "user-1",
            model_id: "fal-ai/bytedance/seedream/v4.5/edit",
            source_ref: "src-1",
            submit_route: "/api/fal/seedream-edit-submit",
            submit_payload: { prompt: "hello" },
            timeout_ms: 20000,
            attempts: 0,
            status: "dispatching",
            next_attempt_at: null,
            lease_until: "2026-02-26T15:00:00.000Z",
            created_at: "2026-02-26T14:59:00.000Z",
          },
        ],
        error: null,
      });
    getSupabaseAdminMock.mockReturnValue({ rpc });

    const claimPromise = claimGenerationSubmitQueueBatch({
      limit: 1,
      leaseSeconds: 30,
    });

    await vi.runAllTimersAsync();

    await expect(claimPromise).resolves.toEqual([
      expect.objectContaining({
        queueId: "queue-1",
        generationId: "gen-1",
      }),
    ]);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("throws after the bounded retry when the collision persists", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "23505",
        message:
          'duplicate key value violates unique constraint "ux_ai_generation_submit_queue_dispatching_user"',
        details: null,
        hint: null,
      },
    });
    getSupabaseAdminMock.mockReturnValue({ rpc });

    const handledClaim = claimGenerationSubmitQueueBatch({
      limit: 1,
      leaseSeconds: 30,
    }).catch((error) => error);

    await vi.runAllTimersAsync();

    const error = await handledClaim;
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain("claim_generation_submit_queue_batch failed");
    expect(rpc).toHaveBeenCalledTimes(2);
  });
});

describe("generationQueue/service mutation result guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns applied result when queue retry update affects one row", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(async () => ({
              data: [{ id: "queue-1" }],
              error: null,
            })),
          })),
        })),
      })),
    });

    await expect(
      updateQueueItemForRetry({
        queueId: "queue-1",
        attempts: 1,
        nextAttemptAt: "2026-02-27T00:00:00.000Z",
        lastError: "retry",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        operation: "retry",
        reason: "applied",
      })
    );
  });

  it("returns db_error result when queue delete fails", async () => {
    getSupabaseAdminMock.mockReturnValue({
      from: vi.fn(() => ({
        delete: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(async () => ({
              data: null,
              error: { message: "db unavailable" },
            })),
          })),
        })),
      })),
    });

    await expect(removeQueueItem("queue-1")).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        operation: "remove",
        reason: "db_error",
      })
    );
  });

  it("parses committed queued dispatch success RPC results", async () => {
    getSupabaseAdminMock.mockReturnValue({
      rpc: vi.fn(async () => ({
        data: {
          status: "committed",
          stage: "post_submit_commit",
          code: null,
          source_ref: "source-1",
          attempt_id: "attempt-1",
          attempt_number: 2,
          message: null,
        },
        error: null,
      })),
    });

    await expect(
      commitQueuedGenerationDispatchSuccess({
        userId: "user-1",
        queueId: "queue-1",
        generationId: "gen-1",
        sourceRef: "source-1",
        provider: "fal",
        modelId: "fal-ai/nano-banana-pro",
        providerRequestId: "req-1",
        nextRecoveryAtIso: "2026-04-03T00:02:00.000Z",
        generationMetadata: {
          source_ref: "source-1",
          generation_submit_authority: "worker",
          queue_id: "queue-1",
        },
        attemptMetadata: {
          source_ref: "source-1",
          queue_id: "queue-1",
        },
        submitRoute: "/api/fal/nano-banana-pro-submit",
        observedAt: "2026-04-03T00:00:00.000Z",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        ok: true,
        status: "committed",
        stage: "post_submit_commit",
        sourceRef: "source-1",
        attemptId: "attempt-1",
        attemptNumber: 2,
      })
    );
  });

  it("returns rpc failure when queued dispatch success commit RPC errors", async () => {
    getSupabaseAdminMock.mockReturnValue({
      rpc: vi.fn(async () => ({
        data: null,
        error: {
          code: "XX000",
          message: "rpc exploded",
          details: null,
          hint: null,
        },
      })),
    });

    await expect(
      commitQueuedGenerationDispatchSuccess({
        userId: "user-1",
        queueId: "queue-1",
        generationId: "gen-1",
        sourceRef: "source-1",
        provider: "fal",
        modelId: "fal-ai/nano-banana-pro",
        providerRequestId: "req-1",
        nextRecoveryAtIso: "2026-04-03T00:02:00.000Z",
        generationMetadata: {},
        attemptMetadata: {},
        submitRoute: "/api/fal/nano-banana-pro-submit",
        observedAt: "2026-04-03T00:00:00.000Z",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        ok: false,
        status: "failed",
        stage: "rpc",
        code: "POST_SUBMIT_COMMIT_RPC_FAILED",
      })
    );
  });
});

describe("generationQueue/service.readGenerationQueueStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupLatestGenerationAttemptMock.mockResolvedValue({ data: null, error: null });
  });

  const createStatusSupabaseMock = ({
    queueRow,
    generationRow,
    projectionRow,
    projectionRows,
  }: {
    queueRow?: Record<string, unknown> | null;
    generationRow?: Record<string, unknown> | null;
    projectionRow?: Record<string, unknown> | null;
    projectionRows?: Record<string, unknown>[] | null;
  }) => {
    const queueMaybeSingle = vi.fn(async () => ({ data: queueRow ?? null, error: null }));
    const queueEq2 = vi.fn(() => ({ maybeSingle: queueMaybeSingle }));
    const queueEq1 = vi.fn(() => ({ eq: queueEq2 }));
    const queueSelect = vi.fn(() => ({ eq: queueEq1 }));

    const generationMaybeSingle = vi.fn(async () => ({ data: generationRow ?? null, error: null }));
    const generationLimit = vi.fn(() => ({ maybeSingle: generationMaybeSingle }));
    const generationOrder = vi.fn(() => ({
      limit: generationLimit,
      maybeSingle: generationMaybeSingle,
    }));
    const generationContains = vi.fn(() => ({
      order: generationOrder,
      limit: generationLimit,
      maybeSingle: generationMaybeSingle,
    }));
    const generationEq2 = vi.fn(() => ({ maybeSingle: generationMaybeSingle }));
    const generationEq1 = vi.fn(() => ({ eq: generationEq2, contains: generationContains }));
    const generationSelect = vi.fn(() => ({ eq: generationEq1, contains: generationContains }));

    const projectionMaybeSingle = vi.fn(async () => ({ data: projectionRow ?? null, error: null }));
    const projectionOrder = vi.fn(() => ({
      limit: projectionLimit,
      maybeSingle: projectionMaybeSingle,
    }));
    const projectionLimit = vi.fn(() =>
      projectionRows
        ? Promise.resolve({ data: projectionRows, error: null })
        : ({ maybeSingle: projectionMaybeSingle } as never)
    );
    const projectionEq2 = vi.fn(() => ({
      order: projectionOrder,
      limit: projectionLimit,
      maybeSingle: projectionMaybeSingle,
    }));
    const projectionEq1 = vi.fn(() => ({ eq: projectionEq2 }));
    const projectionSelect = vi.fn(() => ({ eq: projectionEq1 }));

    return {
      queueSelect,
      generationSelect,
      generationContains,
      generationEq2,
      projectionLimit,
      from: vi.fn((tableName: string) => {
        if (tableName === "ai_generation_submit_queue") {
          return { select: queueSelect };
        }
        if (tableName === "ai_generations") {
          return { select: generationSelect };
        }
        if (tableName === "generation_projection") {
          return { select: projectionSelect };
        }
        throw new Error(`Unexpected table: ${tableName}`);
      }),
    };
  };

  it("returns dispatching when the queue row holds the active lease", async () => {
    const supabaseMock = createStatusSupabaseMock({
      queueRow: {
        id: "queue-1",
        status: "dispatching",
        source_ref: "src-1",
        generation_id: "gen-1",
      },
      generationRow: {
        id: "gen-1",
        status: "pending",
        request_id: null,
        provider: "fal",
        model_id: "fal-ai/bytedance/seedream/v4.5/edit",
        metadata: { source_ref: "src-1" },
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseMock);

    await expect(
      readGenerationQueueStatus({
        userId: "user-1",
        generationId: "gen-1",
      })
    ).resolves.toEqual({
      status: "dispatching",
      generationId: "gen-1",
      sourceRef: "src-1",
      retryAfterMs: 1000,
      shortpulseLifecycle: {
        taskState: "running",
        queueState: "dispatching",
        isTerminal: false,
        statusLabel: "Dispatching...",
      },
    });

    expect(supabaseMock.generationSelect).not.toHaveBeenCalled();
  });

  it("returns queued from the queue row without querying ai_generations", async () => {
    const supabaseMock = createStatusSupabaseMock({
      queueRow: {
        id: "queue-queued-1",
        status: "queued",
        source_ref: "src-queued-1",
        generation_id: "gen-queued-1",
      },
      generationRow: {
        id: "gen-queued-1",
        status: "running",
        request_id: null,
        provider: "fal",
        model_id: "fal-ai/bytedance/seedream/v4.5/edit",
        metadata: { source_ref: "src-queued-1" },
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabaseMock);

    await expect(
      readGenerationQueueStatus({
        userId: "user-1",
        generationId: "gen-queued-1",
      })
    ).resolves.toEqual({
      status: "queued",
      generationId: "gen-queued-1",
      sourceRef: "src-queued-1",
      retryAfterMs: 2000,
      shortpulseLifecycle: {
        taskState: "pending",
        queueState: "queued",
        isTerminal: false,
        statusLabel: "Waiting in queue...",
      },
    });

    expect(supabaseMock.generationSelect).not.toHaveBeenCalled();
  });

  it("returns slower queued retry guidance when the generation is still pre-dispatch without a queue row", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createStatusSupabaseMock({
        queueRow: null,
        generationRow: {
          id: "gen-2",
          status: "running",
          request_id: null,
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          metadata: { source_ref: "src-2" },
        },
      })
    );

    await expect(
      readGenerationQueueStatus({
        userId: "user-1",
        generationId: "gen-2",
      })
    ).resolves.toEqual({
      status: "queued",
      generationId: "gen-2",
      sourceRef: "src-2",
      retryAfterMs: 3000,
      shortpulseLifecycle: {
        taskState: "pending",
        queueState: "queued",
        isTerminal: false,
        statusLabel: "Waiting in queue...",
      },
    });
  });

  it("returns dispatched when the canonical generation attempt has a provider request id", async () => {
    lookupLatestGenerationAttemptMock.mockResolvedValue({
      data: {
        providerRequestId: "req-attempt-1",
      },
      error: null,
    });
    getSupabaseAdminMock.mockReturnValue(
      createStatusSupabaseMock({
        queueRow: null,
        generationRow: {
          id: "gen-3",
          status: "running",
          request_id: null,
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          metadata: { source_ref: "src-3" },
        },
      })
    );

    await expect(
      readGenerationQueueStatus({
        userId: "user-1",
        generationId: "gen-3",
      })
    ).resolves.toEqual({
      status: "dispatched",
      generationId: "gen-3",
      sourceRef: "src-3",
      requestId: "req-attempt-1",
      provider: "fal",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      pollingProvider: "fal-seedream-edit",
      shortpulseLifecycle: {
        taskState: "running",
        queueState: "dispatched",
        isTerminal: false,
        statusLabel: "Submitted",
      },
    });
    expect(lookupLatestGenerationAttemptMock).toHaveBeenCalledWith({
      userId: "user-1",
      generationId: "gen-3",
    });
  });

  it("prefers generation_projection request ids before generation-attempt lookup", async () => {
    const supabase = createStatusSupabaseMock({
      queueRow: null,
      generationRow: {
        id: "gen-projection-1",
        status: "running",
        request_id: null,
        provider: "fal",
        model_id: "fal-ai/bytedance/seedream/v4.5/edit",
        metadata: { source_ref: "src-projection-1" },
      },
      projectionRow: {
        generation_id: "gen-projection-1",
        request_id: "req-from-projection",
        provider: "fal",
        model_id: "fal-ai/bytedance/seedream/v4.5/edit",
        task_state: "running",
        queue_state: "dispatched",
      },
    });
    getSupabaseAdminMock.mockReturnValue(supabase);

    await expect(
      readGenerationQueueStatus({
        userId: "user-1",
        generationId: "gen-projection-1",
      })
    ).resolves.toEqual({
      status: "dispatched",
      generationId: "gen-projection-1",
      sourceRef: "src-projection-1",
      requestId: "req-from-projection",
      provider: "fal",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      pollingProvider: "fal-seedream-edit",
      shortpulseLifecycle: {
        taskState: "running",
        queueState: "dispatched",
        isTerminal: false,
        statusLabel: "Submitted",
      },
    });
    expect(lookupLatestGenerationAttemptMock).not.toHaveBeenCalled();
    expect(supabase.generationEq2).toHaveBeenCalledTimes(1);
  });

  it("returns projected terminal failure before legacy queue reconstruction", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createStatusSupabaseMock({
        queueRow: null,
        generationRow: {
          id: "gen-projection-fail",
          status: "running",
          request_id: null,
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          metadata: { source_ref: "src-projection-fail" },
        },
        projectionRow: {
          generation_id: "gen-projection-fail",
          status: "ready",
          task_state: "fail",
          queue_state: "dispatched",
          error_message_short: "Projection terminal failure",
          error_detail: "provider failed",
        },
      })
    );

    await expect(
      readGenerationQueueStatus({
        userId: "user-1",
        generationId: "gen-projection-fail",
      })
    ).resolves.toEqual({
      status: "failed",
      generationId: "gen-projection-fail",
      sourceRef: "src-projection-fail",
      message: "Projection terminal failure",
      shortpulseLifecycle: {
        taskState: "fail",
        queueState: "failed",
        isTerminal: true,
        errorMessage: "Projection terminal failure",
        statusLabel: null,
      },
    });
  });

  it("prefers projected terminal failure over a projected request id", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createStatusSupabaseMock({
        queueRow: null,
        generationRow: {
          id: "gen-projection-fail-with-request",
          status: "running",
          request_id: "req-from-generation-row",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          metadata: { source_ref: "src-projection-fail-with-request" },
        },
        projectionRow: {
          generation_id: "gen-projection-fail-with-request",
          request_id: "req-from-projection",
          status: "ready",
          task_state: "fail",
          queue_state: "dispatched",
          error_message_short: "Projection failed after dispatch",
        },
      })
    );

    await expect(
      readGenerationQueueStatus({
        userId: "user-1",
        generationId: "gen-projection-fail-with-request",
      })
    ).resolves.toEqual({
      status: "failed",
      generationId: "gen-projection-fail-with-request",
      sourceRef: "src-projection-fail-with-request",
      message: "Projection failed after dispatch",
      shortpulseLifecycle: {
        taskState: "fail",
        queueState: "failed",
        isTerminal: true,
        errorMessage: "Projection failed after dispatch",
        statusLabel: null,
      },
    });
  });

  it("returns queued from generation_projection when legacy queue rows are absent", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createStatusSupabaseMock({
        queueRow: null,
        generationRow: {
          id: "gen-projection-queued",
          status: "pending",
          request_id: null,
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          metadata: { source_ref: "src-projection-queued" },
        },
        projectionRow: {
          generation_id: "gen-projection-queued",
          status: "ready",
          task_state: "pending",
          queue_state: "queued",
        },
      })
    );

    await expect(
      readGenerationQueueStatus({
        userId: "user-1",
        generationId: "gen-projection-queued",
      })
    ).resolves.toEqual({
      status: "queued",
      generationId: "gen-projection-queued",
      sourceRef: "src-projection-queued",
      retryAfterMs: 2000,
      shortpulseLifecycle: {
        taskState: "pending",
        queueState: "queued",
        isTerminal: false,
        statusLabel: "Waiting in queue...",
      },
    });
  });

  it("prefers terminal generation failure over a legacy request id", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createStatusSupabaseMock({
        queueRow: null,
        generationRow: {
          id: "gen-fail-with-request",
          status: "fail",
          request_id: "req-failed-generation",
          error_message: "Generation failed after submit",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          metadata: { source_ref: "src-fail-with-request" },
        },
      })
    );

    await expect(
      readGenerationQueueStatus({
        userId: "user-1",
        generationId: "gen-fail-with-request",
      })
    ).resolves.toEqual({
      status: "failed",
      generationId: "gen-fail-with-request",
      sourceRef: "src-fail-with-request",
      message: "Generation failed after submit",
      shortpulseLifecycle: {
        taskState: "fail",
        queueState: "failed",
        isTerminal: true,
        errorMessage: "Generation failed after submit",
        statusLabel: null,
      },
    });
  });

  it("prefers projection sourceRef when legacy metadata source_ref is missing", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createStatusSupabaseMock({
        queueRow: null,
        generationRow: {
          id: "gen-projection-source-ref",
          status: "running",
          request_id: null,
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          metadata: {},
        },
        projectionRow: {
          generation_id: "gen-projection-source-ref",
          source_ref: "src-from-projection",
          request_id: "req-from-projection",
          provider: "fal",
          model_id: "fal-ai/bytedance/seedream/v4.5/edit",
          task_state: "running",
          queue_state: "dispatched",
        },
      })
    );

    await expect(
      readGenerationQueueStatus({
        userId: "user-1",
        generationId: "gen-projection-source-ref",
      })
    ).resolves.toEqual({
      status: "dispatched",
      generationId: "gen-projection-source-ref",
      sourceRef: "src-from-projection",
      requestId: "req-from-projection",
      provider: "fal",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      pollingProvider: "fal-seedream-edit",
      shortpulseLifecycle: {
        taskState: "running",
        queueState: "dispatched",
        isTerminal: false,
        statusLabel: "Submitted",
      },
    });
  });

  it("resolves generationId from projection sourceRef before legacy metadata scan", async () => {
    const supabase = createStatusSupabaseMock({
      queueRow: null,
      generationRow: {
        id: "gen-source-ref-projection",
        status: "running",
        request_id: "req-from-projection-source-ref",
        provider: "fal",
        model_id: "fal-ai/bytedance/seedream/v4.5/edit",
        metadata: {},
      },
      projectionRow: {
        generation_id: "gen-source-ref-projection",
        source_ref: "src-projection-lookup",
        request_id: "req-from-projection-source-ref",
        provider: "fal",
        model_id: "fal-ai/bytedance/seedream/v4.5/edit",
        task_state: "running",
        queue_state: "dispatched",
      },
      projectionRows: [
        {
          generation_id: "gen-source-ref-projection",
          source_ref: "src-projection-lookup",
          request_id: "req-from-projection-source-ref",
          updated_at: new Date().toISOString(),
        },
      ],
    });
    getSupabaseAdminMock.mockReturnValue(supabase);

    await expect(
      readGenerationQueueStatus({
        userId: "user-1",
        sourceRef: "src-projection-lookup",
      })
    ).resolves.toEqual({
      status: "dispatched",
      generationId: "gen-source-ref-projection",
      sourceRef: "src-projection-lookup",
      requestId: "req-from-projection-source-ref",
      provider: "fal",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      pollingProvider: "fal-seedream-edit",
      shortpulseLifecycle: {
        taskState: "running",
        queueState: "dispatched",
        isTerminal: false,
        statusLabel: "Submitted",
      },
    });

    expect(supabase.generationContains).not.toHaveBeenCalled();
  });
});
