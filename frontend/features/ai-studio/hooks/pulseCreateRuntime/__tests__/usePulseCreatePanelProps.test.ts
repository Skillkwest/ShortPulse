import { describe, expect, it, vi } from "vitest";
import { buildPulseCreatePanelProps } from "../usePulseCreatePanelProps";

describe("buildPulseCreatePanelProps", () => {
  const baseParams = {
    pulsePrompt: "Pulse prompt",
    activePulsePresetKind: "custom_gpt" as const,
    agentEnabled: true,
    agentBootstrapReady: true,
    agentMessages: [],
    agentInput: "Analyze this image",
    agentBusy: false,
    agentIsSending: false,
    agentUiBusy: false,
    agentAttachmentError: null,
    agentError: null,
    stagedAgentPrompt: null,
    agentAttachments: [],
    isAgentDropActive: false,
    handleAgentInputChange: vi.fn(),
    handleAgentSend: vi.fn(),
    handleAgentAttachmentDrop: vi.fn(),
    handleAgentAttachmentDragOver: vi.fn(),
    handleAgentAttachmentDragEnter: vi.fn(),
    handleAgentAttachmentDragLeave: vi.fn(),
    handleRemoveAgentAttachment: vi.fn(),
    handleClearAgentAttachments: vi.fn(),
    handleAssistantMessageEdit: vi.fn(),
    handlePulsePromptChange: vi.fn(),
    createIsGenerating: false,
    currentCostCredits: 2,
    isGenerateDisabled: false,
    generationGuardrail: null,
    handleClearAgentChat: vi.fn(),
    handlePulseCreatePrimarySubmit: vi.fn(),
    pulsePreferenceRuntime: undefined,
  };

  it("blocks Pulse generate while an attached image is still preparing", () => {
    const props = buildPulseCreatePanelProps({
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

    expect(props.isGenerateDisabled).toBe(true);
    expect(props.guardrailReason).toBe("Wait for attached images to finish preparing.");
  });

  it("blocks Pulse generate when an attached image has failed", () => {
    const props = buildPulseCreatePanelProps({
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

    expect(props.isGenerateDisabled).toBe(true);
    expect(props.guardrailReason).toBe("Resolve failed image attachments before generating.");
  });
});
