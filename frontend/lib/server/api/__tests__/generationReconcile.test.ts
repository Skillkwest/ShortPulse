import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeGenerationReconcileIdentities,
  reconcileVisibleGenerationsForUser,
} from "../generationReconcile";

const executeGenerationRecoveryMock = vi.fn();
const readGenerationProjectionLinkBySourceRefMock = vi.fn();
const fromMock = vi.fn();

vi.mock("../generationProjection", () => ({
  readGenerationProjectionLinkBySourceRef: (...args: unknown[]) =>
    readGenerationProjectionLinkBySourceRefMock(...args),
}));

vi.mock("../supabaseAdmin", () => ({
  getSupabaseAdmin: () => ({
    from: (...args: unknown[]) => fromMock(...args),
  }),
}));

vi.mock("../../falIntegration/recoveryExecution", () => ({
  executeGenerationRecovery: (...args: unknown[]) => executeGenerationRecoveryMock(...args),
}));

const createGenerationSelectBuilder = (data: unknown[] = []) => {
  type GenerationSelectBuilder = {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    filter: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  };
  const builder: GenerationSelectBuilder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    filter: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(async () => ({ data, error: null })),
  };
  return builder;
};

describe("generationReconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    readGenerationProjectionLinkBySourceRefMock.mockResolvedValue(null);
    fromMock.mockReturnValue(createGenerationSelectBuilder());
    executeGenerationRecoveryMock.mockResolvedValue({
      ok: true,
      state: "recovered",
      generationId: "generation-1",
      requestId: "request-1",
      mediaFileIds: ["media-1"],
      mediaUrls: ["https://cdn.example.com/result.png"],
    });
  });

  it("normalizes and bounds runtime identities", () => {
    const identities = normalizeGenerationReconcileIdentities([
      { generationId: " generation-1 ", requestId: "request-1" },
      { generationId: " generation-1 ", requestId: "request-1" },
      { sourceRef: "source-2" },
      { requestId: "request-3" },
      { generationId: "generation-4" },
      { generationId: "generation-5" },
      { generationId: "generation-6" },
      { generationId: "generation-7" },
    ]);

    expect(identities).toEqual([
      { generationId: "generation-1", requestId: "request-1", sourceRef: null },
      { generationId: null, requestId: null, sourceRef: "source-2" },
      { generationId: null, requestId: "request-3", sourceRef: null },
      { generationId: "generation-4", requestId: null, sourceRef: null },
      { generationId: "generation-5", requestId: null, sourceRef: null },
      { generationId: "generation-6", requestId: null, sourceRef: null },
    ]);
  });

  it("passes authenticated user ownership into shared recovery", async () => {
    const result = await reconcileVisibleGenerationsForUser({
      userId: "user-1",
      identities: [{ generationId: "generation-1", requestId: "request-1", sourceRef: null }],
    });

    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith({
      actor: "user_reconcile",
      generationId: "generation-1",
      requestId: "request-1",
      userId: "user-1",
      routeLabel: "generation.reconcile",
    });
    expect(result).toEqual({
      attempted: 1,
      results: [
        {
          generationId: "generation-1",
          requestId: "request-1",
          sourceRef: null,
          state: "recovered",
          ok: true,
          mediaFileIds: ["media-1"],
          mediaUrls: ["https://cdn.example.com/result.png"],
          note: undefined,
        },
      ],
    });
  });

  it("resolves source refs through projection before recovery", async () => {
    readGenerationProjectionLinkBySourceRefMock.mockResolvedValueOnce({
      generationId: "generation-from-projection",
      requestId: "request-from-projection",
      sourceRef: "source-1",
    });

    await reconcileVisibleGenerationsForUser({
      userId: "user-1",
      identities: [{ generationId: null, requestId: null, sourceRef: "source-1" }],
    });

    expect(readGenerationProjectionLinkBySourceRefMock).toHaveBeenCalledWith({
      userId: "user-1",
      sourceRef: "source-1",
    });
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-from-projection",
        userId: "user-1",
      })
    );
  });

  it("falls back to ai_generations source_ref metadata when projection is absent", async () => {
    fromMock.mockReturnValueOnce(
      createGenerationSelectBuilder([{ id: "generation-from-metadata" }])
    );

    await reconcileVisibleGenerationsForUser({
      userId: "user-1",
      identities: [{ generationId: null, requestId: null, sourceRef: "source-1" }],
    });

    expect(fromMock).toHaveBeenCalledWith("ai_generations");
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        generationId: "generation-from-metadata",
        userId: "user-1",
      })
    );
  });
});
