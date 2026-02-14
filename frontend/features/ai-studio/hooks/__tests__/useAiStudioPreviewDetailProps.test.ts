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
  handleDownloadReference: vi.fn(),
  savePromptReference: vi.fn(),
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
    const handleDownloadReference = vi.fn();
    const savePromptReference = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioPreviewDetailProps(
        createParams({
          setDetailOutputId,
          updateOutputPrompt,
          deleteOutput,
          handleDownloadReference,
          savePromptReference,
        })
      )
    );

    result.current.onDetailClose();
    result.current.onUpdateOutputPrompt("out-1", "Updated prompt");
    result.current.onDeleteOutput("out-1");
    result.current.onDetailDownload?.("out-1");
    result.current.onDetailSavePrompt?.("Saved prompt");

    expect(setDetailOutputId).toHaveBeenCalledWith(null);
    expect(updateOutputPrompt).toHaveBeenCalledWith("out-1", "Updated prompt");
    expect(deleteOutput).toHaveBeenCalledWith("out-1");
    expect(handleDownloadReference).toHaveBeenCalledWith("out-1");
    expect(savePromptReference).toHaveBeenCalledWith("Saved prompt");
  });
});
