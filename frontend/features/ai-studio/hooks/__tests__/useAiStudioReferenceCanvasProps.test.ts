import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import {
  useAiStudioReferenceCanvasProps,
  useAiStudioReferenceGridProps,
} from "../useAiStudioReferenceGridProps";

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
  overrides: Partial<Parameters<typeof useAiStudioReferenceGridProps>[0]> = {}
): Parameters<typeof useAiStudioReferenceGridProps>[0] => ({
  outputs: [output],
  activeOutputId: "out-1",
  curatedReferenceIds: ["out-1"],
  removedFromAllRefsIds: ["out-1"],
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
  handlePasteTextReference: vi.fn(),
  handlePasteMediaReference: vi.fn(),
  retryOutputStatus: vi.fn(),
  deleteOutput: vi.fn(),
  addCuratedReference: vi.fn(),
  removeCuratedReference: vi.fn(),
  reorderCuratedReference: vi.fn(),
  currentCostCredits: 2,
  selectedTool: "image",
  ...overrides,
});

describe("useAiStudioReferenceGridProps", () => {
  it("routes output action callbacks through output id wrappers", () => {
    const handleDescribeReference = vi.fn();
    const handleSaveReference = vi.fn();
    const handleDownloadReference = vi.fn();
    const handleGenerateFromPromptReference = vi.fn();
    const handlePasteTextReference = vi.fn();
    const handlePasteMediaReference = vi.fn();
    const retryOutputStatus = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioReferenceGridProps(
        createParams({
          handleDescribeReference,
          handleSaveReference,
          handleDownloadReference,
          handleGenerateFromPromptReference,
          handlePasteTextReference,
          handlePasteMediaReference,
          retryOutputStatus,
        })
      )
    );

    result.current.onDescribeImage?.(output);
    result.current.onSaveToLibrary?.(output);
    result.current.onDownload?.(output);
    result.current.onGeneratePrompt?.(output);
    result.current.onPasteTextReference?.("new prompt");
    result.current.onPasteMediaReference?.({
      url: "https://example.com/cat.png",
      mimeType: "image/*",
    });
    result.current.onRetryStatus?.(output);

    expect(handleDescribeReference).toHaveBeenCalledWith("out-1");
    expect(handleSaveReference).toHaveBeenCalledWith("out-1");
    expect(handleDownloadReference).toHaveBeenCalledWith("out-1");
    expect(handleGenerateFromPromptReference).toHaveBeenCalledWith("out-1");
    expect(handlePasteTextReference).toHaveBeenCalledWith("new prompt");
    expect(handlePasteMediaReference).toHaveBeenCalledWith({
      url: "https://example.com/cat.png",
      mimeType: "image/*",
    });
    expect(retryOutputStatus).toHaveBeenCalledWith("out-1");
  });

  it("preserves non-action props for canvas rendering state", () => {
    const archivedOutput: StudioOutput = {
      ...output,
      id: "archived-1",
      prompt: "Archived",
      archivedAt: "2026-02-17T00:00:00.000Z",
      archiveReason: "soft_limit",
    };
    const restoreArchivedOutput = vi.fn();
    const restoreAllArchivedOutputs = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioReferenceGridProps(
        createParams({
          selectedTool: "video",
          currentCostCredits: null,
          disableReferencePromptGenerate: true,
          archivedOutputs: [archivedOutput],
          restoreArchivedOutput,
          restoreAllArchivedOutputs,
        })
      )
    );

    expect(result.current.showHeader).toBe(true);
    expect(result.current.curatedReferenceIds).toEqual(["out-1"]);
    expect(result.current.removedFromAllRefsIds).toEqual(["out-1"]);
    expect(result.current.selectedTool).toBe("video");
    expect(result.current.generateCostCredits).toBeNull();
    expect(result.current.disablePromptGenerate).toBe(true);
    expect(result.current.linkedPromptReferenceIds).toEqual(["out-1"]);
    expect(result.current.archivedOutputs?.map((item) => item.id)).toEqual(["archived-1"]);
    result.current.onRestoreArchivedOutput?.("archived-1");
    result.current.onRestoreAllArchivedOutputs?.();
    expect(restoreArchivedOutput).toHaveBeenCalledWith("archived-1");
    expect(restoreAllArchivedOutputs).toHaveBeenCalledTimes(1);
  });

  it("maps curated callbacks and reorder payloads", () => {
    const addCuratedReference = vi.fn();
    const removeCuratedReference = vi.fn();
    const reorderCuratedReference = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioReferenceGridProps(
        createParams({
          addCuratedReference,
          removeCuratedReference,
          reorderCuratedReference,
        })
      )
    );

    result.current.onAddCuratedReference?.("out-1");
    result.current.onRemoveCuratedReference?.("out-1");
    result.current.onReorderCuratedReference?.("out-1", "out-2", "after");

    expect(addCuratedReference).toHaveBeenCalledWith("out-1");
    expect(removeCuratedReference).toHaveBeenCalledWith("out-1");
    expect(reorderCuratedReference).toHaveBeenCalledWith("out-1", "out-2", "after");
  });

  it("retains the legacy alias export for compatibility", () => {
    expect(useAiStudioReferenceCanvasProps).toBe(useAiStudioReferenceGridProps);
  });
});
