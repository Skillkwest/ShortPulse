import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useAiStudioAgentOrchestration } from "../useAiStudioAgentOrchestration";
import { resolveCreateAgentOrchestrationRuntimePolicy } from "../agentOrchestration/createAgentOrchestrationRuntimePolicy";
import { prepareImageUrl } from "../../logic/imageDescription";
import type { StudioOutput } from "../../types";
import type { AgentAttachment, AgentPulseWorkflowSession } from "../../../../prefabs/agent";
import type { CreatePulseResolvedPreset } from "../../components/create/createPulsePresets";

vi.mock("../../logic/imageDescription", () => ({
  prepareImageUrl: vi.fn(async (url: string) => url),
}));

const prepareImageUrlMock = vi.mocked(prepareImageUrl);

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: "Prompt",
  mode: "image",
  aspect: "1:1",
  model: "fal-ai/flux/dev",
  status: "ready",
  timestamp: "now",
  taskState: "success",
  ...overrides,
});

const asDispatch = <T>(fn: (...args: unknown[]) => unknown): Dispatch<SetStateAction<T>> =>
  fn as unknown as Dispatch<SetStateAction<T>>;

const standardRuntimePolicy = () =>
  resolveCreateAgentOrchestrationRuntimePolicy({
    expertCreateMode: "standard",
    activePulsePresetId: null,
    pulseSessionInstanceId: null,
  });

const pulseRuntimePolicy = (
  activePulsePresetId = "story_builder",
  pulseSessionInstanceId = "pulse-session-1"
) =>
  resolveCreateAgentOrchestrationRuntimePolicy({
    expertCreateMode: "pulse",
    activePulsePresetId,
    pulseSessionInstanceId,
  });

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioAgentOrchestration>[0]> = {}
): Parameters<typeof useAiStudioAgentOrchestration>[0] => ({
  agentIsSending: false,
  agentBootstrapReady: true,
  agentUiBusyRef: { current: false } as MutableRefObject<boolean>,
  setAgentUiBusy: asDispatch<boolean>(vi.fn()),
  agentSessionEnabled: true,
  setAgentSessionEnabled: asDispatch<boolean>(vi.fn()),
  agentInput: "",
  setAgentInput: asDispatch<string>(vi.fn()),
  agentAttachments: [],
  setAgentAttachments: asDispatch<AgentAttachment[]>(vi.fn()),
  setAgentAttachmentError: asDispatch<string | null>(vi.fn()),
  prompt: "",
  latestAgentPrompt: null,
  setLatestAgentPrompt: asDispatch<string | null>(vi.fn()),
  setPulseWorkflowSession: asDispatch(vi.fn()),
  selectedTool: "create",
  setSharedPrompt: vi.fn(),
  setPromptOrigin: asDispatch<"manual" | "agent" | "reference">(vi.fn()),
  sendToAgent: vi.fn(async () => ({ response: null, actions: undefined })),
  appendUserMessage: vi.fn(() => "msg-1"),
  updateMessageById: vi.fn(() => false),
  getAgentContext: vi.fn(() => ({})),
  trackAgentUiEvent: vi.fn(),
  addAgentPromptReference: vi.fn(),
  editReferenceText: "",
  setEditReferenceText: vi.fn(),
  videoReferenceText: "",
  setVideoReferenceText: vi.fn(),
  getOutputById: vi.fn(() => null),
  aspect: "1:1",
  model: null,
  setOutputs: asDispatch<StudioOutput[]>(vi.fn()),
  setActiveOutputId: asDispatch<string | null>(vi.fn()),
  lastAssistantMessage: null,
  setUiNotice: asDispatch<string | null>(vi.fn()),
  runtimePolicy: standardRuntimePolicy(),
  ...overrides,
});

describe("useAiStudioAgentOrchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareImageUrlMock.mockResolvedValue("https://cdn.test/prepared-image.png");
  });

  it("returns early for empty outbound send", async () => {
    const sendToAgent = vi.fn(async () => ({ response: null, actions: undefined }));
    const appendUserMessage = vi.fn(() => "msg-1");
    const trackAgentUiEvent = vi.fn();
    const params = createParams({
      prompt: "   ",
      agentInput: "   ",
      sendToAgent,
      appendUserMessage,
      trackAgentUiEvent,
    });

    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentSend();
    });

    expect(sendToAgent).not.toHaveBeenCalled();
    expect(appendUserMessage).not.toHaveBeenCalled();
    expect(trackAgentUiEvent).not.toHaveBeenCalled();
  });

  it("blocks outbound chat send while agent bootstrap is still pending", async () => {
    const sendToAgent = vi.fn(async () => ({ response: null, actions: undefined }));
    const trackAgentUiEvent = vi.fn();
    const setUiNotice = vi.fn();
    const params = createParams({
      agentBootstrapReady: false,
      agentInput: "hello",
      prompt: "hello",
      sendToAgent,
      trackAgentUiEvent,
      setUiNotice: asDispatch<string | null>(setUiNotice),
    });

    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentSend();
    });

    expect(sendToAgent).not.toHaveBeenCalled();
    expect(setUiNotice).toHaveBeenCalledWith("Preparing chat. Try again in a moment.");
    expect(trackAgentUiEvent).toHaveBeenCalledWith("studio_agent_send_blocked_bootstrap_pending");
  });

  it("sends image-only turns without auto-injecting describe text", async () => {
    const sendToAgent = vi.fn(async () => ({ response: null, actions: undefined }));
    const appendUserMessage = vi.fn(() => "msg-1");
    const getAgentContext = vi.fn(() => ({}));
    const params = createParams({
      prompt: "   ",
      agentInput: "   ",
      sendToAgent,
      appendUserMessage,
      agentAttachments: [
        {
          id: "img-1",
          kind: "image",
          referenceId: "ref-image-1",
          imageUrl: "https://cdn.test/image.png",
          text: null,
          aspect: null,
        },
      ],
      getAgentContext,
    });

    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentSend();
    });

    expect(appendUserMessage).toHaveBeenCalledWith("", [
      expect.objectContaining({
        id: "img-1",
        kind: "image",
        referenceId: "ref-image-1",
      }),
    ]);
    expect(sendToAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "",
        payloadText: "",
        context: expect.objectContaining({
          focusedSource: "image",
          selectedReferenceIds: ["ref-image-1"],
          references: expect.arrayContaining([
            expect.objectContaining({
              id: "ref-image-1",
              kind: "image",
            }),
          ]),
          media: [
            expect.objectContaining({
              id: "ref-image-1",
              kind: "image",
              url: "https://cdn.test/prepared-image.png",
            }),
          ],
        }),
      })
    );
    expect(getAgentContext).toHaveBeenCalledWith(
      expect.objectContaining({
        modeHint: "reference",
      })
    );
  });

  it("does not inject latest agent prompt context for true image-only sends", async () => {
    const sendToAgent = vi.fn(async () => ({ response: null, actions: undefined }));
    const getAgentContext = vi.fn(() => ({
      focusedSource: "agent-output" as const,
    }));
    const params = createParams({
      prompt: "   ",
      agentInput: "   ",
      latestAgentPrompt: "stale canonical prompt",
      lastAssistantMessage: "stale canonical prompt",
      sendToAgent,
      agentAttachments: [
        {
          id: "img-1",
          kind: "image",
          referenceId: "ref-image-1",
          imageUrl: "https://cdn.test/image.png",
          text: null,
          aspect: null,
        },
      ],
      getAgentContext,
    });

    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentSend();
    });

    expect(sendToAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "",
        payloadText: "",
      })
    );
    const firstSendCall = ((sendToAgent.mock.calls as unknown[][])[0]?.[0] ?? null) as {
      context?: Record<string, unknown>;
    } | null;
    const context = firstSendCall?.context;
    expect(context?.activePrompt ?? null).toBeNull();
    expect(context?.lastAssistantMessage ?? null).toBeNull();
  });

  it("keeps agent-output focus when prompt references are attached and canonical context exists", async () => {
    const sendToAgent = vi.fn(async () => ({ response: { message: "ok" }, actions: {} }));
    const params = createParams({
      latestAgentPrompt: "A cinematic portrait in neon light.",
      lastAssistantMessage: "A cinematic portrait in neon light.",
      agentAttachments: [
        {
          id: "prompt-1",
          kind: "prompt",
          referenceId: "ref-1",
          text: "silver armor details",
          aspect: "1:1",
        },
      ],
      getAgentContext: vi.fn(() => ({
        activePrompt: "A cinematic portrait in neon light.",
        lastAssistantMessage: "A cinematic portrait in neon light.",
        focusedSource: "agent-output" as const,
      })),
      sendToAgent,
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentSend();
    });

    expect(sendToAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          focusedSource: "agent-output",
          selectedReferenceIds: ["ref-1"],
          activePrompt: "A cinematic portrait in neon light.",
          lastAssistantMessage: "A cinematic portrait in neon light.",
        }),
      })
    );
  });

  it("keeps the transcript assistant message separate from the latest agent prompt seed", async () => {
    const sendToAgent = vi.fn(async () => ({ response: { message: "ok" }, actions: {} }));
    const params = createParams({
      agentInput: "Help me shape this concept.",
      latestAgentPrompt: "Refined pulse guidance",
      lastAssistantMessage: "Previous assistant turn",
      sendToAgent,
      getAgentContext: vi.fn(() => ({
        activePrompt: "Refined pulse guidance",
        lastAssistantMessage: "Previous assistant turn",
        focusedSource: "agent-output" as const,
      })),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentSend();
    });

    expect(sendToAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          activePrompt: "Refined pulse guidance",
          lastAssistantMessage: "Previous assistant turn",
        }),
      })
    );
  });

  it("keeps Video Prompt Magic prompt seed separate from the transcript assistant message", async () => {
    const sendToAgent = vi.fn(async () => ({ response: { message: "ok" }, actions: {} }));
    const params = createParams({
      agentInput: "truck left",
      latestAgentPrompt: "Which camera motion should I use?",
      lastAssistantMessage: "Upload your image to get the process started :)",
      sendToAgent,
      getAgentContext: vi.fn(() => ({
        activePrompt: "Which camera motion should I use?",
        lastAssistantMessage: "Upload your image to get the process started :)",
        focusedSource: "agent-output" as const,
        media: [
          {
            id: "selected-image",
            kind: "image" as const,
            url: "https://cdn.test/selected-image.png",
          },
        ],
        pulse: {
          presetId: "image",
          label: "Video Prompt Magic",
          instructions: "Direct the user through a single-shot video workflow.",
          runtimeMode: "workflow_gpt" as const,
          activationMode: "activate_and_start" as const,
          starterAssistantMessage: "Upload your image to get the process started :)",
          workflowStageHints: ["Image Gate", "Camera Motion", "Action Selection"],
          outputMode: "chat_reply" as const,
          memoryPolicy: "session" as const,
          source: "builtin" as const,
        },
      })),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentSend();
    });

    expect(sendToAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          activePrompt: "Which camera motion should I use?",
          lastAssistantMessage: "Upload your image to get the process started :)",
          pulse: expect.objectContaining({
            label: "Video Prompt Magic",
            presetId: "image",
          }),
        }),
      })
    );
  });

  it("blocks text-only sends while a workflow Pulse is still waiting for an image", async () => {
    const sendToAgent = vi.fn(async () => ({ response: { message: "ok" }, actions: {} }));
    const appendUserMessage = vi.fn(() => "msg-1");
    const setPulseWorkflowSession = vi.fn();
    const setUiNotice = vi.fn();
    const setAgentAttachmentError = vi.fn();
    const trackAgentUiEvent = vi.fn();
    const params = createParams({
      agentInput: "truck left",
      sendToAgent,
      appendUserMessage,
      setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
      setUiNotice: asDispatch<string | null>(setUiNotice),
      setAgentAttachmentError: asDispatch<string | null>(setAgentAttachmentError),
      trackAgentUiEvent,
      runtimePolicy: pulseRuntimePolicy("image"),
      getAgentContext: vi.fn(() => ({
        activePrompt: "Upload your image to get the process started :)",
        lastAssistantMessage: "Upload your image to get the process started :)",
        pulse: {
          presetId: "image",
          label: "Video Prompt Magic",
          instructions: "Run the guided single-shot workflow.",
          runtimeMode: "workflow_gpt" as const,
          activationMode: "activate_and_start" as const,
          starterAssistantMessage: "Upload your image to get the process started :)",
          workflowStageHints: ["Image Gate", "Camera Motion", "Action Selection"],
          outputMode: "chat_reply" as const,
          memoryPolicy: "session" as const,
          source: "builtin" as const,
          workflowSession: {
            presetId: "image",
            status: "awaiting_input" as const,
            currentStepIndex: 1,
            currentStepLabel: "Image Gate",
            currentStepPrompt: "Upload your image to get the process started :)",
            collectedInputs: [],
            lastArtifact: null,
          },
        },
      })),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentSend();
    });

    expect(sendToAgent).not.toHaveBeenCalled();
    expect(appendUserMessage).not.toHaveBeenCalled();
    expect(setPulseWorkflowSession).not.toHaveBeenCalled();
    expect(setUiNotice).toHaveBeenCalledWith("Attach or drop an image to continue this Pulse.");
    expect(setAgentAttachmentError).toHaveBeenCalledWith(
      "Attach or drop an image to continue this Pulse."
    );
    expect(trackAgentUiEvent).toHaveBeenCalledWith(
      "studio_agent_send_blocked_pulse_image_required"
    );
  });

  it("allows image-gated Pulse sends when selected image media is present in context", async () => {
    const sendToAgent = vi.fn(async () => ({ response: { message: "ok" }, actions: {} }));
    const appendUserMessage = vi.fn(() => "msg-1");
    const setUiNotice = vi.fn();
    const params = createParams({
      agentInput: "truck left",
      sendToAgent,
      appendUserMessage,
      setUiNotice: asDispatch<string | null>(setUiNotice),
      runtimePolicy: pulseRuntimePolicy("image"),
      getAgentContext: vi.fn(() => ({
        media: [
          {
            id: "selected-image",
            kind: "image" as const,
            url: "https://cdn.test/selected-image.png",
          },
        ],
        pulse: {
          presetId: "image",
          label: "Video Prompt Magic",
          instructions: "Run the guided single-shot workflow.",
          runtimeMode: "workflow_gpt" as const,
          activationMode: "activate_and_start" as const,
          starterAssistantMessage: "Upload your image to get the process started :)",
          workflowStageHints: ["Image Gate", "Camera Motion", "Action Selection"],
          outputMode: "chat_reply" as const,
          memoryPolicy: "session" as const,
          source: "builtin" as const,
          workflowSession: {
            presetId: "image",
            status: "awaiting_input" as const,
            currentStepIndex: 1,
            currentStepLabel: "Image Gate",
            currentStepPrompt: "Upload your image to get the process started :)",
            collectedInputs: [],
            lastArtifact: null,
          },
        },
      })),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentSend();
    });

    expect(sendToAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "truck left",
        context: expect.objectContaining({
          media: [
            {
              id: "selected-image",
              kind: "image",
              url: "https://cdn.test/selected-image.png",
            },
          ],
          pulse: expect.objectContaining({
            workflowSession: expect.objectContaining({
              collectedInputs: ["truck left"],
            }),
          }),
        }),
      })
    );
    expect(appendUserMessage).toHaveBeenCalledWith("truck left", []);
    expect(setUiNotice).not.toHaveBeenCalledWith("Attach or drop an image to continue this Pulse.");
  });

  it("uses prompt focus for prompt references when no canonical context exists", async () => {
    const sendToAgent = vi.fn(async () => ({ response: { message: "ok" }, actions: {} }));
    const params = createParams({
      latestAgentPrompt: null,
      lastAssistantMessage: null,
      agentAttachments: [
        {
          id: "prompt-1",
          kind: "prompt",
          referenceId: "ref-1",
          text: "silver armor details",
          aspect: "1:1",
        },
      ],
      getAgentContext: vi.fn(() => ({
        activePrompt: null,
        lastAssistantMessage: null,
        focusedSource: "agent-output" as const,
      })),
      sendToAgent,
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentSend();
    });

    expect(sendToAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          focusedSource: "prompt",
          selectedReferenceIds: ["ref-1"],
        }),
      })
    );
  });

  it("enhances video reference prompt and routes to video setter", async () => {
    const setVideoReferenceText = vi.fn();
    const setEditReferenceText = vi.fn();
    const setPromptOrigin = vi.fn();
    const sendToAgent = vi.fn(async () => ({
      response: { message: "Refined video prompt" },
      actions: { applyPrompt: "Refined video prompt" },
    }));

    const params = createParams({
      selectedTool: "video",
      latestAgentPrompt: "Previous prompt context",
      videoReferenceText: "Base video prompt",
      sendToAgent,
      setVideoReferenceText,
      setEditReferenceText,
      setPromptOrigin: asDispatch<"manual" | "agent" | "reference">(setPromptOrigin),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleReferencePromptEnhance();
    });

    expect(sendToAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Base video prompt",
        payloadText: "Base video prompt",
        isolateHistory: true,
        skipUserEcho: true,
        previousPrompt: "Previous prompt context",
      })
    );
    expect(setVideoReferenceText).toHaveBeenCalledWith("Refined video prompt");
    expect(setEditReferenceText).not.toHaveBeenCalled();
    expect(setPromptOrigin).toHaveBeenCalledWith("manual");
  });

  it("blocks Standard reference prompt enhancement while Pulse runtime is active", async () => {
    const sendToAgent = vi.fn(async () => ({
      response: { message: "Refined video prompt" },
      actions: { applyPrompt: "Refined video prompt" },
    }));
    const setUiNotice = vi.fn();
    const trackAgentUiEvent = vi.fn();
    const params = createParams({
      selectedTool: "video",
      videoReferenceText: "Base video prompt",
      sendToAgent,
      runtimePolicy: pulseRuntimePolicy("multi_shot"),
      setUiNotice: asDispatch<string | null>(setUiNotice),
      trackAgentUiEvent,
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleReferencePromptEnhance();
    });

    expect(sendToAgent).not.toHaveBeenCalled();
    expect(setUiNotice).toHaveBeenCalledWith("Use the Pulse workflow to continue.");
    expect(trackAgentUiEvent).toHaveBeenCalledWith(
      "studio_agent_standard_action_blocked_in_pulse_mode"
    );
  });

  it("blocks prompt enhancement while agent bootstrap is still pending", async () => {
    const sendToAgent = vi.fn(async () => ({ response: null, actions: undefined }));
    const setUiNotice = vi.fn();
    const params = createParams({
      agentBootstrapReady: false,
      prompt: "Base prompt",
      sendToAgent,
      setUiNotice: asDispatch<string | null>(setUiNotice),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentEnhanceSend();
    });

    expect(sendToAgent).not.toHaveBeenCalled();
    expect(setUiNotice).toHaveBeenCalledWith("Preparing chat. Try again in a moment.");
  });

  it("blocks reference prompt enhancement while agent bootstrap is still pending", async () => {
    const sendToAgent = vi.fn(async () => ({ response: null, actions: undefined }));
    const setUiNotice = vi.fn();
    const params = createParams({
      agentBootstrapReady: false,
      selectedTool: "video",
      videoReferenceText: "Base video prompt",
      sendToAgent,
      setUiNotice: asDispatch<string | null>(setUiNotice),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleReferencePromptEnhance();
    });

    expect(sendToAgent).not.toHaveBeenCalled();
    expect(setUiNotice).toHaveBeenCalledWith("Preparing chat. Try again in a moment.");
  });

  it("describes a reference through the canonical agent path without legacy describe route", async () => {
    const sendToAgent = vi.fn(async () => ({
      response: { message: "A detailed image prompt" },
      actions: { applyPrompt: "A detailed image prompt" },
    }));
    const setOutputs = vi.fn();
    const setSharedPrompt = vi.fn();
    const setLatestAgentPrompt = vi.fn();
    const setPromptOrigin = vi.fn();
    const setActiveOutputId = vi.fn();
    const targetOutput = makeOutput("out-1", {
      prompt: "Original output prompt",
      previewUrl: "https://cdn.test/original.png",
      previewText: "Preview text",
    });

    const params = createParams({
      sendToAgent,
      setOutputs: asDispatch<StudioOutput[]>(setOutputs),
      setSharedPrompt,
      setLatestAgentPrompt: asDispatch<string | null>(setLatestAgentPrompt),
      setPromptOrigin: asDispatch<"manual" | "agent" | "reference">(setPromptOrigin),
      setActiveOutputId: asDispatch<string | null>(setActiveOutputId),
      getOutputById: vi.fn((id: string) => (id === "out-1" ? targetOutput : null)),
      getAgentContext: vi.fn(() => ({})),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleDescribeReference("out-1");
    });

    expect(prepareImageUrlMock).toHaveBeenCalledWith("https://cdn.test/original.png");
    expect(sendToAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "",
        payloadText: "",
        isolateHistory: true,
        skipUserEcho: true,
        context: expect.objectContaining({
          focusedSource: "image",
          selectedReferenceIds: ["out-1"],
          media: [
            expect.objectContaining({
              id: "out-1",
              kind: "image",
              url: "https://cdn.test/prepared-image.png",
            }),
          ],
        }),
      })
    );
    expect(setSharedPrompt).toHaveBeenCalledWith("A detailed image prompt");
    expect(setLatestAgentPrompt).toHaveBeenCalledWith("A detailed image prompt");
    expect(setPromptOrigin).toHaveBeenCalledWith("agent");
  });

  it("keeps Pulse chat applyPrompt output out of the shared Create prompt", async () => {
    const sendToAgent = vi.fn(async () => ({
      response: { message: "Refined pulse guidance" },
      actions: { applyPrompt: "Refined pulse guidance" },
    }));
    const setSharedPrompt = vi.fn();
    const setLatestAgentPrompt = vi.fn();
    const setPromptOrigin = vi.fn();
    const params = createParams({
      agentInput: "Help me shape this concept.",
      sendToAgent,
      setSharedPrompt,
      setLatestAgentPrompt: asDispatch<string | null>(setLatestAgentPrompt),
      setPromptOrigin: asDispatch<"manual" | "agent" | "reference">(setPromptOrigin),
      runtimePolicy: pulseRuntimePolicy("multi_shot"),
      getAgentContext: vi.fn(() => ({
        pulse: {
          presetId: "multi_shot",
          label: "Multi Sequence Video Prompt",
          instructions: "Build a multi-shot video sequence.",
          runtimeMode: "workflow_gpt" as const,
          activationMode: "activate_and_start" as const,
          starterAssistantMessage: null,
          workflowStageHints: null,
          outputMode: "chat_reply" as const,
          memoryPolicy: "session" as const,
          source: "builtin" as const,
        },
      })),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentSend();
    });

    expect(setLatestAgentPrompt).toHaveBeenCalledWith("Refined pulse guidance");
    expect(setSharedPrompt).not.toHaveBeenCalled();
    expect(setPromptOrigin).not.toHaveBeenCalled();
  });

  it("reuses prepared image URLs across repeated sends for the same attachment source", async () => {
    const sendToAgent = vi.fn(async () => ({ response: { message: "ok" }, actions: {} }));
    const params = createParams({
      agentInput: "refine this",
      sendToAgent,
      agentAttachments: [
        {
          id: "img-1",
          kind: "image",
          imageUrl: "https://cdn.test/image.png",
          text: null,
          aspect: null,
        },
      ],
      getAgentContext: vi.fn(() => ({})),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentSend();
      await result.current.handleAgentSend();
    });

    expect(prepareImageUrlMock).toHaveBeenCalledTimes(1);
  });

  it("primes authoritative workflow session state immediately when a workflow pulse starts", async () => {
    const setPulseWorkflowSession = vi.fn();
    const workflowSession: AgentPulseWorkflowSession = {
      presetId: "story_builder",
      status: "awaiting_input",
      currentStepIndex: 1,
      currentStepLabel: "Upload Characters",
      currentStepPrompt: "Step 1 - Upload your characters.",
      collectedInputs: [],
      lastArtifact: null,
    };
    const sendToAgent = vi.fn(async () => ({
      response: { message: "Step 1 - Upload your characters." },
      actions: undefined,
      workflowSession,
    }));
    const params = createParams({
      sendToAgent,
      setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
      getAgentContext: vi.fn(() => ({})),
      runtimePolicy: pulseRuntimePolicy("story_builder"),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    const preset: CreatePulseResolvedPreset = {
      presetId: "story_builder",
      label: "DFY Story Builder",
      description: "Story workflow",
      systemInstructions: "workflow instructions",
      runtimeMode: "workflow_gpt",
      activationMode: "activate_and_start",
      starterAssistantMessage:
        "Step 1 - Upload your characters. Please upload 1-3+ character images.",
      workflowStageHints: ["Upload Characters", "Plot Seed", "Runtime"],
      outputMode: "chat_reply",
      memoryPolicy: "session",
      isCustom: false,
      isBuiltIn: true,
      isEditable: true,
      hasUserOverride: false,
    };

    await act(async () => {
      await result.current.handlePulsePresetStart(preset, {
        pulseSessionInstanceId: "pulse-session-1",
      });
    });

    expect(setPulseWorkflowSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        presetId: "story_builder",
        status: "running",
        currentStepIndex: 1,
        currentStepLabel: "Upload Characters",
        collectedInputs: [],
      })
    );
    expect(setPulseWorkflowSession).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        presetId: "story_builder",
        status: "awaiting_input",
        currentStepLabel: "Upload Characters",
      })
    );
  });

  it("starts an image-gated Pulse at the next step when selected image media already exists", async () => {
    const setPulseWorkflowSession = vi.fn();
    const sendToAgent = vi.fn(async () => ({
      response: { message: "Which camera motion should I use?" },
      actions: undefined,
      workflowSession: {
        presetId: "image",
        status: "awaiting_input" as const,
        currentStepIndex: 2,
        currentStepLabel: "Camera Motion",
        currentStepPrompt: "Which camera motion should I use?",
        collectedInputs: ["Uploaded image attached"],
        lastArtifact: null,
      },
    }));
    const params = createParams({
      sendToAgent,
      setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
      getAgentContext: vi.fn(() => ({
        focusedSource: "image" as const,
        focusedReferenceId: "selected-image",
        selectedReferenceIds: ["selected-image"],
        media: [
          {
            id: "selected-image",
            kind: "image" as const,
            url: "https://cdn.test/selected-image.png",
          },
        ],
      })),
      runtimePolicy: pulseRuntimePolicy("image"),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    const preset: CreatePulseResolvedPreset = {
      presetId: "image",
      label: "Video Prompt Magic",
      description: "Video workflow",
      systemInstructions: "workflow instructions",
      runtimeMode: "workflow_gpt",
      activationMode: "activate_and_start",
      starterAssistantMessage: "Upload your image to get the process started :)",
      workflowStageHints: ["Image Gate", "Camera Motion", "Action Selection"],
      outputMode: "chat_reply",
      memoryPolicy: "session",
      isCustom: false,
      isBuiltIn: true,
      isEditable: true,
      hasUserOverride: false,
    };

    await act(async () => {
      await result.current.handlePulsePresetStart(preset, {
        pulseSessionInstanceId: "pulse-session-1",
      });
    });

    expect(setPulseWorkflowSession).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        presetId: "image",
        status: "running",
        currentStepIndex: 2,
        currentStepLabel: "Camera Motion",
        collectedInputs: ["Uploaded image attached"],
      })
    );
    expect(sendToAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        payloadText: expect.not.stringContaining("Your first assistant reply must be exactly this"),
        context: expect.objectContaining({
          media: [
            {
              id: "selected-image",
              kind: "image",
              url: "https://cdn.test/selected-image.png",
            },
          ],
          pulse: expect.objectContaining({
            workflowSession: expect.objectContaining({
              currentStepIndex: 2,
              currentStepLabel: "Camera Motion",
              collectedInputs: ["Uploaded image attached"],
            }),
          }),
        }),
      })
    );
  });

  it("returns blocked_busy and does not start a pulse when the agent is already busy", async () => {
    const sendToAgent = vi.fn();
    const setPulseWorkflowSession = vi.fn();
    const params = createParams({
      agentIsSending: true,
      sendToAgent,
      setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
      getAgentContext: vi.fn(() => ({})),
      runtimePolicy: pulseRuntimePolicy("story_builder"),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    const preset: CreatePulseResolvedPreset = {
      presetId: "story_builder",
      label: "DFY Story Builder",
      description: "Story workflow",
      systemInstructions: "workflow instructions",
      runtimeMode: "workflow_gpt",
      activationMode: "activate_and_start",
      starterAssistantMessage: "Step 1 - Upload your characters.",
      workflowStageHints: ["Upload Characters", "Plot Seed", "Runtime"],
      outputMode: "chat_reply",
      memoryPolicy: "session",
      isCustom: false,
      isBuiltIn: true,
      isEditable: true,
      hasUserOverride: false,
    };

    let startResult: Awaited<ReturnType<typeof result.current.handlePulsePresetStart>> | undefined;
    await act(async () => {
      startResult = await result.current.handlePulsePresetStart(preset, {
        pulseSessionInstanceId: "pulse-session-1",
      });
    });

    expect(startResult).toEqual({
      status: "blocked_busy",
      message: "Wait for the current Pulse step to finish before switching.",
    });
    expect(sendToAgent).not.toHaveBeenCalled();
    expect(setPulseWorkflowSession).not.toHaveBeenCalled();
  });

  it("returns a scope-discard failure when the kickoff turn is invalidated by a session switch", async () => {
    const setPulseWorkflowSession = vi.fn();
    const sendToAgent = vi.fn(async () => ({
      response: null,
      actions: undefined,
      workflowSession: null,
      discarded: true,
    }));
    const params = createParams({
      sendToAgent,
      setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
      getAgentContext: vi.fn(() => ({})),
      runtimePolicy: pulseRuntimePolicy("story_builder"),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    let startResult: Awaited<ReturnType<typeof result.current.handlePulsePresetStart>> | undefined;
    await act(async () => {
      startResult = await result.current.handlePulsePresetStart({
        presetId: "story_builder",
        label: "DFY Story Builder",
        description: "Story workflow",
        systemInstructions: "workflow instructions",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        starterAssistantMessage: "Step 1 - Upload your characters.",
        workflowStageHints: ["Upload Characters"],
        outputMode: "chat_reply",
        memoryPolicy: "session",
        isCustom: false,
        isBuiltIn: true,
        isEditable: true,
        hasUserOverride: false,
      });
    });

    expect(startResult).toEqual({
      status: "failed",
      reason: "scope_discarded",
      message: "Pulse session changed before kickoff completed. Try again.",
    });
    expect(setPulseWorkflowSession).toHaveBeenLastCalledWith(null);
  });

  it("returns a transport failure reason when the kickoff turn fails before any response arrives", async () => {
    const setPulseWorkflowSession = vi.fn();
    const sendToAgent = vi.fn(async () => ({
      response: null,
      actions: undefined,
      workflowSession: null,
      errorText: "Agent request failed (502)",
      failureKind: "transport_error" as const,
    }));
    const params = createParams({
      sendToAgent,
      setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
      getAgentContext: vi.fn(() => ({})),
      runtimePolicy: pulseRuntimePolicy("story_builder"),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    let startResult: Awaited<ReturnType<typeof result.current.handlePulsePresetStart>> | undefined;
    await act(async () => {
      startResult = await result.current.handlePulsePresetStart({
        presetId: "story_builder",
        label: "DFY Story Builder",
        description: "Story workflow",
        systemInstructions: "workflow instructions",
        runtimeMode: "workflow_gpt",
        activationMode: "activate_and_start",
        starterAssistantMessage: "Step 1 - Upload your characters.",
        workflowStageHints: ["Upload Characters"],
        outputMode: "chat_reply",
        memoryPolicy: "session",
        isCustom: false,
        isBuiltIn: true,
        isEditable: true,
        hasUserOverride: false,
      });
    });

    expect(startResult).toEqual({
      status: "failed",
      reason: "transport_error",
      message: "Agent request failed (502)",
    });
    expect(setPulseWorkflowSession).toHaveBeenLastCalledWith(null);
  });

  it("routes pulse activation turns through the target preset session namespace", async () => {
    const sendToAgent = vi.fn(async () => ({
      response: { message: "Step 1 - Upload your characters." },
      actions: undefined,
      workflowSession: null,
    }));
    const params = createParams({
      sendToAgent,
      getAgentContext: vi.fn(() => ({})),
      runtimePolicy: pulseRuntimePolicy("story_builder"),
      resolvePulseSessionNamespace: (presetId, pulseSessionInstanceId) =>
        `ai-studio:session-1::pulse:${presetId}:${pulseSessionInstanceId}`,
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handlePulsePresetStart(
        {
          presetId: "story_builder",
          label: "DFY Story Builder",
          description: "Story workflow",
          systemInstructions: "workflow instructions",
          runtimeMode: "workflow_gpt",
          activationMode: "activate_and_start",
          starterAssistantMessage: "Step 1 - Upload your characters.",
          workflowStageHints: ["Upload Characters", "Plot Seed", "Runtime"],
          outputMode: "chat_reply",
          memoryPolicy: "session",
          isCustom: false,
          isBuiltIn: true,
          isEditable: true,
          hasUserOverride: false,
        },
        {
          pulseSessionInstanceId: "pulse-session-1",
        }
      );
    });

    expect(sendToAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionNamespaceOverride: "ai-studio:session-1::pulse:story_builder:pulse-session-1",
        isolateHistory: true,
      })
    );
  });

  it("primes workflow session state on user reply before the next workflow response returns", async () => {
    const setPulseWorkflowSession = vi.fn();
    const sendToAgent = vi.fn(async () => ({
      response: { message: "Step 3 - How long should it be?" },
      actions: undefined,
      workflowSession: null,
    }));
    const params = createParams({
      agentInput: "A knight enters a cursed forest",
      sendToAgent,
      setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
      runtimePolicy: pulseRuntimePolicy("story_builder"),
      getAgentContext: vi.fn(() => ({
        pulse: {
          presetId: "story_builder",
          label: "DFY Story Builder",
          instructions: "workflow instructions",
          runtimeMode: "workflow_gpt" as const,
          activationMode: "activate_and_start" as const,
          starterAssistantMessage:
            "Step 1 - Upload your characters. Please upload 1-3+ character images.",
          workflowStageHints: ["Upload Characters", "Plot Seed", "Runtime"],
          outputMode: "chat_reply" as const,
          memoryPolicy: "session" as const,
          source: "builtin" as const,
          workflowSession: {
            presetId: "story_builder",
            status: "awaiting_input" as const,
            currentStepIndex: 2,
            currentStepLabel: "Plot Seed",
            currentStepPrompt: "Step 2 - Basic plot. Share a 1-2 sentence plot idea.",
            collectedInputs: ["grimdark"],
            lastArtifact: null,
          },
        },
      })),
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handleAgentSend();
    });

    expect(setPulseWorkflowSession).toHaveBeenCalledWith({
      presetId: "story_builder",
      status: "running",
      currentStepIndex: 2,
      currentStepLabel: "Plot Seed",
      currentStepPrompt: "Step 2 - Basic plot. Share a 1-2 sentence plot idea.",
      collectedInputs: ["grimdark", "A knight enters a cursed forest"],
      lastArtifact: null,
      finalArtifactSource: null,
    });
    expect(sendToAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({
          pulse: expect.objectContaining({
            workflowSession: expect.objectContaining({
              presetId: "story_builder",
              status: "running",
              currentStepIndex: 2,
              currentStepLabel: "Plot Seed",
              collectedInputs: ["grimdark", "A knight enters a cursed forest"],
              finalArtifactSource: null,
            }),
          }),
        }),
      })
    );
  });
});
