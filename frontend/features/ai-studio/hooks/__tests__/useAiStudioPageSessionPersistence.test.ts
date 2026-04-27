import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { AiStudioSessionSnapshot } from "../../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";
import { useAiStudioPageSessionPersistence } from "../useAiStudioPageSessionPersistence";
import { useAiStudioProjectWorkspacePersistenceController } from "../useAiStudioProjectWorkspacePersistenceController";
import { useAiStudioSessionPersistenceController } from "../useAiStudioSessionPersistenceController";
import type { ExpertEditSessionState } from "../../components/edit/expertEditSessionState";
import type { AgentPulseWorkflowSession } from "../../../../prefabs/agent";

vi.mock("../useAiStudioProjectWorkspacePersistenceController", () => ({
  useAiStudioProjectWorkspacePersistenceController: vi.fn(() => ({
    sessionId: "session-1",
    sessionSnapshot: null,
    sessionRestoreCandidate: {
      status: "idle",
      result: "idle",
      snapshot: null,
      source: "none",
      error: null,
      retry: vi.fn(),
    },
    setSkipRestoreApplyForSessionId: vi.fn(),
    projectBootstrapApplied: false,
    projectBootstrapError: null,
    retryProjectBootstrap: vi.fn(),
  })),
}));

vi.mock("../useAiStudioSessionPersistenceController", () => ({
  useAiStudioSessionPersistenceController: vi.fn(() => ({
    sessionId: "session-1",
    sessionSnapshot: null,
    sessionRestoreCandidate: {
      status: "idle",
      result: "idle",
      snapshot: null,
      source: "none",
      error: null,
      retry: vi.fn(),
    },
    setSkipRestoreApplyForSessionId: vi.fn(),
    projectBootstrapApplied: true,
    projectBootstrapError: null,
    retryProjectBootstrap: vi.fn(),
  })),
}));

const mockedUseAiStudioSessionPersistenceController = vi.mocked(
  useAiStudioSessionPersistenceController
);
const mockedUseAiStudioProjectWorkspacePersistenceController = vi.mocked(
  useAiStudioProjectWorkspacePersistenceController
);

describe("useAiStudioPageSessionPersistence", () => {
  const expertEditSessionState: ExpertEditSessionState = {
    version: 2,
    layers: {
      layerIdCounter: 2,
      foundationLayerId: "layer-1",
      selectedLayerIndex: 0,
      layers: [],
    },
    markup: {
      strokes: [],
    },
    inpaint: {
      snapshot: { layers: [] },
    },
  };

  beforeEach(() => {
    mockedUseAiStudioSessionPersistenceController.mockClear();
    mockedUseAiStudioProjectWorkspacePersistenceController.mockClear();
  });

  it("passes the page-owned snapshot bridge into the shared persistence controller", () => {
    const buildSessionSnapshot = vi.fn(
      (args): AiStudioSessionSnapshot =>
        ({
          schemaVersion: 2,
          sessionId: args.sessionId,
          updatedAt: "2026-03-23T00:00:00.000Z",
          workspace: {} as AiStudioSessionSnapshot["workspace"],
          outputs: {} as AiStudioSessionSnapshot["outputs"],
          agent: {} as AiStudioSessionSnapshot["agent"],
        }) as AiStudioSessionSnapshot
    );
    const hydrateFromSessionSnapshot = vi.fn(
      (): AiStudioSessionHydrationPayload => ({
        workspace: {} as never,
        outputs: {} as never,
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
        agentRuntimes: {
          standard: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: false,
            pulseWorkflowSession: null,
          },
          pulsePresetId: null,
          pulse: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: true,
            pulseWorkflowSession: null,
          },
        },
        canvas: null,
        expertEdit: null,
      })
    );
    const hydrateFromSessionAgentSnapshot = vi.fn();
    const hydrateFromSessionCanvasSnapshot = vi.fn();
    const hydrateFromSessionExpertEditSnapshot = vi.fn();
    const setUiNotice = vi.fn();

    renderHook(() =>
      useAiStudioPageSessionPersistence({
        sessionId: "session-1",
        buildSessionSnapshot,
        agentMessages: [],
        agentInput: "plan next shot",
        latestAgentPrompt: "latest",
        promptOrigin: "manual",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
        agentRuntimes: {
          standard: {
            messages: [],
            input: "plan next shot",
            latestAgentPrompt: "latest",
            promptOrigin: "manual",
            chatModeEnabled: true,
            pulseWorkflowSession: null,
          },
          pulsePresetId: null,
          pulse: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: true,
            pulseWorkflowSession: null,
          },
        },
        expertEditSessionState,
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot,
        hydrateFromSessionCanvasSnapshot,
        hydrateFromSessionExpertEditSnapshot,
        setUiNotice,
      })
    );

    expect(mockedUseAiStudioSessionPersistenceController).toHaveBeenCalledTimes(1);
    const params = mockedUseAiStudioSessionPersistenceController.mock.calls[0]?.[0];
    expect(params?.sessionId).toBe("session-1");

    params?.buildSessionSnapshot("session-2");
    expect(buildSessionSnapshot).toHaveBeenCalledWith({
      sessionId: "session-2",
      agentMessages: [],
      agentInput: "plan next shot",
      latestAgentPrompt: "latest",
      promptOrigin: "manual",
      chatModeEnabled: true,
      pulseWorkflowSession: null,
      agentRuntimes: {
        standard: {
          messages: [],
          input: "plan next shot",
          latestAgentPrompt: "latest",
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
        pulsePresetId: null,
        pulse: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
      },
      expertEditSessionState,
    });

    params?.onPersistenceWarning?.("autosave warning");
    expect(setUiNotice).toHaveBeenCalledWith("autosave warning");
    expect(params?.hydrateFromSessionSnapshot).toBe(hydrateFromSessionSnapshot);
    expect(params?.hydrateFromSessionAgentSnapshot).toBe(hydrateFromSessionAgentSnapshot);
    expect(params?.hydrateFromSessionCanvasSnapshot).toBe(hydrateFromSessionCanvasSnapshot);
    expect(params?.hydrateFromSessionExpertEditSnapshot).toBe(hydrateFromSessionExpertEditSnapshot);
  });

  it("preserves completed Pulse artifact state when the page builds persistence snapshots", () => {
    const buildSessionSnapshot = vi.fn(
      (args): AiStudioSessionSnapshot =>
        ({
          schemaVersion: 2,
          sessionId: args.sessionId,
          updatedAt: "2026-03-23T00:00:00.000Z",
          workspace: {} as AiStudioSessionSnapshot["workspace"],
          outputs: {} as AiStudioSessionSnapshot["outputs"],
          agent: {} as AiStudioSessionSnapshot["agent"],
        }) as AiStudioSessionSnapshot
    );
    const hydrateFromSessionSnapshot = vi.fn(
      (): AiStudioSessionHydrationPayload => ({
        workspace: {} as never,
        outputs: {} as never,
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
        agentRuntimes: {
          standard: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: false,
            pulseWorkflowSession: null,
          },
          pulsePresetId: null,
          pulse: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: true,
            pulseWorkflowSession: null,
          },
        },
        canvas: null,
        expertEdit: null,
      })
    );
    const completedPulseWorkflowSession: AgentPulseWorkflowSession = {
      presetId: "story_builder",
      status: "completed",
      currentStepIndex: 4,
      currentStepLabel: "Final Prompt",
      currentStepPrompt: null,
      collectedInputs: ["grimdark tone", "10 minute runtime"],
      lastArtifact:
        "A lone medieval knight in weathered steel plate armor steps through the shattered entrance of a ruined Gothic cathedral at dawn.",
      finalArtifactSource: "chat_reply" as const,
    };
    const setUiNotice = vi.fn();

    renderHook(() =>
      useAiStudioPageSessionPersistence({
        sessionId: "session-1",
        buildSessionSnapshot,
        agentMessages: [
          {
            id: "assistant-1",
            role: "assistant",
            content: completedPulseWorkflowSession.lastArtifact ?? "",
          },
        ],
        agentInput: "",
        latestAgentPrompt: completedPulseWorkflowSession.lastArtifact ?? null,
        promptOrigin: "agent",
        chatModeEnabled: true,
        pulseWorkflowSession: completedPulseWorkflowSession,
        agentRuntimes: {
          standard: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: true,
            pulseWorkflowSession: null,
          },
          pulsePresetId: "story_builder",
          pulse: {
            messages: [
              {
                id: "assistant-1",
                role: "assistant",
                content: completedPulseWorkflowSession.lastArtifact ?? "",
              },
            ],
            input: "",
            latestAgentPrompt: completedPulseWorkflowSession.lastArtifact ?? null,
            promptOrigin: "agent",
            chatModeEnabled: true,
            pulseWorkflowSession: completedPulseWorkflowSession,
          },
        },
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot: vi.fn(),
        setUiNotice,
      })
    );

    const params = mockedUseAiStudioSessionPersistenceController.mock.calls.at(-1)?.[0];
    params?.buildSessionSnapshot("session-2");

    expect(buildSessionSnapshot).toHaveBeenCalledWith({
      sessionId: "session-2",
      agentMessages: [
        {
          id: "assistant-1",
          role: "assistant",
          content: completedPulseWorkflowSession.lastArtifact,
        },
      ],
      agentInput: "",
      latestAgentPrompt: completedPulseWorkflowSession.lastArtifact,
      promptOrigin: "agent",
      chatModeEnabled: true,
      pulseWorkflowSession: completedPulseWorkflowSession,
      agentRuntimes: {
        standard: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: true,
          pulseWorkflowSession: null,
        },
        pulsePresetId: "story_builder",
        pulse: {
          messages: [
            {
              id: "assistant-1",
              role: "assistant",
              content: completedPulseWorkflowSession.lastArtifact,
            },
          ],
          input: "",
          latestAgentPrompt: completedPulseWorkflowSession.lastArtifact,
          promptOrigin: "agent",
          chatModeEnabled: true,
          pulseWorkflowSession: completedPulseWorkflowSession,
        },
      },
      expertEditSessionState: undefined,
    });
  });

  it("routes project-backed sessions through the project workspace controller", () => {
    const buildSessionSnapshot = vi.fn(
      (args): AiStudioSessionSnapshot =>
        ({
          schemaVersion: 2,
          sessionId: args.sessionId,
          updatedAt: "2026-03-23T00:00:00.000Z",
          workspace: {} as AiStudioSessionSnapshot["workspace"],
          outputs: {} as AiStudioSessionSnapshot["outputs"],
          agent: {} as AiStudioSessionSnapshot["agent"],
        }) as AiStudioSessionSnapshot
    );
    const hydrateFromSessionSnapshot = vi.fn(
      (): AiStudioSessionHydrationPayload => ({
        workspace: {} as never,
        outputs: {} as never,
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
        agentRuntimes: {
          standard: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: false,
            pulseWorkflowSession: null,
          },
          pulsePresetId: null,
          pulse: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: true,
            pulseWorkflowSession: null,
          },
        },
        canvas: null,
        expertEdit: null,
      })
    );
    const hydrateFromSessionAgentSnapshot = vi.fn();
    const resetProjectAgentConversation = vi.fn();
    const setUiNotice = vi.fn();

    renderHook(() =>
      useAiStudioPageSessionPersistence({
        projectId: "project-1",
        sessionId: "session-1",
        buildSessionSnapshot,
        agentMessages: [],
        agentInput: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot,
        resetProjectAgentConversation,
        setUiNotice,
      })
    );

    expect(mockedUseAiStudioProjectWorkspacePersistenceController).toHaveBeenCalledTimes(1);
    expect(mockedUseAiStudioProjectWorkspacePersistenceController.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        projectId: "project-1",
        sessionId: "session-1",
        resetProjectAgentConversation,
      })
    );
    expect(mockedUseAiStudioSessionPersistenceController.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        sessionId: null,
      })
    );
  });

  it("disables the legacy session lane while a project route is still pending bootstrap", () => {
    const buildSessionSnapshot = vi.fn(
      (args): AiStudioSessionSnapshot =>
        ({
          schemaVersion: 2,
          sessionId: args.sessionId,
          updatedAt: "2026-03-23T00:00:00.000Z",
          workspace: {} as AiStudioSessionSnapshot["workspace"],
          outputs: {} as AiStudioSessionSnapshot["outputs"],
          agent: {} as AiStudioSessionSnapshot["agent"],
        }) as AiStudioSessionSnapshot
    );
    const hydrateFromSessionSnapshot = vi.fn(
      (): AiStudioSessionHydrationPayload => ({
        workspace: {} as never,
        outputs: {} as never,
        agent: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
        agentRuntimes: {
          standard: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: false,
            pulseWorkflowSession: null,
          },
          pulsePresetId: null,
          pulse: {
            messages: [],
            input: "",
            latestAgentPrompt: null,
            promptOrigin: "manual",
            chatModeEnabled: true,
            pulseWorkflowSession: null,
          },
        },
        canvas: null,
        expertEdit: null,
      })
    );
    const hydrateFromSessionAgentSnapshot = vi.fn();
    const resetProjectAgentConversation = vi.fn();
    const setUiNotice = vi.fn();

    renderHook(() =>
      useAiStudioPageSessionPersistence({
        projectRouteRequested: true,
        sessionId: "session-1",
        buildSessionSnapshot,
        agentMessages: [],
        agentInput: "",
        latestAgentPrompt: null,
        promptOrigin: "manual",
        chatModeEnabled: true,
        pulseWorkflowSession: null,
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot,
        resetProjectAgentConversation,
        setUiNotice,
      })
    );

    expect(mockedUseAiStudioProjectWorkspacePersistenceController).toHaveBeenCalledTimes(1);
    expect(mockedUseAiStudioProjectWorkspacePersistenceController.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        projectId: null,
        sessionId: "session-1",
        resetProjectAgentConversation,
      })
    );
    expect(mockedUseAiStudioSessionPersistenceController.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        sessionId: null,
      })
    );
  });
});
