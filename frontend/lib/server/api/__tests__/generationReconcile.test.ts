import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  normalizeGenerationReconcileIdentities,
  reconcileVisibleProjectGenerationsForUser,
  reconcileVisibleGenerationsForUser,
} from "../generationReconcile";

const executeGenerationRecoveryMock = vi.fn();
const getProjectForUserMock = vi.fn();
const resolveGenerationLineageBySourceRefMock = vi.fn();
const fromMock = vi.fn();

vi.mock("../../projectsService", () => ({
  getProjectForUser: (...args: unknown[]) => getProjectForUserMock(...args),
}));

vi.mock("../generationLineageResolver", () => ({
  resolveGenerationLineageBySourceRef: (...args: unknown[]) =>
    resolveGenerationLineageBySourceRefMock(...args),
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
    resolveGenerationLineageBySourceRefMock.mockResolvedValue(null);
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

  it("keeps reconciling later identities when one recovery attempt fails", async () => {
    executeGenerationRecoveryMock.mockRejectedValueOnce(new Error("schema cache exploded"));

    const result = await reconcileVisibleGenerationsForUser({
      userId: "user-1",
      identities: [
        { generationId: "generation-failing", requestId: "request-failing", sourceRef: null },
        { generationId: "generation-ok", requestId: "request-ok", sourceRef: null },
      ],
    });

    expect(executeGenerationRecoveryMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      attempted: 2,
      results: [
        {
          generationId: "generation-failing",
          requestId: "request-failing",
          sourceRef: null,
          state: "skipped",
          ok: false,
          mediaFileIds: [],
          mediaUrls: [],
          note: "reconcile_error: schema cache exploded",
        },
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

  it("resolves source refs through shared lineage before recovery", async () => {
    resolveGenerationLineageBySourceRefMock.mockResolvedValueOnce({
      generationId: "generation-from-projection",
      requestId: "request-from-projection",
      sourceRef: "source-1",
    });

    await reconcileVisibleGenerationsForUser({
      userId: "user-1",
      identities: [{ generationId: null, requestId: null, sourceRef: "source-1" }],
    });

    expect(resolveGenerationLineageBySourceRefMock).toHaveBeenCalledWith({
      userId: "user-1",
      sourceRef: "source-1",
    });
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith({
      actor: "user_reconcile",
      generationId: "generation-from-projection",
      requestId: "request-from-projection",
      userId: "user-1",
      routeLabel: "generation.reconcile",
    });
  });

  it("uses shared lineage metadata fallback results when projection is absent", async () => {
    resolveGenerationLineageBySourceRefMock.mockResolvedValueOnce({
      generationId: "generation-from-metadata",
      requestId: "request-from-metadata",
      sourceRef: "source-1",
    });

    await reconcileVisibleGenerationsForUser({
      userId: "user-1",
      identities: [{ generationId: null, requestId: null, sourceRef: "source-1" }],
    });

    expect(fromMock).not.toHaveBeenCalled();
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith({
      actor: "user_reconcile",
      generationId: "generation-from-metadata",
      requestId: "request-from-metadata",
      userId: "user-1",
      routeLabel: "generation.reconcile",
    });
  });

  it("reconciles project-bound in-flight generations even when projection visibility is hidden", async () => {
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
    expect(executeGenerationRecoveryMock).toHaveBeenCalledTimes(3);
    expect(executeGenerationRecoveryMock).toHaveBeenNthCalledWith(1, {
      actor: "user_reconcile",
      generationId: "generation-hidden",
      requestId: "request-hidden",
      userId: "user-1",
      routeLabel: "generation.reconcile",
    });
    expect(executeGenerationRecoveryMock).toHaveBeenNthCalledWith(2, {
      actor: "user_reconcile",
      generationId: "generation-associated",
      requestId: "request-associated",
      userId: "user-1",
      routeLabel: "generation.reconcile",
    });
    expect(executeGenerationRecoveryMock).toHaveBeenNthCalledWith(3, {
      actor: "user_reconcile",
      generationId: "generation-direct",
      requestId: "request-direct",
      userId: "user-1",
      routeLabel: "generation.reconcile",
    });
    expect(result.attempted).toBe(3);
  });

  it("reconciles hidden legacy user-abandoned project generations from project association", async () => {
    const associationBuilder = createGenerationSelectBuilder([
      { generation_id: "generation-associated", updated_at: "2026-06-08T00:03:00.000Z" },
    ]);
    const emptyProjectionBuilder = createGenerationSelectBuilder([]);
    const associatedGenerationRowsBuilder = createGenerationSelectBuilder([
      {
        id: "generation-associated",
        request_id: "request-associated",
        status: "fail",
        recovery_state: "exhausted",
        failure_reason_code: "user_abandoned",
        metadata: {
          source_ref: "source-associated",
          user_abandoned: true,
          hidden_in_reference_grid: true,
        },
        updated_at: "2026-06-08T00:04:00.000Z",
      },
    ]);
    const metadataProjectRowsBuilder = createGenerationSelectBuilder([]);
    let projectionCallCount = 0;
    let aiGenerationCallCount = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "project_generation_items") return associationBuilder;
      if (table === "generation_projection") {
        projectionCallCount += 1;
        return emptyProjectionBuilder;
      }
      if (table === "ai_generations") {
        aiGenerationCallCount += 1;
        return aiGenerationCallCount === 1
          ? associatedGenerationRowsBuilder
          : metadataProjectRowsBuilder;
      }
      return createGenerationSelectBuilder();
    });

    const result = await reconcileVisibleProjectGenerationsForUser({
      userId: "user-1",
      projectId: "project-1",
    });

    expect(projectionCallCount).toBe(2);
    expect(associatedGenerationRowsBuilder.in).toHaveBeenCalledWith("id", [
      "generation-associated",
    ]);
    expect(associatedGenerationRowsBuilder.select).toHaveBeenCalledWith(
      expect.not.stringContaining("metadata")
    );
    expect(executeGenerationRecoveryMock).toHaveBeenCalledTimes(1);
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith({
      actor: "user_reconcile",
      generationId: "generation-associated",
      requestId: "request-associated",
      userId: "user-1",
      routeLabel: "generation.reconcile",
    });
    expect(result.attempted).toBe(1);
  });

  it("reconciles hidden legacy user-abandoned project generations from direct project projection", async () => {
    const associationBuilder = createGenerationSelectBuilder([]);
    const directProjectionBuilder = createGenerationSelectBuilder([
      {
        generation_id: "generation-direct-legacy",
        request_id: "request-direct-legacy",
        source_ref: "source-direct-legacy",
        task_state: "fail",
        hidden_in_reference_grid: true,
        reference_grid_visible: false,
        updated_at: "2026-06-08T00:05:00.000Z",
      },
    ]);
    const directGenerationRowsBuilder = createGenerationSelectBuilder([
      {
        id: "generation-direct-legacy",
        request_id: "request-direct-legacy",
        status: "fail",
        recovery_state: "exhausted",
        failure_reason_code: "user_abandoned",
        metadata: {
          source_ref: "source-direct-legacy",
          user_abandoned: true,
          hidden_in_reference_grid: true,
        },
        updated_at: "2026-06-08T00:04:00.000Z",
      },
    ]);
    let aiGenerationCallCount = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "project_generation_items") return associationBuilder;
      if (table === "generation_projection") return directProjectionBuilder;
      if (table === "ai_generations") {
        aiGenerationCallCount += 1;
        return aiGenerationCallCount === 3
          ? directGenerationRowsBuilder
          : createGenerationSelectBuilder([]);
      }
      return createGenerationSelectBuilder();
    });

    const result = await reconcileVisibleProjectGenerationsForUser({
      userId: "user-1",
      projectId: "project-1",
    });

    expect(directGenerationRowsBuilder.in).toHaveBeenCalledWith("id", ["generation-direct-legacy"]);
    expect(executeGenerationRecoveryMock).toHaveBeenCalledTimes(1);
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith({
      actor: "user_reconcile",
      generationId: "generation-direct-legacy",
      requestId: "request-direct-legacy",
      userId: "user-1",
      routeLabel: "generation.reconcile",
    });
    expect(result.attempted).toBe(1);
  });

  it("reconciles project generations from camelCase shortpulse metadata", async () => {
    const associationBuilder = createGenerationSelectBuilder([]);
    const directProjectionBuilder = createGenerationSelectBuilder([]);
    const camelMetadataRowsBuilder = createGenerationSelectBuilder([
      {
        id: "generation-camel-metadata",
        request_id: "request-camel-metadata",
        status: "running",
        recovery_state: "queued",
        failure_reason_code: null,
        metadata: {
          source_ref: "source-camel-metadata",
          shortpulseContext: {
            projectId: "project-1",
          },
        },
        updated_at: "2026-06-08T00:04:00.000Z",
      },
    ]);
    let aiGenerationCallCount = 0;
    fromMock.mockImplementation((table: string) => {
      if (table === "project_generation_items") return associationBuilder;
      if (table === "generation_projection") return directProjectionBuilder;
      if (table === "ai_generations") {
        aiGenerationCallCount += 1;
        return aiGenerationCallCount === 2
          ? camelMetadataRowsBuilder
          : createGenerationSelectBuilder([]);
      }
      return createGenerationSelectBuilder();
    });

    const result = await reconcileVisibleProjectGenerationsForUser({
      userId: "user-1",
      projectId: "project-1",
    });

    expect(camelMetadataRowsBuilder.filter).toHaveBeenCalledWith(
      "metadata->shortpulseContext->>projectId",
      "eq",
      "project-1"
    );
    expect(camelMetadataRowsBuilder.select).toHaveBeenCalledWith(
      expect.not.stringContaining("metadata")
    );
    expect(executeGenerationRecoveryMock).toHaveBeenCalledTimes(1);
    expect(executeGenerationRecoveryMock).toHaveBeenCalledWith({
      actor: "user_reconcile",
      generationId: "generation-camel-metadata",
      requestId: "request-camel-metadata",
      userId: "user-1",
      routeLabel: "generation.reconcile",
    });
    expect(result.attempted).toBe(1);
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
