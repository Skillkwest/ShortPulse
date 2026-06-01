import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  resolveGenerationProjectionLifecycle,
  resolveVisibleGenerationReconcile,
} from "../../../logic/generatedMediaAuthority";
import {
  resolveProjectionFailureMessage,
  resolveVisibleGenerationSettle,
} from "../visibleGenerationSettle";

vi.mock("../../../logic/generatedMediaAuthority", () => ({
  resolveGenerationProjectionLifecycle: vi.fn(),
  resolveVisibleGenerationReconcile: vi.fn(),
}));

describe("visibleGenerationSettle", () => {
  const resolveGenerationProjectionLifecycleMock = vi.mocked(resolveGenerationProjectionLifecycle);
  const resolveVisibleGenerationReconcileMock = vi.mocked(resolveVisibleGenerationReconcile);

  beforeEach(() => {
    vi.resetAllMocks();
    resolveGenerationProjectionLifecycleMock.mockResolvedValue(null);
    resolveVisibleGenerationReconcileMock.mockResolvedValue(null);
  });

  it("returns hidden_or_failed when projection lifecycle fails", async () => {
    resolveGenerationProjectionLifecycleMock.mockResolvedValue({
      generationId: "gen-1",
      taskState: "fail",
      queueState: undefined,
      hiddenInReferenceGrid: false,
      referenceGridVisible: true,
      errorMessageShort: "Generation failed hard.",
      errorDetail: "Generation failed hard with provider detail.",
    });

    await expect(
      resolveVisibleGenerationSettle({
        generationId: "gen-1",
        requestId: "task-1",
        sourceRef: "source-1",
        projectId: "project-1",
      })
    ).resolves.toMatchObject({
      kind: "hidden_or_failed",
      projectionLifecycle: expect.objectContaining({
        generationId: "gen-1",
        taskState: "fail",
      }),
      failure: {
        message: "Generation failed hard.",
        detail: "Generation failed hard with provider detail.",
        shortMessage: "Generation failed hard.",
      },
    });

    expect(resolveVisibleGenerationReconcileMock).not.toHaveBeenCalled();
  });

  it("returns unresolved when projection lifecycle is non-terminal and visible reconcile misses", async () => {
    resolveGenerationProjectionLifecycleMock.mockResolvedValue({
      generationId: "gen-1",
      taskState: "running",
      queueState: "dispatching",
      hiddenInReferenceGrid: false,
      referenceGridVisible: true,
      errorMessageShort: null,
      errorDetail: null,
    });

    await expect(
      resolveVisibleGenerationSettle({
        generationId: "gen-1",
        requestId: "task-1",
      })
    ).resolves.toEqual({
      kind: "unresolved",
    });
  });

  it("returns visible when reconcile resolves canonical delivery", async () => {
    resolveGenerationProjectionLifecycleMock.mockResolvedValue({
      generationId: "gen-1",
      taskState: "running",
      queueState: "dispatching",
      hiddenInReferenceGrid: false,
      referenceGridVisible: true,
      errorMessageShort: null,
      errorDetail: null,
    });
    resolveVisibleGenerationReconcileMock.mockResolvedValue({
      generationId: "gen-1",
      previewUrl: "https://cdn.example.com/generated.png",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      resultUrls: ["https://cdn.example.com/generated.png"],
    });

    await expect(
      resolveVisibleGenerationSettle({
        requestId: "task-1",
      })
    ).resolves.toEqual({
      kind: "visible",
      visibleGeneration: {
        generationId: "gen-1",
        previewUrl: "https://cdn.example.com/generated.png",
        previewStoragePath: "user-1/generated/preview.png",
        fullStoragePath: "user-1/generated/full.png",
        resultUrls: ["https://cdn.example.com/generated.png"],
      },
    });
  });

  it("builds short projection failure copy for shared callers", () => {
    expect(
      resolveProjectionFailureMessage({
        generationId: "gen-1",
        taskState: "fail",
        queueState: undefined,
        hiddenInReferenceGrid: false,
        referenceGridVisible: true,
        errorMessageShort: "The provider rejected the request after moderation review.",
        errorDetail: null,
      })
    ).toEqual({
      message: "The provider rejected the request after moderation review.",
      detail: "The provider rejected the request after moderation review.",
      shortMessage: "Content not allowed",
    });
  });
});
