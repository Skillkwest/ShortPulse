import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { useAiStudioReferenceGridProps } from "../useAiStudioReferenceGridProps";

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
  topNotice: null,
  curatedReferenceIds: ["out-1"],
  removedFromAllRefsIds: ["out-1"],
  onReferenceOutputMediaLoaded: vi.fn(),
  linkedPromptReferenceIds: ["out-1"],
  handleSelectOutput: vi.fn(),
  setDetailOutputId: vi.fn(),
  handleSaveReference: vi.fn(),
  handleDownloadReference: vi.fn(),
  handlePasteTextReference: vi.fn(),
  handlePasteMediaReference: vi.fn(),
  openDetailSelectionTarget: vi.fn(),
  retryOutputStatus: vi.fn(),
  deleteOutput: vi.fn(),
  addCuratedReference: vi.fn(),
  removeCuratedReference: vi.fn(),
  reorderCuratedReference: vi.fn(),
  ...overrides,
});

describe("useAiStudioReferenceGridProps", () => {
  it("routes output action callbacks through output id wrappers", () => {
    const handleSaveReference = vi.fn();
    const handleDownloadReference = vi.fn();
    const handlePasteTextReference = vi.fn();
    const handlePasteMediaReference = vi.fn();
    const handleAddLibraryMediaReference = vi.fn();
    const handleAddLibraryPromptReference = vi.fn();
    const retryOutputStatus = vi.fn();
    const handleRerollOutput = vi.fn();
    const handleReloadWorkflowOutput = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioReferenceGridProps(
        createParams({
          handleSaveReference,
          handleDownloadReference,
          handlePasteTextReference,
          handlePasteMediaReference,
          handleAddLibraryMediaReference,
          handleAddLibraryPromptReference,
          retryOutputStatus,
          handleRerollOutput,
          handleReloadWorkflowOutput,
        })
      )
    );

    result.current.onSaveToLibrary?.(output);
    result.current.onDownload?.(output);
    result.current.onPasteTextReference?.("new prompt");
    result.current.onPasteMediaReference?.({
      url: "https://example.com/cat.png",
      mimeType: "image/*",
    });
    result.current.onAddLibraryMediaReference?.({
      id: "media-1",
      url: "https://example.com/library.png",
      fileType: "image",
    });
    result.current.onAddLibraryPromptReference?.({
      id: "prompt-1",
      promptText: "library prompt",
    });
    result.current.onRetryStatus?.(output);
    result.current.onRerollOutput?.(output);
    result.current.onReloadWorkflowOutput?.(output);

    expect(handleSaveReference).toHaveBeenCalledWith("out-1");
    expect(handleDownloadReference).toHaveBeenCalledWith("out-1");
    expect(handlePasteTextReference).toHaveBeenCalledWith("new prompt");
    expect(handlePasteMediaReference).toHaveBeenCalledWith({
      url: "https://example.com/cat.png",
      mimeType: "image/*",
    });
    expect(handleAddLibraryMediaReference).toHaveBeenCalledWith({
      id: "media-1",
      url: "https://example.com/library.png",
      fileType: "image",
    });
    expect(handleAddLibraryPromptReference).toHaveBeenCalledWith({
      id: "prompt-1",
      promptText: "library prompt",
    });
    expect(retryOutputStatus).toHaveBeenCalledWith("out-1");
    expect(handleRerollOutput).toHaveBeenCalledWith("out-1");
    expect(handleReloadWorkflowOutput).toHaveBeenCalledWith("out-1");
  });

  it("stores the selected output snapshot when opening details", () => {
    const openDetailSelectionTarget = vi.fn();
    const setDetailOutputId = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioReferenceGridProps(
        createParams({
          openDetailSelectionTarget,
          setDetailOutputId,
        })
      )
    );

    result.current.onOpenDetails("out-1", output);

    expect(openDetailSelectionTarget).toHaveBeenCalledWith({
      kind: "studio-output",
      outputId: "out-1",
      surface: "reference-grid",
      outputSnapshot: output,
    });
    expect(setDetailOutputId).toHaveBeenCalledWith("out-1");
  });

  it("preserves non-action props for canvas rendering state", () => {
    const archivedOutput: StudioOutput = {
      ...output,
      id: "archived-1",
      prompt: "Archived",
      archivedAt: "2026-02-17T00:00:00.000Z",
      archiveReason: "cleanup",
    };
    const restoreArchivedOutput = vi.fn();
    const restoreAllArchivedOutputs = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioReferenceGridProps(
        createParams({
          archivedOutputs: [archivedOutput],
          restoreArchivedOutput,
          restoreAllArchivedOutputs,
        })
      )
    );

    expect(result.current.showHeader).toBe(true);
    expect(result.current.topNotice).toBeNull();
    expect(result.current.curatedReferenceIds).toEqual(["out-1"]);
    expect(result.current.removedFromAllRefsIds).toEqual(["out-1"]);
    expect(result.current.linkedPromptReferenceIds).toEqual(["out-1"]);
    expect(result.current.archivedOutputs?.map((item) => item.id)).toEqual(["archived-1"]);
    result.current.onRestoreArchivedOutput?.("archived-1");
    result.current.onRestoreAllArchivedOutputs?.();
    expect(restoreArchivedOutput).toHaveBeenCalledWith("archived-1");
    expect(restoreAllArchivedOutputs).toHaveBeenCalledTimes(1);
  });

  it("omits direct output collections when live grid reads from the selector store", () => {
    const archivedOutput: StudioOutput = {
      ...output,
      id: "archived-1",
      prompt: "Archived",
      archivedAt: "2026-02-17T00:00:00.000Z",
      archiveReason: "cleanup",
    };
    const { result } = renderHook(() =>
      useAiStudioReferenceGridProps(
        createParams({
          archivedOutputs: [archivedOutput],
          readOutputsFromStore: true,
        })
      )
    );

    expect(result.current.outputs).toBeUndefined();
    expect(result.current.archivedOutputs).toBeUndefined();
    expect(result.current.curatedReferenceIds).toEqual(["out-1"]);
    expect(result.current.removedFromAllRefsIds).toEqual(["out-1"]);
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

  it("preserves the top notice when provided", () => {
    const { result } = renderHook(() =>
      useAiStudioReferenceGridProps(
        createParams({
          topNotice:
            "4 max concurrent generations. Wait for one to finish before starting another.",
        })
      )
    );

    expect(result.current.topNotice).toBe(
      "4 max concurrent generations. Wait for one to finish before starting another."
    );
  });

  it("passes through media storage full state", () => {
    const { result } = renderHook(() =>
      useAiStudioReferenceGridProps(
        createParams({
          isMediaStorageFull: true,
        })
      )
    );

    expect(result.current.isMediaStorageFull).toBe(true);
  });
});
