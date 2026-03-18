import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimGenerationSubmitQueueBatch,
  removeQueueItem,
  updateQueueItemForRetry,
} from "../generationQueue/service";

const getSupabaseAdminMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
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
});
