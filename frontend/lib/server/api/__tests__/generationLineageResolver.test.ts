import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveGenerationLineageByProviderRequest,
  resolveGenerationLineageBySourceRef,
} from "../generationLineageResolver";

const lookupGenerationAttemptByProviderRequestMock = vi.fn();
const readGenerationProjectionLinkByGenerationIdMock = vi.fn();
const readGenerationProjectionLinkByProviderRequestIdMock = vi.fn();
const readGenerationProjectionLinkByRequestIdMock = vi.fn();
const readGenerationProjectionLinkBySourceRefMock = vi.fn();
const getSupabaseAdminMock = vi.fn();

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
  readGenerationProjectionLinkBySourceRef: (...args: unknown[]) =>
    readGenerationProjectionLinkBySourceRefMock(...args),
}));

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: (...args: unknown[]) => getSupabaseAdminMock(...args),
}));

const createMockSupabase = ({
  generationData = null,
}: {
  generationData?: {
    id: string;
    user_id?: string | null;
    model_id?: string | null;
    request_id?: string | null;
    source_ref?: string | null;
    metadata?: Record<string, unknown> | null;
  } | null;
} = {}) => {
  const generationBuilder: Record<string, unknown> = {};
  generationBuilder.eq = vi.fn(() => generationBuilder);
  generationBuilder.filter = vi.fn(() => generationBuilder);
  generationBuilder.order = vi.fn(() => generationBuilder);
  generationBuilder.limit = vi.fn(() => generationBuilder);
  generationBuilder.maybeSingle = vi.fn(async () => ({
    data: generationData
      ? {
          ...generationData,
          source_ref:
            generationData.source_ref ??
            (typeof generationData.metadata?.source_ref === "string"
              ? generationData.metadata.source_ref
              : null),
        }
      : null,
    error: null,
  }));

  return {
    from: vi.fn((tableName: string) => {
      if (tableName === "ai_generations") {
        return { select: vi.fn(() => generationBuilder) };
      }
      throw new Error(`Unexpected table ${tableName}`);
    }),
  };
};

describe("resolveGenerationLineageByProviderRequest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({ data: null, error: null });
    readGenerationProjectionLinkByGenerationIdMock.mockResolvedValue(null);
    readGenerationProjectionLinkByProviderRequestIdMock.mockResolvedValue(null);
    readGenerationProjectionLinkByRequestIdMock.mockResolvedValue(null);
    readGenerationProjectionLinkBySourceRefMock.mockResolvedValue(null);
    getSupabaseAdminMock.mockReturnValue(createMockSupabase());
  });

  it("uses generation_attempts before projection repair evidence", async () => {
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        generationId: "gen-attempt-1",
        providerRequestId: "req-attempt-1",
        metadata: {
          source_ref: "source-ref-attempt-metadata-1",
        },
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
      modelId: null,
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

  it("passes injected Supabase admin clients through provider-request lineage", async () => {
    const injectedSupabase = createMockSupabase();
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        generationId: "gen-attempt-1",
      },
      error: null,
    });

    await expect(
      resolveGenerationLineageByProviderRequest({
        providerRequestId: "req-attempt-1",
        userId: "user-1",
        includeProjection: false,
        supabaseAdmin: injectedSupabase as never,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        generationId: "gen-attempt-1",
        evidence: ["generation_attempt"],
      })
    );
    expect(lookupGenerationAttemptByProviderRequestMock).toHaveBeenCalledWith({
      providerRequestId: "req-attempt-1",
      userId: "user-1",
      supabaseAdmin: injectedSupabase,
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

  it("uses ai_generations request_id lifecycle evidence before projection repair evidence", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createMockSupabase({
        generationData: {
          id: "gen-request-shell-1",
          user_id: "user-1",
          model_id: "model-1",
          request_id: "req-shell-1",
        },
      })
    );
    readGenerationProjectionLinkByProviderRequestIdMock.mockResolvedValue({
      generationId: "gen-projection-1",
      sourceRef: "source-ref-projection-1",
      requestId: "req-shell-1",
    });

    await expect(
      resolveGenerationLineageByProviderRequest({
        providerRequestId: "req-shell-1",
        userId: "user-1",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        generationId: "gen-request-shell-1",
        userId: "user-1",
        modelId: "model-1",
        requestId: "req-shell-1",
        evidence: ["generation_request_id"],
      })
    );
    expect(readGenerationProjectionLinkByProviderRequestIdMock).not.toHaveBeenCalled();
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
        providerRequestId: "req-recovery-1",
        metadata: {
          source_ref: "source-ref-recovery-1",
        },
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
      modelId: null,
      sourceRef: "source-ref-recovery-1",
      requestId: "req-recovery-1",
      providerRequestId: "req-recovery-1",
      evidence: ["generation_attempt"],
      attemptLookupError: null,
    });
    expect(readGenerationProjectionLinkByGenerationIdMock).not.toHaveBeenCalled();
    expect(readGenerationProjectionLinkByProviderRequestIdMock).not.toHaveBeenCalled();
    expect(readGenerationProjectionLinkByRequestIdMock).not.toHaveBeenCalled();
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("preserves attempt request and source lineage when projection is absent", async () => {
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        id: "attempt-1",
        generationId: "gen-attempt-1",
        userId: "user-1",
        modelId: "model-1",
        providerRequestId: "req-attempt-1",
        metadata: {
          source_ref: "source-ref-attempt-1",
        },
      },
      error: null,
    });

    await expect(
      resolveGenerationLineageByProviderRequest({
        providerRequestId: "req-attempt-1",
        userId: "user-1",
      })
    ).resolves.toEqual({
      generationId: "gen-attempt-1",
      generationAttemptId: "attempt-1",
      userId: "user-1",
      modelId: "model-1",
      sourceRef: "source-ref-attempt-1",
      requestId: "req-attempt-1",
      providerRequestId: "req-attempt-1",
      evidence: ["generation_attempt"],
      attemptLookupError: null,
    });
  });

  it("does not let provider-request projection override canonical attempt lineage", async () => {
    lookupGenerationAttemptByProviderRequestMock.mockResolvedValue({
      data: {
        id: "attempt-1",
        generationId: "gen-attempt-1",
        userId: "user-1",
        modelId: "model-1",
        providerRequestId: "req-attempt-1",
        metadata: {
          source_ref: "source-ref-attempt-1",
        },
      },
      error: null,
    });
    readGenerationProjectionLinkByGenerationIdMock.mockResolvedValue(null);
    readGenerationProjectionLinkByProviderRequestIdMock.mockResolvedValue({
      generationId: "gen-projection-drift-1",
      sourceRef: "source-ref-projection-drift-1",
      requestId: "req-attempt-1",
    });

    await expect(
      resolveGenerationLineageByProviderRequest({
        providerRequestId: "req-attempt-1",
        userId: "user-1",
      })
    ).resolves.toEqual({
      generationId: "gen-attempt-1",
      generationAttemptId: "attempt-1",
      userId: "user-1",
      modelId: "model-1",
      sourceRef: "source-ref-attempt-1",
      requestId: "req-attempt-1",
      providerRequestId: "req-attempt-1",
      evidence: ["generation_attempt"],
      attemptLookupError: null,
    });
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

describe("resolveGenerationLineageBySourceRef", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readGenerationProjectionLinkBySourceRefMock.mockResolvedValue(null);
    getSupabaseAdminMock.mockReturnValue(createMockSupabase());
  });

  it("prefers projection source-ref lineage before caller-owned metadata", async () => {
    readGenerationProjectionLinkBySourceRefMock.mockResolvedValue({
      generationId: "gen-projection-source-1",
      sourceRef: "source-ref-1",
      requestId: "req-projection-source-1",
    });
    getSupabaseAdminMock.mockReturnValue(
      createMockSupabase({
        generationData: {
          id: "gen-metadata-source-1",
          user_id: "user-1",
          model_id: "model-1",
          request_id: "req-metadata-source-1",
          metadata: { source_ref: "source-ref-1" },
        },
      })
    );

    await expect(
      resolveGenerationLineageBySourceRef({
        sourceRef: " source-ref-1 ",
        userId: " user-1 ",
      })
    ).resolves.toEqual({
      generationId: "gen-projection-source-1",
      generationAttemptId: null,
      userId: "user-1",
      modelId: null,
      sourceRef: "source-ref-1",
      requestId: "req-projection-source-1",
      providerRequestId: "",
      evidence: ["projection_source_ref"],
      attemptLookupError: null,
    });
    expect(readGenerationProjectionLinkBySourceRefMock).toHaveBeenCalledWith({
      userId: "user-1",
      sourceRef: "source-ref-1",
    });
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });

  it("uses projection source-ref lineage when canonical metadata is absent", async () => {
    readGenerationProjectionLinkBySourceRefMock.mockResolvedValue({
      generationId: "gen-projection-source-1",
      sourceRef: "source-ref-1",
      requestId: "req-projection-source-1",
    });

    await expect(
      resolveGenerationLineageBySourceRef({
        sourceRef: "source-ref-1",
        userId: "user-1",
      })
    ).resolves.toEqual({
      generationId: "gen-projection-source-1",
      generationAttemptId: null,
      userId: "user-1",
      modelId: null,
      sourceRef: "source-ref-1",
      requestId: "req-projection-source-1",
      providerRequestId: "",
      evidence: ["projection_source_ref"],
      attemptLookupError: null,
    });
    expect(readGenerationProjectionLinkBySourceRefMock).toHaveBeenCalledWith({
      userId: "user-1",
      sourceRef: "source-ref-1",
    });
  });

  it("uses caller-owned ai_generations source-ref metadata", async () => {
    getSupabaseAdminMock.mockReturnValue(
      createMockSupabase({
        generationData: {
          id: "gen-metadata-source-1",
          user_id: "user-1",
          model_id: "model-1",
          request_id: "req-metadata-source-1",
          metadata: { source_ref: "source-ref-1" },
        },
      })
    );

    await expect(
      resolveGenerationLineageBySourceRef({
        sourceRef: "source-ref-1",
        userId: "user-1",
      })
    ).resolves.toEqual({
      generationId: "gen-metadata-source-1",
      generationAttemptId: null,
      userId: "user-1",
      modelId: "model-1",
      sourceRef: "source-ref-1",
      requestId: "req-metadata-source-1",
      providerRequestId: "",
      evidence: ["generation_source_ref"],
      attemptLookupError: null,
    });

    const supabase = getSupabaseAdminMock.mock.results[0]?.value;
    expect(supabase.from).toHaveBeenCalledWith("ai_generations");
  });

  it("uses an injected Supabase admin client for source-ref lookups", async () => {
    const injectedSupabase = createMockSupabase({
      generationData: {
        id: "gen-injected-source-1",
        user_id: "user-1",
        model_id: "model-1",
        request_id: "req-injected-source-1",
        metadata: { source_ref: "source-ref-1" },
      },
    });

    await expect(
      resolveGenerationLineageBySourceRef({
        sourceRef: "source-ref-1",
        userId: "user-1",
        includeProjection: false,
        supabaseAdmin: injectedSupabase as never,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        generationId: "gen-injected-source-1",
        evidence: ["generation_source_ref"],
      })
    );
    expect(getSupabaseAdminMock).not.toHaveBeenCalled();
  });
});
