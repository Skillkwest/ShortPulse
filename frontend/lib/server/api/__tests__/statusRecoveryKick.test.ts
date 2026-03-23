import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimDueQueueStatusRecovery } from "../generationQueue/statusRecoveryKick";

const readFalRuntimeFlagsMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const repairGenerationRequestIdFromReservationMock = vi.fn();

vi.mock("../falRuntimeFlags", () => ({
  readFalRuntimeFlags: (...args: unknown[]) => readFalRuntimeFlagsMock(...args),
}));

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../generationQueue/requestIdRepair", () => ({
  repairGenerationRequestIdFromReservation: (...args: unknown[]) =>
    repairGenerationRequestIdFromReservationMock(...args),
}));

const createDefaultFlags = () => ({
  integrationMode: "on",
  modelAllowlist: new Set<string>(),
  reconcilerEnabled: true,
  reconcilerCronSecret: "secret",
  reconcilerBatchSize: 25,
  reconcilerMaxAttempts: 5,
  reconcilerMinAgeSeconds: 120,
  reconcilerLeaseSeconds: 120,
  circuitBreakerEnabled: false,
  circuitBreakerThreshold15m: 20,
  webhookEnabled: true,
  webhookVerifyMode: "dual",
  webhookJwksUrl: "https://example.com/jwks.json",
  webhookToleranceSeconds: 300,
  publicApiBaseUrl: "https://example.com",
  directDebitFallbackEnabled: false,
  admission: {
    mode: "off",
    globalMax: 30,
    tierLimits: {},
    retryAfterSeconds: 30,
  },
  reservationCleanupEnabled: true,
  reservationCleanupMinAgeSeconds: 900,
  reservationCleanupBatchSize: 200,
  admissionAtomicEnabled: false,
  queueEnabled: true,
  queueStatusDispatchKickEnabled: true,
  queueMaxPerUser: 20,
  queueDispatchBatchSize: 25,
  queueLeaseSeconds: 30,
  queueMaxAttempts: 5,
  queueBaseBackoffSeconds: 5,
  queueMaxWaitSeconds: 1200,
});

const createSelectBuilder = (row: Record<string, unknown> | null) => {
  const builder = {
    eq: vi.fn(),
    contains: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data: row, error: null })),
  };
  builder.eq.mockReturnValue(builder);
  builder.contains.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
};

const createUpdateBuilder = (updatedRows: Array<Record<string, unknown>>) => {
  const builder = {
    eq: vi.fn(),
    ilike: vi.fn(),
    lt: vi.fn(),
    lte: vi.fn(),
    or: vi.fn(),
    select: vi.fn(async () => ({ data: updatedRows, error: null })),
  };
  builder.eq.mockReturnValue(builder);
  builder.ilike.mockReturnValue(builder);
  builder.lt.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.or.mockReturnValue(builder);
  return builder;
};

describe("claimDueQueueStatusRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readFalRuntimeFlagsMock.mockReturnValue(createDefaultFlags());
    repairGenerationRequestIdFromReservationMock.mockResolvedValue({
      repaired: false,
      generationId: null,
      requestId: null,
      sourceRef: null,
      reason: "missing_provider_request_id",
      errorMessage: null,
    });
  });

  it("returns disabled when reconciler is off", async () => {
    readFalRuntimeFlagsMock.mockReturnValue({
      ...createDefaultFlags(),
      reconcilerEnabled: false,
    });

    await expect(
      claimDueQueueStatusRecovery({
        userId: "user-1",
        generationId: "gen-1",
        sourceRef: null,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        claimed: false,
        reason: "disabled",
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("claims a due candidate and returns claimed metadata", async () => {
    const selectBuilder = createSelectBuilder({
      id: "gen-1",
      request_id: "req-1",
      provider: "fal",
      status: "running",
      recovery_state: "queued",
      recovery_attempts: 1,
      next_recovery_at: new Date(Date.now() - 1_000).toISOString(),
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    });
    const updateBuilder = createUpdateBuilder([{ id: "gen-1", request_id: "req-1" }]);
    const from = vi
      .fn()
      .mockImplementationOnce(() => ({
        select: vi.fn(() => selectBuilder),
      }))
      .mockImplementationOnce(() => ({
        update: vi.fn(() => updateBuilder),
      }));
    getSupabaseAdminMock.mockReturnValue({ from });

    await expect(
      claimDueQueueStatusRecovery({
        userId: "user-1",
        generationId: "gen-1",
        sourceRef: null,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        claimed: true,
        generationId: "gen-1",
        requestId: "req-1",
        reason: "claimed",
      })
    );
    expect(updateBuilder.select).toHaveBeenCalledWith("id, request_id");
  });

  it("skips claims that are not due", async () => {
    const selectBuilder = createSelectBuilder({
      id: "gen-1",
      request_id: "req-1",
      provider: "fal",
      status: "running",
      recovery_state: "queued",
      recovery_attempts: 1,
      next_recovery_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    });
    const from = vi.fn().mockImplementationOnce(() => ({
      select: vi.fn(() => selectBuilder),
    }));
    getSupabaseAdminMock.mockReturnValue({ from });

    await expect(
      claimDueQueueStatusRecovery({
        userId: "user-1",
        generationId: "gen-1",
        sourceRef: null,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        claimed: false,
        reason: "not_due",
      })
    );
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("skips providers outside the Fal/Kie recovery family", async () => {
    const selectBuilder = createSelectBuilder({
      id: "gen-1",
      request_id: "req-1",
      provider: "other-provider",
      status: "running",
      recovery_state: "queued",
      recovery_attempts: 1,
      next_recovery_at: new Date(Date.now() - 1_000).toISOString(),
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    });
    const from = vi.fn().mockImplementationOnce(() => ({
      select: vi.fn(() => selectBuilder),
    }));
    getSupabaseAdminMock.mockReturnValue({ from });

    await expect(
      claimDueQueueStatusRecovery({
        userId: "user-1",
        generationId: "gen-1",
        sourceRef: null,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        claimed: false,
        reason: "provider_not_supported",
      })
    );
  });

  it("repairs a missing request id from the reservation and retries the claim once", async () => {
    const initialSelectBuilder = createSelectBuilder({
      id: "gen-1",
      request_id: null,
      provider: "fal",
      status: "running",
      recovery_state: "queued",
      recovery_attempts: 1,
      next_recovery_at: new Date(Date.now() - 1_000).toISOString(),
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    });
    const repairedSelectBuilder = createSelectBuilder({
      id: "gen-1",
      request_id: "req-1",
      provider: "fal",
      status: "running",
      recovery_state: "queued",
      recovery_attempts: 1,
      next_recovery_at: new Date(Date.now() - 1_000).toISOString(),
      created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    });
    const updateBuilder = createUpdateBuilder([{ id: "gen-1", request_id: "req-1" }]);
    const from = vi
      .fn()
      .mockImplementationOnce(() => ({
        select: vi.fn(() => initialSelectBuilder),
      }))
      .mockImplementationOnce(() => ({
        select: vi.fn(() => repairedSelectBuilder),
      }))
      .mockImplementationOnce(() => ({
        update: vi.fn(() => updateBuilder),
      }));
    getSupabaseAdminMock.mockReturnValue({ from });
    repairGenerationRequestIdFromReservationMock.mockResolvedValueOnce({
      repaired: true,
      generationId: "gen-1",
      requestId: "req-1",
      sourceRef: "source-1",
      reason: "repaired",
      errorMessage: null,
    });

    await expect(
      claimDueQueueStatusRecovery({
        userId: "user-1",
        generationId: "gen-1",
        sourceRef: "source-1",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        claimed: true,
        generationId: "gen-1",
        requestId: "req-1",
        reason: "claimed",
      })
    );

    expect(repairGenerationRequestIdFromReservationMock).toHaveBeenCalledWith({
      userId: "user-1",
      generationId: "gen-1",
      sourceRef: "source-1",
    });
    expect(updateBuilder.select).toHaveBeenCalledWith("id, request_id");
  });
});
