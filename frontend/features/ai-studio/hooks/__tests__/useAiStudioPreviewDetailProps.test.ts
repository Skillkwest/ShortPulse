import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { useAiStudioPreviewDetailProps } from "../useAiStudioPreviewDetailProps";

const output: StudioOutput = {
  id: "out-1",
  prompt: "Prompt",
  mode: "image",
  aspect: "1:1",
  model: "Model",
  modelId: "model-id",
  status: "ready",
  timestamp: "2026-02-14T00:00:00.000Z",
  previewUrl: "https://example.com/out-1.png",
};

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioPreviewDetailProps>[0]> = {}
): Parameters<typeof useAiStudioPreviewDetailProps>[0] => ({
  activeOutput: output,
  referenceGridReadyOutputIds: new Set<string>(),
  referenceImageUrl: "https://example.com/ref.png",
  selectedTool: "image",
  videoReferenceText: "Video prompt",
  editReferenceText: "Edit prompt",
  setReferenceImageUrl: vi.fn(),
  handleManualPromptChange: vi.fn(),
  handleRegenerateWithDebit: vi.fn(),
  detailOutput: output,
  setDetailOutputId: vi.fn(),
  updateOutputPrompt: vi.fn(),
  deleteOutput: vi.fn(),
  handleSaveReference: vi.fn(),
  handleDownloadReference: vi.fn(),
  savePromptToLibrary: vi.fn(),
  handleOpenMediaLibrary: vi.fn(),
  ...overrides,
});

describe("useAiStudioPreviewDetailProps", () => {
  it("selects preview reference text based on tool mode", () => {
    type SelectedTool = Parameters<typeof useAiStudioPreviewDetailProps>[0]["selectedTool"];
    const { result, rerender } = renderHook(
      ({ selectedTool }: { selectedTool: SelectedTool }) =>
        useAiStudioPreviewDetailProps(createParams({ selectedTool })),
      { initialProps: { selectedTool: "image" } }
    );

    expect(result.current.studioPreviewProps.referenceText).toBe("Edit prompt");

    rerender({ selectedTool: "video" });
    expect(result.current.studioPreviewProps.referenceText).toBe("Video prompt");

    rerender({ selectedTool: "kling" });
    expect(result.current.studioPreviewProps.referenceText).toBe("Video prompt");
  });

  it("routes detail modal handlers and close behavior", () => {
    const setDetailOutputId = vi.fn();
    const updateOutputPrompt = vi.fn();
    const deleteOutput = vi.fn();
    const handleSaveReference = vi.fn();
    const handleDownloadReference = vi.fn();
    const savePromptToLibrary = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioPreviewDetailProps(
        createParams({
          setDetailOutputId,
          updateOutputPrompt,
          deleteOutput,
          handleSaveReference,
          handleDownloadReference,
          savePromptToLibrary,
        })
      )
    );

    result.current.onDetailClose();
    result.current.onUpdateOutputPrompt("out-1", "Updated prompt");
    result.current.onDeleteOutput("out-1");
    result.current.onDetailSaveReference?.("out-1");
    result.current.onDetailDownload?.("out-1");
    result.current.onDetailSavePrompt?.("Saved prompt");

    expect(setDetailOutputId).toHaveBeenCalledWith(null);
    expect(updateOutputPrompt).toHaveBeenCalledWith("out-1", "Updated prompt");
    expect(deleteOutput).toHaveBeenCalledWith("out-1");
    expect(handleSaveReference).toHaveBeenCalledWith("out-1");
    expect(handleDownloadReference).toHaveBeenCalledWith("out-1");
    expect(savePromptToLibrary).toHaveBeenCalledWith("Saved prompt");
  });

  it("withholds the active output preview until the reference grid marks it ready", () => {
    const { result, rerender } = renderHook(
      ({ readyIds }: { readyIds: ReadonlySet<string> }) =>
        useAiStudioPreviewDetailProps(createParams({ referenceGridReadyOutputIds: readyIds })),
      {
        initialProps: { readyIds: new Set<string>() },
      }
    );

    expect(result.current.studioPreviewProps.activeOutputPreviewUrl).toBeNull();

    rerender({ readyIds: new Set<string>(["out-1"]) });
    expect(result.current.studioPreviewProps.activeOutputPreviewUrl).toBe(
      "https://example.com/out-1.png"
    );
  });

  it("does not gate outputs that are intentionally hidden from the reference grid", () => {
    const hiddenOutput: StudioOutput = {
      ...output,
      id: "out-hidden",
      hiddenInReferenceGrid: true,
      previewUrl: "https://example.com/out-hidden.png",
    };

    const { result } = renderHook(() =>
      useAiStudioPreviewDetailProps(
        createParams({
          activeOutput: hiddenOutput,
          detailOutput: hiddenOutput,
        })
      )
    );

    expect(result.current.studioPreviewProps.activeOutputPreviewUrl).toBe(
      "https://example.com/out-hidden.png"
    );
  });
});
