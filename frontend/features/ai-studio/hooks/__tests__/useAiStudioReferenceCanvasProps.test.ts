import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { useAiStudioReferenceCanvasProps } from "../useAiStudioReferenceCanvasProps";

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
  overrides: Partial<Parameters<typeof useAiStudioReferenceCanvasProps>[0]> = {}
): Parameters<typeof useAiStudioReferenceCanvasProps>[0] => ({
  outputs: [output],
  activeOutputId: "out-1",
  onReferenceOutputMediaLoaded: vi.fn(),
  linkedPromptReferenceIds: ["out-1"],
  showReferencePromptGenerate: true,
  disableReferencePromptGenerate: false,
  handleSelectOutput: vi.fn(),
  setDetailOutputId: vi.fn(),
  handleDescribeReference: vi.fn(),
  handleSaveReference: vi.fn(),
  handleDownloadReference: vi.fn(),
  handleGenerateFromPromptReference: vi.fn(),
  retryOutputStatus: vi.fn(),
  deleteOutput: vi.fn(),
  currentCostCredits: 2,
  selectedTool: "image",
  ...overrides,
});

describe("useAiStudioReferenceCanvasProps", () => {
  it("routes output action callbacks through output id wrappers", () => {
    const handleDescribeReference = vi.fn();
    const handleSaveReference = vi.fn();
    const handleDownloadReference = vi.fn();
    const handleGenerateFromPromptReference = vi.fn();
    const retryOutputStatus = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioReferenceCanvasProps(
        createParams({
          handleDescribeReference,
          handleSaveReference,
          handleDownloadReference,
          handleGenerateFromPromptReference,
          retryOutputStatus,
        })
      )
    );

    result.current.onDescribeImage?.(output);
    result.current.onSaveToLibrary?.(output);
    result.current.onDownload?.(output);
    result.current.onGeneratePrompt?.(output);
    result.current.onRetryStatus?.(output);

    expect(handleDescribeReference).toHaveBeenCalledWith("out-1");
    expect(handleSaveReference).toHaveBeenCalledWith("out-1");
    expect(handleDownloadReference).toHaveBeenCalledWith("out-1");
    expect(handleGenerateFromPromptReference).toHaveBeenCalledWith("out-1");
    expect(retryOutputStatus).toHaveBeenCalledWith("out-1");
  });

  it("preserves non-action props for canvas rendering state", () => {
    const { result } = renderHook(() =>
      useAiStudioReferenceCanvasProps(
        createParams({
          selectedTool: "video",
          currentCostCredits: null,
          disableReferencePromptGenerate: true,
        })
      )
    );

    expect(result.current.showHeader).toBe(false);
    expect(result.current.selectedTool).toBe("video");
    expect(result.current.generateCostCredits).toBeNull();
    expect(result.current.disablePromptGenerate).toBe(true);
    expect(result.current.linkedPromptReferenceIds).toEqual(["out-1"]);
  });
});
