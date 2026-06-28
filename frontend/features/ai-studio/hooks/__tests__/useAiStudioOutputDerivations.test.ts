import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../../logic/editPromptPolicy";
import type { StudioOutput } from "../../types";
import { useAiStudioOutputDerivations } from "../useAiStudioOutputDerivations";

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: `Prompt ${id}`,
  mode: "image",
  aspect: "1:1",
  model: "Seedream 4.5",
  status: "ready",
  timestamp: "now",
  taskState: "success",
  ...overrides,
});

describe("useAiStudioOutputDerivations", () => {
  it("marks the primary edit stage generating only for hidden nonterminal primary edit image runs", () => {
    const hiddenPendingEdit = makeOutput("hidden-pending", {
      hiddenInReferenceGrid: true,
      taskState: "pending",
    });
    const hiddenRunningEdit = makeOutput("hidden-running", {
      hiddenInReferenceGrid: true,
      taskState: "running",
    });
    const hiddenSucceededEdit = makeOutput("hidden-success", {
      hiddenInReferenceGrid: true,
      taskState: "success",
    });
    const hiddenFailedEdit = makeOutput("hidden-fail", {
      hiddenInReferenceGrid: true,
      taskState: "fail",
    });
    const hiddenBriaEdit = makeOutput("hidden-bria", {
      hiddenInReferenceGrid: true,
      taskState: "running",
      modelId: BRIA_BACKGROUND_REMOVE_MODEL_ID,
    });
    const hiddenVideoRun = makeOutput("hidden-video", {
      hiddenInReferenceGrid: true,
      taskState: "running",
      mode: "video",
    });
    const hiddenGeneratedRemoval = makeOutput("hidden-generated-removal", {
      hiddenInReferenceGrid: true,
      taskState: "pending",
      mediaSource: "generated",
      sourceRef: "source-generated-removal",
    });
    const hiddenGeneratedTaskRemoval = makeOutput("hidden-generated-task-removal", {
      hiddenInReferenceGrid: true,
      taskState: "running",
      mediaSource: "generated",
      taskId: "task-generated-removal",
    });
    const hiddenGeneratedIdRemoval = makeOutput("hidden-generated-id-removal", {
      hiddenInReferenceGrid: true,
      taskState: "pending",
      mediaSource: "generated",
      generationId: "generation-generated-removal",
    });

    const { result, rerender } = renderHook(
      ({ outputs }: { outputs: StudioOutput[] }) =>
        useAiStudioOutputDerivations({
          outputs,
          activeOutputById: {},
          detailOutputId: null,
          model: null,
        }),
      {
        initialProps: {
          outputs: [hiddenPendingEdit],
        },
      }
    );

    expect(result.current.isPrimaryEditStageGenerating).toBe(true);

    rerender({
      outputs: [hiddenRunningEdit],
    });
    expect(result.current.isPrimaryEditStageGenerating).toBe(true);

    rerender({
      outputs: [hiddenSucceededEdit, hiddenFailedEdit, hiddenBriaEdit, hiddenVideoRun],
    });
    expect(result.current.isPrimaryEditStageGenerating).toBe(false);

    rerender({
      outputs: [hiddenGeneratedRemoval, hiddenGeneratedTaskRemoval, hiddenGeneratedIdRemoval],
    });
    expect(result.current.isPrimaryEditStageGenerating).toBe(false);
  });

  it("returns detail output and current model label from canonical inputs only", () => {
    const detailOutput = makeOutput("detail-1");
    const { result } = renderHook(() =>
      useAiStudioOutputDerivations({
        outputs: [detailOutput],
        activeOutputById: { [detailOutput.id]: detailOutput },
        detailOutputId: detailOutput.id,
        model: "fal-ai/seedream/v4.5",
      })
    );

    expect(result.current.detailOutput).toBe(detailOutput);
    expect(result.current.currentModelLabel).toBe("Custom (fal-ai/seedream/v4.5)");
  });

  it("keeps the selected detail output stable when active output indexing briefly misses it", () => {
    const detailOutput = makeOutput("detail-1");
    const { result, rerender } = renderHook(
      ({
        activeOutputById,
        detailOutputId,
      }: {
        activeOutputById: Record<string, StudioOutput>;
        detailOutputId: string | null;
      }) =>
        useAiStudioOutputDerivations({
          outputs: Object.values(activeOutputById),
          activeOutputById,
          detailSelectionTarget: detailOutputId
            ? {
                kind: "studio-output",
                outputId: detailOutputId,
                surface: "reference-grid",
                outputSnapshot: detailOutput,
              }
            : null,
          detailOutputId,
          model: null,
        }),
      {
        initialProps: {
          activeOutputById: { [detailOutput.id]: detailOutput },
          detailOutputId: detailOutput.id as string | null,
        },
      }
    );

    expect(result.current.detailOutput).toBe(detailOutput);

    rerender({
      activeOutputById: {},
      detailOutputId: detailOutput.id,
    });

    expect(result.current.detailOutput).toBe(detailOutput);

    rerender({
      activeOutputById: {},
      detailOutputId: null,
    });

    expect(result.current.detailOutput).toBeNull();
  });
});
