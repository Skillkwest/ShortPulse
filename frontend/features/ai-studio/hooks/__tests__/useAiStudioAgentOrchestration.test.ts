import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useAiStudioAgentOrchestration } from "../useAiStudioAgentOrchestration";
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
  setAgentActions: asDispatch<unknown>(vi.fn()),
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
        }),
      })
    );
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
      getAgentContext: vi.fn(() => ({
        pulse: {
          presetId: "ad_hook",
          label: "Ad Hook",
          instructions: "Lead with a crisp paid-social hook.",
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
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
      pulseSessionInstanceId: "pulse-session-1",
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    const preset: CreatePulseResolvedPreset = {
      presetId: "story_builder",
      label: "Story Builder",
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

  it("returns blocked_busy and does not start a pulse when the agent is already busy", async () => {
    const sendToAgent = vi.fn();
    const setPulseWorkflowSession = vi.fn();
    const params = createParams({
      agentIsSending: true,
      sendToAgent,
      setPulseWorkflowSession: asDispatch(setPulseWorkflowSession),
      getAgentContext: vi.fn(() => ({})),
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
      pulseSessionInstanceId: "pulse-session-1",
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    const preset: CreatePulseResolvedPreset = {
      presetId: "story_builder",
      label: "Story Builder",
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

    expect(startResult).toBe("blocked_busy");
    expect(sendToAgent).not.toHaveBeenCalled();
    expect(setPulseWorkflowSession).not.toHaveBeenCalled();
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
      expertCreateMode: "pulse",
      activePulsePresetId: "story_builder",
      pulseSessionInstanceId: "pulse-session-1",
      resolvePulseSessionNamespace: (presetId, pulseSessionInstanceId) =>
        `ai-studio:session-1::pulse-v2:${presetId}:${pulseSessionInstanceId}`,
    });
    const { result } = renderHook(() => useAiStudioAgentOrchestration(params));

    await act(async () => {
      await result.current.handlePulsePresetStart(
        {
          presetId: "story_builder",
          label: "Story Builder",
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
        sessionNamespaceOverride: "ai-studio:session-1::pulse-v2:story_builder:pulse-session-1",
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
      getAgentContext: vi.fn(() => ({
        pulse: {
          presetId: "story_builder",
          label: "Story Builder",
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
