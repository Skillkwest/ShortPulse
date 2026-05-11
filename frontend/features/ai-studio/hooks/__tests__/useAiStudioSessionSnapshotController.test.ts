import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";
import type { StudioOutput } from "../../types";

const addBreadcrumbMock = vi.hoisted(() => vi.fn());
const buildAiStudioSessionHydrationPayloadMock = vi.hoisted(() => vi.fn());
const getSignedMediaUrlsBatchMock = vi.hoisted(() => vi.fn());

vi.mock("../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: (...args: unknown[]) => addBreadcrumbMock(...args),
}));

vi.mock("../../logic/sessionSnapshotHydrator", () => ({
  buildAiStudioSessionHydrationPayload: (...args: unknown[]) =>
    buildAiStudioSessionHydrationPayloadMock(...args),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrlsBatch: (...args: unknown[]) => getSignedMediaUrlsBatchMock(...args),
}));

import { useAiStudioSessionSnapshotController } from "../useAiStudioSessionSnapshotController";

const createOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-1",
  prompt: "Prompt",
  mode: "image",
  aspect: "1:1",
  model: "Model",
  status: "ready",
  timestamp: "now",
  ...overrides,
});

const createHydrationPayload = (active: StudioOutput[]): AiStudioSessionHydrationPayload => ({
  workspace: {
    mode: "image",
    selectedTool: "create",
    standardPrompt: "",
    pulsePrompt: "",
    model: null,
    aspect: "1:1",
    expertCreateMode: "standard",
    activePulsePresetId: null,
    pulseSessionInstanceId: null,
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
    active,
    archived: [],
    activeOutputId: active[0]?.id ?? null,
    curatedReferenceIds: [],
    removedFromAllRefsIds: [],
  },
  agent: {
    messages: [],
    input: "",
    latestAgentPrompt: null,
    promptOrigin: "manual",
    chatModeEnabled: true,
    pulseWorkflowSession: null,
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
});

describe("useAiStudioSessionSnapshotController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries restore signing once and patches restored outputs after recovery", async () => {
    let activeRows: StudioOutput[] = [];
    let archivedRows: StudioOutput[] = [];
    const restoredRows = [
      createOutput({
        id: "restored-1",
        previewStoragePath: "user-1/images/restored-1.png",
        fullStoragePath: "user-1/images/restored-1.png",
        previewUrl: undefined,
        resultUrls: ["https://provider.test/restored-1.png"],
      }),
    ];
    buildAiStudioSessionHydrationPayloadMock.mockReturnValue(createHydrationPayload(restoredRows));
    getSignedMediaUrlsBatchMock
      .mockRejectedValueOnce(new Error("temporary_sign_failure"))
      .mockResolvedValueOnce(
        new Map<string, string | null>([
          ["user-1/images/restored-1.png", "https://signed/restored-1.png"],
        ])
      );

    const setOutputsState = vi.fn((updater: (rows: StudioOutput[]) => StudioOutput[]) => {
      activeRows = updater(activeRows);
    });
    const setArchivedOutputs = vi.fn((updater: (rows: StudioOutput[]) => StudioOutput[]) => {
      archivedRows = updater(archivedRows);
    });
    const setOutputCollectionsForCreateMode = vi.fn(
      (
        _createMode: "standard" | "pulse",
        nextActive: StudioOutput[],
        nextArchived: StudioOutput[]
      ) => {
        activeRows = nextActive;
        archivedRows = nextArchived;
      }
    );

    const { result } = renderHook(() =>
      useAiStudioSessionSnapshotController({
        mode: "image",
        selectedTool: "create",
        standardCreatePrompt: "",
        pulseCreatePrompt: "",
        model: null,
        aspect: "1:1",
        pulseWorkspaceState: { expertCreateMode: "standard" } as never,
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
        outputs: [],
        archivedOutputs: [],
        activeOutputId: null,
        curatedReferenceIds: [],
        removedFromAllRefsIds: [],
        sessionHydrationSigningRevisionRef: { current: 0 },
        setMode: vi.fn(),
        setSelectedTool: vi.fn(),
        setStandardCreatePrompt: vi.fn(),
        setPulseCreatePrompt: vi.fn(),
        setModel: vi.fn(),
        setAspect: vi.fn(),
        setExpertCreateMode: vi.fn(),
        setActivePulsePresetId: vi.fn(),
        setPulseSessionInstanceId: vi.fn(),
        setReferenceImageUrl: vi.fn(),
        setExtraImageUrl: vi.fn(),
        setEditReferenceText: vi.fn(),
        setVideoReferenceText: vi.fn(),
        setVideoReferenceMode: vi.fn(),
        setVideoDurationSeconds: vi.fn(),
        setVideoResolution: vi.fn(),
        setImageResolution: vi.fn(),
        setVideoGenerateAudio: vi.fn(),
        setVideoCameraFixed: vi.fn(),
        setVideoAutoFix: vi.fn(),
        setKlingNegativePrompt: vi.fn(),
        setKlingCfgScale: vi.fn(),
        setKlingWorkflowMode: vi.fn(),
        setSeedance2InputMode: vi.fn(),
        setSeedance2ReferenceImageUrls: vi.fn(),
        setSeedance2ReferenceVideoUrls: vi.fn(),
        setSeedance2ReferenceAudioUrls: vi.fn(),
        setSeedance2ReturnLastFrame: vi.fn(),
        setSeedance2WebSearch: vi.fn(),
        setKlingShotType: vi.fn(),
        setKlingVoiceIds: vi.fn(),
        setKlingMultiPrompts: vi.fn(),
        setKlingElements: vi.fn(),
        setMotionReferenceVideoUrl: vi.fn(),
        setOutputCollectionsForCreateMode,
        setOutputsState,
        setArchivedOutputs,
        setRuntimeUiStateForCreateMode: vi.fn(),
      })
    );

    await act(async () => {
      result.current.hydrateFromSessionSnapshot({} as never);
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1500);
      await Promise.resolve();
    });

    expect(getSignedMediaUrlsBatchMock).toHaveBeenCalledTimes(2);
    expect(addBreadcrumbMock).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "ai_studio_session_restore_sign_batch_retry_scheduled",
      })
    );
    expect(activeRows[0]).toEqual(
      expect.objectContaining({
        previewUrl: "https://signed/restored-1.png",
        resultUrls: ["https://signed/restored-1.png", "https://provider.test/restored-1.png"],
      })
    );
    expect(archivedRows).toEqual([]);
  });
});
