import { act, renderHook } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
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

const asDispatch = <T>(fn: (value: SetStateAction<T>) => void): Dispatch<SetStateAction<T>> =>
  fn as Dispatch<SetStateAction<T>>;

const createHydrationPayload = (active: StudioOutput[]): AiStudioSessionHydrationPayload => ({
  workspace: {
    mode: "image",
    selectedTool: "create",
    prompt: "",
    standardPrompt: "",
    pulsePrompt: "",
    model: null,
    aspect: "1:1",
    selectedCharacterId: null,
    selectedCharacterLookId: null,
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
    pulseSessionInstanceId: null,
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

    const setOutputsState = asDispatch<StudioOutput[]>((value) => {
      activeRows = typeof value === "function" ? value(activeRows) : value;
    });
    const setArchivedOutputs = asDispatch<StudioOutput[]>((value) => {
      archivedRows = typeof value === "function" ? value(archivedRows) : value;
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
        setReferenceSelectionStateForCreateMode: vi.fn(),
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

  it("seeds the target create-mode selection state before restoring Pulse workspaces", async () => {
    const setReferenceSelectionStateForCreateMode = vi.fn();
    const payload = createHydrationPayload([]);
    buildAiStudioSessionHydrationPayloadMock.mockReturnValue({
      ...payload,
      workspace: {
        ...payload.workspace,
        expertCreateMode: "pulse",
        selectedTool: "edit",
        activePulsePresetId: "story_builder",
        pulseSessionInstanceId: "pulse-session-1",
        referenceImageUrl: "https://example.com/edit-ref.png",
        extraImageUrls: ["https://example.com/edit-extra.png", null, null],
      },
    });

    const setSelectedTool = vi.fn();
    const setExpertCreateMode = vi.fn();
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
        setSelectedTool,
        setStandardCreatePrompt: vi.fn(),
        setPulseCreatePrompt: vi.fn(),
        setModel: vi.fn(),
        setAspect: vi.fn(),
        setExpertCreateMode,
        setActivePulsePresetId: vi.fn(),
        setPulseSessionInstanceId: vi.fn(),
        setReferenceImageUrl: vi.fn(),
        setReferenceSelectionStateForCreateMode,
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
        setOutputCollectionsForCreateMode: vi.fn(),
        setOutputsState: vi.fn(),
        setArchivedOutputs: vi.fn(),
        setRuntimeUiStateForCreateMode: vi.fn(),
      })
    );

    await act(async () => {
      result.current.hydrateFromSessionSnapshot({} as never);
      await Promise.resolve();
    });

    expect(setReferenceSelectionStateForCreateMode).toHaveBeenCalledWith("pulse", {
      selectedTool: "edit",
      referenceImageUrl: "https://example.com/edit-ref.png",
      extraImageUrls: ["https://example.com/edit-extra.png", null, null],
      motionReferenceVideoUrl: null,
    });
    expect(setReferenceSelectionStateForCreateMode.mock.invocationCallOrder[0]).toBeLessThan(
      setExpertCreateMode.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(setSelectedTool).toHaveBeenCalledWith("edit");
  });
});
