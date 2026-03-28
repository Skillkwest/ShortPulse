import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimGenerationRecoveryBatch } from "../recoveryBatchAcquisition";

const tryClaimRecoveryCandidateMock = vi.fn();
const resolveSupportedRecoveryProviderFamilyMock = vi.fn();

vi.mock("../../api/generationRecoveryClaimPolicy", () => ({
  resolveSupportedRecoveryProviderFamily: (...args: unknown[]) =>
    resolveSupportedRecoveryProviderFamilyMock(...args),
  tryClaimRecoveryCandidate: (...args: unknown[]) => tryClaimRecoveryCandidateMock(...args),
}));

describe("generationControlPlane/recoveryBatchAcquisition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resolveSupportedRecoveryProviderFamilyMock.mockReturnValue("fal");
    tryClaimRecoveryCandidateMock.mockResolvedValue({
      claimed: true,
      requestId: "req-1",
      reason: "claimed",
      errorMessage: null,
    });
  });

  it("returns parsed rows from the rpc path when claim rpc succeeds", async () => {
    const supabaseAdmin = {
      rpc: vi.fn(async () => ({
        data: [
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
        ],
        error: null,
      })),
    };

    const result = await claimGenerationRecoveryBatch({
      supabaseAdmin: supabaseAdmin as never,
      batchSize: 10,
      maxAttempts: 5,
      minAgeSeconds: 60,
      leaseSeconds: 120,
    });

    expect(result).toEqual({
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
      ],
      claimSource: "rpc",
      rpcError: null,
    });
    expect(tryClaimRecoveryCandidateMock).not.toHaveBeenCalled();
  });

  it("falls back to row query and claim policy when the rpc path errors", async () => {
    const selectBuilder = {
      in: vi.fn(),
      lte: vi.fn(),
      or: vi.fn(),
      lt: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(async () => ({
        data: [
          {
            id: "gen-1",
            user_id: "user-1",
            request_id: "req-legacy",
            provider: "fal",
            model_id: "model-1",
            status: "running",
            recovery_state: "queued",
            recovery_attempts: 1,
          },
        ],
        error: null,
      })),
    };
    selectBuilder.in.mockReturnValue(selectBuilder);
    selectBuilder.lte.mockReturnValue(selectBuilder);
    selectBuilder.or.mockReturnValue(selectBuilder);
    selectBuilder.lt.mockReturnValue(selectBuilder);
    selectBuilder.order.mockReturnValue(selectBuilder);

    const supabaseAdmin = {
      rpc: vi.fn(async () => ({
        data: null,
        error: new Error("rpc unavailable"),
      })),
      from: vi.fn(() => ({
        select: vi.fn(() => selectBuilder),
      })),
    };

    const result = await claimGenerationRecoveryBatch({
      supabaseAdmin: supabaseAdmin as never,
      batchSize: 10,
      maxAttempts: 5,
      minAgeSeconds: 60,
      leaseSeconds: 120,
    });

    expect(result.claimSource).toBe("fallback");
    expect(result.rows).toEqual([
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
    ]);
    expect(result.rpcError).toBeInstanceOf(Error);
    expect(tryClaimRecoveryCandidateMock).toHaveBeenCalledTimes(1);
  });

  it("skips unsupported providers on the fallback path", async () => {
    resolveSupportedRecoveryProviderFamilyMock.mockReturnValue(null);

    const selectBuilder = {
      in: vi.fn(),
      lte: vi.fn(),
      or: vi.fn(),
      lt: vi.fn(),
      order: vi.fn(),
      limit: vi.fn(async () => ({
        data: [
          {
            id: "gen-1",
            user_id: "user-1",
            request_id: "req-1",
            provider: "other",
            model_id: "model-1",
            status: "running",
            recovery_state: "queued",
            recovery_attempts: 1,
          },
        ],
        error: null,
      })),
    };
    selectBuilder.in.mockReturnValue(selectBuilder);
    selectBuilder.lte.mockReturnValue(selectBuilder);
    selectBuilder.or.mockReturnValue(selectBuilder);
    selectBuilder.lt.mockReturnValue(selectBuilder);
    selectBuilder.order.mockReturnValue(selectBuilder);

    const supabaseAdmin = {
      rpc: vi.fn(async () => ({
        data: null,
        error: new Error("rpc unavailable"),
      })),
      from: vi.fn(() => ({
        select: vi.fn(() => selectBuilder),
      })),
    };

    const result = await claimGenerationRecoveryBatch({
      supabaseAdmin: supabaseAdmin as never,
      batchSize: 10,
      maxAttempts: 5,
      minAgeSeconds: 60,
      leaseSeconds: 120,
    });

    expect(result.rows).toEqual([]);
    expect(tryClaimRecoveryCandidateMock).not.toHaveBeenCalled();
  });
});
