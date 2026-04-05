import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useExpertEditInlineGenerate } from "../useExpertEditInlineGenerate";

const composePrimaryStageLayersToBlobMock = vi.fn();
const buildExpertEditSubmissionReferenceInputsMock = vi.fn();
const analyzeExpertEditPromptTokensMock = vi.fn();
const compileExpertEditSubmissionPromptMock = vi.fn();

vi.mock("../../../logic/expertEditStageFlatten", () => ({
  composePrimaryStageLayersToBlob: (...args: unknown[]) =>
    composePrimaryStageLayersToBlobMock(...args),
}));

vi.mock("../../../logic/expertEditPromptReferences", () => ({
  analyzeExpertEditPromptTokens: (...args: unknown[]) => analyzeExpertEditPromptTokensMock(...args),
  buildExpertEditSubmissionReferenceInputs: (...args: unknown[]) =>
    buildExpertEditSubmissionReferenceInputsMock(...args),
  compileExpertEditSubmissionPrompt: (...args: unknown[]) =>
    compileExpertEditSubmissionPromptMock(...args),
}));

vi.mock("../../../logic/inpaintSubmission", () => ({
  INPAINT_FLUX_FILL_MODEL_ID: "flux-fill",
  MARKUP_NANO_BANANA_PRO_EDIT_MODEL_ID: "nano-banana",
  isMarkupModelLockEnabled: () => false,
  isMarkupStrokeSecondaryReferenceEnabled: () => false,
}));

vi.mock("../../../logic/expertEditMarkupReference", () => ({
  composeFlattenedMarkupReferenceBlob: vi.fn(),
}));

const createArgs = (
  overrides: Partial<Parameters<typeof useExpertEditInlineGenerate>[0]> = {}
): Parameters<typeof useExpertEditInlineGenerate>[0] => ({
  layers: [{ id: "layer-1" } as never],
  promptText: "Refine the scene",
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
  ...overrides,
});

describe("useExpertEditInlineGenerate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyzeExpertEditPromptTokensMock.mockReturnValue({
      hasInvalidTokens: false,
      inlineError: null,
      referencedSlotIndexes: new Set<number>(),
    });
    buildExpertEditSubmissionReferenceInputsMock.mockImplementation(
      ({ flattenedPrimaryUrl }: { flattenedPrimaryUrl: string | null }) => [flattenedPrimaryUrl]
    );
    compileExpertEditSubmissionPromptMock.mockReturnValue({
      hasTokenReferences: false,
      submissionPrompt: "Refine the scene",
    });
    composePrimaryStageLayersToBlobMock.mockResolvedValue(
      new Blob(["flattened"], { type: "image/png" })
    );
  });

  it("uses the latest reusable primary source url after rerendering", async () => {
    const onRegenerateWithReferenceInputs = vi.fn(async () => undefined);
    const { result, rerender } = renderHook(
      (props: Parameters<typeof useExpertEditInlineGenerate>[0]) =>
        useExpertEditInlineGenerate(props),
      {
        initialProps: createArgs({
          reusablePrimarySourceUrl: null,
          onRegenerateWithReferenceInputs,
        }),
      }
    );

    rerender(
      createArgs({
        reusablePrimarySourceUrl: "https://cdn.test/reusable-primary.png",
        onRegenerateWithReferenceInputs,
      })
    );

    act(() => {
      result.current.handleInlineGenerate();
    });

    await waitFor(() => {
      expect(onRegenerateWithReferenceInputs).toHaveBeenCalledWith(
        ["https://cdn.test/reusable-primary.png"],
        expect.objectContaining({
          referenceInputsMode: "replace",
        })
      );
    });
    expect(composePrimaryStageLayersToBlobMock).not.toHaveBeenCalled();
    expect(buildExpertEditSubmissionReferenceInputsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        flattenedPrimaryUrl: "https://cdn.test/reusable-primary.png",
      })
    );
  });
});
