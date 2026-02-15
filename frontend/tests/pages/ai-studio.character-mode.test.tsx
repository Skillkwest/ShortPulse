/**
 * AI Studio page integration tests for Character Mode submission wiring.
 * Verifies Create workflow prompt/reference injection and stale bundle refresh behavior.
 */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../features/ai-studio/types";
import type { CharacterManagerDraftSnapshot } from "../../features/character-manager/logic/characterManagerPersistence";
import AiStudioPage from "../../pages/ai-studio";

const {
  generateOutputMock,
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
        setOutputs: vi.fn(),
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
        savePromptReference: vi.fn(),
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

vi.mock("../../features/ai-studio/components/AiStudioPageContent", () => ({
  AiStudioPageContent: (props: {
    propertiesText: {
      onGenerate: () => void;
      onSelectedCharacterIdChange?: (value: string) => void;
      onCharacterModeEnabledChange?: (value: boolean) => void;
    };
    balanceCredits?: number | null;
    pendingHoldCredits?: number | null;
  }) => {
    aiStudioPageContentCapture.lastProps = props;
    const { propertiesText } = props;
    return (
      <div>
        <button
          type="button"
          onClick={() => {
            propertiesText.onCharacterModeEnabledChange?.(true);
          }}
        >
          enable-character-mode
        </button>
        <button
          type="button"
          onClick={() => {
            propertiesText.onSelectedCharacterIdChange?.("char-1");
          }}
        >
          select-character
        </button>
        <button type="button" onClick={() => propertiesText.onGenerate()}>
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

vi.mock("../../features/ai-studio/hooks/useAiStudioViewModel", () => ({
  useAiStudioViewModel: () => ({
    currentCostCredits: 10,
    hasSufficientCreditsForCost: true,
    isCreditGuardrail: false,
    generationGuardrail: null,
    isGenerateDisabled: false,
    referenceImageWarning: null,
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

vi.mock("../../features/ai-studio/hooks/useBeginnerModePreference", () => ({
  useBeginnerModePreference: () => ({
    beginnerMode: false,
    setBeginnerMode: vi.fn(),
  }),
}));

vi.mock("../../features/ai-agent/useAiAgent", () => ({
  useAiAgent: () => ({
    messages: [],
    isSending: false,
    error: null,
    send: vi.fn(async () => ({ response: null, actions: undefined })),
    appendUserMessage: vi.fn(() => "msg-1"),
    reset: vi.fn(),
  }),
}));

vi.mock("../../features/character-manager/logic/characterManagerPersistence", () => ({
  listCharacterManagerCharacters: listCharacterManagerCharactersMock,
  loadCharacterManagerDraftByCharacterId: loadCharacterManagerDraftByCharacterIdMock,
}));
vi.mock("../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: (...args: unknown[]) => getSignedMediaUrlsBatchMock(...args),
}));

vi.mock("../../features/ai-studio/logic/promptGeneration", () => ({
  postGeneratePrompt: vi.fn(async (text: string) => ({ prompt: text })),
}));

vi.mock("../../features/ai-studio/logic/imageDescription", () => ({
  postDescribeImage: vi.fn(async () => ({ description: "desc" })),
  prepareImageUrl: vi.fn(async (url: string) => url),
}));

vi.mock("../../lib/supabaseClient", () => ({
  ensureSupabaseClient: vi.fn(() => ({})),
}));

vi.mock("../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: addBreadcrumbMock,
}));
vi.mock("../../lib/appErrorReporter", () => ({
  reportAppError: (...args: unknown[]) => reportAppErrorMock(...args),
}));

vi.mock("../../features/ai-studio/hooks/useAiStudioState", () => ({
  useAiStudioState: () => aiStudioStateMock,
}));

const createCharacterSnapshot = (
  description: string,
  url: string,
  storagePath: string
): CharacterManagerDraftSnapshot =>
  ({
    characterId: "char-1",
    characterSheetId: "sheet-1",
    characterName: "Taylor",
    characterDescription: description,
    characterSheetAssignments: {
      portrait: "portrait_close",
      close_up: null,
      front_shot: null,
      back_shot: null,
    },
    activeCharacterSheetPresetId: "1",
    characterSheetPresets: {
      "1": {
        portrait: {
          mediaFileId: "media-portrait",
          storagePath,
          previewUrl: url,
        },
        close_up: null,
        front_shot: null,
        back_shot: null,
      },
      "2": { portrait: null, close_up: null, front_shot: null, back_shot: null },
      "3": { portrait: null, close_up: null, front_shot: null, back_shot: null },
      "4": { portrait: null, close_up: null, front_shot: null, back_shot: null },
    },
    characterSheetPresetAssignments: {
      portrait: {
        mediaFileId: "media-portrait",
        storagePath,
        previewUrl: url,
      },
      close_up: null,
      front_shot: null,
      back_shot: null,
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
      portrait_close: { storagePath, previewUrl: url },
      fullbody_wide: null,
    },
  }) as CharacterManagerDraftSnapshot;

const createOutput = (id: string, taskState: StudioOutput["taskState"]): StudioOutput => ({
  id,
  prompt: "Prompt",
  mode: "image",
  aspect: "9:16",
  model: "Model",
  status: "ready",
  timestamp: "Now",
  taskState,
});

describe("ai-studio page character mode submission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    nowMs = 1_000_000;
    vi.spyOn(Date, "now").mockImplementation(() => nowMs);
    creditsStateMock.balanceCents = 10_000;
    creditsStateMock.balanceReservedCents = null;
    creditsStateMock.balanceLoading = false;
    creditsStateMock.refreshSource = "fallback";
    aiStudioPageContentCapture.lastProps = null;
    aiStudioStateMock.outputs = [];
    getSignedMediaUrlsBatchMock.mockImplementation(
      async ({ storagePaths }: { storagePaths: string[] }) =>
        new Map(
          storagePaths.map((path) => [path, `https://signed.test/${encodeURIComponent(path)}`])
        )
    );
    listCharacterManagerCharactersMock.mockResolvedValue([
      {
        characterId: "char-1",
        characterName: "Taylor",
        profileImageUrl: null,
      },
    ]);
  });

  it("refreshes stale character bundle before Create generate and submits refreshed hidden context", async () => {
    loadCharacterManagerDraftByCharacterIdMock
      .mockResolvedValueOnce(
        createCharacterSnapshot(
          "Older character description",
          "https://cdn.test/old.png",
          "user/chars/old.png"
        )
      )
      .mockResolvedValueOnce(
        createCharacterSnapshot(
          "Fresh character description",
          "https://cdn.test/fresh.png",
          "user/chars/fresh.png"
        )
      );

    render(<AiStudioPage />);

    fireEvent.click(screen.getByRole("button", { name: "enable-character-mode" }));
    fireEvent.click(screen.getByRole("button", { name: "select-character" }));
    await waitFor(() =>
      expect(loadCharacterManagerDraftByCharacterIdMock).toHaveBeenCalledWith("char-1")
    );

    nowMs += 46 * 60 * 1000;

    fireEvent.click(screen.getByRole("button", { name: "generate" }));

    await waitFor(() => expect(generateOutputMock).toHaveBeenCalledTimes(1));
    expect(loadCharacterManagerDraftByCharacterIdMock).toHaveBeenCalledTimes(2);
    expect(generateOutputMock).toHaveBeenCalledWith("User visible prompt", {
      modeOverride: "image",
      selectedToolOverride: "create",
      submissionPromptOverride: "Fresh character description\n\nUser visible prompt",
      displayPromptOverride: "User visible prompt",
      referenceInputsOverride: ["https://signed.test/user%2Fchars%2Ffresh.png"],
      characterContextOverride: {
        applied: true,
        characterId: "char-1",
        characterName: "Taylor",
        characterProfileImageUrl: null,
      },
    });
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "character_mode_bundle_refresh_before_submit",
      })
    );
  });

  it("emits fallback telemetry when Character Mode is enabled without a selected character", async () => {
    render(<AiStudioPage />);
    fireEvent.click(screen.getByRole("button", { name: "enable-character-mode" }));

    fireEvent.click(screen.getByRole("button", { name: "generate" }));

    await waitFor(() => expect(generateOutputMock).toHaveBeenCalledTimes(1));
    expect(generateOutputMock).toHaveBeenCalledWith("User visible prompt", {
      modeOverride: "image",
      selectedToolOverride: "create",
      submissionPromptOverride: "User visible prompt",
      displayPromptOverride: "User visible prompt",
      referenceInputsOverride: [],
    });
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "character_mode_injection_fallback",
        data: expect.objectContaining({
          fallback_code: "no_character_selected",
        }),
      })
    );
  });

  it("falls back safely when signed URL refresh returns no references at submit time", async () => {
    getSignedMediaUrlsBatchMock.mockImplementation(async () => new Map());
    loadCharacterManagerDraftByCharacterIdMock.mockResolvedValue(
      createCharacterSnapshot(
        "Character description from manager",
        "https://cdn.test/original.png",
        "user/chars/original.png"
      )
    );

    render(<AiStudioPage />);
    fireEvent.click(screen.getByRole("button", { name: "enable-character-mode" }));
    fireEvent.click(screen.getByRole("button", { name: "select-character" }));
    await waitFor(() =>
      expect(loadCharacterManagerDraftByCharacterIdMock).toHaveBeenCalledWith("char-1")
    );

    fireEvent.click(screen.getByRole("button", { name: "generate" }));

    await waitFor(() => expect(generateOutputMock).toHaveBeenCalledTimes(1));
    expect(generateOutputMock).toHaveBeenCalledWith("User visible prompt", {
      modeOverride: "image",
      selectedToolOverride: "create",
      submissionPromptOverride: "Character description from manager\n\nUser visible prompt",
      displayPromptOverride: "User visible prompt",
      referenceInputsOverride: [],
      characterContextOverride: {
        applied: true,
        characterId: "char-1",
        characterName: "Taylor",
        characterProfileImageUrl: null,
      },
    });
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "character_mode_injection_fallback",
        data: expect.objectContaining({
          fallback_code: "no_references",
          selected_character_id: "char-1",
        }),
      })
    );
    expect(reportAppErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "telemetry.character_mode",
        message: "character_mode_reference_refresh_empty",
      })
    );
  });

  it("does not force image resolution while character mode is enabled", async () => {
    render(<AiStudioPage />);

    await waitFor(() => expect(listCharacterManagerCharactersMock).toHaveBeenCalledTimes(1));
    expect(aiStudioStateMock.setImageResolution).not.toHaveBeenCalled();
  });

  it("keeps pending holds visible across pending to running and clears after success", async () => {
    creditsStateMock.balanceCents = 100;
    aiStudioStateMock.outputs = [];

    const { rerender } = render(<AiStudioPage />);

    await waitFor(() => expect(aiStudioPageContentCapture.lastProps?.balanceCredits).toBe(100));
    expect(aiStudioPageContentCapture.lastProps?.pendingHoldCredits).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "generate" }));
    await waitFor(() => expect(aiStudioPageContentCapture.lastProps?.pendingHoldCredits).toBe(10));
    expect(aiStudioPageContentCapture.lastProps?.balanceCredits).toBe(90);

    aiStudioStateMock.outputs = [createOutput("out-1", "pending")];
    rerender(<AiStudioPage />);
    await waitFor(() => expect(aiStudioPageContentCapture.lastProps?.pendingHoldCredits).toBe(10));
    expect(aiStudioPageContentCapture.lastProps?.balanceCredits).toBe(90);

    aiStudioStateMock.outputs = [createOutput("out-1", "running")];
    rerender(<AiStudioPage />);
    await waitFor(() => expect(aiStudioPageContentCapture.lastProps?.pendingHoldCredits).toBe(10));
    expect(aiStudioPageContentCapture.lastProps?.balanceCredits).toBe(90);

    aiStudioStateMock.outputs = [createOutput("out-1", "success")];
    rerender(<AiStudioPage />);
    await waitFor(() =>
      expect(aiStudioPageContentCapture.lastProps?.pendingHoldCredits).toBeNull()
    );
    expect(aiStudioPageContentCapture.lastProps?.balanceCredits).toBe(100);
  });
});
