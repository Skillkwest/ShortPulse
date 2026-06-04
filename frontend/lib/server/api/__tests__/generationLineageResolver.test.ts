import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveGenerationLineageByProviderRequest } from "../generationLineageResolver";

const lookupGenerationAttemptByProviderRequestMock = vi.fn();
const readGenerationProjectionLinkByGenerationIdMock = vi.fn();
const readGenerationProjectionLinkByProviderRequestIdMock = vi.fn();
const readGenerationProjectionLinkByRequestIdMock = vi.fn();

vi.mock("../generationAttempts", () => ({
  lookupGenerationAttemptByProviderRequest: (...args: unknown[]) =>
    lookupGenerationAttemptByProviderRequestMock(...args),
}));

vi.mock("../generationProjection", () => ({
  readGenerationProjectionLinkByGenerationId: (...args: unknown[]) =>
    readGenerationProjectionLinkByGenerationIdMock(...args),
  readGenerationProjectionLinkByProviderRequestId: (...args: unknown[]) =>
    readGenerationProjectionLinkByProviderRequestIdMock(...args),
  readGenerationProjectionLinkByRequestId: (...args: unknown[]) =>
    readGenerationProjectionLinkByRequestIdMock(...args),
}));

describe("resolveGenerationLineageByProviderRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({ data: null, error: null });
    readGenerationProjectionLinkByGenerationIdMock.mockResolvedValue(null);
    readGenerationProjectionLinkByProviderRequestIdMock.mockResolvedValue(null);
    readGenerationProjectionLinkByRequestIdMock.mockResolvedValue(null);
  });

  it("uses generation_attempts before projection repair evidence", async () => {
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        generationId: "gen-attempt-1",
      },
      error: null,
    });
    readGenerationProjectionLinkByGenerationIdMock.mockResolvedValue({
      generationId: "gen-attempt-1",
      sourceRef: "source-ref-attempt-1",
      requestId: "req-attempt-1",
    });

    await expect(
      resolveGenerationLineageByProviderRequest({
        providerRequestId: " req-attempt-1 ",
        userId: "user-1",
      })
    ).resolves.toEqual({
      generationId: "gen-attempt-1",
      generationAttemptId: null,
      userId: null,
      sourceRef: "source-ref-attempt-1",
      requestId: "req-attempt-1",
      providerRequestId: "req-attempt-1",
      evidence: ["generation_attempt", "projection_generation_id"],
      attemptLookupError: null,
    });
    expect(lookupGenerationAttemptByProviderRequestMock).toHaveBeenCalledWith({
      providerRequestId: "req-attempt-1",
      userId: "user-1",
    });
  });

  it("uses provider_request_id projection before request_id projection", async () => {
    readGenerationProjectionLinkByProviderRequestIdMock.mockResolvedValue({
      generationId: "gen-provider-1",
      sourceRef: "source-ref-provider-1",
      requestId: null,
    });
    readGenerationProjectionLinkByRequestIdMock.mockResolvedValue({
      generationId: "gen-request-1",
      sourceRef: "source-ref-request-1",
      requestId: "req-provider-1",
    });

    await expect(
      resolveGenerationLineageByProviderRequest({
        providerRequestId: "req-provider-1",
        userId: "user-1",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        generationId: "gen-provider-1",
        sourceRef: "source-ref-provider-1",
        evidence: ["projection_provider_request_id"],
      })
    );
    expect(readGenerationProjectionLinkByRequestIdMock).not.toHaveBeenCalled();
  });

  it("accepts provider_request_id projection lineage even when source_ref is absent", async () => {
    readGenerationProjectionLinkByProviderRequestIdMock.mockResolvedValue({
      generationId: "gen-provider-no-source-1",
      sourceRef: null,
      requestId: "req-provider-no-source-1",
    });

    await expect(
      resolveGenerationLineageByProviderRequest({
        providerRequestId: "req-provider-no-source-1",
        userId: "user-1",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        generationId: "gen-provider-no-source-1",
        sourceRef: null,
        requestId: "req-provider-no-source-1",
        evidence: ["projection_provider_request_id"],
      })
    );
    expect(readGenerationProjectionLinkByRequestIdMock).not.toHaveBeenCalled();
  });

  it("can resolve only canonical attempt lineage for recovery lookups", async () => {
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        generationId: "gen-recovery-1",
      },
      error: null,
    });

    await expect(
      resolveGenerationLineageByProviderRequest({
        providerRequestId: "req-recovery-1",
        userId: null,
        includeProjection: false,
      })
    ).resolves.toEqual({
      generationId: "gen-recovery-1",
      generationAttemptId: null,
      userId: null,
      sourceRef: null,
      requestId: null,
      providerRequestId: "req-recovery-1",
      evidence: ["generation_attempt"],
      attemptLookupError: null,
    });
    expect(readGenerationProjectionLinkByGenerationIdMock).not.toHaveBeenCalled();
    expect(readGenerationProjectionLinkByProviderRequestIdMock).not.toHaveBeenCalled();
    expect(readGenerationProjectionLinkByRequestIdMock).not.toHaveBeenCalled();
  });

  it("throws attempt lookup errors when recovery requires strict authority", async () => {
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: null,
      error: {
        code: "42P01",
        message: "relation generation_attempts does not exist",
      },
    });

    await expect(
      resolveGenerationLineageByProviderRequest({
        providerRequestId: "req-error-1",
        throwOnAttemptLookupError: true,
      })
    ).rejects.toThrow("relation generation_attempts does not exist");
  });
});
