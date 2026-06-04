import { act, renderHook } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInternalMediaRef } from "../../../../lib/media/internalMediaRefs";
import type { StudioOutput } from "../../types";
import { useAiStudioPageGenerationRuntime } from "../useAiStudioPageGenerationRuntime";

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

vi.mock("../useAiStudioOptimisticDebitReconciliation", () => ({
  useAiStudioOptimisticDebitReconciliation: () => ({
    visibleFailures: [],
    dismissFailure: vi.fn(),
    focusFailure: vi.fn(),
  }),
}));

vi.mock("../useAiStudioPageDerivations", () => ({
  useAiStudioPageDerivations: () => ({
    isTemplateView: false,
    costParamsForModel: vi.fn(() => ({})),
    filteredModelOptions: [],
    resolveDefaultPromptForTool: (tool: string | null) =>
      tool === "edit" ? "edit prompt" : "User visible prompt",
    promptForViewModel: "User visible prompt",
  }),
}));

vi.mock("../useAiStudioViewModel", () => ({
  useAiStudioViewModel: () => ({
    currentCostCredits: 2,
    promptReferenceGenerateCostCredits: null,
    resolveModelPickerCredits: vi.fn(() => null),
    hasSufficientCreditsForPromptReferenceGenerate: true,
    isCreditGuardrail: false,
    generationGuardrail: null,
    referenceImageWarning: null,
  }),
}));

vi.mock("../useAiStudioWorkspaceActions", () => ({
  useAiStudioWorkspaceActions: () => ({
    handleOpenModelModal: vi.fn(),
    handleSelectModelFromModal: vi.fn(),
    handleManualPromptChange: vi.fn(),
    handleEditPromptTextChange: vi.fn(),
    handleVideoPromptTextChange: vi.fn(),
    handleToolSelect: vi.fn(),
    handleOpenMediaLibrary: vi.fn(),
    handleFileBrowserSelection: vi.fn(),
    handleReferenceGridFiles: vi.fn(),
    handleSelectOutput: vi.fn(),
  }),
}));

vi.mock("../useAiStudioAudioGeneration", () => ({
  useAiStudioAudioGeneration: () => ({
    musicIsGenerating: false,
    voicesIsGenerating: false,
    soundEffectsIsGenerating: false,
    handleVoicesGenerate: vi.fn(),
    handleMusicGenerate: vi.fn(),
    handleSoundEffectsGenerate: vi.fn(),
  }),
}));

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioPageGenerationRuntime>[0]> = {}
): Parameters<typeof useAiStudioPageGenerationRuntime>[0] => ({
  activeCreatePrompt: "User visible prompt",
  activeOutput: null,
  activeOutputId: null,
  addCharacterReferences: vi.fn(),
  addOutputsFromFiles: vi.fn(),
  aspect: "9:16",
  balanceCredits: 100,
  balanceError: null,
  balanceLoading: false,
  createCharacterModeInjectionBundle: null,
  createSelectedCharacterId: "char-1",
  editReferenceText: "",
  editSubmitIntent: "standard",
  extraImageUrls: [null, null, null],
  generateOutput: vi.fn(),
  getDefaultDurationSeconds: vi.fn(() => 6),
  imageResolution: "model_default",
  insertOptimisticGenerationPlaceholder: vi.fn(() => null),
  isCreateCharacterBundleLoading: false,
  isCreateCharacterModeEnabled: true,
  mode: "image",
  model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
  modelPricingPolicyReady: true,
  motionReferenceVideoPending: false,
  motionReferenceVideoError: null,
  motionReferenceVideoUrl: null,
  notifyGenerationFailure: vi.fn(),
  optimisticDebitEntries: [],
  outputs: [],
  closeModelModal: vi.fn(),
  openModelModal: vi.fn(),
  projectId: null,
  referenceImageUrl: null,
  refreshBalance: vi.fn(async () => 100),
  refreshCharacterModeInjectionBundleForSubmission: vi.fn(async () => null),
  regenerateOutput: vi.fn(),
  removeOptimisticGenerationPlaceholder: vi.fn(),
  resolveCharacterModeSubmissionOverrides: vi.fn(() => null),
  resolveIsCharacterModeEnabledForTool: vi.fn((tool) => tool === "create" || tool === "text"),
  resolveReferenceInputsForTool: vi.fn(() => ({
    referenceImageUrl: null,
    extraImageUrls: [null, null, null] as [string | null, string | null, string | null],
  })),
  resolveSelectedCharacterIdForTool: vi.fn(() => "char-1"),
  selectedStyleContext: null,
  selectedTool: "create",
  setActiveOutputId: asDispatch<string | null>(vi.fn()),
  setDetailOutputId: asDispatch<string | null>(vi.fn()),
  setEditReferenceText: vi.fn(),
  setMode: asDispatch(vi.fn()),
  setModel: vi.fn(),
  setOptimisticDebitEntries: asDispatch(vi.fn()),
  setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
  setPromptOrigin: asDispatch(vi.fn()),
  setCreatePromptForActiveMode: vi.fn(),
  setShowCreateTools: asDispatch(vi.fn()),
  setUiError: asDispatch<string | null>(vi.fn()),
  setUiNotice: asDispatch<string | null>(vi.fn()),
  setVideoReferenceText: vi.fn(),
  setSelectedToolWithEditIntentReset: vi.fn(),
  trackCharacterModeFallback: vi.fn(),
  trackUiEvent: vi.fn(),
  updateOutputById: vi.fn(),
  useReferenceImageIndicator: false,
  videoDurationSeconds: 6,
  videoGenerateAudio: false,
  videoReferenceMode: "standard",
  videoReferenceText: "",
  videoResolution: "1080p",
  ...overrides,
});

describe("useAiStudioPageGenerationRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("hands refreshed Create Character Mode context to generation submit", async () => {
    const refreshedBundle = {
      characterId: "char-1",
      characterDescription: "Fresh character description",
      sheetReferenceStoragePaths: ["user/chars/fresh.png"],
      sheetReferenceUrls: ["https://signed.test/user%2Fchars%2Ffresh.png"],
      loadedAtMs: Date.now(),
    };
    const refreshCharacterModeInjectionBundleForSubmission = vi.fn(async () => refreshedBundle);
    const resolveCharacterModeSubmissionOverrides = vi.fn(() => ({
      submissionPromptOverride: "Fresh character description\n\nUser visible prompt",
      displayPromptOverride: "User visible prompt",
      referenceInputsOverride: [],
      internalMediaRefsOverride: [createInternalMediaRef({ storagePath: "user/chars/fresh.png" })],
      characterContextOverride: {
        applied: true,
        characterId: "char-1",
        characterName: "Taylor",
        characterProfileImageUrl: null,
      } as StudioOutput["characterContext"],
      notice: null,
      fallbackCode: null,
      characterReferenceCount: 1,
      hasCharacterDescription: true,
    }));
    const generateOutput = vi.fn();
    const setModel = vi.fn();
    const trackUiEvent = vi.fn();
    const params = createParams({
      generateOutput,
      refreshCharacterModeInjectionBundleForSubmission,
      resolveCharacterModeSubmissionOverrides,
      setModel,
      trackUiEvent,
    });
    const { result } = renderHook(() => useAiStudioPageGenerationRuntime(params));

    await act(async () => {
      await result.current.handleGenerate("User visible prompt", {
        modeOverride: "image",
        toolOverride: "create",
        costOverrideCredits: 2,
      });
    });

    expect(refreshCharacterModeInjectionBundleForSubmission).toHaveBeenCalledWith("create");
    expect(resolveCharacterModeSubmissionOverrides).toHaveBeenCalledWith(
      "User visible prompt",
      "create",
      refreshedBundle,
      []
    );
    expect(setModel).toHaveBeenCalledWith("fal-ai/bytedance/seedream/v4.5/edit");
    expect(trackUiEvent).toHaveBeenCalledWith(
      "character_mode_submit_invariant_coerced",
      expect.objectContaining({
        trigger: "generate",
        from_model_id: "fal-ai/bytedance/seedream/v4.5/text-to-image",
        to_model_id: "fal-ai/bytedance/seedream/v4.5/edit",
      })
    );
    expect(generateOutput).toHaveBeenCalledWith(
      "User visible prompt",
      expect.objectContaining({
        modeOverride: "image",
        selectedToolOverride: "create",
        modelIdOverride: "fal-ai/bytedance/seedream/v4.5/edit",
        submissionPromptOverride: "Fresh character description\n\nUser visible prompt",
        displayPromptOverride: "User visible prompt",
        referenceInputsOverride: [],
        internalMediaRefsOverride: [
          {
            version: 1,
            kind: "storage_object",
            bucket: "media_library",
            storagePath: "user/chars/fresh.png",
          },
        ],
        displayedBilledCredits: 2,
        characterContextOverride: expect.objectContaining({
          characterId: "char-1",
          characterName: "Taylor",
        }),
      })
    );
  });

  it("blocks Create Character Mode at the page-generation seam when no character references resolve", async () => {
    const setUiError = vi.fn();
    const generateOutput = vi.fn();
    const trackUiEvent = vi.fn();
    const trackCharacterModeFallback = vi.fn();
    const resolveCharacterModeSubmissionOverrides = vi.fn(() => ({
      submissionPromptOverride: "User visible prompt",
      displayPromptOverride: "User visible prompt",
      referenceInputsOverride: [],
      notice: null,
      fallbackCode: "no_character_selected" as const,
      characterReferenceCount: 0,
      hasCharacterDescription: false,
    }));
    const params = createParams({
      createSelectedCharacterId: "",
      generateOutput,
      resolveCharacterModeSubmissionOverrides,
      resolveSelectedCharacterIdForTool: vi.fn(() => null),
      setUiError: asDispatch<string | null>(setUiError),
      trackCharacterModeFallback,
      trackUiEvent,
    });
    const { result } = renderHook(() => useAiStudioPageGenerationRuntime(params));

    await act(async () => {
      await result.current.handleGenerate("User visible prompt", {
        modeOverride: "image",
        toolOverride: "create",
      });
    });

    expect(generateOutput).not.toHaveBeenCalled();
    expect(trackCharacterModeFallback).toHaveBeenCalledWith(
      expect.objectContaining({
        fallbackCode: "no_character_selected",
        characterReferenceCount: 0,
      }),
      "create"
    );
    expect(trackUiEvent).toHaveBeenCalledWith(
      "character_mode_submit_blocked_no_references",
      expect.objectContaining({
        fallback_code: "no_character_selected",
        character_reference_count: 0,
      })
    );
    expect(setUiError).toHaveBeenCalledWith(
      "Character Mode requires at least one character image before generating."
    );
  });
});
