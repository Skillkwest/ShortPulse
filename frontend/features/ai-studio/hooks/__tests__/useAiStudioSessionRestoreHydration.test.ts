import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStudioSessionRestoreHydration } from "../useAiStudioSessionRestoreHydration";
import type { AiStudioSessionRestoreCandidateState } from "../useAiStudioSessionRestoreCandidate";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";
import type { AiStudioSessionSnapshotV1 } from "../../logic/sessionSnapshot";

const addBreadcrumbMock = vi.fn();

vi.mock("../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: (...args: unknown[]) => addBreadcrumbMock(...args),
}));

const createSnapshot = (updatedAt: string): AiStudioSessionSnapshotV1 => ({
  schemaVersion: 1,
  sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
  updatedAt,
  workspace: {
    mode: "text",
    selectedTool: "create",
    prompt: "prompt",
    model: null,
    aspect: "9:16",
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
    messages: [],
    input: "",
    latestAgentPrompt: null,
    promptOrigin: "manual",
    chatModeEnabled: true,
  },
});

const createCandidate = (
  snapshot: AiStudioSessionSnapshotV1 | null
): AiStudioSessionRestoreCandidateState => ({
  status: "ready",
  snapshot,
  source: "local",
});

const createHydrationPayload = (): AiStudioSessionHydrationPayload => ({
  workspace: {
    mode: "text",
    selectedTool: "create",
    prompt: "",
    model: null,
    aspect: "9:16",
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
    messages: [{ id: "agent-assistant-restored-0", role: "assistant", content: "hi" }],
    input: "draft",
    latestAgentPrompt: "prompt",
    promptOrigin: "agent",
    chatModeEnabled: true,
  },
  canvas: null,
});

describe("useAiStudioSessionRestoreHydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("logs restore-candidate breadcrumb once per unique candidate key", async () => {
    const hydrateFromSessionSnapshot = vi.fn().mockReturnValue(createHydrationPayload());
    const hydrateFromSessionAgentSnapshot = vi.fn();
    const snapshot = createSnapshot("2026-03-02T01:00:00.000Z");

    const { rerender } = renderHook(
      ({ candidate }) =>
        useAiStudioSessionRestoreHydration({
          sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
          sessionRestoreCandidate: candidate,
          hydrateFromSessionSnapshot,
          hydrateFromSessionAgentSnapshot,
          applyEnabled: false,
        }),
      {
        initialProps: { candidate: createCandidate(snapshot) },
      }
    );

    await waitFor(() => {
      expect(addBreadcrumbMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "ai_studio_session_restore_candidate_loaded",
        })
      );
    });

    rerender({ candidate: createCandidate(snapshot) });
    expect(addBreadcrumbMock).toHaveBeenCalledTimes(1);
    expect(hydrateFromSessionSnapshot).not.toHaveBeenCalled();
  });

  it("applies hydration once per sid when apply gate is enabled", async () => {
    const hydrateFromSessionSnapshot = vi.fn().mockReturnValue(createHydrationPayload());
    const hydrateFromSessionAgentSnapshot = vi.fn();
    const hydrateFromSessionCanvasSnapshot = vi.fn();

    const { rerender } = renderHook(
      ({ sessionId, candidate }) =>
        useAiStudioSessionRestoreHydration({
          sessionId,
          sessionRestoreCandidate: candidate,
          hydrateFromSessionSnapshot,
          hydrateFromSessionAgentSnapshot,
          hydrateFromSessionCanvasSnapshot,
          applyEnabled: true,
          agentApplyEnabled: true,
        }),
      {
        initialProps: {
          sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
          candidate: createCandidate(createSnapshot("2026-03-02T02:00:00.000Z")),
        },
      }
    );

    await waitFor(() => {
      expect(hydrateFromSessionSnapshot).toHaveBeenCalledTimes(1);
      expect(hydrateFromSessionAgentSnapshot).toHaveBeenCalledTimes(1);
      expect(hydrateFromSessionCanvasSnapshot).toHaveBeenCalledTimes(1);
      expect(addBreadcrumbMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "ai_studio_session_hydration_applied",
          data: expect.objectContaining({
            agent_hydration_applied: true,
            canvas_hydration_applied: true,
          }),
        })
      );
    });

    rerender({
      sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      candidate: createCandidate(createSnapshot("2026-03-02T02:00:00.000Z")),
    });
    expect(hydrateFromSessionSnapshot).toHaveBeenCalledTimes(1);

    rerender({
      sessionId: "0f95df49-1fe8-4bc4-9971-5c6ebf0c8c35",
      candidate: createCandidate(createSnapshot("2026-03-02T03:00:00.000Z")),
    });

    await waitFor(() => {
      expect(hydrateFromSessionSnapshot).toHaveBeenCalledTimes(2);
      expect(hydrateFromSessionAgentSnapshot).toHaveBeenCalledTimes(2);
      expect(hydrateFromSessionCanvasSnapshot).toHaveBeenCalledTimes(2);
    });
  });

  it("skips agent hydration when agent apply gate is disabled", async () => {
    const hydrateFromSessionSnapshot = vi.fn().mockReturnValue(createHydrationPayload());
    const hydrateFromSessionAgentSnapshot = vi.fn();

    renderHook(() =>
      useAiStudioSessionRestoreHydration({
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        sessionRestoreCandidate: createCandidate(createSnapshot("2026-03-02T04:00:00.000Z")),
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot,
        applyEnabled: true,
        agentApplyEnabled: false,
      })
    );

    await waitFor(() => {
      expect(hydrateFromSessionSnapshot).toHaveBeenCalledTimes(1);
    });
    expect(hydrateFromSessionAgentSnapshot).not.toHaveBeenCalled();
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "ai_studio_session_hydration_applied",
        data: expect.objectContaining({ agent_hydration_applied: false }),
      })
    );
  });

  it("skips apply when sid is marked for manual hydration", async () => {
    const hydrateFromSessionSnapshot = vi.fn().mockReturnValue(createHydrationPayload());
    const hydrateFromSessionAgentSnapshot = vi.fn();

    renderHook(() =>
      useAiStudioSessionRestoreHydration({
        sessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
        sessionRestoreCandidate: createCandidate(createSnapshot("2026-03-02T05:00:00.000Z")),
        hydrateFromSessionSnapshot,
        hydrateFromSessionAgentSnapshot,
        applyEnabled: true,
        skipApplyForSessionId: "f7f45245-f204-4ece-8f9e-c9a66a9d8d2a",
      })
    );

    await waitFor(() => {
      expect(addBreadcrumbMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "ai_studio_session_restore_candidate_loaded",
        })
      );
    });
    expect(hydrateFromSessionSnapshot).not.toHaveBeenCalled();
    expect(hydrateFromSessionAgentSnapshot).not.toHaveBeenCalled();
  });
});
