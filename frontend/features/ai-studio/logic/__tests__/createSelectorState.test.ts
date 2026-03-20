import { describe, expect, it } from "vitest";
import { deriveCreateSelectorViewState } from "../createSelectorState";

describe("deriveCreateSelectorViewState", () => {
  it("marks model selector empty and closed when no model is selected", () => {
    const state = deriveCreateSelectorViewState({
      mode: "image",
      modelId: null,
      isModelModalOpen: false,
      modelModalAnchor: null,
      isGenerateDisabled: false,
      hasSufficientCreditsForOutputGenerate: true,
      characterModeEnabled: false,
      selectedCharacterId: "",
      imageResolution: "model_default",
    });

    expect(state.isModelSelectionEmpty).toBe(true);
    expect(state.isCreateModelPickerOpen).toBe(false);
    expect(state.disableOutputGenerate).toBe(true);
  });

  it("opens only the create-model picker anchor", () => {
    const baseParams = {
      mode: "image",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      isGenerateDisabled: false,
      hasSufficientCreditsForOutputGenerate: true,
      characterModeEnabled: false,
      selectedCharacterId: "",
      imageResolution: "model_default",
    } as const;
    const openState = deriveCreateSelectorViewState({
      ...baseParams,
      isModelModalOpen: true,
      modelModalAnchor: "create-model",
    });
    const closedState = deriveCreateSelectorViewState({
      ...baseParams,
      isModelModalOpen: true,
      modelModalAnchor: "edit-model",
    });

    expect(openState.isCreateModelPickerOpen).toBe(true);
    expect(closedState.isCreateModelPickerOpen).toBe(false);
  });

  it("keeps output-generate disabled when character mode is enabled without a selected character", () => {
    const state = deriveCreateSelectorViewState({
      mode: "image",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      isModelModalOpen: false,
      modelModalAnchor: null,
      isGenerateDisabled: false,
      hasSufficientCreditsForOutputGenerate: true,
      characterModeEnabled: true,
      selectedCharacterId: "",
      imageResolution: "model_default",
    });

    expect(state.disableOutputGenerate).toBe(true);
  });

  it("clamps invalid image resolution values and keeps selector card visibility policy", () => {
    const state = deriveCreateSelectorViewState({
      mode: "image",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      isModelModalOpen: false,
      modelModalAnchor: null,
      isGenerateDisabled: false,
      hasSufficientCreditsForOutputGenerate: true,
      characterModeEnabled: false,
      selectedCharacterId: "",
      imageResolution: "not-a-resolution",
    });

    expect(state.imageResolutionValue).toBe("auto_2K");
    expect(state.shouldShowImageResolutionCard).toBe(true);
    expect(state.imageResolutionOptions.length).toBeGreaterThan(0);
  });

  it("normalizes legacy model_default seedream selections to auto_2K", () => {
    const state = deriveCreateSelectorViewState({
      mode: "image",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      isModelModalOpen: false,
      modelModalAnchor: null,
      isGenerateDisabled: false,
      hasSufficientCreditsForOutputGenerate: true,
      characterModeEnabled: false,
      selectedCharacterId: "",
      imageResolution: "model_default",
    });

    expect(state.imageResolutionValue).toBe("auto_2K");
  });
});
