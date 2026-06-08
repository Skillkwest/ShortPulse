import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeGenerationReconcileIdentities,
  reconcileVisibleProjectGenerationsForUser,
  reconcileVisibleGenerationsForUser,
} from "../generationReconcile";

const executeGenerationRecoveryMock = vi.fn();
const getProjectForUserMock = vi.fn();
const readGenerationProjectionLinkBySourceRefMock = vi.fn();
const fromMock = vi.fn();

vi.mock("../../projectsService", () => ({
  getProjectForUser: (...args: unknown[]) => getProjectForUserMock(...args),
}));

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

const createGenerationSelectBuilder = (data: unknown[] = [], error: unknown = null) => {
  type GenerationSelectBuilder = {
    select: ReturnType<typeof vi.fn>;
    eq: ReturnType<typeof vi.fn>;
    filter: ReturnType<typeof vi.fn>;
    in: ReturnType<typeof vi.fn>;
    order: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  };
  const builder: GenerationSelectBuilder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    filter: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(async () => ({ data, error })),
  };
  return builder;
};

describe("generationReconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getProjectForUserMock.mockResolvedValue({
      id: "project-1",
      title: "Project 1",
      createdAt: "2026-06-08T00:00:00.000Z",
      updatedAt: "2026-06-08T00:00:00.000Z",
    });
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

  it("reconciles visible in-flight generations by owned project when the client has no runtime identities", async () => {
    const associationBuilder = createGenerationSelectBuilder([
      { generation_id: "generation-associated", updated_at: "2026-06-08T00:03:00.000Z" },
    ]);
    const directProjectionBuilder = createGenerationSelectBuilder([
      {
        generation_id: "generation-direct",
        request_id: "request-direct",
        source_ref: "source-direct",
        task_state: "running",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
        updated_at: "2026-06-08T00:02:00.000Z",
      },
      {
        generation_id: "generation-hidden",
        request_id: "request-hidden",
        task_state: "running",
        hidden_in_reference_grid: true,
        reference_grid_visible: true,
        updated_at: "2026-06-08T00:04:00.000Z",
      },
    ]);
    const associatedProjectionBuilder = createGenerationSelectBuilder([
      {
        generation_id: "generation-associated",
        request_id: "request-associated",
        source_ref: "source-associated",
        task_state: "pending",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
        updated_at: "2026-06-08T00:01:00.000Z",
      },
    ]);
    fromMock.mockImplementation((table: string) => {
      if (table === "project_generation_items") return associationBuilder;
      if (table === "generation_projection") {
        return fromMock.mock.calls.filter(([name]) => name === "generation_projection").length === 1
          ? directProjectionBuilder
          : associatedProjectionBuilder;
      }
      return createGenerationSelectBuilder();
    });

    const result = await reconcileVisibleProjectGenerationsForUser({
      userId: "user-1",
      projectId: "project-1",
    });

    expect(getProjectForUserMock).toHaveBeenCalledWith({
      userId: "user-1",
      projectId: "project-1",
    });
    expect(associationBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(associationBuilder.eq).toHaveBeenCalledWith("project_id", "project-1");
    expect(directProjectionBuilder.eq).toHaveBeenCalledWith("project_id", "project-1");
    expect(associatedProjectionBuilder.in).toHaveBeenCalledWith("generation_id", [
      "generation-associated",
    ]);
    expect(executeGenerationRecoveryMock).toHaveBeenCalledTimes(2);
    expect(executeGenerationRecoveryMock).toHaveBeenNthCalledWith(1, {
      actor: "user_reconcile",
      generationId: "generation-associated",
      requestId: "request-associated",
      userId: "user-1",
      routeLabel: "generation.reconcile",
    });
    expect(executeGenerationRecoveryMock).toHaveBeenNthCalledWith(2, {
      actor: "user_reconcile",
      generationId: "generation-direct",
      requestId: "request-direct",
      userId: "user-1",
      routeLabel: "generation.reconcile",
    });
    expect(result.attempted).toBe(2);
  });

  it("still reconciles direct project projection rows when project associations are unavailable", async () => {
    const associationBuilder = createGenerationSelectBuilder([], {
      message: "project_generation_items unavailable",
    });
    const directProjectionBuilder = createGenerationSelectBuilder([
      {
        generation_id: "generation-direct",
        request_id: "request-direct",
        task_state: "running",
        hidden_in_reference_grid: false,
        reference_grid_visible: true,
        updated_at: "2026-06-08T00:02:00.000Z",
      },
    ]);
    fromMock.mockImplementation((table: string) => {
      if (table === "project_generation_items") return associationBuilder;
      if (table === "generation_projection") return directProjectionBuilder;
      return createGenerationSelectBuilder();
    });

    const result = await reconcileVisibleProjectGenerationsForUser({
      userId: "user-1",
      projectId: "project-1",
    });

    expect(executeGenerationRecoveryMock).toHaveBeenCalledTimes(1);
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith({
      actor: "user_reconcile",
      generationId: "generation-direct",
      requestId: "request-direct",
      userId: "user-1",
      routeLabel: "generation.reconcile",
    });
    expect(result.attempted).toBe(1);
  });

  it("does not reconcile project generations when the authenticated user does not own the project", async () => {
    getProjectForUserMock.mockResolvedValueOnce(null);

    const result = await reconcileVisibleProjectGenerationsForUser({
      userId: "user-1",
      projectId: "project-other",
    });

    expect(result).toEqual({
      attempted: 0,
      results: [],
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(executeGenerationRecoveryMock).not.toHaveBeenCalled();
  });
});
