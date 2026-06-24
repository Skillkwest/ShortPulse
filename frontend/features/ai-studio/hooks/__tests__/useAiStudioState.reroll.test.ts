/**
 * Verifies reroll replay behavior stays strict, decoupled, and submit-path scoped.
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import { buildWorkflowReloadConfigV1 } from "../../logic/workflowReload";
import { useAiStudioState } from "../useAiStudioState";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";

const submitTaskMock = vi.fn();
const findOutputByIdMock = vi.fn<(id: string) => StudioOutput | null>(() => null);

vi.mock("../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

vi.mock("../useAiStudioReferenceSelectionState", () => ({
  useAiStudioReferenceSelectionState: () => ({
    selectedTool: "create",
    setSelectedTool: vi.fn(),
    showCreateTools: true,
    setShowCreateTools: vi.fn(),
    videoReferenceImageUrl: null,
    motionReferenceVideoUrl: null,
    setMotionReferenceVideoUrl: vi.fn(),
    useReferenceImageIndicator: false,
    setUseReferenceImageIndicator: vi.fn(),
    detailOutputId: null,
    setDetailOutputId: vi.fn(),
    referenceImageUrl: null,
    setReferenceImageUrl: vi.fn(),
    extraImageUrls: [null, null, null] as [string | null, string | null, string | null],
    setExtraImageUrl: vi.fn(),
    clearReferenceImages: vi.fn(),
    toggleReferenceIndicator: vi.fn(),
    resolveReferenceInputsForTool: vi.fn(() => ({
      referenceImageUrl: null,
      extraImageUrls: [null, null, null] as [string | null, string | null, string | null],
    })),
    isModelModalOpen: false,
    modelModalAnchor: null,
    modelModalContext: null,
    setIsModelModalOpen: vi.fn(),
    setModelModalAnchor: vi.fn(),
    openModelModal: vi.fn(),
    closeModelModal: vi.fn(),
  }),
}));

vi.mock("../useAiStudioWorkflowSettings", () => ({
  useAiStudioWorkflowSettings: () => ({
    hasPendingWorkflowRestore: false,
  }),
}));

vi.mock("../useAiStudioStateEffects", () => ({
  useAiStudioStateEffects: () => undefined,
}));

vi.mock("../useAiStudioOutputLifecycle", () => ({
  useAiStudioOutputLifecycle: () => ({
    updateOutputById: vi.fn(),
    findOutputById: findOutputByIdMock,
    deleteOutput: vi.fn(),
    notifyGenerationFailure: vi.fn(),
    updateOutputPrompt: vi.fn(),
  }),
}));

vi.mock("../useAiStudioPersistenceActions", () => ({
  useAiStudioPersistenceActions: () => ({
    markOutputSaved: vi.fn(),
    markOutputSaveFailed: vi.fn(),
    ensureGenerationRecord: vi.fn(async () => null),
    persistMediaUrls: vi.fn(async () => ({ mediaFileIds: [], errors: [], delivery: null })),
    saveActiveOutput: vi.fn(),
    saveReferenceToLibrary: vi.fn(),
    savePromptToLibrary: vi.fn(),
  }),
}));

vi.mock("../useAiStudioTaskOrchestration", () => ({
  useAiStudioTaskOrchestration: () => ({
    submitTask: submitTaskMock,
    onReferenceOutputMediaLoaded: vi.fn(),
    retryOutputStatus: vi.fn(),
  }),
}));

vi.mock("../useAiStudioGenerationPromptComposer", () => ({
  useAiStudioGenerationPromptComposer: () => ({
    generateOutput: vi.fn(),
    regenerateOutput: vi.fn(),
  }),
}));

const makeGeneratedImageOutput = (
  id: string,
  overrides: Partial<StudioOutput> = {}
): StudioOutput => ({
  id,
  prompt: `Prompt ${id}`,
  mode: "image",
  aspect: "1:1",
  model: "Seedream 4.5",
  status: "ready",
  timestamp: "Now",
  mediaSource: "generated",
  ...overrides,
});

describe("useAiStudioState rerollOutputFromReplay", () => {
  beforeEach(() => {
    submitTaskMock.mockReset();
    findOutputByIdMock.mockReset();
    vi.mocked(addBreadcrumb).mockReset();
  });

  it("submits reroll using replay overrides when replay is valid", () => {
    findOutputByIdMock.mockReturnValue(
      makeGeneratedImageOutput("out-reroll-valid", {
        generationReplay: {
          version: 1,
          mode: "image",
          submitTool: "edit",
          modelId: "fal-ai/bytedance/seedream/v4.5/edit",
          displayPrompt: "Visible prompt",
          submissionPrompt: "Submission prompt with hidden context",
          aspect: "9:16",
          imageResolution: "auto_4K",
          referenceInputs: ["https://cdn.test/prepared-ref.png"],
          capturedAt: "2026-02-26T00:00:00.000Z",
        },
      })
    );

    const { result } = renderHook(() => useAiStudioState());

    act(() => {
      result.current.rerollOutputFromReplay(" out-reroll-valid ");
    });

    expect(submitTaskMock).toHaveBeenCalledWith(
      "Submission prompt with hidden context",
      ["https://cdn.test/prepared-ref.png"],
      expect.objectContaining({
        modeOverride: "image",
        selectedToolOverride: "edit",
        displayPromptOverride: "Visible prompt",
        characterContextOverride: undefined,
        modelIdOverride: "fal-ai/bytedance/seedream/v4.5/edit",
        aspectOverride: "9:16",
        imageResolutionOverride: "auto_4K",
      })
    );
    expect(vi.mocked(addBreadcrumb)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "reroll_started",
      })
    );
  });

  it("shows notice and blocks submit when replay snapshot is missing", () => {
    findOutputByIdMock.mockReturnValue(
      makeGeneratedImageOutput("out-reroll-missing-replay", {
        generationReplay: undefined,
      })
    );

    const { result } = renderHook(() => useAiStudioState());

    act(() => {
      result.current.rerollOutputFromReplay("out-reroll-missing-replay");
    });

    expect(submitTaskMock).not.toHaveBeenCalled();
    expect(result.current.uiNotice).toBe(
      "Re-roll is unavailable because original generation settings are missing."
    );
    expect(vi.mocked(addBreadcrumb)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "reroll_blocked_missing_or_invalid_replay",
      })
    );
  });

  it("shows notice and blocks submit when replay references are local-only URLs", () => {
    findOutputByIdMock.mockReturnValue(
      makeGeneratedImageOutput("out-reroll-local-ref", {
        generationReplay: {
          version: 1,
          mode: "image",
          submitTool: "edit",
          modelId: "fal-ai/bytedance/seedream/v4.5/edit",
          displayPrompt: "Visible prompt",
          submissionPrompt: "Submission prompt",
          aspect: "9:16",
          imageResolution: "auto_4K",
          referenceInputs: ["blob:local-preview-reference"],
          capturedAt: "2026-02-26T00:00:00.000Z",
        },
      })
    );

    const { result } = renderHook(() => useAiStudioState());

    act(() => {
      result.current.rerollOutputFromReplay("out-reroll-local-ref");
    });

    expect(submitTaskMock).not.toHaveBeenCalled();
    expect(result.current.uiNotice).toBe(
      "Re-roll is unavailable because original reference media are no longer accessible."
    );
    expect(vi.mocked(addBreadcrumb)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "reroll_blocked_missing_or_invalid_replay",
        data: expect.objectContaining({
          reason: "local_reference",
        }),
      })
    );
  });

  it("replays canonical internal refs for reroll v2 payloads", () => {
    findOutputByIdMock.mockReturnValue(
      makeGeneratedImageOutput("out-reroll-v2", {
        generationReplay: {
          version: 2,
          mode: "image",
          submitTool: "edit",
          modelId: "fal-ai/nano-banana/edit",
          displayPrompt: "Visible prompt",
          submissionPrompt: "Submission prompt with durable refs",
          aspect: "1:1",
          imageResolution: "model_default",
          referenceInputs: [],
          internalMediaRefs: [
            {
              version: 1,
              kind: "storage_object",
              bucket: "media_library",
              storagePath: "user-1/library/ref-a.png",
            },
          ],
          capturedAt: "2026-02-26T00:00:00.000Z",
        },
      })
    );

    const { result } = renderHook(() => useAiStudioState());

    act(() => {
      result.current.rerollOutputFromReplay("out-reroll-v2");
    });

    expect(submitTaskMock).toHaveBeenCalledWith(
      "Submission prompt with durable refs",
      [],
      expect.objectContaining({
        internalMediaRefsOverride: [
          {
            version: 1,
            kind: "storage_object",
            bucket: "media_library",
            storagePath: "user-1/library/ref-a.png",
          },
        ],
      })
    );
  });

  it("submits video reroll using workflow reload metadata", () => {
    const workflowReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-23T00:00:00.000Z",
      originTool: "video",
      panelKind: "video",
      outputMode: "video",
      prompt: {
        display: "Visible video prompt",
        submission: "Submission video prompt with style",
      },
      model: { id: "kie-ai/kling-3.0" },
      payload: {
        kind: "video",
        aspect: "9:16",
        videoReferenceMode: "standard",
        durationSeconds: 8,
        resolution: "1080p",
        generateAudio: true,
        cameraFixed: false,
        autoFix: true,
        referenceInputs: ["https://cdn.test/first-frame.png"],
        internalMediaRefs: [],
        videoReferences: {
          version: 1,
          firstFrame: { sourceUrl: "https://cdn.test/first-frame.png" },
        },
        seedance2ReferenceImageUrls: [],
        seedance2ReferenceVideoUrls: [],
        seedance2ReferenceAudioUrls: [],
        seedance2ReturnLastFrame: false,
        seedance2WebSearch: false,
        klingElements: [],
      },
    });

    findOutputByIdMock.mockReturnValue(
      makeGeneratedImageOutput("out-reroll-video", {
        mode: "video",
        modelId: "kie-ai/kling-3.0",
        previewUrl: "https://cdn.test/generated-video.mp4",
        workflowReload: workflowReload ?? undefined,
      })
    );

    const { result } = renderHook(() => useAiStudioState());

    act(() => {
      result.current.rerollOutputFromReplay("out-reroll-video");
    });

    expect(submitTaskMock).toHaveBeenCalledWith(
      "Submission video prompt with style",
      ["https://cdn.test/first-frame.png"],
      expect.objectContaining({
        modeOverride: "video",
        selectedToolOverride: "video",
        modelIdOverride: "kie-ai/kling-3.0",
        aspectOverride: "9:16",
        videoReferenceModeOverride: "standard",
        videoReferenceImageUrlOverride: "https://cdn.test/first-frame.png",
        videoDurationSecondsOverride: 8,
        videoResolutionOverride: "1080p",
        videoGenerateAudioOverride: true,
        videoCameraFixedOverride: false,
        videoAutoFixOverride: true,
      })
    );
  });
});
