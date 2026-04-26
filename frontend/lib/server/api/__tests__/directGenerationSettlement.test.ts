import { beforeEach, describe, expect, it, vi } from "vitest";

const readRecoveryGenerationRowMock = vi.fn();
const settleGenerationOutcomeMock = vi.fn();
const lookupGenerationAttemptByProviderRequestMock = vi.fn();
const persistGenerationOutputRecordsMock = vi.fn();
const applyGenerationLifecycleTransitionMock = vi.fn();
const upsertGenerationProjectionMock = vi.fn();
const upsertGenerationPublicationMock = vi.fn();
const updateGenerationEqMock = vi.fn();
const updateGenerationUpdateMock = vi.fn();

vi.mock("../../falIntegration/recoveryGenerationLookup", () => ({
  readRecoveryGenerationRow: (...args: unknown[]) => readRecoveryGenerationRowMock(...args),
}));

vi.mock("../generationBilling", () => ({
  settleGenerationOutcome: (...args: unknown[]) => settleGenerationOutcomeMock(...args),
}));

vi.mock("../generationAttempts", () => ({
  lookupGenerationAttemptByProviderRequest: (...args: unknown[]) =>
    lookupGenerationAttemptByProviderRequestMock(...args),
}));

vi.mock("../generationOutputs", () => ({
  persistGenerationOutputRecords: (...args: unknown[]) =>
    persistGenerationOutputRecordsMock(...args),
}));

vi.mock("../generationLifecycleTransitionService", () => ({
  applyGenerationLifecycleTransition: (...args: unknown[]) =>
    applyGenerationLifecycleTransitionMock(...args),
}));

vi.mock("../generationProjection", () => ({
  upsertGenerationProjection: (...args: unknown[]) => upsertGenerationProjectionMock(...args),
}));

vi.mock("../generationPublications", () => ({
  upsertGenerationPublication: (...args: unknown[]) => upsertGenerationPublicationMock(...args),
}));

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn(() => ({
      update: updateGenerationUpdateMock,
    })),
  }),
}));

import {
  settleDirectGenerationFailure,
  settleDirectGenerationSuccess,
} from "../directGenerationSettlement";

describe("directGenerationSettlement", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    updateGenerationEqMock.mockReturnThis();
    updateGenerationUpdateMock.mockReturnValue({
      eq: updateGenerationEqMock,
    });
    updateGenerationEqMock.mockResolvedValue({ error: null });

    readRecoveryGenerationRowMock.mockResolvedValue({
      id: "gen-1",
      user_id: "user-1",
      request_id: "req-1",
      provider: "fal",
      model_id: "fal-ai/nano-banana",
      prompt_text: "portrait",
      created_at: "2026-04-26T00:00:00.000Z",
      metadata: {
        source_ref: "source-ref-1",
        hidden_in_reference_grid: true,
        generation_replay: { input: "value" },
        character_context: { characterId: "char-1" },
        style_context: { styleId: "style-1" },
      },
    });
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        id: "attempt-1",
      },
      error: null,
    });
    applyGenerationLifecycleTransitionMock.mockResolvedValue({ ok: true });
    persistGenerationOutputRecordsMock.mockResolvedValue([
      {
        id: "output-1",
        resultUrl: "https://provider.example/out-1.png",
      },
      {
        id: "output-2",
        resultUrl: "https://provider.example/out-2.png",
      },
    ]);
    upsertGenerationPublicationMock.mockResolvedValue(undefined);
    upsertGenerationProjectionMock.mockResolvedValue(undefined);
    settleGenerationOutcomeMock.mockResolvedValue(undefined);
  });

  it("persists direct terminal success using provider result URLs and published projection state", async () => {
    const result = await settleDirectGenerationSuccess({
      generationId: "gen-1",
      requestId: "req-1",
      userId: "user-1",
      routeLabel: "test/direct-success",
      providerState: "COMPLETED",
      resultUrls: [
        "https://provider.example/out-1.png",
        "   ",
        "https://provider.example/out-2.png",
      ],
    });

    expect(result).toEqual({
      ok: true,
      generationId: "gen-1",
      requestId: "req-1",
    });
    expect(persistGenerationOutputRecordsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        generationAttemptId: "attempt-1",
        providerRequestId: "req-1",
        resultUrls: ["https://provider.example/out-1.png", "https://provider.example/out-2.png"],
        mediaFileIds: [],
      })
    );
    expect(upsertGenerationPublicationMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        generationId: "gen-1",
        generationOutputId: "output-1",
        userId: "user-1",
        generationAttemptId: "attempt-1",
        publicationState: "published",
        previewUrl: "https://provider.example/out-1.png",
        fullUrl: "https://provider.example/out-1.png",
        visibleInReferenceGrid: false,
      })
    );
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        requestId: "req-1",
        taskState: "success",
        queueState: "dispatched",
        publicationState: "published",
        previewUrl: "https://provider.example/out-1.png",
        resultUrls: ["https://provider.example/out-1.png", "https://provider.example/out-2.png"],
        savedMediaIds: [],
        hiddenInReferenceGrid: true,
        referenceGridVisible: false,
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        providerRequestId: "req-1",
        outcome: "success",
      })
    );
  });

  it("suppresses publications and projection output on direct terminal failure", async () => {
    const result = await settleDirectGenerationFailure({
      generationId: "gen-1",
      requestId: "req-1",
      userId: "user-1",
      routeLabel: "test/direct-failure",
      providerState: "FAILED",
      errorMessage: "Provider rejected request",
      errorDetail: { reason: "bad_input" },
      failureReasonCode: "provider_error",
    });

    expect(result).toEqual({
      ok: true,
      generationId: "gen-1",
      requestId: "req-1",
    });
    expect(persistGenerationOutputRecordsMock).not.toHaveBeenCalled();
    expect(upsertGenerationPublicationMock).not.toHaveBeenCalled();
    expect(upsertGenerationProjectionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "gen-1",
        userId: "user-1",
        requestId: "req-1",
        taskState: "fail",
        queueState: "failed",
        publicationState: "suppressed",
        resultUrls: [],
        savedMediaIds: [],
        errorMessage: "Provider rejected request",
        errorMessageShort: "Provider rejected request",
        errorDetail: JSON.stringify({ reason: "bad_input" }),
      })
    );
    expect(settleGenerationOutcomeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        providerRequestId: "req-1",
        outcome: "fail",
        reason: "Provider rejected request",
      })
    );
  });
});
