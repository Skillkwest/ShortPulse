import { describe, expect, it, vi } from "vitest";
import { buildStandardCreatePanelProps } from "../useStandardCreatePanelProps";

describe("buildStandardCreatePanelProps", () => {
  const baseParams = {
    mode: "text" as const,
    aspect: "9:16",
    model: "seedream",
    currentModelLabel: "Seedream 4.5",
    prompt: "shared prompt",
    agentEnabled: true,
    agentBootstrapReady: true,
    agentMessages: [],
    agentInput: "chat prompt",
    chatModeEnabled: true,
    agentBusy: false,
    agentAttachmentError: null,
    agentError: null,
    stagedAgentPrompt: null,
    assistantBubbleMedia: undefined,
    agentAttachments: [],
    isAgentDropActive: false,
    handleAgentInputChange: vi.fn(),
    setChatModeEnabled: vi.fn(),
    handleAgentSend: vi.fn(),
    handleAgentAttachmentDrop: vi.fn(),
    handleAgentAttachmentDragOver: vi.fn(),
    handleAgentAttachmentDragEnter: vi.fn(),
    handleAgentAttachmentDragLeave: vi.fn(),
    handleRemoveAgentAttachment: vi.fn(),
    handleClearAgentAttachments: vi.fn(),
    handleAssistantMessageEdit: vi.fn(),
    handleApplyAgentOutputPrompt: vi.fn(),
    isModelModalOpen: false,
    modelModalAnchor: null,
    setAspect: vi.fn(),
    handleOpenModelModal: vi.fn(),
    handleManualPromptChange: vi.fn(),
    createIsGenerating: false,
    isPromptRefining: false,
    describeInFlightCount: 0,
    createGenerateCostCredits: 2,
    promptReferenceGenerateCostCredits: 2,
    hasSufficientCreditsForPromptReferenceGenerate: true,
    isGenerateDisabled: false,
    generationGuardrail: null,
    handleClearAgentChat: vi.fn(),
    useReferenceImageIndicator: false,
    handleStandardCreatePrimarySubmit: vi.fn(),
    savePromptReference: vi.fn(),
    characterOptions: [],
    selectedCharacterId: "",
    selectedCharacterLookId: "",
    selectedCharacterLookLabel: null,
    setSelectedCharacterId: vi.fn(),
    onOpenCharacterLibrary: undefined,
    isCharacterOptionsLoading: false,
    isCharacterModeEnabled: false,
    setIsCharacterModeEnabled: vi.fn(),
    refreshCharacterOptions: undefined,
    loadCharacterLookOptions: undefined,
    resolveCharacterAvatarUrlById: undefined,
    imageResolution: "default",
    setImageResolution: vi.fn(),
    beginnerCreateMode: false,
    expertCreateUiEligible: true,
    isStylesPanelOpen: false,
    onStylesPanelToggle: vi.fn(),
    selectedStyleId: null,
    stylesCatalog: [],
    onOpenPresetsLibrary: undefined,
  };

  it("disables primary generate when the visible Standard chat composer is empty", () => {
    const props = buildStandardCreatePanelProps({
      ...baseParams,
      chatModeEnabled: true,
      agentInput: "   ",
      prompt: "hidden fallback prompt",
    });

    expect(props.isGenerateDisabled).toBe(true);
    expect(props.guardrailReason).toBe("Enter a prompt to generate.");
  });

  it("preserves existing guardrail reasons over the empty-composer hint", () => {
    const props = buildStandardCreatePanelProps({
      ...baseParams,
      chatModeEnabled: false,
      prompt: "",
      isGenerateDisabled: true,
      generationGuardrail: "Select a model before generating.",
    });

    expect(props.isGenerateDisabled).toBe(true);
    expect(props.guardrailReason).toBe("Select a model before generating.");
  });
});
