import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput, ToolId } from "../../types";
import { useAiStudioGenerationPromptComposer } from "../useAiStudioGenerationPromptComposer";

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioGenerationPromptComposer>[0]> = {}
): Parameters<typeof useAiStudioGenerationPromptComposer>[0] => ({
  model: "fal/flux-2",
  prompt: "base prompt",
  editReferenceText: "edit prompt",
  videoReferenceText: "video prompt",
  selectedTool: "create",
  videoReferenceMode: "standard",
  useReferenceImageIndicator: false,
  activeOutputPreviewUrl: null,
  resolveReferenceInputsForTool: vi.fn(() => ({
    referenceImageUrl: "https://example.com/ref.png",
    extraImageUrls: [
      "https://example.com/extra-1.png",
      "https://example.com/extra-2.png",
      null,
    ] as [string | null, string | null, string | null],
  })),
  submitTask: vi.fn(),
  ...overrides,
});

describe("useAiStudioGenerationPromptComposer", () => {
  it("prefers explicit submission/display overrides and passes submit options", () => {
    const submitTask = vi.fn();
    const params = createParams({ submitTask });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.generateOutput("prompt override", {
        modeOverride: "video",
        selectedToolOverride: "video",
        displayPromptOverride: "display prompt",
        submissionPromptOverride: "submission prompt",
        referenceInputsOverride: ["https://example.com/override.png"],
        characterContextOverride: {
          applied: true,
          characterId: "char-1",
          characterName: "A",
          characterProfileImageUrl: null,
        } as StudioOutput["characterContext"],
      });
    });

    expect(submitTask).toHaveBeenCalledWith(
      "submission prompt",
      ["https://example.com/override.png", "https://example.com/ref.png"],
      {
        modeOverride: "video",
        selectedToolOverride: "video",
        displayPromptOverride: "display prompt",
        characterContextOverride: {
          applied: true,
          characterId: "char-1",
          characterName: "A",
          characterProfileImageUrl: null,
        },
        modelIdOverride: undefined,
      }
    );
  });

  it("keeps base reference inputs when override list is empty", () => {
    const submitTask = vi.fn();
    const params = createParams({ submitTask });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.generateOutput("prompt override", {
        referenceInputsOverride: [],
      });
    });

    expect(submitTask).toHaveBeenCalledWith(
      "prompt override",
      [
        "https://example.com/ref.png",
        "https://example.com/extra-1.png",
        "https://example.com/extra-2.png",
      ],
      expect.objectContaining({ displayPromptOverride: "prompt override" })
    );
  });

  it("forwards selected style context metadata to submission options", () => {
    const submitTask = vi.fn();
    const params = createParams({
      submitTask,
      selectedStyleContext: {
        applied: true,
        styleId: "style-cinematic",
        styleName: "Cinematic",
        stylePrompt: "cinematic teal-and-amber treatment",
      },
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.generateOutput("prompt override");
    });

    expect(submitTask).toHaveBeenCalledWith(
      "prompt override",
      [
        "https://example.com/ref.png",
        "https://example.com/extra-1.png",
        "https://example.com/extra-2.png",
      ],
      expect.objectContaining({
        displayPromptOverride: "prompt override",
        styleContextOverride: {
          applied: true,
          styleId: "style-cinematic",
          styleName: "Cinematic",
          stylePrompt: "cinematic teal-and-amber treatment",
        },
      })
    );
  });

  it("does not forward style context metadata for video tools", () => {
    const submitTask = vi.fn();
    const params = createParams({
      submitTask,
      selectedTool: "video",
      selectedStyleContext: {
        applied: true,
        styleId: "style-cinematic",
        styleName: "Cinematic",
        stylePrompt: "cinematic teal-and-amber treatment",
      },
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.generateOutput("prompt override");
    });

    expect(submitTask).toHaveBeenCalledWith(
      "prompt override",
      ["https://example.com/ref.png"],
      expect.not.objectContaining({
        styleContextOverride: expect.anything(),
      })
    );
  });

  it("uses video prompt and single primary input for standard video mode", () => {
    const submitTask = vi.fn();
    const resolveReferenceInputsForTool = vi.fn(() => ({
      referenceImageUrl: "https://example.com/video-ref.png",
      extraImageUrls: [
        "https://example.com/video-extra-1.png",
        "https://example.com/video-extra-2.png",
        null,
      ] as [string | null, string | null, string | null],
    }));
    const params = createParams({
      submitTask,
      selectedTool: "video",
      videoReferenceMode: "standard",
      resolveReferenceInputsForTool,
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.generateOutput();
    });

    expect(resolveReferenceInputsForTool).toHaveBeenCalledWith("video");
    expect(submitTask).toHaveBeenCalledWith("video prompt", ["https://example.com/video-ref.png"], {
      modeOverride: undefined,
      selectedToolOverride: undefined,
      displayPromptOverride: "video prompt",
      characterContextOverride: undefined,
      modelIdOverride: undefined,
    });
  });

  it("forwards output id overrides to submission for optimistic placeholder reuse", () => {
    const submitTask = vi.fn();
    const params = createParams({ submitTask });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.generateOutput("prompt override", {
        outputIdOverride: "out-optimistic",
      });
    });

    expect(submitTask).toHaveBeenCalledWith(
      "prompt override",
      [
        "https://example.com/ref.png",
        "https://example.com/extra-1.png",
        "https://example.com/extra-2.png",
      ],
      expect.objectContaining({ outputIdOverride: "out-optimistic" })
    );
  });

  it("allows regenerate submit when prompt is empty", () => {
    const submitTask = vi.fn();
    const params = createParams({
      submitTask,
      prompt: "",
      editReferenceText: "",
      videoReferenceText: "",
      selectedTool: "create",
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.regenerateOutput();
    });

    expect(submitTask).toHaveBeenCalledWith(
      "",
      [
        "https://example.com/ref.png",
        "https://example.com/extra-1.png",
        "https://example.com/extra-2.png",
      ],
      {
        displayPromptOverride: "",
        characterContextOverride: undefined,
        modelIdOverride: undefined,
      }
    );
  });

  it("builds regenerate reference pool using active preview for non-image/video tools", () => {
    const submitTask = vi.fn();
    const resolveReferenceInputsForTool = vi.fn((tool: ToolId | null) => ({
      referenceImageUrl: tool ? "https://example.com/ref.png" : null,
      extraImageUrls: ["https://example.com/extra.png", null, null] as [
        string | null,
        string | null,
        string | null,
      ],
    }));
    const params = createParams({
      submitTask,
      selectedTool: "create",
      prompt: "  keep me  ",
      useReferenceImageIndicator: true,
      activeOutputPreviewUrl: "https://example.com/active.png",
      resolveReferenceInputsForTool,
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.regenerateOutput();
    });

    expect(resolveReferenceInputsForTool).toHaveBeenCalledWith("create");
    expect(submitTask).toHaveBeenCalledWith(
      "keep me",
      [
        "https://example.com/active.png",
        "https://example.com/ref.png",
        "https://example.com/extra.png",
      ],
      {
        displayPromptOverride: "keep me",
        characterContextOverride: undefined,
        modelIdOverride: undefined,
      }
    );
  });

  it("forwards model override to submission payload", () => {
    const submitTask = vi.fn();
    const params = createParams({ submitTask });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.generateOutput("prompt override", {
        modelIdOverride: "fal-ai/nano-banana-pro/edit",
      });
    });

    expect(submitTask).toHaveBeenCalledWith(
      "prompt override",
      [
        "https://example.com/ref.png",
        "https://example.com/extra-1.png",
        "https://example.com/extra-2.png",
      ],
      expect.objectContaining({ modelIdOverride: "fal-ai/nano-banana-pro/edit" })
    );
  });

  it("appends selected style prompt to submission text while keeping display prompt unchanged", () => {
    const submitTask = vi.fn();
    const params = createParams({
      selectedTool: "create",
      selectedStylePrompt: "cinematic editorial photography style, moody lighting",
      submitTask,
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.generateOutput("Visible user prompt");
    });

    expect(submitTask).toHaveBeenCalledWith(
      "Visible user prompt\n\nVisual style reference: cinematic editorial photography style, moody lighting",
      [
        "https://example.com/ref.png",
        "https://example.com/extra-1.png",
        "https://example.com/extra-2.png",
      ],
      expect.objectContaining({ displayPromptOverride: "Visible user prompt" })
    );
  });

  it("uses Nano Banana family style phrasing when effective model is Nano Banana", () => {
    const submitTask = vi.fn();
    const params = createParams({
      model: "fal-ai/nano-banana-pro/edit",
      selectedTool: "edit",
      selectedStylePrompt: "sun-washed editorial look",
      submitTask,
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.generateOutput("Tune style");
    });

    expect(submitTask).toHaveBeenCalledWith(
      "Tune style\n\nVisual style reference (treatment only): sun-washed editorial look. Preserve subject identity and base composition.",
      [
        "https://example.com/ref.png",
        "https://example.com/extra-1.png",
        "https://example.com/extra-2.png",
      ],
      expect.objectContaining({ displayPromptOverride: "Tune style" })
    );
  });

  it("uses Seedream family phrasing when regenerate model override targets Seedream", () => {
    const submitTask = vi.fn();
    const params = createParams({
      model: "fal-ai/nano-banana-pro/edit",
      selectedTool: "edit",
      selectedStylePrompt: "cool cinematic grade",
      submitTask,
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.regenerateOutput({
        displayPromptOverride: "Refine this frame",
        modelIdOverride: "fal-ai/bytedance/seedream/v4.5/edit",
      });
    });

    expect(submitTask).toHaveBeenCalledWith(
      "Refine this frame\n\nVisual style reference: cool cinematic grade. Emphasize cohesive palette, lighting mood, and surface texture.",
      [
        "https://example.com/ref.png",
        "https://example.com/extra-1.png",
        "https://example.com/extra-2.png",
      ],
      expect.objectContaining({
        displayPromptOverride: "Refine this frame",
        modelIdOverride: "fal-ai/bytedance/seedream/v4.5/edit",
      })
    );
  });

  it("keeps legacy style line when family adapter flag is disabled", () => {
    const previousFlag = process.env.NEXT_PUBLIC_AI_STUDIO_STYLE_FAMILY_ADAPTER_ENABLED;
    process.env.NEXT_PUBLIC_AI_STUDIO_STYLE_FAMILY_ADAPTER_ENABLED = "false";
    try {
      const submitTask = vi.fn();
      const params = createParams({
        model: "fal-ai/nano-banana/edit",
        selectedTool: "edit",
        selectedStylePrompt: "moody studio lighting",
        submitTask,
      });
      const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

      act(() => {
        result.current.generateOutput("Refine scene");
      });

      expect(submitTask).toHaveBeenCalledWith(
        "Refine scene\n\nVisual style reference: moody studio lighting",
        [
          "https://example.com/ref.png",
          "https://example.com/extra-1.png",
          "https://example.com/extra-2.png",
        ],
        expect.objectContaining({ displayPromptOverride: "Refine scene" })
      );
    } finally {
      if (previousFlag === undefined) {
        delete process.env.NEXT_PUBLIC_AI_STUDIO_STYLE_FAMILY_ADAPTER_ENABLED;
      } else {
        process.env.NEXT_PUBLIC_AI_STUDIO_STYLE_FAMILY_ADAPTER_ENABLED = previousFlag;
      }
    }
  });

  it("does not append selected style prompt for video submissions", () => {
    const submitTask = vi.fn();
    const params = createParams({
      selectedTool: "video",
      selectedStylePrompt: "cinematic editorial photography style, moody lighting",
      submitTask,
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.generateOutput("Video visible prompt");
    });

    expect(submitTask).toHaveBeenCalledWith(
      "Video visible prompt",
      ["https://example.com/ref.png"],
      expect.objectContaining({ displayPromptOverride: "Video visible prompt" })
    );
  });
});
