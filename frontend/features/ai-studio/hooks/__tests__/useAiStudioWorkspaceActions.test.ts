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

  it("selects tool, preserves create workflow mode, enforces image mode for edit, and closes tray on clear", () => {
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
    expect(setSelectedTool).toHaveBeenNthCalledWith(4, "video");
    expect(setMode).toHaveBeenCalledTimes(1);
    expect(setMode).toHaveBeenCalledWith("image");
    expect(setShowCreateTools).toHaveBeenCalledWith(false);
  });

  it("preserves non-workflow tool selections like templates and pulse presets", () => {
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
      result.current.handleToolSelect("pulse-presets");
    });

    expect(setSelectedTool).toHaveBeenCalledWith("templates");
    expect(setSelectedTool).toHaveBeenCalledWith("pulse-presets");
    expect(setMode).not.toHaveBeenCalled();
  });

  it("always routes reference-grid file picker uploads to outputs and clears input value", () => {
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
      { initialProps: { selectedTool: "create" as ToolId } }
    );

    const targetA = { files: createFileList(), value: "filled" } as unknown as HTMLInputElement;
    act(() => {
      result.current.handleFileBrowserSelection({
        target: targetA,
      } as unknown as Parameters<typeof result.current.handleFileBrowserSelection>[0]);
    });
    expect(addCharacterReferences).not.toHaveBeenCalled();
    expect(addOutputsFromFiles).toHaveBeenCalledTimes(1);
    expect(addOutputsFromFiles).toHaveBeenLastCalledWith(targetA.files, "filePicker");
    expect(targetA.value).toBe("");

    rerender({ selectedTool: "create" });
    const targetB = { files: createFileList(), value: "filled" } as unknown as HTMLInputElement;
    act(() => {
      result.current.handleFileBrowserSelection({
        target: targetB,
      } as unknown as Parameters<typeof result.current.handleFileBrowserSelection>[0]);
    });
    expect(addOutputsFromFiles).toHaveBeenCalledTimes(2);
    expect(addOutputsFromFiles).toHaveBeenLastCalledWith(targetB.files, "filePicker");
    expect(targetB.value).toBe("");

    rerender({ selectedTool: "character" });
    const targetC = { files: createFileList(), value: "filled" } as unknown as HTMLInputElement;
    act(() => {
      result.current.handleFileBrowserSelection({
        target: targetC,
      } as unknown as Parameters<typeof result.current.handleFileBrowserSelection>[0]);
    });
    expect(addOutputsFromFiles).toHaveBeenCalledTimes(3);
    expect(addOutputsFromFiles).toHaveBeenLastCalledWith(targetC.files, "filePicker");
    expect(targetC.value).toBe("");

    act(() => {
      result.current.handleReferenceGridFiles(createFileList());
    });
    expect(addCharacterReferences).toHaveBeenCalledTimes(1);

    rerender({ selectedTool: "create" });
    const droppedFiles = createFileList();
    act(() => {
      result.current.handleReferenceGridFiles(droppedFiles);
    });
    expect(addOutputsFromFiles).toHaveBeenCalledTimes(4);
    expect(addOutputsFromFiles).toHaveBeenLastCalledWith(droppedFiles, "drop");
  });
});
