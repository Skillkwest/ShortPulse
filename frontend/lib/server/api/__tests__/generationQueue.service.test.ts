import { beforeEach, describe, expect, it, vi } from "vitest";
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
