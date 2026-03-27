import { beforeEach, describe, expect, it, vi } from "vitest";
import { repairGenerationRequestIdFromReservation } from "../generationQueue/requestIdRepair";

const getSupabaseAdminMock = vi.fn();
const lookupLatestGenerationAttemptMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../generationAttempts", () => ({
  lookupLatestGenerationAttempt: (...args: unknown[]) => lookupLatestGenerationAttemptMock(...args),
}));

const createGenerationSelectBuilder = ({
  data,
  error = null,
}: {
  data: Record<string, unknown> | null;
  error?: { message: string } | null;
}) => {
  const builder = {
    eq: vi.fn(),
    contains: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data, error })),
  };
  builder.eq.mockReturnValue(builder);
  builder.contains.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
};

const createReservationSelectBuilder = ({
  data,
  error = null,
}: {
  data: Record<string, unknown> | null;
  error?: { message: string } | null;
}) => {
  const builder = {
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(async () => ({ data, error })),
  };
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  return builder;
};

const createUpdateBuilder = ({
  data,
  error = null,
}: {
  data: Array<Record<string, unknown>>;
  error?: { message: string } | null;
}) => {
  const builder = {
    eq: vi.fn(),
    is: vi.fn(),
    select: vi.fn(async () => ({ data, error })),
  };
  builder.eq.mockReturnValue(builder);
  builder.is.mockReturnValue(builder);
  return builder;
};

describe("repairGenerationRequestIdFromReservation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupLatestGenerationAttemptMock.mockResolvedValue({ data: null, error: null });
  });

  it("backfills request_id from generation_attempts before falling back to reservations", async () => {
    lookupLatestGenerationAttemptMock.mockResolvedValue({
      data: {
        providerRequestId: "req-attempt-1",
      },
      error: null,
    });
    const generationSelectBuilder = createGenerationSelectBuilder({
      data: {
        id: "gen-1",
        user_id: "user-1",
        request_id: null,
        provider: "fal-ai",
        status: "running",
        recovery_state: "queued",
        recovery_attempts: 1,
        metadata: {
          source_ref: "source-1",
          existing: "value",
        },
      },
    });
    const updateBuilder = createUpdateBuilder({
      data: [{ id: "gen-1", request_id: "req-attempt-1" }],
    });
    const update = vi.fn(() => updateBuilder);
    const from = vi
      .fn()
      .mockImplementationOnce(() => ({
        select: vi.fn(() => generationSelectBuilder),
      }))
      .mockImplementationOnce(() => ({
        update,
      }));
    getSupabaseAdminMock.mockReturnValue({ from });

    await expect(
      repairGenerationRequestIdFromReservation({
        userId: "user-1",
        generationId: "gen-1",
        sourceRef: null,
      })
    ).resolves.toEqual({
      repaired: true,
      generationId: "gen-1",
      requestId: "req-attempt-1",
      sourceRef: "source-1",
      reason: "repaired",
      errorMessage: null,
    });

    expect(lookupLatestGenerationAttemptMock).toHaveBeenCalledWith({
      userId: "user-1",
      generationId: "gen-1",
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-attempt-1",
        metadata: expect.objectContaining({
          provider_request_id: "req-attempt-1",
          request_id_repair_source: "attempt_backfill",
        }),
      })
    );
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("backfills request_id from the reservation for an eligible generation", async () => {
    const generationSelectBuilder = createGenerationSelectBuilder({
      data: {
        id: "gen-1",
        user_id: "user-1",
        request_id: null,
        provider: "fal-ai",
        status: "running",
        recovery_state: "queued",
        recovery_attempts: 1,
        metadata: {
          source_ref: "source-1",
          existing: "value",
        },
      },
    });
    const reservationSelectBuilder = createReservationSelectBuilder({
      data: {
        provider_request_id: "req-1",
      },
    });
    const updateBuilder = createUpdateBuilder({
      data: [{ id: "gen-1", request_id: "req-1" }],
    });
    const update = vi.fn(() => updateBuilder);
    const from = vi
      .fn()
      .mockImplementationOnce(() => ({
        select: vi.fn(() => generationSelectBuilder),
      }))
      .mockImplementationOnce(() => ({
        select: vi.fn(() => reservationSelectBuilder),
      }))
      .mockImplementationOnce(() => ({
        update,
      }));
    getSupabaseAdminMock.mockReturnValue({ from });

    await expect(
      repairGenerationRequestIdFromReservation({
        userId: "user-1",
        generationId: "gen-1",
        sourceRef: null,
      })
    ).resolves.toEqual({
      repaired: true,
      generationId: "gen-1",
      requestId: "req-1",
      sourceRef: "source-1",
      reason: "repaired",
      errorMessage: null,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: "req-1",
        status: "running",
        recovery_state: "queued",
        next_recovery_at: expect.any(String),
        metadata: expect.objectContaining({
          source_ref: "source-1",
          provider_request_id: "req-1",
          request_id_repair_source: "reservation_backfill",
          existing: "value",
        }),
      })
    );
    expect(updateBuilder.is).toHaveBeenCalledWith("request_id", null);
  });

  it("surfaces reservation lookup errors as db errors", async () => {
    const generationSelectBuilder = createGenerationSelectBuilder({
      data: {
        id: "gen-1",
        user_id: "user-1",
        request_id: null,
        provider: "kie",
        status: "submitted",
        recovery_state: "recovering",
        recovery_attempts: 2,
        metadata: {
          source_ref: "source-1",
        },
      },
    });
    const reservationSelectBuilder = createReservationSelectBuilder({
      data: null,
      error: { message: "reservation unavailable" },
    });
    const from = vi
      .fn()
      .mockImplementationOnce(() => ({
        select: vi.fn(() => generationSelectBuilder),
      }))
      .mockImplementationOnce(() => ({
        select: vi.fn(() => reservationSelectBuilder),
      }));
    getSupabaseAdminMock.mockReturnValue({ from });

    await expect(
      repairGenerationRequestIdFromReservation({
        userId: "user-1",
        generationId: "gen-1",
        sourceRef: null,
      })
    ).resolves.toEqual({
      repaired: false,
      generationId: "gen-1",
      requestId: null,
      sourceRef: "source-1",
      reason: "db_error",
      errorMessage: "reservation unavailable",
    });
  });
});
