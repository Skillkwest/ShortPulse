import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ToolId } from "../../types";
import { useAiStudioPageDerivations } from "../useAiStudioPageDerivations";

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioPageDerivations>[0]> = {}
): Parameters<typeof useAiStudioPageDerivations>[0] => ({
  mode: "image",
  selectedTool: "create",
  model: "fal-ai/bytedance/seedream/v4.5/edit",
  aspect: "1:1",
  prompt: "base prompt",
  editReferenceText: "edit prompt",
  videoReferenceText: "video prompt",
  videoReferenceMode: "standard",
  ...overrides,
});

describe("useAiStudioPageDerivations", () => {
  it("routes prompt defaults by selected tool", () => {
    const { result, rerender } = renderHook(
      ({ selectedTool }: { selectedTool: ToolId | null }) =>
        useAiStudioPageDerivations(createParams({ selectedTool })),
      { initialProps: { selectedTool: "create" as ToolId } }
    );

    expect(result.current.promptForViewModel).toBe("base prompt");
    expect(result.current.resolveDefaultPromptForTool("edit")).toBe("edit prompt");

    rerender({ selectedTool: "video" });
    expect(result.current.promptForViewModel).toBe("video prompt");
    expect(result.current.resolveDefaultPromptForTool("kling")).toBe("video prompt");
  });

  it("marks template view for coming-soon tools", () => {
    const { result, rerender } = renderHook(
      ({ selectedTool }: { selectedTool: ToolId | null }) =>
        useAiStudioPageDerivations(createParams({ selectedTool })),
      { initialProps: { selectedTool: "create" as ToolId } }
    );

    expect(result.current.isTemplateView).toBe(false);
    rerender({ selectedTool: "templates" });
    expect(result.current.isTemplateView).toBe(true);
  });

  it("applies modelId/defaults/overrides in cost params", () => {
    const { result } = renderHook(() =>
      useAiStudioPageDerivations(createParams({ aspect: "16:9" }))
    );

    const params = result.current.costParamsForModel({ durationSeconds: 8 });
    expect(params.modelId).toBe("fal-ai/bytedance/seedream/v4.5/edit");
    expect(params.aspect).toBe("16:9");
    expect(params.durationSeconds).toBe(8);
  });

  it("uses shared create/image model policy and excludes flux-2-pro", () => {
    const { result } = renderHook(() =>
      useAiStudioPageDerivations(
        createParams({
          mode: "image",
          selectedTool: "create",
          videoReferenceMode: "standard",
        })
      )
    );

    const values = new Set(result.current.filteredModelOptions.map((option) => option.value));
    expect(values.has("fal/flux-2-pro")).toBe(false);
    expect(values.has("fal-ai/bytedance/seedream/v4.5/text-to-image")).toBe(true);
  });
});
