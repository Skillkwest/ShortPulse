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

  it("preserves non-workflow tool selections like templates", () => {
    const setSelectedTool = vi.fn();
    const setMode = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioWorkspaceActions(
        createParams({
          setSelectedTool,
          setMode: asDispatch<StudioMode>(setMode),
        })
      )
    );

    act(() => {
      result.current.handleToolSelect("templates");
    });

    expect(setSelectedTool).toHaveBeenCalledWith("templates");
    expect(setMode).not.toHaveBeenCalled();
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
      result.current.handleReferenceGridFiles(createFileList());
    });
    expect(addCharacterReferences).toHaveBeenCalledTimes(2);

    rerender({ selectedTool: "create" });
    const droppedFiles = createFileList();
    act(() => {
      result.current.handleReferenceGridFiles(droppedFiles);
    });
    expect(addOutputsFromFiles).toHaveBeenCalledTimes(2);
    expect(addOutputsFromFiles).toHaveBeenLastCalledWith(droppedFiles, "drop");
  });
});
