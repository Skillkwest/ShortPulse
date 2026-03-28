import { beforeEach, describe, expect, it, vi } from "vitest";
import { executeClaimedRecoveryBatch } from "../recoveryBatchExecution";

const executeGenerationRecoveryMock = vi.fn();

vi.mock("../../falIntegration/recoveryExecution", () => ({
  executeGenerationRecovery: (...args: unknown[]) => executeGenerationRecoveryMock(...args),
}));

const createSupabaseAdmin = () => {
  const updateEq2 = vi.fn(async () => ({ error: null }));
  const updateEq1 = vi.fn(() => ({ eq: updateEq2 }));
  const update = vi.fn(() => ({ eq: updateEq1 }));
  const from = vi.fn(() => ({ update }));
  return { from, updateEq2 };
};

describe("generationControlPlane/recoveryBatchExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts recovered and duplicate outcomes from the recovery engine", async () => {
    const supabaseAdmin = createSupabaseAdmin();
    const logException = vi.fn(async () => undefined);
    executeGenerationRecoveryMock
      .mockResolvedValueOnce({ processed: true, state: "recovered" })
      .mockResolvedValueOnce({ processed: false, state: "already_persisted" });

    const result = await executeClaimedRecoveryBatch({
      supabaseAdmin: supabaseAdmin as never,
      rows: [
        {
          id: "gen-1",
          user_id: "user-1",
          request_id: "req-1",
          provider: "fal",
          model_id: "model-1",
          status: "running",
          recovery_state: "recovering",
          recovery_attempts: 2,
        },
        {
          id: "gen-2",
          user_id: "user-1",
          request_id: "req-2",
          provider: "fal",
          model_id: "model-1",
          status: "running",
          recovery_state: "recovering",
          recovery_attempts: 2,
        },
      ],
      modelAllowlist: new Set(["*"]),
      maxAttempts: 5,
      routeLabel: "worker/generation-control-plane",
      logException,
    });

    expect(result).toEqual({
      recovered: 2,
      requeued: 0,
      exhausted: 0,
      skipped: 0,
      duplicates: 1,
      processed: 1,
      errors: 0,
    });
    expect(logException).not.toHaveBeenCalled();
  });

  it("requeues allowlist-skipped rows without calling the recovery engine", async () => {
    const supabaseAdmin = createSupabaseAdmin();

    const result = await executeClaimedRecoveryBatch({
      supabaseAdmin: supabaseAdmin as never,
      rows: [
        {
          id: "gen-1",
          user_id: "user-1",
          request_id: "req-1",
          provider: "fal",
          model_id: "model-not-allowed",
          status: "running",
          recovery_state: "recovering",
          recovery_attempts: 3,
        },
      ],
      modelAllowlist: new Set(["allowed-*"]),
      maxAttempts: 5,
      routeLabel: "worker/generation-control-plane",
      logException: vi.fn(async () => undefined),
    });

    expect(result).toEqual({
      recovered: 0,
      requeued: 0,
      exhausted: 0,
      skipped: 1,
      duplicates: 0,
      processed: 0,
      errors: 0,
    });
    expect(executeGenerationRecoveryMock).not.toHaveBeenCalled();
  });

  it("logs and requeues rows when recovery execution throws", async () => {
    const supabaseAdmin = createSupabaseAdmin();
    const logException = vi.fn(async () => undefined);
    executeGenerationRecoveryMock.mockRejectedValue(new Error("boom"));

    const result = await executeClaimedRecoveryBatch({
      supabaseAdmin: supabaseAdmin as never,
      rows: [
        {
          id: "gen-1",
          user_id: "user-1",
          request_id: "req-1",
          provider: "fal",
          model_id: "model-1",
          status: "running",
          recovery_state: "recovering",
          recovery_attempts: 1,
        },
      ],
      modelAllowlist: new Set(["*"]),
      maxAttempts: 5,
      routeLabel: "worker/generation-control-plane",
      logException,
    });

    expect(result).toEqual({
      recovered: 0,
      requeued: 0,
      exhausted: 0,
      skipped: 0,
      duplicates: 0,
      processed: 0,
      errors: 1,
    });
    expect(logException).toHaveBeenCalledWith({
      error: expect.any(Error),
      metadata: {
        stage: "execute_generation_recovery",
        generation_id: "gen-1",
        request_id: "req-1",
      },
    });
  });
});
