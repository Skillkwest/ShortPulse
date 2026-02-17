import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { StudioOutput, ToolId } from "../../types";
import { useAiStudioGenerationPromptComposer } from "../useAiStudioGenerationPromptComposer";

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioGenerationPromptComposer>[0]> = {}
): Parameters<typeof useAiStudioGenerationPromptComposer>[0] => ({
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
  setUiError: asDispatch<string | null>(vi.fn()),
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
      ["https://example.com/override.png"],
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
      }
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

  it("sets a user-facing error when regenerate prompt is empty", () => {
    const submitTask = vi.fn();
    const setUiError = vi.fn();
    const params = createParams({
      submitTask,
      setUiError: asDispatch<string | null>(setUiError),
      prompt: "",
      editReferenceText: "",
      videoReferenceText: "",
      selectedTool: "create",
    });
    const { result } = renderHook(() => useAiStudioGenerationPromptComposer(params));

    act(() => {
      result.current.regenerateOutput();
    });

    expect(setUiError).toHaveBeenCalledWith("Add a prompt to start a generation.");
    expect(submitTask).not.toHaveBeenCalled();
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
      }
    );
  });
});
