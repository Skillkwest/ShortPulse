import { beforeEach, describe, expect, it, vi } from "vitest";
import { settleGenerationOutcome } from "../generationBilling/settlementService";

const getSupabaseAdminMock = vi.fn();
const captureGenerationReservationByProviderRequestMock = vi.fn();
const releaseGenerationReservationByProviderRequestMock = vi.fn();
const markGenerationReservationSubmittedMock = vi.fn();
const lookupGenerationAttemptByProviderRequestMock = vi.fn();

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../generationBilling/reservationRpcAdapter", () => ({
  captureGenerationReservationByProviderRequest: (...args: unknown[]) =>
    captureGenerationReservationByProviderRequestMock(...args),
  releaseGenerationReservationByProviderRequest: (...args: unknown[]) =>
    releaseGenerationReservationByProviderRequestMock(...args),
  markGenerationReservationSubmitted: (...args: unknown[]) =>
    markGenerationReservationSubmittedMock(...args),
}));

vi.mock("../generationAttempts", () => ({
  lookupGenerationAttemptByProviderRequest: (...args: unknown[]) =>
    lookupGenerationAttemptByProviderRequestMock(...args),
}));

const mockGenerationLookup = ({
  projectionRow = null,
  projectionRows = null,
}: {
  projectionRow?: Record<string, unknown> | null;
  projectionRows?: Record<string, unknown>[] | null;
}) => {
  const projectionMaybeSingleQuery = {
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: projectionRow, error: null }),
  };
  const projectionListQuery = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: projectionRows ?? [], error: null }),
  };

  getSupabaseAdminMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "generation_projection") {
        return {
          select: vi.fn((columns: string) =>
            columns.includes("updated_at") ? projectionListQuery : projectionMaybeSingleQuery
          ),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    }),
  });
};

describe("settleGenerationOutcome linkage repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({ data: null, error: null });
  });

  it("repairs reservation linkage from generation_attempts before projection request lookup", async () => {
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        generationId: "gen-attempt-1",
        userId: "user-1",
      },
      error: null,
    });
    mockGenerationLookup({
      projectionRow: {
        generation_id: "gen-attempt-1",
        source_ref: "source-ref-attempt-1",
        request_id: "req-attempt-1",
      },
    });
    captureGenerationReservationByProviderRequestMock
      .mockResolvedValueOnce({
        status: "not_found",
        sourceRef: null,
        message: null,
        code: null,
      })
      .mockResolvedValueOnce({
        status: "captured",
        sourceRef: "source-ref-attempt-1",
        message: null,
        code: null,
      });
    markGenerationReservationSubmittedMock.mockResolvedValue({
      status: "reserved",
      sourceRef: "source-ref-attempt-1",
      message: null,
      code: null,
    });

    const result = await settleGenerationOutcome({
      userId: "user-1",
      providerRequestId: "req-attempt-1",
      outcome: "success",
      reason: "capture after success",
      routeLabel: "api/fal/status",
      detail: {
        actor: "test",
      },
    });

    expect(result).toEqual({
      settled: true,
      sourceRef: "source-ref-attempt-1",
      note: "captured",
    });
    expect(lookupGenerationAttemptByProviderRequestMock).toHaveBeenCalledWith({
      userId: "user-1",
      providerRequestId: "req-attempt-1",
    });
    expect(markGenerationReservationSubmittedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRef: "source-ref-attempt-1",
        metadata: expect.objectContaining({
          generation_id: "gen-attempt-1",
          repair_source: "settlement_repair",
        }),
      })
    );
  });

  it("repairs reservation linkage from generation_attempt metadata when projection is absent", async () => {
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        generationId: "gen-attempt-metadata-1",
        userId: "user-1",
        providerRequestId: "req-attempt-metadata-1",
        metadata: {
          source_ref: "source-ref-attempt-metadata-1",
        },
      },
      error: null,
    });
    mockGenerationLookup({});
    captureGenerationReservationByProviderRequestMock
      .mockResolvedValueOnce({
        status: "not_found",
        sourceRef: null,
        message: null,
        code: null,
      })
      .mockResolvedValueOnce({
        status: "captured",
        sourceRef: "source-ref-attempt-metadata-1",
        message: null,
        code: null,
      });
    markGenerationReservationSubmittedMock.mockResolvedValue({
      status: "reserved",
      sourceRef: "source-ref-attempt-metadata-1",
      message: null,
      code: null,
    });

    const result = await settleGenerationOutcome({
      userId: "user-1",
      providerRequestId: "req-attempt-metadata-1",
      outcome: "success",
      reason: "capture after success",
      routeLabel: "api/fal/status",
      detail: {
        actor: "test",
      },
    });

    expect(result).toEqual({
      settled: true,
      sourceRef: "source-ref-attempt-metadata-1",
      note: "captured",
    });
    expect(markGenerationReservationSubmittedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sourceRef: "source-ref-attempt-metadata-1",
        providerRequestId: "req-attempt-metadata-1",
        metadata: expect.objectContaining({
          generation_id: "gen-attempt-metadata-1",
          repair_source: "settlement_repair",
        }),
      })
    );
    expect(captureGenerationReservationByProviderRequestMock).toHaveBeenCalledTimes(2);
  });

  it("repairs reservation linkage from provider_request_id projection before request_id projection lookup", async () => {
    mockGenerationLookup({
      projectionRows: [
        {
          generation_id: "gen-provider-1",
          source_ref: "source-ref-provider-1",
          request_id: null,
        },
      ],
    });
    captureGenerationReservationByProviderRequestMock
      .mockResolvedValueOnce({
        status: "not_found",
        sourceRef: null,
        message: null,
        code: null,
      })
      .mockResolvedValueOnce({
        status: "captured",
        sourceRef: "source-ref-provider-1",
        message: null,
        code: null,
      });
    markGenerationReservationSubmittedMock.mockResolvedValue({
      status: "reserved",
      sourceRef: "source-ref-provider-1",
      message: null,
      code: null,
    });

    const result = await settleGenerationOutcome({
      userId: "user-1",
      providerRequestId: "req-provider-1",
      outcome: "success",
      reason: "capture after success",
      routeLabel: "api/fal/status",
      detail: {
        actor: "test",
      },
    });

    expect(result).toEqual({
      settled: true,
      sourceRef: "source-ref-provider-1",
      note: "captured",
    });
    expect(markGenerationReservationSubmittedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceRef: "source-ref-provider-1",
        providerRequestId: "req-provider-1",
        metadata: expect.objectContaining({
          generation_id: "gen-provider-1",
          repair_source: "settlement_repair",
        }),
      })
    );
  });

  it("repairs reservation linkage from generation_projection before retrying capture", async () => {
    mockGenerationLookup({
      projectionRows: [
        {
          generation_id: "gen-1",
          source_ref: "source-ref-1",
          request_id: "req-1",
        },
      ],
    });
    captureGenerationReservationByProviderRequestMock
      .mockResolvedValueOnce({
        status: "not_found",
        sourceRef: null,
        message: null,
        code: null,
      })
      .mockResolvedValueOnce({
        status: "captured",
        sourceRef: "source-ref-1",
        message: null,
        code: null,
      });
    markGenerationReservationSubmittedMock.mockResolvedValue({
      status: "reserved",
      sourceRef: "source-ref-1",
      message: null,
      code: null,
    });

    const result = await settleGenerationOutcome({
      userId: "user-1",
      providerRequestId: "req-1",
      outcome: "success",
      reason: "capture after success",
      routeLabel: "api/fal/status",
      detail: {
        actor: "test",
      },
    });

    expect(result).toEqual({
      settled: true,
      sourceRef: "source-ref-1",
      note: "captured",
    });
    expect(markGenerationReservationSubmittedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sourceRef: "source-ref-1",
        providerRequestId: "req-1",
        metadata: expect.objectContaining({
          repair_source: "settlement_repair",
          generation_id: "gen-1",
        }),
      })
    );
    expect(captureGenerationReservationByProviderRequestMock).toHaveBeenCalledTimes(2);
  });

  it("does not repair reservation linkage from legacy ai_generations metadata", async () => {
    mockGenerationLookup({
      projectionRows: [
        {
          generation_id: "gen-2",
          source_ref: null,
          request_id: "req-2",
        },
      ],
    });
    releaseGenerationReservationByProviderRequestMock.mockResolvedValueOnce({
      status: "not_found",
      sourceRef: null,
      message: null,
      code: null,
    });
    markGenerationReservationSubmittedMock.mockResolvedValue({
      status: "reserved",
      sourceRef: "source-ref-2",
      message: null,
      code: null,
    });

    const result = await settleGenerationOutcome({
      userId: "user-1",
      providerRequestId: "req-2",
      outcome: "fail",
      reason: "release after failure",
      routeLabel: "api/fal/status",
      detail: {
        actor: "test",
      },
    });

    expect(result).toEqual({
      settled: false,
      sourceRef: null,
      note: "not_found",
    });
    expect(markGenerationReservationSubmittedMock).not.toHaveBeenCalled();
    expect(releaseGenerationReservationByProviderRequestMock).toHaveBeenCalledTimes(1);
  });
});
