import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  claimPendingGenerationObservations,
  markGenerationObservationProcessingState,
} from "../generationObservationInbox";

const rpcMock = vi.fn();
const updateEqMock = vi.fn();
const updateMock = vi.fn(() => ({ eq: updateEqMock }));
const fromMock = vi.fn((_table?: string) => ({ update: updateMock }));
const getSupabaseAdminMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: () => getSupabaseAdminMock(),
}));

describe("generationObservationInbox", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateEqMock.mockResolvedValue({ error: null });
    getSupabaseAdminMock.mockReturnValue({
      rpc: (fnName: string, params?: unknown) => rpcMock(fnName, params),
      from: (table: string) => fromMock(table),
    });
  });

  it("claims pending observations through the inbox RPC", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: "obs-1",
          generation_id: "gen-1",
          generation_attempt_id: "attempt-1",
          user_id: "user-1",
          provider: "fal",
          provider_request_id: "req-1",
          observation_source: "webhook",
          observation_type: "completed",
          idempotency_key: "fal:webhook:event-1",
          payload: { status: "completed" },
          observed_at: "2026-04-08T20:00:00.000Z",
        },
      ],
      error: null,
    });

    await expect(
      claimPendingGenerationObservations({
        limit: 12.9,
        leaseSeconds: 119.2,
      })
    ).resolves.toEqual([
      {
        id: "obs-1",
        generationId: "gen-1",
        generationAttemptId: "attempt-1",
        userId: "user-1",
        provider: "fal",
        providerRequestId: "req-1",
        observationSource: "webhook",
        observationType: "completed",
        idempotencyKey: "fal:webhook:event-1",
        payload: { status: "completed" },
        observedAt: "2026-04-08T20:00:00.000Z",
      },
    ]);
    expect(rpcMock).toHaveBeenCalledWith("claim_generation_observation_inbox_batch", {
      p_limit: 12,
      p_lease_seconds: 119,
    });
  });

  it("throws when the claim RPC returns an error or invalid payload", async () => {
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: new Error("rpc_failed"),
    });
    await expect(
      claimPendingGenerationObservations({
        limit: 5,
        leaseSeconds: 60,
      })
    ).rejects.toThrow("rpc_failed");

    rpcMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    await expect(
      claimPendingGenerationObservations({
        limit: 5,
        leaseSeconds: 60,
      })
    ).rejects.toThrow("claim_generation_observation_inbox_batch returned non-array payload");
  });

  it("keeps processed_at null for processing and sets it for terminal states", async () => {
    await markGenerationObservationProcessingState({
      idempotencyKey: "fal:webhook:event-1",
      processingState: "processing",
      processingError: null,
    });

    expect(fromMock).toHaveBeenCalledWith("generation_observation_inbox");
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        processing_state: "processing",
        processed_at: null,
        updated_at: expect.any(String),
      })
    );
    expect(updateEqMock).toHaveBeenCalledWith("idempotency_key", "fal:webhook:event-1");

    await markGenerationObservationProcessingState({
      idempotencyKey: "fal:webhook:event-2",
      processingState: "processed",
      processingError: null,
    });

    expect(updateMock).toHaveBeenLastCalledWith(
      expect.objectContaining({
        processing_state: "processed",
        processed_at: expect.any(String),
      })
    );
  });
});
