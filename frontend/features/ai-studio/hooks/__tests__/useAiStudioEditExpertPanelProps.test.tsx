/**
 * Focused coverage for Expert Edit panel prop wiring.
 * Locks submit options that must survive the panel wrapper before generation submission.
 */
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { useAiStudioEditExpertPanelProps } from "../useAiStudioEditExpertPanelProps";

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioEditExpertPanelProps>[0]> = {}
): Parameters<typeof useAiStudioEditExpertPanelProps>[0] => ({
  aspect: "1:1",
  model: "fal-ai/bytedance/seedream/v4.5/edit",
  currentModelLabel: "Seedream Edit",
  referenceImageUrl: "https://cdn.test/primary.png",
  extraImageUrls: [],
  editReferenceText: "Refine the scene",
  isModelModalOpen: false,
  modelModalAnchor: null,
  setAspect: vi.fn(),
  handleOpenModelModal: vi.fn(),
  setReferenceImageUrl: vi.fn(),
  addPastedMediaReference: vi.fn(),
  setExtraImageUrl: vi.fn(),
  handleEditPromptTextChange: vi.fn(),
  onPinPromptReference: vi.fn(),
  handleImageRegenerateWithDebit: vi.fn(),
  currentCostCredits: null,
  removeBackgroundCostCredits: null,
  isGenerateDisabled: false,
  isPrimaryStageGenerating: false,
  referenceImageWarning: null,
  resolveOutputPreviewUrl: vi.fn(() => null),
  imageResolution: "model_default",
  setImageResolution: vi.fn(),
  characterOptions: [],
  selectedCharacterId: "",
  setSelectedCharacterId: vi.fn(),
  isCharacterOptionsLoading: false,
  isCharacterModeEnabled: false,
  setIsCharacterModeEnabled: vi.fn(),
  refreshCharacterOptions: vi.fn(async () => []),
  resolveCharacterAvatarUrlById: vi.fn(() => null),
  ...overrides,
});

describe("useAiStudioEditExpertPanelProps", () => {
  it("forwards Expert Edit restore-only refs through regenerate options", async () => {
    const handleImageRegenerateWithDebit = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioEditExpertPanelProps(
        createParams({
          handleImageRegenerateWithDebit,
        })
      )
    );

    await result.current.onRegenerateWithReferenceInputs?.(["blob:primary"], {
      referenceInputsMode: "replace",
      referenceInputsLimit: 11,
      expertEditReferences: {
        version: 1,
        maxSecondarySlotCount: 10,
        primaryReferenceInputIndex: 0,
        secondarySlots: [],
        restoreSecondarySlots: [{ slotIndex: 2, sourceUrl: "blob:secondary-local" }],
      },
      expertEditRestoreImageInputs: ["blob:secondary-local"],
    });

    expect(handleImageRegenerateWithDebit).toHaveBeenCalledWith(
      expect.objectContaining({
        referenceInputsOverride: ["blob:primary"],
        referenceInputsMode: "replace",
        referenceInputsLimit: 11,
        expertEditReferences: expect.objectContaining({
          restoreSecondarySlots: [{ slotIndex: 2, sourceUrl: "blob:secondary-local" }],
        }),
        expertEditRestoreImageInputs: ["blob:secondary-local"],
      })
    );
  });
});
