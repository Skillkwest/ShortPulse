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
  notifyGenerationFailure: vi.fn(),
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
    exportExpertEditStageArtifactsMock.mockResolvedValue({
      flattenedBlob: null,
      flattenedMarkupReferenceBlob: null,
      inpaintMaskBlob: null,
      reusablePrimarySourceUrl: "https://cdn.test/reusable-primary.png",
    });
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

  it("ignores duplicate inline generate clicks while a submission is already in flight", async () => {
    const exportResolvers: Array<(value: MockExportResult) => void> = [];
    exportExpertEditStageArtifactsMock.mockImplementation(
      () =>
        new Promise<MockExportResult>((resolve) => {
          exportResolvers.push(resolve);
        })
    );
    const insertOptimisticGenerationPlaceholder = vi.fn().mockReturnValue("out-optimistic-1");
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

    act(() => {
      exportResolvers[0]?.({
        flattenedBlob: null,
        flattenedMarkupReferenceBlob: null,
        inpaintMaskBlob: null,
        reusablePrimarySourceUrl: "https://cdn.test/reusable-primary.png",
      });
    });

    await waitFor(() => {
      expect(onRegenerateWithReferenceInputs).toHaveBeenCalledWith(
        ["https://cdn.test/reusable-primary.png"],
        expect.objectContaining({
          outputIdOverride: "out-optimistic-1",
          referenceInputsMode: "replace",
        })
      );
    });
    await waitFor(() => {
      expect(result.current.isInlineGeneratePending).toBe(false);
    });
    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
    expect(prepareExpertEditSubmissionMock).toHaveBeenCalledWith(
      expect.objectContaining({
        editSubmitIntent: "standard",
      })
    );
  });

  it("marks the optimistic placeholder failed when export fails before submit", async () => {
    exportExpertEditStageArtifactsMock.mockRejectedValue(new Error("flatten failed"));
    const removeOptimisticGenerationPlaceholder = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const showStatusToast = vi.fn();

    const { result } = renderHook(() =>
      useExpertEditInlineGenerate(
        createArgs({
          removeOptimisticGenerationPlaceholder,
          notifyGenerationFailure,
          showStatusToast,
        })
      )
    );

    act(() => {
      result.current.handleInlineGenerate();
    });

    await waitFor(() => {
      expect(notifyGenerationFailure).toHaveBeenCalledWith(
        "out-optimistic",
        "Unable to flatten layers.",
        "Unable to flatten layers."
      );
    });
    expect(removeOptimisticGenerationPlaceholder).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.isInlineGeneratePending).toBe(false);
    });
    expect(showStatusToast).toHaveBeenCalledWith("Unable to flatten layers.");
  });

  it("marks the optimistic placeholder failed when submission dispatch rejects the request", async () => {
    resolveExpertEditSubmissionDispatchMock.mockReturnValue({
      status: "error",
      message: "Select a layer mask before inpainting.",
    });
    const removeOptimisticGenerationPlaceholder = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const showStatusToast = vi.fn();

    const { result } = renderHook(() =>
      useExpertEditInlineGenerate(
        createArgs({
          removeOptimisticGenerationPlaceholder,
          notifyGenerationFailure,
          showStatusToast,
        })
      )
    );

    act(() => {
      result.current.handleInlineGenerate();
    });

    await waitFor(() => {
      expect(notifyGenerationFailure).toHaveBeenCalledWith(
        "out-optimistic",
        "Select a layer mask before inpainting.",
        "Select a layer mask before inpainting."
      );
    });
    expect(removeOptimisticGenerationPlaceholder).not.toHaveBeenCalled();
    expect(showStatusToast).toHaveBeenCalledWith("Select a layer mask before inpainting.");
  });

  it("reports submit handler failures with the submission error instead of a flatten fallback", async () => {
    const removeOptimisticGenerationPlaceholder = vi.fn();
    const notifyGenerationFailure = vi.fn();
    const showStatusToast = vi.fn();
    const onRegenerateWithReferenceInputs = vi.fn(async () => {
      throw new Error("Credits check failed.");
    });

    const { result } = renderHook(() =>
      useExpertEditInlineGenerate(
        createArgs({
          onRegenerateWithReferenceInputs,
          removeOptimisticGenerationPlaceholder,
          notifyGenerationFailure,
          showStatusToast,
        })
      )
    );

    act(() => {
      result.current.handleInlineGenerate();
    });

    await waitFor(() => {
      expect(notifyGenerationFailure).toHaveBeenCalledWith(
        "out-optimistic",
        "Credits check failed.",
        "Credits check failed."
      );
    });
    expect(removeOptimisticGenerationPlaceholder).not.toHaveBeenCalled();
    expect(showStatusToast).toHaveBeenCalledWith("Credits check failed.");
  });

  it("allows valid clicks while the shared edit generation state is already busy", async () => {
    const insertOptimisticGenerationPlaceholder = vi.fn(() => "out-optimistic");
    const onRegenerateWithReferenceInputs = vi.fn(async () => undefined);

    const { result } = renderHook(() =>
      useExpertEditInlineGenerate(
        createArgs({
          insertOptimisticGenerationPlaceholder,
          onRegenerateWithReferenceInputs,
        })
      )
    );

    act(() => {
      result.current.handleInlineGenerate();
    });

    expect(insertOptimisticGenerationPlaceholder).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
    });
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
