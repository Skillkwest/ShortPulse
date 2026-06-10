import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInternalMediaRef } from "../../../../lib/media/internalMediaRefs";
import { KIE_VEO_31_FAST_I2V_MODEL_ID } from "../../../../lib/model-runtime/providerModelIds";
import type { StudioOutput, ToolId } from "../../types";
import { useAiStudioGenerationPromptComposer } from "../useAiStudioGenerationPromptComposer";

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioGenerationPromptComposer>[0]> = {}
): Parameters<typeof useAiStudioGenerationPromptComposer>[0] => ({
  model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
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
      [
        "https://example.com/override.png",
        "https://example.com/ref.png",
        "https://example.com/extra-1.png",
      ],
      expect.objectContaining({
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
      })
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

  it("forwards internal media refs for generate when character references have no URL inputs", () => {
    const submitTask = vi.fn();
    const internalRef = createInternalMediaRef({ storagePath: "user/chars/char-ref.png" });
    const params = createParams({
      submitTask,
      resolveReferenceInputsForTool: vi.fn(() => ({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null] as [string | null, string | null, string | null],
      })),
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.generateOutput("Visible prompt", {
        selectedToolOverride: "create",
        modelIdOverride: "fal-ai/nano-banana-2/edit",
        referenceInputsOverride: [],
        internalMediaRefsOverride: [internalRef],
      });
    });

    expect(submitTask).toHaveBeenCalledWith(
      "Visible prompt",
      [],
      expect.objectContaining({
        selectedToolOverride: "create",
        modelIdOverride: "fal-ai/nano-banana-2/edit",
        internalMediaRefsOverride: [internalRef],
      })
    );
  });

  it("replaces base reference inputs when override mode is replace", () => {
    const submitTask = vi.fn();
    const params = createParams({ submitTask, selectedTool: "edit" });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.regenerateOutput({
        referenceInputsOverride: [
          "https://example.com/flatten-primary.png",
          "https://example.com/flatten-primary.png",
          "https://example.com/flatten-secondary.png",
        ],
        referenceInputsMode: "replace",
      });
    });

    expect(submitTask).toHaveBeenCalledWith(
      "edit prompt",
      [
        "https://example.com/flatten-primary.png",
        "https://example.com/flatten-primary.png",
        "https://example.com/flatten-secondary.png",
      ],
      expect.objectContaining({ displayPromptOverride: "edit prompt" })
    );
  });

  it("keeps eleven replace-mode reference inputs when a caller raises the limit", () => {
    const submitTask = vi.fn();
    const params = createParams({ submitTask, selectedTool: "edit" });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));
    const referenceInputs = Array.from(
      { length: 11 },
      (_, index) => `https://example.com/ref-${index + 1}.png`
    );

    act(() => {
      result.current.regenerateOutput({
        referenceInputsOverride: referenceInputs,
        referenceInputsMode: "replace",
        referenceInputsLimit: 11,
      });
    });

    expect(submitTask).toHaveBeenCalledWith(
      "edit prompt",
      referenceInputs,
      expect.objectContaining({ displayPromptOverride: "edit prompt" })
    );
  });

  it("forwards internal media refs for regenerate when replay refs are canonical-only", () => {
    const submitTask = vi.fn();
    const internalRef = createInternalMediaRef({ storagePath: "user/chars/replay-ref.png" });
    const params = createParams({
      submitTask,
      selectedTool: "edit",
      resolveReferenceInputsForTool: vi.fn(() => ({
        referenceImageUrl: null,
        extraImageUrls: [null, null, null] as [string | null, string | null, string | null],
      })),
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.regenerateOutput({
        referenceInputsOverride: [],
        referenceInputsMode: "replace",
        internalMediaRefsOverride: [internalRef],
        modelIdOverride: "fal-ai/nano-banana-2/edit",
      });
    });

    expect(submitTask).toHaveBeenCalledWith(
      "edit prompt",
      [],
      expect.objectContaining({
        selectedToolOverride: "edit",
        modelIdOverride: "fal-ai/nano-banana-2/edit",
        internalMediaRefsOverride: [internalRef],
      })
    );
  });

  it("preserves duplicate edit base references when slot order is authoritative", () => {
    const submitTask = vi.fn();
    const resolveReferenceInputsForTool = vi.fn(() => ({
      referenceImageUrl: "https://example.com/shared.png",
      extraImageUrls: [
        "https://example.com/shared.png",
        "https://example.com/secondary.png",
        "https://example.com/shared.png",
      ] as [string | null, string | null, string | null],
    }));
    const params = createParams({
      submitTask,
      selectedTool: "edit",
      resolveReferenceInputsForTool,
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.regenerateOutput();
    });

    expect(submitTask).toHaveBeenCalledWith(
      "edit prompt",
      [
        "https://example.com/shared.png",
        "https://example.com/shared.png",
        "https://example.com/secondary.png",
        "https://example.com/shared.png",
      ],
      expect.objectContaining({ displayPromptOverride: "edit prompt" })
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
      ["https://example.com/ref.png", "https://example.com/extra-1.png"],
      expect.objectContaining({
        displayPromptOverride: "prompt override",
      })
    );
    expect(submitTask.mock.calls[0]?.[2]).not.toHaveProperty("styleContextOverride");
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
    expect(submitTask).toHaveBeenCalledWith(
      "video prompt",
      ["https://example.com/video-ref.png", "https://example.com/video-extra-1.png"],
      {
        modeOverride: undefined,
        selectedToolOverride: undefined,
        displayPromptOverride: "video prompt",
        characterContextOverride: undefined,
        modelIdOverride: undefined,
        hideOutputFromReferenceGrid: undefined,
        inpaintOverride: undefined,
      }
    );
  });

  it("includes the optional last frame for Kie Veo standard video runs", () => {
    const submitTask = vi.fn();
    const resolveReferenceInputsForTool = vi.fn(() => ({
      referenceImageUrl: "https://example.com/video-ref.png",
      extraImageUrls: [
        "https://example.com/video-last.png",
        "https://example.com/video-extra-2.png",
        null,
      ] as [string | null, string | null, string | null],
    }));
    const params = createParams({
      model: KIE_VEO_31_FAST_I2V_MODEL_ID,
      submitTask,
      selectedTool: "video",
      videoReferenceMode: "standard",
      resolveReferenceInputsForTool,
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.generateOutput();
    });

    expect(submitTask).toHaveBeenCalledWith(
      "video prompt",
      ["https://example.com/video-ref.png", "https://example.com/video-last.png"],
      expect.objectContaining({
        displayPromptOverride: "video prompt",
      })
    );
  });

  it("includes the optional end frame for Fal Kling standard video runs", () => {
    const submitTask = vi.fn();
    const resolveReferenceInputsForTool = vi.fn(() => ({
      referenceImageUrl: "https://example.com/video-ref.png",
      extraImageUrls: [
        "https://example.com/video-end.png",
        "https://example.com/video-extra-2.png",
        null,
      ] as [string | null, string | null, string | null],
    }));
    const params = createParams({
      model: "fal-ai/kling-video/v3/pro/image-to-video",
      submitTask,
      selectedTool: "video",
      videoReferenceMode: "standard",
      resolveReferenceInputsForTool,
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.generateOutput();
    });

    expect(submitTask).toHaveBeenCalledWith(
      "video prompt",
      ["https://example.com/video-ref.png", "https://example.com/video-end.png"],
      expect.objectContaining({
        displayPromptOverride: "video prompt",
      })
    );
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
        hideOutputFromReferenceGrid: undefined,
        inpaintOverride: undefined,
        modelIdOverride: undefined,
        selectedToolOverride: "create",
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
        hideOutputFromReferenceGrid: undefined,
        inpaintOverride: undefined,
        modelIdOverride: undefined,
        selectedToolOverride: "create",
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
      "Visible user prompt\n\nVisual style reference: cinematic editorial photography style, moody lighting. Emphasize cohesive palette, lighting mood, and surface texture.",
      [
        "https://example.com/ref.png",
        "https://example.com/extra-1.png",
        "https://example.com/extra-2.png",
      ],
      expect.objectContaining({ displayPromptOverride: "Visible user prompt" })
    );
  });

  it("can suppress selected style state for mode-owned artifact generation", () => {
    const submitTask = vi.fn();
    const params = createParams({
      selectedTool: "create",
      selectedStylePrompt: "cinematic editorial photography style, moody lighting",
      selectedStyleContext: {
        applied: true,
        styleId: "style-1",
        styleName: "Editorial",
        stylePrompt: "cinematic editorial photography style, moody lighting",
      },
      submitTask,
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.generateOutput("Pulse artifact prompt", {
        suppressStyle: true,
      });
    });

    expect(submitTask).toHaveBeenCalledWith(
      "Pulse artifact prompt",
      [
        "https://example.com/ref.png",
        "https://example.com/extra-1.png",
        "https://example.com/extra-2.png",
      ],
      expect.not.objectContaining({
        styleContextOverride: expect.anything(),
      })
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
        model: "fal-ai/nano-banana-2/edit",
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
      ["https://example.com/ref.png", "https://example.com/extra-1.png"],
      expect.objectContaining({ displayPromptOverride: "Video visible prompt" })
    );
  });
});
