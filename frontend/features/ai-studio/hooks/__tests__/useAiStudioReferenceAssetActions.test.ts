import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";
import type { StudioMode, StudioOutput, ToolId } from "../../types";
import { useAiStudioReferenceAssetActions } from "../useAiStudioReferenceAssetActions";

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const makeOutput = (id: string, prompt = "Prompt text"): StudioOutput => ({
  id,
  prompt,
  mode: "image",
  aspect: "1:1",
  model: "fal-ai/seedream",
  status: "ready",
  timestamp: "now",
  taskState: "success",
});

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioReferenceAssetActions>[0]> = {}
): Parameters<typeof useAiStudioReferenceAssetActions>[0] => ({
  outputs: [],
  selectedTool: "create",
  currentCostCredits: 4,
  setVideoReferenceText: vi.fn(),
  setEditReferenceText: vi.fn(),
  setSharedPrompt: vi.fn(),
  setSelectedTool: vi.fn(),
  setMode: asDispatch<StudioMode>(vi.fn()),
  setPromptOrigin: asDispatch<PromptOrigin>(vi.fn()),
  handleGenerate: vi.fn(async () => undefined),
  saveReferenceToLibrary: vi.fn(),
  setUiError: asDispatch<string | null>(vi.fn()),
  ...overrides,
});

describe("useAiStudioReferenceAssetActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("saves a valid reference id and ignores empty ids", () => {
    const saveReferenceToLibrary = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(createParams({ saveReferenceToLibrary }))
    );

    act(() => {
      result.current.handleSaveReference("");
      result.current.handleSaveReference("out-1");
    });

    expect(saveReferenceToLibrary).toHaveBeenCalledTimes(1);
    expect(saveReferenceToLibrary).toHaveBeenCalledWith("out-1");
  });

  it("routes prompt reference generation to video workflow setters", async () => {
    const setVideoReferenceText = vi.fn();
    const setPromptOrigin = vi.fn();
    const handleGenerate = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(
        createParams({
          outputs: [makeOutput("out-1", "Video prompt")],
          selectedTool: "video",
          currentCostCredits: 7,
          setVideoReferenceText,
          setPromptOrigin: asDispatch<PromptOrigin>(setPromptOrigin),
          handleGenerate,
        })
      )
    );

    await act(async () => {
      await result.current.handleGenerateFromPromptReference("out-1");
    });

    expect(setVideoReferenceText).toHaveBeenCalledWith("Video prompt");
    expect(setPromptOrigin).toHaveBeenCalledWith("reference");
    expect(handleGenerate).toHaveBeenCalledWith("Video prompt", {
      modeOverride: "video",
      toolOverride: "video",
      costOverrideCredits: 7,
    });
  });

  it("routes prompt reference generation to create workflow when needed", async () => {
    const setSharedPrompt = vi.fn();
    const setSelectedTool = vi.fn();
    const setMode = vi.fn();
    const handleGenerate = vi.fn(async () => undefined);
    const { result } = renderHook(() =>
      useAiStudioReferenceAssetActions(
        createParams({
          outputs: [makeOutput("out-2", "Create prompt")],
          selectedTool: "community" as ToolId,
          setSharedPrompt,
          setSelectedTool,
          setMode: asDispatch<StudioMode>(setMode),
          handleGenerate,
        })
      )
    );

    await act(async () => {
      await result.current.handleGenerateFromPromptReference("out-2");
    });

    expect(setSharedPrompt).toHaveBeenCalledWith("Create prompt");
    expect(setSelectedTool).toHaveBeenCalledWith("create");
    expect(setMode).toHaveBeenCalledWith("image");
    expect(handleGenerate).toHaveBeenCalledWith("Create prompt", {
      modeOverride: "image",
      toolOverride: "create",
      costOverrideCredits: 4,
    });
  });
});
