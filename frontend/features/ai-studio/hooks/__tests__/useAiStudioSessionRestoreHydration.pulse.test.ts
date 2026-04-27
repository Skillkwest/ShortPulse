import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStudioSessionRestoreHydration } from "../useAiStudioSessionRestoreHydration";
import type { AiStudioSessionRestoreCandidateState } from "../useAiStudioSessionRestoreCandidate";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";
import type { AiStudioSessionSnapshot } from "../../logic/sessionSnapshot";
import type { AgentPulseWorkflowSession } from "../../../../prefabs/agent";

const addBreadcrumbMock = vi.fn();

vi.mock("../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: (...args: unknown[]) => addBreadcrumbMock(...args),
}));

const completedPulseWorkflowSession: AgentPulseWorkflowSession = {
  presetId: "story_builder",
  status: "completed" as const,
  currentStepIndex: 4,
  currentStepLabel: "Final Prompt",
  currentStepPrompt: null,
  collectedInputs: ["grimdark tone", "10 minute runtime"],
  lastArtifact:
    "A lone medieval knight in weathered steel plate armor steps through the shattered entrance of a ruined Gothic cathedral at dawn.",
  finalArtifactSource: "chat_reply" as const,
};

const createSnapshot = (): AiStudioSessionSnapshot =>
  ({
    schemaVersion: 2,
    sessionId: "sid-1",
    updatedAt: "2026-04-25T19:00:00.000Z",
    workspace: {} as AiStudioSessionSnapshot["workspace"],
    outputs: {} as AiStudioSessionSnapshot["outputs"],
    agent: {} as AiStudioSessionSnapshot["agent"],
  }) as AiStudioSessionSnapshot;

const createCandidate = (
  snapshot: AiStudioSessionSnapshot | null
): AiStudioSessionRestoreCandidateState => ({
  status: "ready",
  snapshot,
  source: "local",
});

const createHydrationPayload = (): AiStudioSessionHydrationPayload => ({
  workspace: {
    mode: "text",
    selectedTool: "create",
    prompt: completedPulseWorkflowSession.lastArtifact ?? "",
    standardPrompt: "",
    pulsePrompt: completedPulseWorkflowSession.lastArtifact ?? "",
    model: null,
    aspect: "9:16",
    selectedCharacterId: null,
    selectedCharacterLookId: null,
    expertCreateMode: "pulse",
    activePulsePresetId: "story_builder",
    pulseSessionInstanceId: "pulse-session-1",
    referenceImageUrl: null,
    extraImageUrls: [null, null, null],
    editReferenceText: "",
    videoReferenceText: "",
    videoReferenceMode: "standard",
    videoDurationSeconds: 6,
    videoResolution: "1080p",
    imageResolution: "model_default",
    videoGenerateAudio: false,
    videoCameraFixed: false,
    videoAutoFix: false,
    klingNegativePrompt: "",
    klingCfgScale: 0.5,
    klingWorkflowMode: "single",
    seedance2InputMode: "text",
    seedance2ReferenceImageUrls: [],
    seedance2ReferenceVideoUrls: [],
    seedance2ReferenceAudioUrls: [],
    seedance2ReturnLastFrame: false,
    seedance2WebSearch: false,
    klingShotType: "customize",
    klingVoiceIds: ["", ""],
    klingMultiPrompts: [],
    klingElements: [],
    motionReferenceVideoUrl: null,
  },
  outputs: {
    active: [],
    archived: [],
    activeOutputId: null,
    curatedReferenceIds: [],
    removedFromAllRefsIds: [],
  },
  agent: {
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
  canvas: null,
  expertEdit: null,
});

describe("useAiStudioSessionRestoreHydration completed Pulse restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies completed Pulse workflow runtime through the session restore seam", async () => {
    const hydrateFromSessionSnapshot = vi.fn().mockReturnValue(createHydrationPayload());
    const hydrateFromSessionAgentSnapshot = vi.fn();

    renderHook(() =>
      useAiStudioSessionRestoreHydration({
        sessionId: "sid-1",
        sessionRestoreCandidate: createCandidate(createSnapshot()),
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot,
        applyEnabled: true,
        agentApplyEnabled: true,
      })
    );

    await waitFor(() => {
      expect(hydrateFromSessionSnapshot).toHaveBeenCalledTimes(1);
      expect(hydrateFromSessionAgentSnapshot).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace: expect.objectContaining({
            expertCreateMode: "pulse",
            activePulsePresetId: "story_builder",
            pulsePrompt: completedPulseWorkflowSession.lastArtifact,
          }),
          agent: expect.objectContaining({
            latestAgentPrompt: completedPulseWorkflowSession.lastArtifact,
            promptOrigin: "agent",
            pulseWorkflowSession: completedPulseWorkflowSession,
          }),
          agentRuntimes: expect.objectContaining({
            pulsePresetId: "story_builder",
            pulse: expect.objectContaining({
              latestAgentPrompt: completedPulseWorkflowSession.lastArtifact,
              promptOrigin: "agent",
              pulseWorkflowSession: completedPulseWorkflowSession,
            }),
          }),
        })
      );
    });

    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "ai_studio_session_hydration_applied",
        data: expect.objectContaining({
          session_id: "sid-1",
          agent_hydration_applied: true,
        }),
      })
    );
  });
});
