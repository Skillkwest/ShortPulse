/**
 * AI Studio page integration tests for Character Mode submission wiring.
 * Verifies Create workflow prompt/reference injection and stale bundle refresh behavior.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ModelModal } from "../../features/ai-studio/components/ModelModal";
import type { StudioOutput } from "../../features/ai-studio/types";
import { StandardCreatePropertiesPanel } from "../../features/ai-studio/components/create/StandardCreatePropertiesPanel";
import { createDefaultCharacterSheetPresetState } from "../../features/character-manager/constants";
import type { CharacterManagerDraftSnapshot } from "../../features/character-manager/logic/characterManagerPersistence";
import { readSupabaseUserId } from "../../lib/supabaseClient";
import AiStudioPage from "../../pages/ai-studio";

vi.mock("next/router", () => ({
  useRouter: () => ({
    pathname: "/ai-studio",
    query: {},
    isReady: true,
    push: async () => true,
    replace: async () => true,
    prefetch: async () => undefined,
  }),
}));

const {
  refreshBalanceMock,
  listCharacterManagerCharactersMock,
  loadCharacterManagerDraftByCharacterIdMock,
  getSignedMediaUrlsBatchMock,
  addBreadcrumbMock,
  reportAppErrorMock,
  aiStudioStateMock,
  creditsStateMock,
  aiStudioPageContentCapture,
} = vi.hoisted(() => ({
  ...(() => {
    const generateOutputMock = vi.fn();
    const regenerateOutputMock = vi.fn();
    const setUiNoticeMock = vi.fn();
    const creditsStateMock = {
      balanceCents: 10_000,
      balanceReservedCents: null as number | null,
      balanceLoading: false,
      refreshSource: "fallback" as "snapshot" | "fallback",
    };
    const refreshBalanceMock = vi.fn(
      async (options?: {
        beforeCommit?: (snapshot: {
          cents: number;
          updatedAt: string | null;
          reservedCents?: number | null;
          source?: "snapshot" | "fallback";
        }) => void;
      }) => {
        const cents = creditsStateMock.balanceCents;
        options?.beforeCommit?.({
          cents: cents ?? 0,
          updatedAt: null,
          reservedCents: creditsStateMock.balanceReservedCents,
          source: creditsStateMock.refreshSource,
        });
        return cents;
      }
    );
    const listCharacterManagerCharactersMock = vi.fn();
    const loadCharacterManagerDraftByCharacterIdMock = vi.fn();
    const getSignedMediaUrlsBatchMock = vi.fn();
    const addBreadcrumbMock = vi.fn();
    const reportAppErrorMock = vi.fn();
    const aiStudioPageContentCapture = {
      lastProps: null as {
        balanceCredits?: number | null;
        pendingHoldCredits?: number | null;
        propertiesCreate?: {
          expertCreateMode: "standard" | "pulse";
          standard?: {
            characterOptions?: Array<{
              id: string;
              name: string;
              profileImageUrl: string | null;
            }>;
          };
        };
        modelModalState?: {
          context?: string | null;
          options?: Array<{
            value: string;
            label: string;
          }>;
          onPresentationResolved?: (payload: {
            context: string | null;
            suppliedOptionCount: number;
            visibleOptionCount: number;
          }) => void;
        };
      } | null,
    };
    return {
      generateOutputMock,
      refreshBalanceMock,
      listCharacterManagerCharactersMock,
      loadCharacterManagerDraftByCharacterIdMock,
      getSignedMediaUrlsBatchMock,
      addBreadcrumbMock,
      reportAppErrorMock,
      creditsStateMock,
      aiStudioPageContentCapture,
      aiStudioStateMock: {
        promptRef: { current: null },
        mode: "image",
        setMode: vi.fn(),
        aspect: "9:16",
        setAspect: vi.fn(),
        model: "fal-ai/bytedance/seedream/v4.5/edit",
        setModel: vi.fn(),
        currentModelLabel: "Seedream 4.5 Edit",
        prompt: "User visible prompt",
        outputs: [] as StudioOutput[],
        archivedOutputs: [] as StudioOutput[],
        setOutputs: vi.fn(),
        resetReferenceGridState: vi.fn(),
        curatedReferenceIds: [] as string[],
        removedFromAllRefsIds: [] as string[],
        addCuratedReference: vi.fn(),
        removeCuratedReference: vi.fn(),
        reorderCuratedReference: vi.fn(),
        activeOutput: null,
        activeOutputId: null,
        setActiveOutputId: vi.fn(),
        selectedTool: "create",
        setSelectedTool: vi.fn(),
        showCreateTools: true,
        setShowCreateTools: vi.fn(),
        referenceImageUrl: null,
        setReferenceImageUrl: vi.fn(),
        extraImageUrls: [null, null, null] as [null, null, null],
        setExtraImageUrl: vi.fn(),
        videoReferenceMode: "standard",
        setVideoReferenceMode: vi.fn(),
        videoDurationSeconds: 6,
        setVideoDurationSeconds: vi.fn(),
        videoResolution: "1080p",
        setVideoResolution: vi.fn(),
        imageResolution: "model_default",
        setImageResolution: vi.fn(),
        videoGenerateAudio: false,
        setVideoGenerateAudio: vi.fn(),
        videoCameraFixed: false,
        setVideoCameraFixed: vi.fn(),
        videoAutoFix: false,
        setVideoAutoFix: vi.fn(),
        klingNegativePrompt: "",
        setKlingNegativePrompt: vi.fn(),
        klingCfgScale: 0.5,
        setKlingCfgScale: vi.fn(),
        klingShotType: "customize",
        setKlingShotType: vi.fn(),
        klingVoiceIds: ["", ""] as [string, string],
        setKlingVoiceIds: vi.fn(),
        klingMultiPrompts: [],
        setKlingMultiPrompts: vi.fn(),
        klingElements: [],
        setKlingElements: vi.fn(),
        motionReferenceVideoUrl: null,
        setMotionReferenceVideoUrl: vi.fn(),
        editReferenceText: "",
        setEditReferenceText: vi.fn(),
        videoReferenceText: "",
        setVideoReferenceText: vi.fn(),
        expertEditSessionState: null,
        setExpertEditSessionState: vi.fn(),
        setSharedPrompt: vi.fn(),
        useReferenceImageIndicator: false,
        detailOutput: null,
        setDetailOutputId: vi.fn(),
        isModelModalOpen: false,
        modelModalAnchor: null,
        modelModalContext: null,
        modelModalPosition: null,
        isPromptGenerating: false,
        generateOutput: generateOutputMock,
        regenerateOutput: regenerateOutputMock,
        saveReferenceToLibrary: vi.fn(),
        savePromptToLibrary: vi.fn(),
        addOutputsFromFiles: vi.fn(),
        addLibraryMediaReference: vi.fn(),
        addLibraryPromptReference: vi.fn(),
        toggleReferenceIndicator: vi.fn(),
        openModelModal: vi.fn(),
        closeModelModal: vi.fn(),
        resolvePreviewUrlById: vi.fn(() => null),
        updateOutputPrompt: vi.fn(),
        deleteOutput: vi.fn(),
        uiError: null,
        setUiError: vi.fn(),
        uiNotice: null,
        setUiNotice: setUiNoticeMock,
        getDefaultDurationSeconds: vi.fn(() => 6),
        getAgentContext: vi.fn(() => ({
          selectedReferenceIds: [],
          references: [],
          media: [],
        })),
        onReferenceOutputMediaLoaded: vi.fn(),
        retryOutputStatus: vi.fn(),
        addAgentPromptReference: vi.fn(),
        addPastedPromptReference: vi.fn(),
        addPastedMediaReference: vi.fn(),
      },
    };
  })(),
}));

let nowMs = 1_000_000;

vi.mock("next/head", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("../../features/ai-studio/components/create/StandardCreatePanelView", () => ({
  StandardCreatePanelView: ({
    onCreateModelOpen,
  }: {
    onCreateModelOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
  }) => (
    <div>
      <button type="button" onClick={onCreateModelOpen}>
        open-model-picker
      </button>
    </div>
  ),
}));

vi.mock("../../features/ai-studio/components/modal-layer/AiStudioModalLayer", () => ({
  AiStudioModalLayer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  AiStudioModalActivityProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAiStudioModalActivity: () => false,
}));

vi.mock("../../features/ai-studio/hooks/useAvatarResilience", () => ({
  useAvatarResilience: () => ({
    resolveAvatarUrl: (_id: string, url: string | null) => url,
    clearAvatarFailure: vi.fn(),
    handleAvatarError: vi.fn(async () => undefined),
  }),
}));

vi.mock("../../features/ai-studio/logic/createSelectorState", () => ({
  deriveCreateSelectorViewState: () => ({
    imageResolutionOptions: [],
    imageResolutionValue: "model_default",
    shouldShowImageResolutionCard: false,
    isModelSelectionEmpty: false,
    isCreateModelPickerOpen: false,
    disableOutputGenerate: false,
  }),
}));

vi.mock("../../features/ai-studio/logic/modelRegistry", () => ({
  getModelConfig: () => null,
}));

vi.mock("../../features/ai-studio/components/create/useCreateCharacterModeController", async () => {
  const actual = await vi.importActual(
    "../../features/ai-studio/components/create/useCreateCharacterModeController"
  );
  return {
    ...(actual as object),
    useCreateCharacterModeController: () => ({
      isCharacterPickerOpen: false,
      openCharacterPicker: vi.fn(),
      closeCharacterPicker: vi.fn(),
      handleCharacterModeEnabledToggle: vi.fn(),
      characterSelectDisabled: false,
      isCharacterSelectionEmpty: false,
      selectedCharacterName: "Taylor",
      selectedCharacterDisplayName: "Taylor",
      selectedCharacterProfileImageUrl: null,
      selectedCharacterInitials: "T",
    }),
  };
});

vi.mock("../../features/ai-studio/components/AiStudioPageContent", () => ({
  AiStudioPageContent: (props: {
    propertiesCreate: {
      expertCreateMode: "standard" | "pulse";
      standard?: {
        onGenerate: () => void;
        onSelectedCharacterIdChange?: (value: string, lookId: string) => void;
        onCharacterModeEnabledChange?: (value: boolean) => void;
        characterOptions?: Array<{ id: string; name: string; profileImageUrl: string | null }>;
      };
    };
    balanceCredits?: number | null;
    pendingHoldCredits?: number | null;
  }) => {
    aiStudioPageContentCapture.lastProps = props;
    const standardCreateProps =
      props.propertiesCreate.expertCreateMode === "standard"
        ? props.propertiesCreate.standard
        : null;
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            standardCreateProps?.onCharacterModeEnabledChange?.(true);
          }}
        >
          enable-character-mode
        </button>
        <button
          type="button"
          onClick={() => {
            standardCreateProps?.onSelectedCharacterIdChange?.("char-1", "look-1");
          }}
        >
          select-character
        </button>
        {standardCreateProps ? (
          <StandardCreatePropertiesPanel
            {...(standardCreateProps as React.ComponentProps<typeof StandardCreatePropertiesPanel>)}
          />
        ) : null}
        <button type="button" onClick={() => standardCreateProps?.onGenerate()}>
          generate
        </button>
      </div>
    );
  },
}));

vi.mock("../../features/ai-studio/components/MediaLibraryModal", () => ({
  MediaLibraryModal: () => null,
}));

vi.mock("../../features/ai-studio/hooks/useCredits", () => ({
  useCredits: () => ({
    balanceCents: creditsStateMock.balanceCents,
    balanceReservedCents: creditsStateMock.balanceReservedCents,
    balanceLoading: creditsStateMock.balanceLoading,
    refreshBalance: refreshBalanceMock,
  }),
}));

vi.mock("../../features/character/hooks/useCharacterWorkflow", () => ({
  useCharacterWorkflow: () => ({
    identity: { identityToken: null, quality: "draft", references: [] },
    aspect: "9:16",
    modelId: null,
    engine: "cloud",
    prompt: "",
    poseId: null,
    isBuildingIdentity: false,
    isGenerating: false,
    error: null,
    hasWebGpu: false,
    modelsAvailable: [],
    capabilityMessage: null,
    setPrompt: vi.fn(),
    setAspect: vi.fn(),
    setModelId: vi.fn(),
    setEngine: vi.fn(),
    setPoseId: vi.fn(),
    addReferences: vi.fn(),
    removeReference: vi.fn(),
    buildIdentity: vi.fn(),
    generate: vi.fn(),
    clearError: vi.fn(),
  }),
}));

vi.mock("../../features/character-manager/logic/characterManagerPersistence", () => ({
  listCharacterManagerCharacters: listCharacterManagerCharactersMock,
  loadCharacterManagerDraftByCharacterId: loadCharacterManagerDraftByCharacterIdMock,
}));
vi.mock("../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: (...args: unknown[]) => getSignedMediaUrlsBatchMock(...args),
}));

vi.mock("../../features/ai-studio/logic/imageDescription", () => ({
  prepareImageUrl: vi.fn(async (url: string) => url),
}));

vi.mock("../../lib/supabaseClient", async () => {
  const { createSupabaseClientModuleMock } = await import("../support/supabaseClientMock");
  return createSupabaseClientModuleMock();
});

vi.mock("../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: addBreadcrumbMock,
}));
vi.mock("../../lib/appErrorReporter", () => ({
  reportAppError: (...args: unknown[]) => reportAppErrorMock(...args),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioState", () => ({
  useAiStudioState: () => aiStudioStateMock,
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioPageGenerationRuntime", () => ({
  useAiStudioPageGenerationRuntime: () => ({
    currentCostCredits: null,
    dismissFailure: vi.fn(),
    effectiveGenerationGuardrail: null,
    effectiveIsGenerateDisabled: false,
    filteredModelOptions: [
      { value: "fal-ai/bytedance/seedream/v4.5/edit", label: "Seedream 4.5" },
      { value: "fal-ai/nano-banana-2/edit", label: "Nano Banana 2" },
    ],
    focusFailure: vi.fn(),
    handleEditPromptTextChange: vi.fn(),
    handleFileBrowserSelection: vi.fn(),
    handleGenerate: vi.fn(),
    handleImageRegenerateWithDebit: vi.fn(),
    handleManualPromptChange: vi.fn(),
    handleMusicGenerate: vi.fn(),
    handleOpenMediaLibrary: vi.fn(),
    handleOpenModelModal: (anchorId: string, target: HTMLElement, context?: unknown) =>
      aiStudioStateMock.openModelModal(anchorId, target, context),
    handleReferenceGridFiles: vi.fn(),
    handleRegenerateWithDebit: vi.fn(),
    handleSelectModelFromModal: vi.fn(),
    handleSelectOutput: vi.fn(),
    handleSoundEffectsGenerate: vi.fn(),
    handleToolSelect: vi.fn(),
    handleVideoPromptTextChange: vi.fn(),
    handleVoicesGenerate: vi.fn(),
    hasSufficientCreditsForPromptReferenceGenerate: true,
    isTemplateView: false,
    musicIsGenerating: false,
    promptReferenceGenerateCostCredits: null,
    referenceImageWarning: null,
    resolveModelPickerCredits: vi.fn(() => null),
    soundEffectsIsGenerating: false,
    visibleFailures: [],
    voicesIsGenerating: false,
  }),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioSessionIdentity", () => ({
  useAiStudioSessionIdentity: () => ({ sessionId: "test-session-id" }),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioProjectIdentity", () => ({
  useAiStudioProjectIdentity: () => ({
    projectId: null,
    project: null,
    status: "idle",
    error: null,
    refreshProject: vi.fn(),
    updateProjectTitle: vi.fn(async () => null),
  }),
}));

vi.mock("../../features/ai-studio/hooks/useMediaAutosavePreference", () => ({
  useMediaAutosavePreference: () => ({
    mediaAutosaveEnabled: false,
    syncState: "ready",
    error: null,
  }),
}));

vi.mock("../../features/ai-studio/hooks/useExpertEditPresetPanelPreference", () => ({
  useExpertEditPresetPanelPreference: () => ({
    presetPanelIds: [],
    customPresetOverrides: {},
    setPresetPanelIds: vi.fn(),
    setCustomPresetOverrides: vi.fn(),
  }),
}));

vi.mock("../../features/ai-studio/hooks/useCreatePulsePresetPanelPreference", () => ({
  useCreatePulsePresetPanelPreference: () => ({
    presetPanelIds: [],
    savedPresets: [],
    setPresetPanelIds: vi.fn(),
    setSavedPresets: vi.fn(),
  }),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioCreateModeRuntime", () => ({
  useAiStudioCreateModeRuntime: () => ({
    expertCreateMode: false,
    activeCreatePulsePresetId: null,
    pulseWorkflowSession: null,
    setExpertCreateMode: vi.fn(),
    setActiveCreatePulsePresetId: vi.fn(),
    setPulseWorkflowSession: vi.fn(),
    clearPulseRuntime: vi.fn(),
    handleExpertCreateModeChange: vi.fn(),
    handleActiveCreatePulsePresetIdChange: vi.fn(),
  }),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioPageOutputAdapters", () => ({
  useAiStudioPageOutputAdapters: () => ({
    inFlightOutputIds: new Set<string>(),
    resolvePanelOutputPreviewUrl: () => null,
    resolveReferenceInputsForTool: () => ({
      referenceImageUrl: null,
      extraImageUrls: [null, null, null],
    }),
    findOutputById: () => null,
  }),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioPageCreditDerivations", () => ({
  useAiStudioPageCreditDerivations: () => ({
    optimisticUncoveredDebitCredits: 0,
    pendingHoldCredits: null,
    effectiveBalanceCredits: 10_000,
    referenceGridPreconnectOrigin: null,
  }),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioPerfAuditRuntime", () => ({
  useAiStudioPerfAuditRuntime: () => undefined,
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioPageSessionPersistence", () => ({
  useAiStudioPageSessionPersistence: () => ({
    sessionRestoreCandidate: {
      status: "idle",
      result: "idle",
      snapshot: null,
      source: "none",
      error: null,
      retry: vi.fn(),
    },
    sessionSnapshot: null,
    projectBootstrapApplied: false,
    projectBootstrapError: null,
    retryProjectBootstrap: vi.fn(),
  }),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioPageUiNotices", () => ({
  useAiStudioPageUiNotices: () => ({
    effectiveUiNotice: null,
  }),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioOptimisticDebitReconciliation", () => ({
  useAiStudioOptimisticDebitReconciliation: () => ({
    visibleFailures: [],
    dismissFailure: vi.fn(),
    focusFailure: vi.fn(),
  }),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioPageDerivations", () => ({
  useAiStudioPageDerivations: () => ({
    isTemplateView: false,
    costParamsForModel: null,
    filteredModelOptions: [],
    resolveDefaultPromptForTool: () => "",
    promptForViewModel: "User visible prompt",
  }),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioViewModel", () => ({
  useAiStudioViewModel: () => ({
    currentCostCredits: null,
    promptReferenceGenerateCostCredits: null,
    resolveModelPickerCredits: () => null,
    hasSufficientCreditsForPromptReferenceGenerate: true,
    isCreditGuardrail: false,
    generationGuardrail: null,
    referenceImageWarning: null,
  }),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioWorkspaceActions", () => ({
  useAiStudioWorkspaceActions: () => ({
    handleToolSelect: vi.fn(),
    handleOpenMediaLibrary: vi.fn(),
    handleFileBrowserSelection: vi.fn(),
    handleReferenceGridFiles: vi.fn(),
    handleSelectOutput: vi.fn(),
  }),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioReferenceGridProps", () => ({
  useAiStudioReferenceGridProps: () => ({}),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioPreviewDetailProps", () => ({
  useAiStudioPreviewDetailProps: () => ({
    studioPreviewProps: {},
    detailModalOutput: null,
    onDetailClose: vi.fn(),
    onUpdateOutputPrompt: vi.fn(),
    onDeleteOutput: vi.fn(),
    onDetailDownload: vi.fn(),
    onDetailSaveReference: vi.fn(),
    onDetailSavePrompt: vi.fn(),
    onOpenMediaLibrary: vi.fn(),
  }),
}));

vi.mock("../../features/ai-studio/hooks/aiStudioOutputStore", () => ({
  useOutputSelector: (
    selector: (snapshot: {
      outputById: Record<string, StudioOutput>;
      outputOrder: string[];
      indexes: { inFlightIds: Set<string> };
    }) => unknown
  ) => {
    const outputOrder = aiStudioStateMock.outputs.map((item) => item.id);
    const outputById = Object.fromEntries(aiStudioStateMock.outputs.map((item) => [item.id, item]));
    const inFlightIds = new Set(
      aiStudioStateMock.outputs
        .filter((item) => item.taskState === "pending" || item.taskState === "running")
        .map((item) => item.id)
    );
    return selector({
      outputById,
      outputOrder,
      indexes: {
        inFlightIds,
      },
    });
  },
}));

const createCharacterSnapshot = (
  description: string,
  url: string,
  storagePath: string
): CharacterManagerDraftSnapshot =>
  (() => {
    const defaultPresetState = createDefaultCharacterSheetPresetState();
    return {
      userId: "user-1",
      characterId: "char-1",
      characterSheetId: "sheet-1",
      characterName: "Taylor",
      legacyCharacterDescription: description,
      characterDescription: description,
      characterSheetAssignments: {
        portrait: "portrait_close",
        close_up: null,
        front_shot: null,
      },
      activeCharacterSheetPresetId: "1",
      characterSheetPresets: {
        ...defaultPresetState.presets,
        "1": {
          portrait: {
            characterMediaId: "media-portrait",
            storagePath,
            previewUrl: url,
          },
          close_up: null,
          front_shot: null,
        },
      },
      visibleCharacterSheetPresetIds: ["1"],
      characterSheetPresetLabels: defaultPresetState.tabLabels,
      characterSheetPresetDescriptions: {
        ...defaultPresetState.tabDescriptions,
        "1": description,
      },
      characterSheetPresetAssignments: {
        portrait: {
          characterMediaId: "media-portrait",
          storagePath,
          previewUrl: url,
        },
        close_up: null,
        front_shot: null,
      },
      profileImageUrl: null,
      profileImageTransform: { zoom: 1, offsetX: 0, offsetY: 0 },
      slots: {
        front_full: null,
        side_profile: null,
        back_full: null,
        top_down: null,
        front_left_34: null,
        front_right_34: null,
        back_left_34: null,
        back_right_34: null,
        portrait_close: {
          characterMediaId: "media-portrait",
          storagePath,
          validationStatus: "pass",
          validationNotes: {
            validatorVersion: 1,
            mimeType: "image/png",
            width: 1024,
            height: 1024,
            aspectRatio: 1,
            sha256: "hash",
            hardErrors: [],
            warnings: [],
            evaluatedAt: "2026-01-01T00:00:00.000Z",
          },
          name: "portrait.png",
          size: 1024,
          type: "image/png",
          previewUrl: url,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
        fullbody_wide: null,
      },
    };
  })() as CharacterManagerDraftSnapshot;

const readSupabaseUserIdMock = vi.mocked(readSupabaseUserId);

describe("ai-studio page character mode model picker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    nowMs = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => nowMs);
    creditsStateMock.balanceCents = 10_000;
    creditsStateMock.balanceReservedCents = null;
    creditsStateMock.balanceLoading = false;
    creditsStateMock.refreshSource = "fallback";
    aiStudioPageContentCapture.lastProps = null;
    aiStudioStateMock.outputs = [];
    aiStudioStateMock.openModelModal.mockClear();
    readSupabaseUserIdMock.mockResolvedValue("user-1");
    listCharacterManagerCharactersMock.mockResolvedValue([
      {
        characterId: "char-1",
        characterName: "Taylor",
        profileImageUrl: null,
      },
    ]);
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue(
      createCharacterSnapshot(
        "Character prompt",
        "https://cdn.test/character.png",
        "user/chars/character.png"
      )
    );
  });

  it("opens the create picker with Character Mode edit models on the page flow", async () => {
    render(<AiStudioPage />);

    await waitFor(() =>
      expect(
        aiStudioPageContentCapture.lastProps?.propertiesCreate?.standard?.characterOptions
      ).toEqual([
        {
          id: "char-1",
          name: "Taylor",
          profileImageUrl: null,
        },
      ])
    );

    fireEvent.click(screen.getByRole("button", { name: "enable-character-mode" }));
    fireEvent.click(screen.getByRole("button", { name: "select-character" }));

    await waitFor(() => {
      const optionValues =
        aiStudioPageContentCapture.lastProps?.modelModalState?.options?.map(
          (option) => option.value
        ) ?? [];
      expect(optionValues).toContain("fal-ai/bytedance/seedream/v4.5/edit");
      expect(optionValues).toContain("fal-ai/nano-banana-2/edit");
      expect(optionValues).not.toContain("fal-ai/bytedance/seedream/v4.5/text-to-image");
      expect(optionValues).not.toContain("fal-ai/nano-banana-2");
    });

    fireEvent.click(screen.getByRole("button", { name: "open-model-picker" }));

    expect(aiStudioStateMock.openModelModal).toHaveBeenCalledWith(
      "create-model",
      expect.any(HTMLElement),
      "character-image"
    );

    const capturedModelModalState = aiStudioPageContentCapture.lastProps?.modelModalState;
    const openedModalContext = aiStudioStateMock.openModelModal.mock.calls.at(-1)?.[2] ?? null;
    expect(openedModalContext).toBe("character-image");

    render(
      <ModelModal
        isOpen
        onClose={vi.fn()}
        onSelect={vi.fn()}
        options={capturedModelModalState?.options ?? []}
        context={openedModalContext}
      />
    );

    expect(screen.getByText("Character Mode")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Seedream 4.5/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Nano Banana 2/i })).toBeInTheDocument();
    capturedModelModalState?.onPresentationResolved?.({
      context: "character-image",
      suppliedOptionCount: capturedModelModalState?.options?.length ?? 0,
      visibleOptionCount: capturedModelModalState?.options?.length ?? 0,
    });
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ui",
        message: "create_model_modal_presented",
        data: expect.objectContaining({
          tool: "create",
          expert_create_mode: "standard",
          character_mode_enabled: true,
          modal_context: "character-image",
          visible_option_count: expect.any(Number),
        }),
      })
    );
  });
});
