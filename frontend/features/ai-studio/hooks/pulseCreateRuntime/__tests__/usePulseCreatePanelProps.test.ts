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
    handleClearAgentChat: vi.fn(),
    handlePulsePresetRestart: vi.fn(async () => undefined),
    pulsePreferenceRuntime: undefined,
  };

  it("preserves image attachments for the Pulse composer input", () => {
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

    expect(props.stagedAttachments).toHaveLength(1);
    expect(props.stagedAttachments?.[0]?.deliveryStatus).toBe("preparing");
  });

  it("preserves failed image attachments for user recovery in the composer", () => {
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

    expect(props.stagedAttachments).toHaveLength(1);
    expect(props.stagedAttachments?.[0]?.deliveryStatus).toBe("failed");
    expect(props.agentError).toBeUndefined();
  });
});
