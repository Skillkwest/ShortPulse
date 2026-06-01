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
    isModelModalOpen: false,
    modelModalAnchor: null,
    setAspect: vi.fn(),
    handleOpenModelModal: vi.fn(),
    handleCloseModelModal: vi.fn(),
    handleManualPromptChange: vi.fn(),
    createIsGenerating: false,
    isPromptRefining: false,
    describeInFlightCount: 0,
    createGenerateCostCredits: 2,
    isGenerateDisabled: false,
    handleClearAgentChat: vi.fn(),
    handleStandardCreatePrimarySubmit: vi.fn(),
    characterOptions: [],
    selectedCharacterId: "",
    selectedCharacterLookId: "",
    selectedCharacterLookLabel: null,
    setSelectedCharacterId: vi.fn(),
    onCreateCharacter: undefined,
    isCharacterOptionsLoading: false,
    isCharacterModeEnabled: false,
    setIsCharacterModeEnabled: vi.fn(),
    refreshCharacterOptions: undefined,
    loadCharacterLookOptions: undefined,
    resolveCharacterAvatarUrlById: undefined,
    imageResolution: "default",
    setImageResolution: vi.fn(),
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
  });

  it("still disables generate when an upstream guardrail is active", () => {
    const props = buildStandardCreatePanelProps({
      ...baseParams,
      chatModeEnabled: false,
      prompt: "",
      isGenerateDisabled: true,
    });

    expect(props.isGenerateDisabled).toBe(true);
  });

  it("does not forward removed Standard warning props or output-generate bridge state", () => {
    const props = buildStandardCreatePanelProps({
      ...baseParams,
    });

    const propsRecord = props as Record<string, unknown>;
    expect("guardrailReason" in propsRecord).toBe(false);
    expect("onGenerateOutputPrompt" in propsRecord).toBe(false);
    expect("disableAgentOutputGenerate" in propsRecord).toBe(false);
    expect("outputGenerateCostCredits" in propsRecord).toBe(false);
  });

  it("does not emit detached warning text when the visible composer is empty", () => {
    const props = buildStandardCreatePanelProps({
      ...baseParams,
      chatModeEnabled: true,
      agentInput: "   ",
      prompt: "hidden fallback prompt",
    });

    const propsRecord = props as Record<string, unknown>;
    expect(props.isGenerateDisabled).toBe(true);
    expect("guardrailReason" in propsRecord).toBe(false);
  });

  it("blocks generate while an attached image is still preparing", () => {
    const props = buildStandardCreatePanelProps({
      ...baseParams,
      agentAttachments: [
        {
          id: "img-1",
          kind: "image",
          imageUrl: "data:image/png;base64,preview",
          submissionImageUrl: null,
          text: null,
          deliveryStatus: "preparing",
          deliveryError: null,
        },
      ],
    });

    const propsRecord = props as Record<string, unknown>;
    expect(props.isGenerateDisabled).toBe(true);
    expect("guardrailReason" in propsRecord).toBe(false);
  });

  it("blocks generate when an attached image has failed", () => {
    const props = buildStandardCreatePanelProps({
      ...baseParams,
      agentAttachments: [
        {
          id: "img-1",
          kind: "image",
          imageUrl: "data:image/png;base64,preview",
          submissionImageUrl: null,
          text: null,
          deliveryStatus: "failed",
          deliveryError: "Upload failed",
        },
      ],
    });

    const propsRecord = props as Record<string, unknown>;
    expect(props.isGenerateDisabled).toBe(true);
    expect("guardrailReason" in propsRecord).toBe(false);
  });
});
