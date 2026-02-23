import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Dispatch, SetStateAction } from "react";
import type { PromptOrigin } from "../../logic/agentPromptOwnership";
import type { StudioMode, ToolId } from "../../types";
import { useAiStudioWorkspaceActions } from "../useAiStudioWorkspaceActions";

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioWorkspaceActions>[0]> = {}
): Parameters<typeof useAiStudioWorkspaceActions>[0] => ({
  selectedTool: "create",
  setSelectedTool: vi.fn(),
  setMode: asDispatch<StudioMode>(vi.fn()),
  setShowCreateTools: asDispatch<boolean>(vi.fn()),
  setVideoReferenceText: vi.fn(),
  setEditReferenceText: vi.fn(),
  setSharedPrompt: vi.fn(),
  setPromptOrigin: asDispatch<PromptOrigin>(vi.fn()),
  openModelModal: vi.fn(),
  closeModelModal: vi.fn(),
  setModel: vi.fn(),
  addCharacterReferences: vi.fn(),
  addOutputsFromFiles: vi.fn(),
  setActiveOutputId: asDispatch<string | null>(vi.fn()),
  model: "fal-ai/seedream",
  hasSufficientCreditsForCost: true,
  referenceImageUrl: "",
  extraImageUrls: [],
  motionReferenceVideoUrl: "",
  editReferenceText: "",
  videoReferenceText: "",
  videoReferenceMode: "standard",
  ...overrides,
});

const createFileList = () => {
  const file = new File(["x"], "ref.png", { type: "image/png" });
  return {
    0: file,
    length: 1,
    item: (index: number) => (index === 0 ? file : null),
  } as unknown as FileList;
};

describe("useAiStudioWorkspaceActions", () => {
  it("routes manual prompt updates by selected workflow and marks origin manual", () => {
    const setVideoReferenceText = vi.fn();
    const setPromptOrigin = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioWorkspaceActions(
        createParams({
          selectedTool: "video",
          setVideoReferenceText,
          setPromptOrigin: asDispatch<PromptOrigin>(setPromptOrigin),
        })
      )
    );

    act(() => {
      result.current.handleManualPromptChange("Video prompt");
    });

    expect(setVideoReferenceText).toHaveBeenCalledWith("Video prompt");
    expect(setPromptOrigin).toHaveBeenCalledWith("manual");
  });

  it("selects tool, enforces image mode for create/text/edit, and closes tray on clear", () => {
    const setSelectedTool = vi.fn();
    const setMode = vi.fn();
    const setShowCreateTools = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioWorkspaceActions(
        createParams({
          setSelectedTool,
          setMode: asDispatch<StudioMode>(setMode),
          setShowCreateTools: asDispatch<boolean>(setShowCreateTools),
        })
      )
    );

    act(() => {
      result.current.handleToolSelect("create");
      result.current.handleToolSelect("text");
      result.current.handleToolSelect("edit");
      result.current.handleToolSelect("video");
      result.current.handleToolSelect(null);
    });

    expect(setSelectedTool).toHaveBeenCalledTimes(5);
    expect(setMode).toHaveBeenCalledTimes(3);
    expect(setMode).toHaveBeenCalledWith("image");
    expect(setShowCreateTools).toHaveBeenCalledWith(false);
  });

  it("routes file browser selection by primary Character tool and clears input value", () => {
    const addCharacterReferences = vi.fn();
    const addOutputsFromFiles = vi.fn();
    const { result, rerender } = renderHook(
      ({ selectedTool }: { selectedTool: ToolId | null }) =>
        useAiStudioWorkspaceActions(
          createParams({
            selectedTool,
            addCharacterReferences,
            addOutputsFromFiles,
          })
        ),
      { initialProps: { selectedTool: "canvas" as ToolId } }
    );

    const targetA = { files: createFileList(), value: "filled" } as unknown as HTMLInputElement;
    act(() => {
      result.current.handleFileBrowserSelection({
        target: targetA,
      } as unknown as Parameters<typeof result.current.handleFileBrowserSelection>[0]);
    });
    expect(addCharacterReferences).toHaveBeenCalledTimes(1);
    expect(addOutputsFromFiles).not.toHaveBeenCalled();
    expect(targetA.value).toBe("");

    rerender({ selectedTool: "create" });
    const targetB = { files: createFileList(), value: "filled" } as unknown as HTMLInputElement;
    act(() => {
      result.current.handleFileBrowserSelection({
        target: targetB,
      } as unknown as Parameters<typeof result.current.handleFileBrowserSelection>[0]);
    });
    expect(addOutputsFromFiles).toHaveBeenCalledTimes(1);
    expect(addOutputsFromFiles).toHaveBeenLastCalledWith(targetB.files, "filePicker");
    expect(targetB.value).toBe("");

    rerender({ selectedTool: "character" });
    act(() => {
      result.current.handleReferenceCanvasFiles(createFileList());
    });
    expect(addCharacterReferences).toHaveBeenCalledTimes(2);

    rerender({ selectedTool: "create" });
    const droppedFiles = createFileList();
    act(() => {
      result.current.handleReferenceCanvasFiles(droppedFiles);
    });
    expect(addOutputsFromFiles).toHaveBeenCalledTimes(2);
    expect(addOutputsFromFiles).toHaveBeenLastCalledWith(droppedFiles, "drop");
  });

  it("shows prompt-reference generate only when workflow requirements are met", () => {
    const { result, rerender } = renderHook(
      ({
        selectedTool,
        referenceImageUrl,
        editReferenceText,
        videoReferenceText,
      }: {
        selectedTool: ToolId | null;
        referenceImageUrl: string;
        editReferenceText: string;
        videoReferenceText: string;
      }) =>
        useAiStudioWorkspaceActions(
          createParams({
            selectedTool,
            referenceImageUrl,
            editReferenceText,
            videoReferenceText,
          })
        ),
      {
        initialProps: {
          selectedTool: "create" as ToolId,
          referenceImageUrl: "",
          editReferenceText: "",
          videoReferenceText: "",
        },
      }
    );

    expect(result.current.showReferencePromptGenerate).toBe(true);
    expect(result.current.disableReferencePromptGenerate).toBe(false);

    rerender({
      selectedTool: "edit",
      referenceImageUrl: "",
      editReferenceText: "",
      videoReferenceText: "",
    });
    expect(result.current.showReferencePromptGenerate).toBe(false);

    rerender({
      selectedTool: "video",
      referenceImageUrl: "https://example.com/ref.png",
      editReferenceText: "",
      videoReferenceText: "already set",
    });
    expect(result.current.showReferencePromptGenerate).toBe(false);
  });
});
