import { act, renderHook } from "@testing-library/react";
import type { Dispatch, SetStateAction } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiStudioSessionHydrationPayload } from "../../logic/sessionSnapshotHydrator";
import type { StudioOutput } from "../../types";

const addBreadcrumbMock = vi.hoisted(() => vi.fn());
const buildAiStudioSessionHydrationPayloadMock = vi.hoisted(() => vi.fn());
const getSignedMediaUrlsBatchMock = vi.hoisted(() => vi.fn());
const prepareVideoUrlMock = vi.hoisted(() => vi.fn());

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

vi.mock("../../utils/videoUpload", () => ({
  prepareVideoUrl: (...args: unknown[]) => prepareVideoUrlMock(...args),
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
    createModeReferenceStates: {
      standard: {
        selectedTool: "create",
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        referenceImageInternalMediaRefs: [],
        motionReferenceVideoUrl: null,
      },
      pulse: {
        selectedTool: "create",
        referenceImageUrl: null,
        extraImageUrls: [null, null, null],
        referenceImageInternalMediaRefs: [],
        motionReferenceVideoUrl: null,
      },
    },
    referenceImageUrl: null,
    extraImageUrls: [null, null, null],
    referenceImageInternalMediaRefs: [],
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
  pulseChats: {
    schemaVersion: 1,
    activeThreadId: null,
    threads: [],
  },
  canvas: null,
  expertEdit: null,
});

describe("useAiStudioSessionSnapshotController", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    prepareVideoUrlMock.mockImplementation(async (value: string | null) => value);
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
        getReferenceSelectionStateForCreateMode: vi.fn(() => ({
          selectedTool: "create" as const,
          referenceImageUrl: null,
          extraImageUrls: [null, null, null] as [string | null, string | null, string | null],
          referenceImageInternalMediaRefs: [],
          motionReferenceVideoUrl: null,
        })),
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
        createModeReferenceStates: {
          ...payload.workspace.createModeReferenceStates,
          pulse: {
            selectedTool: "edit",
            referenceImageUrl: "https://example.com/edit-ref.png",
            extraImageUrls: ["https://example.com/edit-extra.png", null, null],
            referenceImageInternalMediaRefs: [],
            motionReferenceVideoUrl: null,
          },
        },
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
        getReferenceSelectionStateForCreateMode: vi.fn(() => ({
          selectedTool: "create" as const,
          referenceImageUrl: null,
          extraImageUrls: [null, null, null] as [string | null, string | null, string | null],
          referenceImageInternalMediaRefs: [],
          motionReferenceVideoUrl: null,
        })),
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
      referenceImageInternalMediaRefs: [],
      motionReferenceVideoUrl: null,
    });
    expect(setReferenceSelectionStateForCreateMode.mock.invocationCallOrder[0]).toBeLessThan(
      setExpertCreateMode.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
    expect(setSelectedTool).toHaveBeenCalledWith("edit");
  });

  it("refreshes restored motion reference video urls for workspace and create-mode state", async () => {
    const setReferenceSelectionStateForCreateMode = vi.fn();
    const setMotionReferenceVideoUrl = vi.fn();
    const payload = createHydrationPayload([]);
    const createModeReferenceStates = payload.workspace.createModeReferenceStates!;
    buildAiStudioSessionHydrationPayloadMock.mockReturnValue({
      ...payload,
      workspace: {
        ...payload.workspace,
        expertCreateMode: "standard",
        motionReferenceVideoUrl: "https://example.com/signed/workspace-motion.mp4?token=old",
        createModeReferenceStates: {
          standard: {
            ...createModeReferenceStates.standard,
            motionReferenceVideoUrl: "https://example.com/signed/standard-motion.mp4?token=old",
          },
          pulse: {
            ...createModeReferenceStates.pulse,
            motionReferenceVideoUrl: "https://example.com/signed/pulse-motion.mp4?token=old",
          },
        },
      },
    });
    getSignedMediaUrlsBatchMock.mockResolvedValue(new Map());
    prepareVideoUrlMock.mockImplementation(async (value: string | null) => {
      if (!value) return value;
      if (value.includes("workspace-motion")) {
        return "https://example.com/signed/workspace-motion.mp4?token=fresh";
      }
      if (value.includes("standard-motion")) {
        return "https://example.com/signed/standard-motion.mp4?token=fresh";
      }
      if (value.includes("pulse-motion")) {
        return "https://example.com/signed/pulse-motion.mp4?token=fresh";
      }
      return value;
    });

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
        setReferenceSelectionStateForCreateMode,
        getReferenceSelectionStateForCreateMode: vi.fn(() => ({
          selectedTool: "create" as const,
          referenceImageUrl: null,
          extraImageUrls: [null, null, null] as [string | null, string | null, string | null],
          referenceImageInternalMediaRefs: [],
          motionReferenceVideoUrl: null,
        })),
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
        setMotionReferenceVideoUrl,
        setOutputCollectionsForCreateMode: vi.fn(),
        setOutputsState: vi.fn(),
        setArchivedOutputs: vi.fn(),
        setRuntimeUiStateForCreateMode: vi.fn(),
      })
    );

    await act(async () => {
      result.current.hydrateFromSessionSnapshot({} as never);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(prepareVideoUrlMock).toHaveBeenCalledWith(
      "https://example.com/signed/workspace-motion.mp4?token=old"
    );
    expect(prepareVideoUrlMock).toHaveBeenCalledWith(
      "https://example.com/signed/standard-motion.mp4?token=old"
    );
    expect(prepareVideoUrlMock).toHaveBeenCalledWith(
      "https://example.com/signed/pulse-motion.mp4?token=old"
    );
    expect(setMotionReferenceVideoUrl).toHaveBeenLastCalledWith(
      "https://example.com/signed/workspace-motion.mp4?token=fresh"
    );
    expect(setReferenceSelectionStateForCreateMode).toHaveBeenCalledWith("standard", {
      selectedTool: "create",
      referenceImageUrl: null,
      extraImageUrls: [null, null, null],
      referenceImageInternalMediaRefs: [],
      motionReferenceVideoUrl: "https://example.com/signed/standard-motion.mp4?token=fresh",
    });
    expect(setReferenceSelectionStateForCreateMode).toHaveBeenCalledWith("pulse", {
      selectedTool: "create",
      referenceImageUrl: null,
      extraImageUrls: [null, null, null],
      referenceImageInternalMediaRefs: [],
      motionReferenceVideoUrl: "https://example.com/signed/pulse-motion.mp4?token=fresh",
    });
  });

  it("keeps the snapshot builder stable across project-nonpersistent draft edits while reading latest values", () => {
    const stableExtraImageUrls = [null, null, null] as [
      string | null,
      string | null,
      string | null,
    ];
    const stableVoiceIds = ["", ""] as [string, string];
    const stablePulseWorkspaceState = { expertCreateMode: "standard" } as never;
    const stableEmptyStringList: string[] = [];
    const stableEmptyOutputs: StudioOutput[] = [];
    const stableEmptyKlingMultiPrompts: Array<{ id: string; prompt: string; duration: number }> =
      [];
    const stableEmptyKlingElements: never[] = [];
    const stableSetMode = vi.fn();
    const stableSetSelectedTool = vi.fn();
    const stableSetStandardCreatePrompt = vi.fn();
    const stableSetPulseCreatePrompt = vi.fn();
    const stableSetModel = vi.fn();
    const stableSetAspect = vi.fn();
    const stableSetExpertCreateMode = vi.fn();
    const stableSetActivePulsePresetId = vi.fn();
    const stableSetPulseSessionInstanceId = vi.fn();
    const stableSetReferenceImageUrl = vi.fn();
    const stableSetReferenceSelectionStateForCreateMode = vi.fn();
    const stableSetExtraImageUrl = vi.fn();
    const stableSetEditReferenceText = vi.fn();
    const stableSetVideoReferenceText = vi.fn();
    const stableSetVideoReferenceMode = vi.fn();
    const stableSetVideoDurationSeconds = vi.fn();
    const stableSetVideoResolution = vi.fn();
    const stableSetImageResolution = vi.fn();
    const stableSetVideoGenerateAudio = vi.fn();
    const stableSetVideoCameraFixed = vi.fn();
    const stableSetVideoAutoFix = vi.fn();
    const stableSetKlingNegativePrompt = vi.fn();
    const stableSetKlingCfgScale = vi.fn();
    const stableSetKlingWorkflowMode = vi.fn();
    const stableSetSeedance2InputMode = vi.fn();
    const stableSetSeedance2ReferenceImageUrls = vi.fn();
    const stableSetSeedance2ReferenceVideoUrls = vi.fn();
    const stableSetSeedance2ReferenceAudioUrls = vi.fn();
    const stableSetSeedance2ReturnLastFrame = vi.fn();
    const stableSetSeedance2WebSearch = vi.fn();
    const stableSetKlingShotType = vi.fn();
    const stableSetKlingVoiceIds = vi.fn();
    const stableSetKlingMultiPrompts = vi.fn();
    const stableSetKlingElements = vi.fn();
    const stableSetMotionReferenceVideoUrl = vi.fn();
    const stableSetOutputCollectionsForCreateMode = vi.fn();
    const stableSetOutputsState = vi.fn();
    const stableSetArchivedOutputs = vi.fn();
    const stableSetRuntimeUiStateForCreateMode = vi.fn();
    const getReferenceSelectionStateForCreateMode = vi.fn(() => ({
      selectedTool: "create" as const,
      referenceImageUrl: null,
      extraImageUrls: stableExtraImageUrls,
      referenceImageInternalMediaRefs: [],
      motionReferenceVideoUrl: null,
    }));

    const { result, rerender } = renderHook(
      ({
        editReferenceText,
        videoReferenceText,
      }: {
        editReferenceText: string;
        videoReferenceText: string;
      }) =>
        useAiStudioSessionSnapshotController({
          mode: "image",
          selectedTool: "create",
          standardCreatePrompt: "A cinematic portrait",
          pulseCreatePrompt: "",
          model: "fal-ai/bytedance/seedream/v4.5/text-to-image",
          aspect: "1:1",
          pulseWorkspaceState: stablePulseWorkspaceState,
          referenceImageUrl: null,
          extraImageUrls: stableExtraImageUrls,
          editReferenceText,
          videoReferenceText,
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
          seedance2ReferenceImageUrls: stableEmptyStringList,
          seedance2ReferenceVideoUrls: stableEmptyStringList,
          seedance2ReferenceAudioUrls: stableEmptyStringList,
          seedance2ReturnLastFrame: false,
          seedance2WebSearch: false,
          klingShotType: "customize",
          klingVoiceIds: stableVoiceIds,
          klingMultiPrompts: stableEmptyKlingMultiPrompts,
          klingElements: stableEmptyKlingElements,
          motionReferenceVideoUrl: null,
          outputs: stableEmptyOutputs,
          archivedOutputs: stableEmptyOutputs,
          activeOutputId: null,
          curatedReferenceIds: stableEmptyStringList,
          removedFromAllRefsIds: stableEmptyStringList,
          sessionHydrationSigningRevisionRef: { current: 0 },
          setMode: stableSetMode,
          setSelectedTool: stableSetSelectedTool,
          setStandardCreatePrompt: stableSetStandardCreatePrompt,
          setPulseCreatePrompt: stableSetPulseCreatePrompt,
          setModel: stableSetModel,
          setAspect: stableSetAspect,
          setExpertCreateMode: stableSetExpertCreateMode,
          setActivePulsePresetId: stableSetActivePulsePresetId,
          setPulseSessionInstanceId: stableSetPulseSessionInstanceId,
          setReferenceImageUrl: stableSetReferenceImageUrl,
          setReferenceSelectionStateForCreateMode: stableSetReferenceSelectionStateForCreateMode,
          getReferenceSelectionStateForCreateMode,
          setExtraImageUrl: stableSetExtraImageUrl,
          setEditReferenceText: stableSetEditReferenceText,
          setVideoReferenceText: stableSetVideoReferenceText,
          setVideoReferenceMode: stableSetVideoReferenceMode,
          setVideoDurationSeconds: stableSetVideoDurationSeconds,
          setVideoResolution: stableSetVideoResolution,
          setImageResolution: stableSetImageResolution,
          setVideoGenerateAudio: stableSetVideoGenerateAudio,
          setVideoCameraFixed: stableSetVideoCameraFixed,
          setVideoAutoFix: stableSetVideoAutoFix,
          setKlingNegativePrompt: stableSetKlingNegativePrompt,
          setKlingCfgScale: stableSetKlingCfgScale,
          setKlingWorkflowMode: stableSetKlingWorkflowMode,
          setSeedance2InputMode: stableSetSeedance2InputMode,
          setSeedance2ReferenceImageUrls: stableSetSeedance2ReferenceImageUrls,
          setSeedance2ReferenceVideoUrls: stableSetSeedance2ReferenceVideoUrls,
          setSeedance2ReferenceAudioUrls: stableSetSeedance2ReferenceAudioUrls,
          setSeedance2ReturnLastFrame: stableSetSeedance2ReturnLastFrame,
          setSeedance2WebSearch: stableSetSeedance2WebSearch,
          setKlingShotType: stableSetKlingShotType,
          setKlingVoiceIds: stableSetKlingVoiceIds,
          setKlingMultiPrompts: stableSetKlingMultiPrompts,
          setKlingElements: stableSetKlingElements,
          setMotionReferenceVideoUrl: stableSetMotionReferenceVideoUrl,
          setOutputCollectionsForCreateMode: stableSetOutputCollectionsForCreateMode,
          setOutputsState: stableSetOutputsState,
          setArchivedOutputs: stableSetArchivedOutputs,
          setRuntimeUiStateForCreateMode: stableSetRuntimeUiStateForCreateMode,
        }),
      {
        initialProps: {
          editReferenceText: "Make the skyline teal.",
          videoReferenceText: "Arc around the subject.",
        },
      }
    );

    const initialBuilder = result.current.buildSessionSnapshot;

    rerender({
      editReferenceText: "Make the skyline teal with warm gold rim light.",
      videoReferenceText: "Arc around the subject with a slow push in.",
    });

    expect(result.current.buildSessionSnapshot).toBe(initialBuilder);

    const snapshot = result.current.buildSessionSnapshot({
      sessionId: "session-1",
      agentRuntime: {
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
        pulseSessionInstanceId: null,
        pulse: {
          messages: [],
          input: "",
          latestAgentPrompt: null,
          promptOrigin: "manual",
          chatModeEnabled: false,
          pulseWorkflowSession: null,
        },
      },
    });

    expect(snapshot.workspace.editReferenceText).toBe(
      "Make the skyline teal with warm gold rim light."
    );
    expect(snapshot.workspace.videoReferenceText).toBe(
      "Arc around the subject with a slow push in."
    );
  });
});
