import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type {
  AiStudioSessionAgentV1,
  AiStudioSessionSnapshotV2,
} from "../../logic/sessionSnapshot";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";
import { useAiStudioPageSessionPersistence } from "../useAiStudioPageSessionPersistence";
import { useAiStudioProjectWorkspacePersistenceController } from "../useAiStudioProjectWorkspacePersistenceController";
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

const mockedUseAiStudioProjectWorkspacePersistenceController = vi.mocked(
  useAiStudioProjectWorkspacePersistenceController
);

const createAgentRuntime = (
  overrides: Partial<AiStudioSessionAgentV1> = {}
): AiStudioSessionAgentV1 => ({
  messages: [],
  input: "",
  latestAgentPrompt: null,
  promptOrigin: "manual",
  chatModeEnabled: true,
  pulseWorkflowSession: null,
  ...overrides,
});

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
    mockedUseAiStudioProjectWorkspacePersistenceController.mockClear();
  });

  it("returns an inert non-project persistence bridge when project workspace is absent", () => {
    const buildBaseSessionSnapshot = vi.fn(
      (args): AiStudioSessionSnapshotV2 =>
        ({
          schemaVersion: 2,
          sessionId: args.sessionId,
          updatedAt: "2026-03-23T00:00:00.000Z",
          workspace: {} as AiStudioSessionSnapshotV2["workspace"],
          outputs: {} as AiStudioSessionSnapshotV2["outputs"],
          agent: {} as AiStudioSessionSnapshotV2["agent"],
          meta: {} as AiStudioSessionSnapshotV2["meta"],
        }) as AiStudioSessionSnapshotV2
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

    const { result } = renderHook(() =>
      useAiStudioPageSessionPersistence({
        sessionId: "session-1",
        buildBaseSessionSnapshot,
        createPersistenceRuntime: {
          kind: "standard",
          agentRuntime: createAgentRuntime({
            input: "plan next shot",
            latestAgentPrompt: "latest",
          }),
        },
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot,
        hydrateFromSessionCanvasSnapshot,
        hydrateFromSessionExpertEditSnapshot,
        setUiNotice,
      })
    );

    expect(mockedUseAiStudioProjectWorkspacePersistenceController).toHaveBeenCalledTimes(1);
    expect(mockedUseAiStudioProjectWorkspacePersistenceController.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        projectId: null,
        projectRouteRequested: false,
        sessionId: "session-1",
      })
    );
    expect(result.current.sessionId).toBe("session-1");
    expect(result.current.sessionSnapshot).toBeNull();
    expect(result.current.sessionRestoreCandidate).toMatchObject({
      status: "idle",
      result: "idle",
      snapshot: null,
      source: "none",
      error: null,
    });
    expect(buildBaseSessionSnapshot).not.toHaveBeenCalled();
    expect(setUiNotice).not.toHaveBeenCalled();
  });

  it("preserves completed Pulse artifact state when the page builds persistence snapshots", () => {
    const buildBaseSessionSnapshot = vi.fn(
      (args): AiStudioSessionSnapshotV2 =>
        ({
          schemaVersion: 2,
          sessionId: args.sessionId,
          updatedAt: "2026-03-23T00:00:00.000Z",
          workspace: {} as AiStudioSessionSnapshotV2["workspace"],
          outputs: {} as AiStudioSessionSnapshotV2["outputs"],
          agent: {} as AiStudioSessionSnapshotV2["agent"],
          meta: {} as AiStudioSessionSnapshotV2["meta"],
        }) as AiStudioSessionSnapshotV2
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
        projectId: "project-1",
        sessionId: "session-1",
        buildBaseSessionSnapshot,
        createPersistenceRuntime: {
          kind: "pulse",
          agentRuntime: createAgentRuntime({
            messages: [
              {
                id: "assistant-1",
                role: "assistant",
                content: completedPulseWorkflowSession.lastArtifact ?? "",
              },
            ],
            latestAgentPrompt: completedPulseWorkflowSession.lastArtifact ?? null,
            promptOrigin: "agent",
            pulseWorkflowSession: completedPulseWorkflowSession,
          }),
          agentRuntimes: {
            standard: createAgentRuntime(),
            pulsePresetId: "story_builder",
            pulse: createAgentRuntime({
              messages: [
                {
                  id: "assistant-1",
                  role: "assistant",
                  content: completedPulseWorkflowSession.lastArtifact ?? "",
                },
              ],
              latestAgentPrompt: completedPulseWorkflowSession.lastArtifact ?? null,
              promptOrigin: "agent",
              pulseWorkflowSession: completedPulseWorkflowSession,
            }),
          },
        },
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot: vi.fn(),
        setUiNotice,
      })
    );

    const params = mockedUseAiStudioProjectWorkspacePersistenceController.mock.calls.at(-1)?.[0];
    params?.buildBaseSessionSnapshot("session-2");

    expect(buildBaseSessionSnapshot).toHaveBeenCalledWith({
      sessionId: "session-2",
      agentRuntime: createAgentRuntime({
        messages: [
          {
            id: "assistant-1",
            role: "assistant",
            content: completedPulseWorkflowSession.lastArtifact ?? "",
          },
        ],
        latestAgentPrompt: completedPulseWorkflowSession.lastArtifact ?? null,
        promptOrigin: "agent",
        pulseWorkflowSession: completedPulseWorkflowSession,
      }),
      agentRuntimes: {
        standard: createAgentRuntime(),
        pulsePresetId: "story_builder",
        pulse: createAgentRuntime({
          messages: [
            {
              id: "assistant-1",
              role: "assistant",
              content: completedPulseWorkflowSession.lastArtifact ?? "",
            },
          ],
          latestAgentPrompt: completedPulseWorkflowSession.lastArtifact ?? null,
          promptOrigin: "agent",
          pulseWorkflowSession: completedPulseWorkflowSession,
        }),
      },
    });
  });

  it("patches the latest Expert Edit snapshot onto the base project snapshot", () => {
    const buildBaseSessionSnapshot = vi.fn(
      (args): AiStudioSessionSnapshotV2 =>
        ({
          schemaVersion: 2,
          sessionId: args.sessionId,
          updatedAt: "2026-03-23T00:00:00.000Z",
          workspace: {} as AiStudioSessionSnapshotV2["workspace"],
          outputs: {} as AiStudioSessionSnapshotV2["outputs"],
          agent: {} as AiStudioSessionSnapshotV2["agent"],
          meta: {} as AiStudioSessionSnapshotV2["meta"],
        }) as AiStudioSessionSnapshotV2
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
    const updatedExpertEditSessionState: ExpertEditSessionState = {
      ...expertEditSessionState,
      markup: {
        strokes: [...expertEditSessionState.markup.strokes],
      },
    };
    let currentExpertEditSessionState: ExpertEditSessionState | null = expertEditSessionState;

    renderHook(() =>
      useAiStudioPageSessionPersistence({
        projectId: "project-1",
        sessionId: "session-1",
        buildBaseSessionSnapshot,
        patchSessionSnapshot: (snapshot) => ({
          ...snapshot,
          expertEdit:
            currentExpertEditSessionState === null
              ? undefined
              : ({
                  schemaVersion: 1,
                  state: currentExpertEditSessionState,
                } as NonNullable<AiStudioSessionSnapshotV2["expertEdit"]>),
        }),
        createPersistenceRuntime: {
          kind: "standard",
          agentRuntime: createAgentRuntime(),
        },
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot: vi.fn(),
        setUiNotice: vi.fn(),
      })
    );

    currentExpertEditSessionState = updatedExpertEditSessionState;
    const params = mockedUseAiStudioProjectWorkspacePersistenceController.mock.calls.at(-1)?.[0];
    const baseSnapshot = params?.buildBaseSessionSnapshot("session-2");
    const patchedSnapshot = baseSnapshot ? params?.patchSessionSnapshot?.(baseSnapshot) : null;

    expect(buildBaseSessionSnapshot).toHaveBeenCalledWith({
      sessionId: "session-2",
      agentRuntime: createAgentRuntime(),
    });
    expect(patchedSnapshot).toEqual(
      expect.objectContaining({
        expertEdit: {
          schemaVersion: 1,
          state: updatedExpertEditSessionState,
        },
      })
    );
  });

  it("routes project-backed sessions through the project workspace controller", () => {
    const buildBaseSessionSnapshot = vi.fn(
      (args): AiStudioSessionSnapshotV2 =>
        ({
          schemaVersion: 2,
          sessionId: args.sessionId,
          updatedAt: "2026-03-23T00:00:00.000Z",
          workspace: {} as AiStudioSessionSnapshotV2["workspace"],
          outputs: {} as AiStudioSessionSnapshotV2["outputs"],
          agent: {} as AiStudioSessionSnapshotV2["agent"],
          meta: {} as AiStudioSessionSnapshotV2["meta"],
        }) as AiStudioSessionSnapshotV2
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
        buildBaseSessionSnapshot,
        createPersistenceRuntime: {
          kind: "standard",
          agentRuntime: createAgentRuntime(),
        },
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
  });

  it("disables the legacy session lane while a project route is still pending bootstrap", () => {
    const buildBaseSessionSnapshot = vi.fn(
      (args): AiStudioSessionSnapshotV2 =>
        ({
          schemaVersion: 2,
          sessionId: args.sessionId,
          updatedAt: "2026-03-23T00:00:00.000Z",
          workspace: {} as AiStudioSessionSnapshotV2["workspace"],
          outputs: {} as AiStudioSessionSnapshotV2["outputs"],
          agent: {} as AiStudioSessionSnapshotV2["agent"],
          meta: {} as AiStudioSessionSnapshotV2["meta"],
        }) as AiStudioSessionSnapshotV2
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
        buildBaseSessionSnapshot,
        createPersistenceRuntime: {
          kind: "standard",
          agentRuntime: createAgentRuntime(),
        },
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
  });
});
