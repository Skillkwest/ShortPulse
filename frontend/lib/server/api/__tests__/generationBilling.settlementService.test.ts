import { beforeEach, describe, expect, it, vi } from "vitest";
import { settleGenerationOutcome } from "../generationBilling/settlementService";

const insertCreditLedgerEntryMock = vi.fn();
const getSupabaseAdminMock = vi.fn();
const readFalRuntimeFlagsMock = vi.fn();
const captureGenerationReservationByProviderRequestMock = vi.fn();
const releaseGenerationReservationByProviderRequestMock = vi.fn();
const markGenerationReservationSubmittedMock = vi.fn();
const lookupGenerationAttemptByProviderRequestMock = vi.fn();

vi.mock("../creditLedger", () => ({
  insertCreditLedgerEntry: (...args: unknown[]) => insertCreditLedgerEntryMock(...args),
}));

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

vi.mock("../falRuntimeFlags", () => ({
  readFalRuntimeFlags: (...args: unknown[]) => readFalRuntimeFlagsMock(...args),
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

const mockGenerationLookup = (row: Record<string, unknown> | null) => {
  const query = {
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  };
  getSupabaseAdminMock.mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue(query),
    }),
  });
};

describe("settleGenerationOutcome linkage repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertCreditLedgerEntryMock.mockResolvedValue({ error: null });
    readFalRuntimeFlagsMock.mockReturnValue({
      directDebitFallbackEnabled: false,
    });
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({ data: null, error: null });
  });

  it("repairs reservation linkage from generation_attempts before falling back to legacy request lookup", async () => {
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        generationId: "gen-attempt-1",
        userId: "user-1",
      },
      error: null,
    });
    mockGenerationLookup({
      id: "gen-attempt-1",
      metadata: {
        source_ref: "source-ref-attempt-1",
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
          repair_source: "settlement_fallback",
        }),
      })
    );
  });

  it("repairs reservation linkage from ai_generations metadata before retrying capture", async () => {
    mockGenerationLookup({
      id: "gen-1",
      metadata: {
        source_ref: "source-ref-1",
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
          repair_source: "settlement_fallback",
          generation_id: "gen-1",
        }),
      })
    );
    expect(captureGenerationReservationByProviderRequestMock).toHaveBeenCalledTimes(2);
  });

  it("repairs reservation linkage from ai_generations metadata before retrying release", async () => {
    mockGenerationLookup({
      id: "gen-2",
      metadata: {
        source_ref: "source-ref-2",
      },
    });
    releaseGenerationReservationByProviderRequestMock
      .mockResolvedValueOnce({
        status: "not_found",
        sourceRef: null,
        message: null,
        code: null,
      })
      .mockResolvedValueOnce({
        status: "released",
        sourceRef: "source-ref-2",
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
      settled: true,
      sourceRef: "source-ref-2",
      note: "released",
    });
    expect(markGenerationReservationSubmittedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sourceRef: "source-ref-2",
        providerRequestId: "req-2",
      })
    );
    expect(releaseGenerationReservationByProviderRequestMock).toHaveBeenCalledTimes(2);
  });
});
