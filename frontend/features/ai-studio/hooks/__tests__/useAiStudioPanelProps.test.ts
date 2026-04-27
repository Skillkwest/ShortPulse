import { renderHook } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { useAiStudioPanelProps } from "../useAiStudioPanelProps";

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioPanelProps>[0]> = {}
): Parameters<typeof useAiStudioPanelProps>[0] => {
  const outputs: StudioOutput[] = [
    {
      id: "out-1",
      previewUrl: "https://example.com/out-1.png",
      prompt: "prompt",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      modelId: "model-id",
      status: "ready",
      timestamp: "2026-02-14T00:00:00.000Z",
    },
  ];
  return {
    mode: "text",
    aspect: "1:1",
    model: "model-id",
    currentModelLabel: "Model",
    prompt: "Draft prompt",
    agentEnabled: true,
    agentMessages: [],
    agentInput: "Agent input",
    chatModeEnabled: true,
    directOpenAiBypassEnabled: true,
    agentBusy: false,
    agentAttachmentError: null,
    agentError: null,
    stagedAgentPrompt: null,
    agentAttachments: [],
    isAgentDropActive: false,
    handleAgentInputChange: vi.fn(),
    setChatModeEnabled: vi.fn(),
    handleAgentSend: vi.fn(),
    handleAgentEnhanceSend: vi.fn(),
    handleAgentAttachmentDrop: vi.fn(),
    handleAgentAttachmentDragOver: vi.fn(),
    handleAgentAttachmentDragEnter: vi.fn(),
    handleAgentAttachmentDragLeave: vi.fn(),
    handleRemoveAgentAttachment: vi.fn(),
    handleClearAgentAttachments: vi.fn(),
    handleGenerateFromAgentOutputPrompt: vi.fn(),
    useReferenceImageIndicator: false,
    isModelModalOpen: false,
    modelModalAnchor: null,
    handleOpenModelModal: vi.fn(),
    handleManualPromptChange: vi.fn(),
    createIsGenerating: false,
    editIsGenerating: false,
    isPrimaryEditStageGenerating: false,
    isPromptRefining: false,
    describeInFlightCount: 0,
    currentCostCredits: 2,
    promptReferenceGenerateCostCredits: 25,
    hasSufficientCreditsForPromptReferenceGenerate: true,
    isGenerateDisabled: false,
    isCreateGenerateClickLocked: false,
    isEditGenerateClickLocked: false,
    generationGuardrail: null,
    handleExpandChat: vi.fn(),
    handleClearAgentChat: vi.fn(),
    isAgentChatOpen: false,
    handlePrimarySubmit: vi.fn(),
    handleChatOffInlineGenerate: vi.fn(),
    savePromptReference: vi.fn(),
    characterOptions: [],
    selectedCharacterId: "",
    setSelectedCharacterId: asDispatch<string>(vi.fn()),
    isCharacterOptionsLoading: false,
    isCharacterModeEnabled: true,
    setIsCharacterModeEnabled: asDispatch<boolean>(vi.fn()),
    videoDurationSeconds: 6,
    videoResolution: "720p",
    imageResolution: "model_default",
    videoGenerateAudio: false,
    videoCameraFixed: false,
    videoAutoFix: false,
    setAspect: vi.fn(),
    setVideoDurationSeconds: asDispatch<number>(vi.fn()),
    setVideoResolution: asDispatch<string>(vi.fn()),
    setImageResolution: asDispatch<string>(vi.fn()),
    setVideoGenerateAudio: asDispatch<boolean>(vi.fn()),
    setVideoCameraFixed: asDispatch<boolean>(vi.fn()),
    setVideoAutoFix: asDispatch<boolean>(vi.fn()),
    beginnerMode: true,
    editReferenceImageUrl: null,
    editExtraImageUrls: [null, null, null],
    editReferenceText: "Edit prompt",
    handleImageRegenerateWithDebit: vi.fn(),
    insertOptimisticGenerationPlaceholder: vi.fn(() => "out-optimistic"),
    removeOptimisticGenerationPlaceholder: vi.fn(),
    addSessionMediaReference: vi.fn(),
    referenceImageWarning: null,
    resolveOutputPreviewUrl: vi.fn((id: string | null | undefined) => {
      if (!id) return null;
      return outputs.find((item) => item.id === id)?.previewUrl ?? null;
    }),
    setEditReferenceImageUrl: vi.fn(),
    setEditExtraImageUrl: vi.fn(),
    handleEditPromptTextChange: vi.fn(),
    videoReferenceText: "Video prompt",
    videoReferenceImageUrl: null,
    videoExtraImageUrls: [null, null, null],
    videoReferenceMode: "standard",
    setVideoReferenceMode: asDispatch<"standard" | "keyframes" | "kling3" | "motion">(vi.fn()),
    klingNegativePrompt: "",
    klingCfgScale: 0.5,
    klingShotType: "customize",
    klingVoiceIds: ["voice-a", "voice-b"],
    klingMultiPrompts: [],
    klingElements: [],
    setKlingNegativePrompt: asDispatch<string>(vi.fn()),
    setKlingCfgScale: asDispatch<number>(vi.fn()),
    setKlingShotType: asDispatch<"customize" | "intelligent">(vi.fn()),
    setKlingVoiceIds: asDispatch<[string, string]>(vi.fn()),
    setKlingMultiPrompts: asDispatch<{ id: string; prompt: string; duration: number }[]>(vi.fn()),
    setKlingElements: asDispatch<
      { id: string; frontalImageUrl: string; referenceImageUrls: string; videoUrl: string }[]
    >(vi.fn()),
    motionReferenceVideoUrl: null,
    setVideoReferenceImageUrl: vi.fn(),
    setVideoExtraImageUrl: vi.fn(),
    setMotionReferenceVideoUrl: vi.fn(),
    handleVideoPromptTextChange: vi.fn(),
    handleRegenerateWithDebit: vi.fn(),
    ...overrides,
  } as Parameters<typeof useAiStudioPanelProps>[0];
};

describe("useAiStudioPanelProps", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds text props with generation flags derived from orchestration state", () => {
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          isPromptRefining: true,
          isCreateGenerateClickLocked: true,
        })
      )
    );

    expect(result.current.propertiesCreate.isPromptGenerating).toBe(true);
    expect(result.current.propertiesCreate.isGenerateDisabled).toBe(true);
    expect(result.current.propertiesCreate.isChatOffInlineGenerateDisabled).toBe(true);
    expect(result.current.propertiesCreate.outputGenerateCostCredits).toBe(25);
    expect(result.current.propertiesCreate.hasSufficientCreditsForOutputGenerate).toBe(true);
    expect(result.current.propertiesEditExpert.expertEditEligible).toBe(false);
    expect(typeof result.current.propertiesCreate.onGenerateFromAgentOutputPrompt).toBe("function");
    expect(typeof result.current.propertiesCreate.onChatOffInlineGenerate).toBe("function");
  });

  it("forwards chat-off inline generate handler into create properties", () => {
    const handleChatOffInlineGenerate = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          handleChatOffInlineGenerate,
        })
      )
    );

    expect(result.current.propertiesCreate.onChatOffInlineGenerate).toBe(
      handleChatOffInlineGenerate
    );
  });

  it("keeps image-run cost for create text when chat mode is off", () => {
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          mode: "text",
          chatModeEnabled: false,
          currentCostCredits: 2,
          promptReferenceGenerateCostCredits: 25,
        })
      )
    );

    expect(result.current.propertiesCreate.costCredits).toBe(25);
    expect(result.current.propertiesCreate.outputGenerateCostCredits).toBe(25);
  });

  it("forwards expert edit flatten callbacks into expert edit panel props", () => {
    const handleImageRegenerateWithDebit = vi.fn();
    const addSessionMediaReference = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          handleImageRegenerateWithDebit,
          addSessionMediaReference,
        })
      )
    );

    result.current.propertiesEditExpert.onRegenerateWithReferenceInputs?.([
      "blob:flatten-primary",
      "https://example.com/extra.png",
    ]);
    result.current.propertiesEditExpert.onAddSessionMediaReference?.({
      url: "blob:flatten-card",
      mimeType: "image/png",
    });

    expect(handleImageRegenerateWithDebit).toHaveBeenCalledWith({
      referenceInputsOverride: ["blob:flatten-primary", "https://example.com/extra.png"],
    });
    expect(addSessionMediaReference).toHaveBeenCalledWith({
      url: "blob:flatten-card",
      mimeType: "image/png",
    });
  });

  it("keeps create and edit character selectors decoupled", () => {
    const setCreateSelectedCharacterId = asDispatch<string>(vi.fn());
    const setEditSelectedCharacterId = asDispatch<string>(vi.fn());
    const setCreateCharacterModeEnabled = asDispatch<boolean>(vi.fn());
    const setEditCharacterModeEnabled = asDispatch<boolean>(vi.fn());
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          selectedCharacterId: "char-create",
          setSelectedCharacterId: setCreateSelectedCharacterId,
          isCharacterModeEnabled: true,
          setIsCharacterModeEnabled: setCreateCharacterModeEnabled,
          editSelectedCharacterId: "char-edit",
          setEditSelectedCharacterId,
          isEditCharacterModeEnabled: false,
          setIsEditCharacterModeEnabled: setEditCharacterModeEnabled,
        })
      )
    );

    expect(result.current.propertiesCreate.selectedCharacterId).toBe("char-create");
    expect(result.current.propertiesCreate.characterModeEnabled).toBe(true);
    expect(result.current.propertiesCreate.onSelectedCharacterIdChange).toBe(
      setCreateSelectedCharacterId
    );
    expect(result.current.propertiesCreate.onCharacterModeEnabledChange).toBe(
      setCreateCharacterModeEnabled
    );

    expect(result.current.propertiesEditExpert.selectedCharacterId).toBe("char-edit");
    expect(result.current.propertiesEditExpert.characterModeEnabled).toBe(false);
    expect(result.current.propertiesEditExpert.onSelectedCharacterIdChange).toBe(
      setEditSelectedCharacterId
    );
    expect(result.current.propertiesEditExpert.onCharacterModeEnabledChange).toBe(
      setEditCharacterModeEnabled
    );
  });

  it("forwards edit submit-intent callback into expert edit panel props", () => {
    const onEditSubmitIntentChange = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          onEditSubmitIntentChange,
        })
      )
    );

    result.current.propertiesEditExpert.onEditSubmitIntentChange?.("inpaint");

    expect(onEditSubmitIntentChange).toHaveBeenCalledWith("inpaint");
  });

  it("does not disable generate controls when only agent send is busy", () => {
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          agentBusy: true,
          isGenerateDisabled: false,
          isCreateGenerateClickLocked: false,
          isEditGenerateClickLocked: false,
          createIsGenerating: false,
          editIsGenerating: false,
          isPromptRefining: false,
          describeInFlightCount: 0,
        })
      )
    );

    expect(result.current.propertiesCreate.agentIsSending).toBe(true);
    expect(result.current.propertiesCreate.isGenerateDisabled).toBe(false);
    expect(result.current.propertiesEditExpert.isGenerateDisabled).toBe(false);
    expect(result.current.propertiesVideo.isGenerateDisabled).toBe(false);
  });

  it("keeps edit generate available while edit submits are in flight but still locks video", () => {
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          createIsGenerating: false,
          editIsGenerating: true,
          agentBusy: false,
        })
      )
    );

    expect(result.current.propertiesEditExpert.isGenerateDisabled).toBe(false);
    expect(result.current.propertiesEditExpert.isGenerateBusy).toBe(true);
    expect(result.current.propertiesVideo.isGenerateDisabled).toBe(false);
    expect(result.current.propertiesVideo.agentIsSending).toBe(false);
    expect(result.current.propertiesCreate.isChatOffInlineGenerateDisabled).toBe(false);
  });

  it("forwards optimistic placeholder helpers into expert edit props", () => {
    const insertOptimisticGenerationPlaceholder = vi.fn(() => "out-optimistic");
    const removeOptimisticGenerationPlaceholder = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          insertOptimisticGenerationPlaceholder,
          removeOptimisticGenerationPlaceholder,
        })
      )
    );

    expect(
      result.current.propertiesEditExpert.insertOptimisticGenerationPlaceholder?.("Edit prompt")
    ).toBe("out-optimistic");
    result.current.propertiesEditExpert.removeOptimisticGenerationPlaceholder?.("out-optimistic");

    expect(insertOptimisticGenerationPlaceholder).toHaveBeenCalledWith("Edit prompt");
    expect(removeOptimisticGenerationPlaceholder).toHaveBeenCalledWith("out-optimistic");
  });

  it("keeps chat-off inline generate disabled for non-cap upstream guardrails", () => {
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          isGenerateDisabled: true,
          generationGuardrail: "Select a model before generating.",
          isCreateGenerateClickLocked: false,
          isEditGenerateClickLocked: false,
          createIsGenerating: false,
          editIsGenerating: false,
          isPromptRefining: false,
          describeInFlightCount: 0,
        })
      )
    );

    expect(result.current.propertiesCreate.isChatOffInlineGenerateDisabled).toBe(true);
  });

  it("forwards primary-stage generation state into expert edit props", () => {
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          isPrimaryEditStageGenerating: true,
          beginnerMode: false,
        })
      )
    );

    expect(result.current.propertiesEditExpert.isPrimaryStageGenerating).toBe(true);
  });

  it("accepts nullable output ids when resolving image/video preview links", () => {
    const resolveOutputPreviewUrl = vi.fn((id: string | null | undefined) =>
      id === "out-1" ? "https://example.com/out-1.png" : null
    );
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          resolveOutputPreviewUrl,
        })
      )
    );

    expect(result.current.propertiesEditExpert.resolvePreviewUrlById?.(null)).toBeNull();
    expect(result.current.propertiesEditExpert.resolvePreviewUrlById?.("out-1")).toBe(
      "https://example.com/out-1.png"
    );
    expect(result.current.propertiesVideo.resolvePreviewUrlById?.(null)).toBeNull();
  });

  it("updates only the targeted Kling voice slot", () => {
    const setKlingVoiceIds = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          setKlingVoiceIds: asDispatch<[string, string]>(setKlingVoiceIds),
        })
      )
    );

    expect(result.current.propertiesVideo.onKlingVoiceIdChange).toBeDefined();
    result.current.propertiesVideo.onKlingVoiceIdChange?.(1, "voice-z");
    const updater = setKlingVoiceIds.mock.calls[0]?.[0] as
      | ((prev: [string, string]) => [string, string])
      | undefined;

    expect(typeof updater).toBe("function");
    expect(updater?.(["voice-a", "voice-b"])).toEqual(["voice-a", "voice-z"]);
  });

  it("enables expert create UI only in development when beginner mode is off", () => {
    vi.stubEnv("NODE_ENV", "development");
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          beginnerMode: false,
        })
      )
    );

    expect(result.current.propertiesCreate.expertCreateUiEligible).toBe(true);
  });

  it("allows explicit env override to disable expert create UI in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_EXPERT_CREATE_UI", "false");
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          beginnerMode: false,
        })
      )
    );

    expect(result.current.propertiesCreate.expertCreateUiEligible).toBe(false);
  });

  it("allows explicit env override to enable expert create UI in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_EXPERT_CREATE_UI", "true");
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          beginnerMode: false,
        })
      )
    );

    expect(result.current.propertiesCreate.expertCreateUiEligible).toBe(true);
  });

  it("disables expert create UI in production builds and while beginner mode is on", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { result: productionResult } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          beginnerMode: false,
        })
      )
    );
    expect(productionResult.current.propertiesCreate.expertCreateUiEligible).toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    const { result: beginnerResult } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          beginnerMode: true,
        })
      )
    );
    expect(beginnerResult.current.propertiesCreate.expertCreateUiEligible).toBe(false);
  });

  it("enables expert edit UI by default when beginner mode is off", () => {
    vi.stubEnv("NODE_ENV", "production");
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          beginnerMode: false,
        })
      )
    );

    expect(result.current.propertiesEditExpert.expertEditEligible).toBe(true);
  });

  it("disables expert edit UI when beginner mode is on", () => {
    const { result } = renderHook(() =>
      useAiStudioPanelProps(
        createParams({
          beginnerMode: true,
        })
      )
    );

    expect(result.current.propertiesEditExpert.expertEditEligible).toBe(false);
  });
});
