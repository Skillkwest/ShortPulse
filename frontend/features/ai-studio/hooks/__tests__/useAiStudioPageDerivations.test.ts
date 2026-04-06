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
  referenceImageUrl: null,
  extraImageUrls: [null, null, null],
  isCharacterModeEnabled: false,
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
    rerender({ selectedTool: "canvas" });
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

  it("keeps create/text mode filtered to create-compatible image models", () => {
    const { result } = renderHook(() =>
      useAiStudioPageDerivations(
        createParams({
          mode: "text",
          selectedTool: "create",
          videoReferenceMode: "standard",
        })
      )
    );

    const values = new Set(result.current.filteredModelOptions.map((option) => option.value));
    expect(values.has("fal-ai/bytedance/seedream/v4.5/text-to-image")).toBe(true);
    expect(values.has("fal-ai/veo3.1/image-to-video")).toBe(false);
    expect(values.has("fal-ai/bytedance/seedream/v4.5/edit")).toBe(false);
  });

  it("hides FLUX.2 Lite in create/image options when character mode is enabled", () => {
    const { result } = renderHook(() =>
      useAiStudioPageDerivations(
        createParams({
          mode: "image",
          selectedTool: "create",
          isCharacterModeEnabled: true,
        })
      )
    );

    const values = new Set(result.current.filteredModelOptions.map((option) => option.value));
    expect(values).toEqual(
      new Set([
        "fal-ai/bytedance/seedream/v4.5/edit",
        "fal-ai/bytedance/seedream/v5/lite/edit",
        "fal-ai/nano-banana-2/edit",
        "fal-ai/nano-banana-pro/edit",
      ])
    );
  });

  it("keeps standard video options open to text-to-video models", () => {
    const { result } = renderHook(() =>
      useAiStudioPageDerivations(
        createParams({
          mode: "video",
          selectedTool: "video",
          videoReferenceMode: "standard",
        })
      )
    );

    const values = new Set(result.current.filteredModelOptions.map((option) => option.value));
    expect(values.has("fal-ai/veo3.1")).toBe(false);
    expect(values.has("kie-ai/veo-3.1-fast-i2v")).toBe(true);
    expect(values.has("fal-ai/kling-video/v3/pro/text-to-video")).toBe(true);
    expect(values.has("fal-ai/sora-2/text-to-video/pro")).toBe(true);
    expect(values.has("fal-ai/bytedance/seedance/v1.5/pro/text-to-video")).toBe(true);
  });

  it("narrows video options to single-image models when exactly one frame is present", () => {
    const { result } = renderHook(() =>
      useAiStudioPageDerivations(
        createParams({
          mode: "video",
          selectedTool: "video",
          referenceImageUrl: "https://example.com/first.png",
          extraImageUrls: [null, null, null],
        })
      )
    );

    const values = new Set(result.current.filteredModelOptions.map((option) => option.value));
    expect(values.has("fal-ai/veo3.1/image-to-video")).toBe(false);
    expect(values.has("kie-ai/veo-3.1-fast-i2v")).toBe(true);
    expect(values.has("fal-ai/kling-video/v3/pro/image-to-video")).toBe(true);
    expect(values.has("fal-ai/veo3.1")).toBe(false);
    expect(values.has("fal-ai/sora-2/text-to-video/pro")).toBe(false);
  });

  it("narrows video options to first-last-capable models when two frames are present", () => {
    const { result } = renderHook(() =>
      useAiStudioPageDerivations(
        createParams({
          mode: "video",
          selectedTool: "video",
          referenceImageUrl: "https://example.com/first.png",
          extraImageUrls: ["https://example.com/last.png", null, null],
        })
      )
    );

    const values = new Set(result.current.filteredModelOptions.map((option) => option.value));
    expect(values).toEqual(new Set(["kie-ai/veo-3.1-fast-i2v"]));
  });

  it("hides Fal.ai chips when Kling 3.0 is the active video model", () => {
    const { result } = renderHook(() =>
      useAiStudioPageDerivations(
        createParams({
          mode: "video",
          selectedTool: "video",
          model: "kie-ai/kling-3.0",
          videoReferenceMode: "standard",
        })
      )
    );

    const values = new Set(result.current.filteredModelOptions.map((option) => option.value));
    expect(values.has("fal-ai/veo3.1")).toBe(false);
    expect(values.has("fal-ai/veo3.1/image-to-video")).toBe(false);
    expect(values.has("fal-ai/bytedance/seedance/v1.5/pro/text-to-video")).toBe(false);
    expect(values.has("kie-ai/kling-3.0")).toBe(true);
    expect(values.has("kie-ai/veo-3.1-fast-i2v")).toBe(true);
  });
});
