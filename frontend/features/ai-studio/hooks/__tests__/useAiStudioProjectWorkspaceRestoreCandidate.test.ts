import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStudioProjectWorkspaceRestoreCandidate } from "../useAiStudioProjectWorkspaceRestoreCandidate";

const getProjectWorkspaceSnapshotMock = vi.fn();

vi.mock("../../logic/projectWorkspaceApiClient", () => ({
  getAiStudioProjectWorkspaceSnapshotViaApi: (...args: unknown[]) =>
    getProjectWorkspaceSnapshotMock(...args),
}));

describe("useAiStudioProjectWorkspaceRestoreCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stays idle when disabled", () => {
    const { result } = renderHook(() =>
      useAiStudioProjectWorkspaceRestoreCandidate({
        projectId: "project-1",
        enabled: false,
      })
    );

    expect(result.current.status).toBe("idle");
    expect(getProjectWorkspaceSnapshotMock).not.toHaveBeenCalled();
  });

  it("sanitizes legacy conversational runtime from loaded project snapshots", async () => {
    getProjectWorkspaceSnapshotMock.mockResolvedValue({
      snapshot: {
        schemaVersion: 2,
        sessionId: "session-1",
        updatedAt: "2026-04-25T18:00:00.000Z",
        meta: {
          generatedAt: "2026-04-25T18:00:00.000Z",
          checksum: "fnv1a32:legacy",
        },
        workspace: {
          mode: "image",
          selectedTool: "create",
          prompt: "A dramatic portrait",
          model: "model-1",
          aspect: "9:16",
          expertCreateMode: "pulse",
          activePulsePresetId: "single_shot",
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
          messages: [{ id: "msg-1", role: "assistant", content: "Old chat" }],
          input: "draft",
          latestAgentPrompt: "Old chat",
          promptOrigin: "agent",
          chatModeEnabled: false,
          pulseWorkflowSession: {
            presetId: "single_shot",
            status: "awaiting_input",
            currentStepIndex: 1,
            currentStepLabel: "Action",
            currentStepPrompt: "What happens next?",
            collectedInputs: ["Close-up"],
            lastArtifact: null,
            finalArtifactSource: null,
          },
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
          pulsePresetId: "single_shot",
          pulse: {
            messages: [{ id: "msg-1", role: "assistant", content: "Old chat" }],
            input: "draft",
            latestAgentPrompt: "Old chat",
            promptOrigin: "agent",
            chatModeEnabled: false,
            pulseWorkflowSession: {
              presetId: "single_shot",
              status: "awaiting_input",
              currentStepIndex: 1,
              currentStepLabel: "Action",
              currentStepPrompt: "What happens next?",
              collectedInputs: ["Close-up"],
              lastArtifact: null,
              finalArtifactSource: null,
            },
          },
        },
      },
    });

    const { result } = renderHook(() =>
      useAiStudioProjectWorkspaceRestoreCandidate({
        projectId: "project-1",
        enabled: true,
      })
    );

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    expect(result.current.result).toBe("found_snapshot");
    expect(result.current.source).toBe("project");
    expect(result.current.snapshot?.workspace.expertCreateMode).toBe("standard");
    expect(result.current.snapshot?.workspace.activePulsePresetId).toBeNull();
    expect(result.current.snapshot?.workspace.pulseSessionInstanceId).toBeNull();
    expect(result.current.snapshot?.agent).toEqual({
      messages: [],
      input: "",
      latestAgentPrompt: null,
      promptOrigin: "manual",
      chatModeEnabled: true,
      pulseWorkflowSession: null,
    });
    expect(result.current.snapshot).not.toBeNull();
    if (result.current.snapshot) {
      expect("agentRuntimes" in result.current.snapshot).toBe(false);
    }
    expect(getProjectWorkspaceSnapshotMock).toHaveBeenCalledWith({
      projectId: "project-1",
    });
  });
});
