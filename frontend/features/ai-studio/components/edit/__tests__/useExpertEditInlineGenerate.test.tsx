import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExpertEditInlineGenerate } from "../useExpertEditInlineGenerate";

const exportExpertEditStageArtifactsMock = vi.fn();
const validateExpertEditSubmissionPromptMock = vi.fn();
const prepareExpertEditSubmissionMock = vi.fn();
const resolveExpertEditSubmissionDispatchMock = vi.fn();
const createExpertEditSubmissionObjectUrlsMock = vi.fn();
const cleanupExpertEditSubmissionObjectUrlsMock = vi.fn();
const revokeExpertEditSubmissionObjectUrlsMock = vi.fn();

vi.mock("../expertEditStageExport", () => ({
  exportExpertEditStageArtifacts: (...args: unknown[]) =>
    exportExpertEditStageArtifactsMock(...args),
}));

vi.mock("../expertEditSubmissionPreparation", () => ({
  validateExpertEditSubmissionPrompt: (...args: unknown[]) =>
    validateExpertEditSubmissionPromptMock(...args),
  prepareExpertEditSubmission: (...args: unknown[]) => prepareExpertEditSubmissionMock(...args),
}));

vi.mock("../expertEditSubmissionDispatch", () => ({
  resolveExpertEditSubmissionDispatch: (...args: unknown[]) =>
    resolveExpertEditSubmissionDispatchMock(...args),
}));

vi.mock("../expertEditSubmissionObjectUrls", () => ({
  createExpertEditSubmissionObjectUrls: (...args: unknown[]) =>
    createExpertEditSubmissionObjectUrlsMock(...args),
  cleanupExpertEditSubmissionObjectUrls: (...args: unknown[]) =>
    cleanupExpertEditSubmissionObjectUrlsMock(...args),
  revokeExpertEditSubmissionObjectUrls: (...args: unknown[]) =>
    revokeExpertEditSubmissionObjectUrlsMock(...args),
}));

vi.mock("../../../logic/inpaintSubmission", () => ({
  resolveInpaintPromptReferencePolicy: () => null,
}));

const createArgs = (
  overrides: Partial<Parameters<typeof useExpertEditInlineGenerate>[0]> = {}
): Parameters<typeof useExpertEditInlineGenerate>[0] => ({
  layers: [{ id: "layer-1" } as never],
  promptText: "Refine the outfit",
  extraImageUrls: [null, null, null],
  reusablePrimarySourceUrl: null,
  markupStrokes: [],
  populatedLayerCount: 1,
  editSubmitIntent: "standard",
  hasSelectedLayerMask: false,
  exportSelectedLayerMaskBlob: vi.fn(async () => null),
  onRegenerate: vi.fn(),
  onRegenerateWithReferenceInputs: vi.fn(async () => undefined),
  scheduleTransientObjectUrlRevoke: vi.fn(),
  revokeObjectUrlSafe: vi.fn(),
  resolveBlobDimensions: vi.fn(async () => ({ width: 1024, height: 1024 })),
  showStatusToast: vi.fn(),
  onInvalidPromptReferenceToken: vi.fn(),
  resolveStageFlattenSnapshot: vi.fn(() => ({ outputAspectRatio: 1 })),
  insertOptimisticGenerationPlaceholder: vi.fn(() => "out-optimistic"),
  removeOptimisticGenerationPlaceholder: vi.fn(),
  ...overrides,
});

type MockExportResult = {
  flattenedBlob: Blob | null;
  flattenedMarkupReferenceBlob: Blob | null;
  inpaintMaskBlob: Blob | null;
  reusablePrimarySourceUrl: string | null;
};

describe("useExpertEditInlineGenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateExpertEditSubmissionPromptMock.mockReturnValue({ status: "ready" });
    prepareExpertEditSubmissionMock.mockReturnValue({
      status: "ready",
      referenceInputs: ["https://cdn.test/reusable-primary.png"],
      linkedSecondaryReferenceInputs: [],
      promptOverrideOptions: {
        displayPromptOverride: "Refine the outfit",
        submissionPromptOverride: "Refine the outfit",
      },
    });
    resolveExpertEditSubmissionDispatchMock.mockReturnValue({
      status: "ready",
      referenceInputs: ["https://cdn.test/reusable-primary.png"],
      options: {
        referenceInputsMode: "replace",
      },
    });
    createExpertEditSubmissionObjectUrlsMock.mockReturnValue({
      flattenedUrl: null,
      flattenedMarkupReferenceUrl: null,
      inpaintMaskUrl: null,
    });
    cleanupExpertEditSubmissionObjectUrlsMock.mockReturnValue(undefined);
    revokeExpertEditSubmissionObjectUrlsMock.mockReturnValue(undefined);
  });

  it("shows one immediate optimistic placeholder and reuses its id for submit handoff", async () => {
    let resolveExport: (value: MockExportResult) => void = () => {
      throw new Error("Expected export resolver");
    };
    exportExpertEditStageArtifactsMock.mockReturnValue(
      new Promise<MockExportResult>((resolve) => {
        resolveExport = resolve;
      })
    );
    const insertOptimisticGenerationPlaceholder = vi.fn(() => "out-optimistic");
    const onRegenerateWithReferenceInputs = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useExpertEditInlineGenerate(
        createArgs({
          onRegenerateWithReferenceInputs,
          insertOptimisticGenerationPlaceholder,
        })
      )
    );

    act(() => {
      result.current.handleInlineGenerate();
      result.current.handleInlineGenerate();
    });

    expect(insertOptimisticGenerationPlaceholder).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.isInlineGeneratePending).toBe(true);
    });

    resolveExport({
      flattenedBlob: null,
      flattenedMarkupReferenceBlob: null,
      inpaintMaskBlob: null,
      reusablePrimarySourceUrl: "https://cdn.test/reusable-primary.png",
    });

    await waitFor(() => {
      expect(onRegenerateWithReferenceInputs).toHaveBeenCalledWith(
        ["https://cdn.test/reusable-primary.png"],
        expect.objectContaining({
          outputIdOverride: "out-optimistic",
          referenceInputsMode: "replace",
        })
      );
    });
    await waitFor(() => {
      expect(result.current.isInlineGeneratePending).toBe(false);
    });
    expect(prepareExpertEditSubmissionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        editSubmitIntent: "standard",
      })
    );
  });

  it("removes the optimistic placeholder when export fails before submit", async () => {
    exportExpertEditStageArtifactsMock.mockRejectedValue(new Error("flatten failed"));
    const removeOptimisticGenerationPlaceholder = vi.fn();
    const showStatusToast = vi.fn();

    const { result } = renderHook(() =>
      useExpertEditInlineGenerate(
        createArgs({
          removeOptimisticGenerationPlaceholder,
          showStatusToast,
        })
      )
    );

    act(() => {
      result.current.handleInlineGenerate();
    });

    await waitFor(() => {
      expect(removeOptimisticGenerationPlaceholder).toHaveBeenCalledWith("out-optimistic");
    });
    await waitFor(() => {
      expect(result.current.isInlineGeneratePending).toBe(false);
    });
    expect(showStatusToast).toHaveBeenCalledWith("Unable to flatten layers.");
  });

  it("ignores repeat clicks while the shared edit generation state is already busy", () => {
    const insertOptimisticGenerationPlaceholder = vi.fn(() => "out-optimistic");
    const onRegenerateWithReferenceInputs = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useExpertEditInlineGenerate(
        createArgs({
          isGenerateBusy: true,
          insertOptimisticGenerationPlaceholder,
          onRegenerateWithReferenceInputs,
        })
      )
    );

    act(() => {
      result.current.handleInlineGenerate();
    });

    expect(insertOptimisticGenerationPlaceholder).not.toHaveBeenCalled();
    expect(exportExpertEditStageArtifactsMock).not.toHaveBeenCalled();
    expect(onRegenerateWithReferenceInputs).not.toHaveBeenCalled();
    expect(result.current.isInlineGeneratePending).toBe(false);
  });

  it("passes markup submit intent into Expert Edit submission preparation", async () => {
    const { result } = renderHook(() =>
      useExpertEditInlineGenerate(
        createArgs({
          editSubmitIntent: "markup",
        })
      )
    );

    exportExpertEditStageArtifactsMock.mockResolvedValue({
      flattenedBlob: null,
      flattenedMarkupReferenceBlob: null,
      inpaintMaskBlob: null,
      reusablePrimarySourceUrl: "https://cdn.test/reusable-primary.png",
    });

    act(() => {
      result.current.handleInlineGenerate();
    });

    await waitFor(() => {
      expect(prepareExpertEditSubmissionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          editSubmitIntent: "markup",
        })
      );
    });
  });
});
