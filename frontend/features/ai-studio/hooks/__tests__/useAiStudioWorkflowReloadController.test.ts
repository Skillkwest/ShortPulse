import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import type { AiStudioKlingElement } from "../../logic/klingElements";
import { resolveInternalMediaRefForUrl } from "../../logic/referenceInputInternalMediaRegistry";
import type {
  StudioOutput,
  ToolId,
  VideoReferenceMode,
  WorkflowReloadConfigV1,
  WorkflowReloadImagePayload,
} from "../../types";
import { useAiStudioWorkflowReloadController } from "../useAiStudioWorkflowReloadController";

const setSelectedVoiceMock = vi.fn();

vi.mock("../../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

vi.mock("../useSharedVoicesGrid", () => ({
  useSharedVoicesGrid: () => ({
    voices: [
      { id: "voice-1", name: "Voice One" },
      { id: "voice-2", name: "Voice Two" },
    ],
    setSelectedVoice: setSelectedVoiceMock,
  }),
}));

const makeSetter = <T>() => vi.fn<(value: T | ((current: T) => T)) => void>();

const makeParams = (output: StudioOutput | null) => ({
  beginManualWorkflowReload: vi.fn(),
  findOutputById: vi.fn(() => output),
  prepareCreateCharacterWorkflowReload: vi.fn(),
  prepareImageStyleWorkflowReload: vi.fn(),
  prepareStandardCreateWorkflowReload: vi.fn(),
  setAspect: makeSetter<string>(),
  setEditReferenceText: vi.fn(),
  setExpertCreateMode: makeSetter<"standard" | "pulse">(),
  setImageResolution: makeSetter<string>(),
  setKlingCfgScale: makeSetter<number>(),
  setKlingElements: makeSetter<AiStudioKlingElement[]>(),
  setKlingMultiPrompts: makeSetter<{ id: string; prompt: string; duration: number }[]>(),
  setKlingNegativePrompt: makeSetter<string>(),
  setKlingShotType: makeSetter<"customize" | "intelligent">(),
  setKlingVoiceIds: makeSetter<[string, string]>(),
  setKlingWorkflowMode: makeSetter<"single" | "multi" | "custom">(),
  setModel: vi.fn(),
  setMotionReferenceVideoUrl: makeSetter<string | null>(),
  setMusicComposerMode: makeSetter<"simple" | "custom">(),
  setMusicDurationSeconds: makeSetter<number | null>(),
  setMusicInstrumentalEnabled: makeSetter<boolean>(),
  setMusicLyricsDraft: vi.fn(),
  setMusicPromptDraft: vi.fn(),
  setMusicSingerEnabled: makeSetter<boolean>(),
  setMusicSongBatchCount: makeSetter<1 | 2 | 3 | 4>(),
  setReferenceSelectionState: vi.fn(),
  setSeedance2InputMode: makeSetter<"text" | "first-frame" | "first-last" | "multimodal">(),
  setSeedance2ReferenceAudioUrls: makeSetter<string[]>(),
  setSeedance2ReferenceImageUrls: makeSetter<string[]>(),
  setSeedance2ReferenceVideoUrls: makeSetter<string[]>(),
  setSeedance2ReturnLastFrame: makeSetter<boolean>(),
  setSeedance2WebSearch: makeSetter<boolean>(),
  setSelectedTool: makeSetter<ToolId | null>(),
  setShowCreateTools: makeSetter<boolean>(),
  setSoundEffectsDurationSeconds: makeSetter<number | null>(),
  setSoundEffectsLoopEnabled: makeSetter<boolean>(),
  setSoundEffectsPromptDraft: vi.fn(),
  setStandardCreatePrompt: vi.fn(),
  setUiNotice: makeSetter<string | null>(),
  setVideoAutoFix: makeSetter<boolean>(),
  setVideoCameraFixed: makeSetter<boolean>(),
  setVideoDurationSeconds: makeSetter<number>(),
  setVideoGenerateAudio: makeSetter<boolean>(),
  setVideoReferenceMode: makeSetter<VideoReferenceMode>(),
  setVideoReferenceText: vi.fn(),
  setVideoResolution: makeSetter<string>(),
  setVoiceChangerSource: vi.fn(),
  setVoiceScriptDraft: vi.fn(),
  setVoiceSelectedVoiceId: makeSetter<string | null>(),
});

const makeOutput = (workflowReload?: WorkflowReloadConfigV1): StudioOutput => ({
  id: "out-1",
  prompt: "Original prompt",
  mode: workflowReload?.outputMode ?? "image",
  aspect: "1:1",
  model: "Model",
  status: "ready",
  timestamp: "Now",
  mediaSource: "generated",
  workflowReload,
});

const makeImageReload = (): WorkflowReloadConfigV1 => ({
  version: 1,
  source: "ai_studio_generation",
  capturedAt: "2026-06-06T12:00:00.000Z",
  originTool: "create",
  panelKind: "create",
  outputMode: "image",
  restoreBehavior: "navigate_and_hydrate",
  createMode: "standard",
  pulse: null,
  prompt: { display: "A luminous harbor", submission: "A luminous harbor, painterly" },
  model: { id: "fal-ai/bytedance/seedream/v4.5/text-to-image" },
  payload: {
    kind: "image",
    submitTool: "create",
    aspect: "9:16",
    imageResolution: "2K",
    referenceInputs: ["https://example.com/ref-a.png", "https://example.com/ref-b.png"],
    internalMediaRefs: [
      {
        version: 1,
        kind: "storage_object",
        bucket: "media_library",
        storagePath: "user/ref-a.png",
      },
      null,
    ],
    characterContext: {
      applied: true,
      characterId: "char-1",
      characterName: "Rozalin Belaroa",
      lookId: "main",
      lookName: "Main",
      characterProfileImageUrl: "https://example.com/rozalin.png",
    },
    styleContext: {
      applied: true,
      styleId: "style-cinematic",
      styleName: "Cinematic",
      stylePrompt: "cinematic contrast and rich shadows",
      stylePreviewImageUrl: "https://example.com/style.png",
    },
  },
});

describe("useAiStudioWorkflowReloadController", () => {
  beforeEach(() => {
    setSelectedVoiceMock.mockReset();
    vi.mocked(addBreadcrumb).mockReset();
  });

  it("hydrates create image workflow state without submitting", () => {
    const workflowReload = makeImageReload();
    const params = makeParams(makeOutput(workflowReload));
    const { result } = renderHook(() => useAiStudioWorkflowReloadController(params));

    let status;
    act(() => {
      status = result.current.reloadWorkflowFromOutput(" out-1 ");
    });

    expect(status).toEqual({ status: "success", outputId: "out-1", targetTool: "create" });
    expect(params.beginManualWorkflowReload).toHaveBeenCalledTimes(1);
    expect(params.setSelectedTool).toHaveBeenCalledWith("create");
    expect(params.prepareStandardCreateWorkflowReload).toHaveBeenCalledWith("A luminous harbor");
    expect(params.prepareCreateCharacterWorkflowReload).toHaveBeenCalledWith(
      expect.objectContaining({
        applied: true,
        characterId: "char-1",
        lookId: "main",
      })
    );
    expect(params.prepareImageStyleWorkflowReload).toHaveBeenCalledWith(
      expect.objectContaining({
        applied: true,
        styleId: "style-cinematic",
        stylePrompt: "cinematic contrast and rich shadows",
      })
    );
    expect(params.setStandardCreatePrompt).toHaveBeenCalledWith("A luminous harbor");
    expect(params.prepareStandardCreateWorkflowReload.mock.invocationCallOrder[0]).toBeLessThan(
      params.setStandardCreatePrompt.mock.invocationCallOrder[0]
    );
    expect(params.setModel).toHaveBeenCalledWith("fal-ai/bytedance/seedream/v4.5/text-to-image");
    expect(params.setAspect).toHaveBeenCalledWith("9:16");
    expect(params.setImageResolution).toHaveBeenCalledWith("2K");
    expect(params.setUiNotice).not.toHaveBeenCalled();
    const selectionState = params.setReferenceSelectionState.mock.calls[0]?.[0];
    expect(selectionState).toEqual(
      expect.objectContaining({
        selectedTool: "create",
        referenceImageUrl: "https://example.com/ref-a.png",
        referenceImageInternalMediaRefs: (workflowReload.payload as WorkflowReloadImagePayload)
          .internalMediaRefs,
      })
    );
    expect(selectionState?.extraImageUrls).toHaveLength(10);
    expect(selectionState?.extraImageUrls.slice(0, 3)).toEqual([
      "https://example.com/ref-b.png",
      null,
      null,
    ]);
  });

  it("hydrates Expert Edit secondary references back into their original token slots", () => {
    const workflowReload = makeImageReload();
    workflowReload.originTool = "edit";
    workflowReload.panelKind = "edit";
    workflowReload.prompt = {
      display: "Use @img10 as the wardrobe reference.",
      submission: "Use Figure 3 as the wardrobe reference.",
    };
    workflowReload.payload = {
      kind: "image",
      submitTool: "edit",
      aspect: "9:16",
      imageResolution: "2K",
      referenceInputs: [
        "https://example.com/primary.png",
        "https://example.com/markup-composite.png",
        "https://example.com/ref-10.png",
      ],
      internalMediaRefs: [
        {
          version: 1,
          kind: "storage_object",
          bucket: "media_library",
          storagePath: "user/primary.png",
        },
        null,
        {
          version: 1,
          kind: "storage_object",
          bucket: "media_library",
          storagePath: "user/ref-10.png",
        },
      ],
      expertEditReferences: {
        version: 1,
        maxSecondarySlotCount: 10,
        primaryReferenceInputIndex: 0,
        secondarySlots: [{ slotIndex: 9, referenceInputIndex: 2 }],
      },
    };
    const params = makeParams(makeOutput(workflowReload));
    const { result } = renderHook(() => useAiStudioWorkflowReloadController(params));

    act(() => {
      result.current.reloadWorkflowFromOutput("out-1");
    });

    const selectionState = params.setReferenceSelectionState.mock.calls[0]?.[0];
    expect(params.setSelectedTool).toHaveBeenCalledWith("edit");
    expect(params.setEditReferenceText).toHaveBeenCalledWith(
      "Use @img10 as the wardrobe reference."
    );
    expect(selectionState).toEqual(
      expect.objectContaining({
        selectedTool: "edit",
        referenceImageUrl: "https://example.com/primary.png",
      })
    );
    expect(selectionState?.extraImageUrls).toHaveLength(10);
    expect(selectionState?.extraImageUrls.slice(0, 9)).toEqual(
      Array.from({ length: 9 }, () => null)
    );
    expect(selectionState?.extraImageUrls[9]).toBe("https://example.com/ref-10.png");
    expect(selectionState?.referenceImageInternalMediaRefs?.[10]).toEqual(
      expect.objectContaining({
        storagePath: "user/ref-10.png",
      })
    );
  });

  it("hydrates Expert Edit restore-only secondary slots when they were not provider inputs", () => {
    const workflowReload = makeImageReload();
    workflowReload.originTool = "edit";
    workflowReload.panelKind = "edit";
    workflowReload.prompt = {
      display: "Make this a side profile shot.",
      submission: "Make this a side profile shot.",
    };
    workflowReload.payload = {
      kind: "image",
      submitTool: "edit",
      aspect: "16:9",
      imageResolution: "1K",
      referenceInputs: ["https://example.com/primary.png"],
      internalMediaRefs: [
        {
          version: 1,
          kind: "storage_object",
          bucket: "media_library",
          storagePath: "user/primary.png",
        },
      ],
      expertEditReferences: {
        version: 1,
        maxSecondarySlotCount: 10,
        primaryReferenceInputIndex: 0,
        secondarySlots: [],
        restoreSecondarySlots: [
          { slotIndex: 0, sourceUrl: "https://example.com/secondary-1.png" },
          { slotIndex: 1, sourceUrl: "https://example.com/secondary-2.png" },
        ],
      },
    };
    const params = makeParams(makeOutput(workflowReload));
    const { result } = renderHook(() => useAiStudioWorkflowReloadController(params));

    act(() => {
      result.current.reloadWorkflowFromOutput("out-1");
    });

    const selectionState = params.setReferenceSelectionState.mock.calls[0]?.[0];
    expect(selectionState).toEqual(
      expect.objectContaining({
        selectedTool: "edit",
        referenceImageUrl: "https://example.com/primary.png",
      })
    );
    expect(selectionState?.extraImageUrls).toHaveLength(10);
    expect(selectionState?.extraImageUrls.slice(0, 3)).toEqual([
      "https://example.com/secondary-1.png",
      "https://example.com/secondary-2.png",
      null,
    ]);
  });

  it("falls back to output character context for restored generated rows", () => {
    const workflowReload = makeImageReload();
    delete (workflowReload.payload as WorkflowReloadImagePayload).characterContext;
    const output = makeOutput(workflowReload);
    output.characterContext = {
      applied: true,
      characterId: "char-output",
      characterName: "Output Character",
      lookId: "look-output",
      lookName: "Output Look",
    };
    const params = makeParams(output);
    const { result } = renderHook(() => useAiStudioWorkflowReloadController(params));

    act(() => {
      result.current.reloadWorkflowFromOutput("out-1");
    });

    expect(params.prepareCreateCharacterWorkflowReload).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: "char-output",
        lookId: "look-output",
      })
    );
  });

  it("falls back to output style context for restored generated rows", () => {
    const workflowReload = makeImageReload();
    delete (workflowReload.payload as WorkflowReloadImagePayload).styleContext;
    const output = makeOutput(workflowReload);
    output.styleContext = {
      applied: true,
      styleId: "style-output",
      styleName: "Output Style",
      stylePrompt: "archival fashion editorial grain",
    };
    const params = makeParams(output);
    const { result } = renderHook(() => useAiStudioWorkflowReloadController(params));

    act(() => {
      result.current.reloadWorkflowFromOutput("out-1");
    });

    expect(params.prepareImageStyleWorkflowReload).toHaveBeenCalledWith(
      expect.objectContaining({
        styleId: "style-output",
        stylePrompt: "archival fashion editorial grain",
      })
    );
  });

  it("clears selected image style when the reloaded image used no style", () => {
    const workflowReload = makeImageReload();
    delete (workflowReload.payload as WorkflowReloadImagePayload).styleContext;
    const output = makeOutput(workflowReload);
    const params = makeParams(output);
    const { result } = renderHook(() => useAiStudioWorkflowReloadController(params));

    act(() => {
      result.current.reloadWorkflowFromOutput("out-1");
    });

    expect(params.prepareImageStyleWorkflowReload).toHaveBeenCalledWith(null);
  });

  it("does not prepare Standard chat mode for Pulse create image reloads", () => {
    const workflowReload = makeImageReload();
    workflowReload.createMode = "pulse";
    const params = makeParams(makeOutput(workflowReload));
    const { result } = renderHook(() => useAiStudioWorkflowReloadController(params));

    act(() => {
      result.current.reloadWorkflowFromOutput("out-1");
    });

    expect(params.setExpertCreateMode).toHaveBeenCalledWith("pulse");
    expect(params.prepareCreateCharacterWorkflowReload).not.toHaveBeenCalled();
    expect(params.prepareStandardCreateWorkflowReload).not.toHaveBeenCalled();
  });

  it("hydrates video workflow state and provider-specific controls", () => {
    const workflowReload: WorkflowReloadConfigV1 = {
      ...makeImageReload(),
      originTool: "kling",
      panelKind: "video",
      outputMode: "video",
      prompt: { display: "A sweeping crane shot" },
      model: { id: "kie-ai/kling-3.0" },
      payload: {
        kind: "video",
        aspect: "16:9",
        videoReferenceMode: "motion",
        durationSeconds: 8,
        resolution: "1080p",
        generateAudio: true,
        cameraFixed: true,
        autoFix: true,
        referenceInputs: ["https://example.com/frame.png"],
        motionReferenceVideoUrl: "https://example.com/motion.mp4",
        seedance2InputMode: "multimodal",
        seedance2ReferenceAudioUrls: ["https://example.com/ref.mp3"],
        seedance2ReferenceImageUrls: ["https://example.com/seed.png"],
        seedance2ReferenceVideoUrls: ["https://example.com/seed.mp4"],
        seedance2ReturnLastFrame: true,
        seedance2WebSearch: true,
        klingNegativePrompt: "blur",
        klingCfgScale: 0.8,
        klingWorkflowMode: "custom",
        klingShotType: "intelligent",
        klingVoiceIds: ["voice-1", "voice-2"],
        klingMultiPrompts: [{ id: "shot-1", prompt: "Shot", duration: 4 }],
        klingElements: [{ id: "el-1", frontalImageUrl: "" }],
      },
    };
    const params = makeParams(makeOutput(workflowReload));
    const { result } = renderHook(() => useAiStudioWorkflowReloadController(params));

    act(() => {
      result.current.reloadWorkflowFromOutput("out-1");
    });

    expect(params.setSelectedTool).toHaveBeenCalledWith("video");
    expect(params.setModel).toHaveBeenCalledWith("kie-ai/kling-3.0");
    expect(params.setVideoReferenceText).toHaveBeenCalledWith("A sweeping crane shot");
    expect(params.setAspect).toHaveBeenCalledWith("16:9");
    expect(params.setVideoReferenceMode).toHaveBeenCalledWith("motion");
    expect(params.setVideoDurationSeconds).toHaveBeenCalledWith(8);
    expect(params.setVideoResolution).toHaveBeenCalledWith("1080p");
    expect(params.setVideoGenerateAudio).toHaveBeenCalledWith(true);
    expect(params.setVideoCameraFixed).toHaveBeenCalledWith(true);
    expect(params.setVideoAutoFix).toHaveBeenCalledWith(true);
    expect(params.setReferenceSelectionState).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedTool: "video",
        referenceImageUrl: "https://example.com/frame.png",
        motionReferenceVideoUrl: "https://example.com/motion.mp4",
        useReferenceImageIndicator: true,
      })
    );
    expect(params.setMotionReferenceVideoUrl).toHaveBeenCalledWith(
      "https://example.com/motion.mp4"
    );
    expect(params.setSeedance2InputMode).toHaveBeenCalledWith("multimodal");
    expect(params.setSeedance2ReferenceAudioUrls).toHaveBeenCalledWith([
      "https://example.com/ref.mp3",
    ]);
    expect(params.setSeedance2ReferenceImageUrls).toHaveBeenCalledWith([
      "https://example.com/seed.png",
    ]);
    expect(params.setSeedance2ReferenceVideoUrls).toHaveBeenCalledWith([
      "https://example.com/seed.mp4",
    ]);
    expect(params.setSeedance2ReturnLastFrame).toHaveBeenCalledWith(true);
    expect(params.setSeedance2WebSearch).toHaveBeenCalledWith(true);
    expect(params.setKlingNegativePrompt).toHaveBeenCalledWith("blur");
    expect(params.setKlingCfgScale).toHaveBeenCalledWith(0.8);
    expect(params.setKlingWorkflowMode).toHaveBeenCalledWith("custom");
    expect(params.setKlingShotType).toHaveBeenCalledWith("intelligent");
    expect(params.setKlingVoiceIds).toHaveBeenCalledWith(["voice-1", "voice-2"]);
    expect(params.setKlingMultiPrompts).toHaveBeenCalledWith([
      { id: "shot-1", prompt: "Shot", duration: 4 },
    ]);
    expect(params.setKlingElements).toHaveBeenCalledWith([{ id: "el-1", frontalImageUrl: "" }]);
  });

  it("hydrates video workflow reference sidecar media and internal refs", () => {
    const firstFrameRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user/video/first-frame.png",
    };
    const lastFrameRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user/video/last-frame.png",
    };
    const seedImageRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user/video/seed-image.png",
    };
    const elementProfileRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user/video/element-profile.png",
    };
    const elementReferenceRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user/video/element-reference.png",
    };
    const workflowReload: WorkflowReloadConfigV1 = {
      ...makeImageReload(),
      originTool: "video",
      panelKind: "video",
      outputMode: "video",
      prompt: { display: "Restore the exact reference setup" },
      model: { id: "fal-ai/bytedance/seedance/v2/text-to-video" },
      payload: {
        kind: "video",
        aspect: "16:9",
        videoReferenceMode: "keyframes",
        durationSeconds: 5,
        resolution: "720p",
        generateAudio: false,
        cameraFixed: false,
        autoFix: false,
        referenceInputs: ["https://example.com/legacy-first.png"],
        internalMediaRefs: [],
        seedance2InputMode: "multimodal",
        seedance2ReferenceImageUrls: ["https://example.com/legacy-seed.png"],
        seedance2ReferenceVideoUrls: ["https://example.com/legacy-seed.mp4"],
        seedance2ReferenceAudioUrls: ["https://example.com/legacy-seed.mp3"],
        klingElements: [{ id: "legacy-element", frontalImageUrl: "" }],
        videoReferences: {
          version: 1,
          firstFrame: {
            sourceUrl: "https://example.com/video-first.png",
            internalMediaRef: firstFrameRef,
          },
          lastFrame: {
            sourceUrl: "https://example.com/video-last.png",
            internalMediaRef: lastFrameRef,
          },
          seedance2ReferenceImages: [
            {
              slotIndex: 0,
              sourceUrl: "https://example.com/seed-image.png",
              internalMediaRef: seedImageRef,
            },
          ],
          seedance2ReferenceVideos: [
            { slotIndex: 0, sourceUrl: "https://example.com/seed-video.mp4" },
          ],
          seedance2ReferenceAudio: [
            { slotIndex: 0, sourceUrl: "https://example.com/seed-audio.mp3" },
          ],
          klingElementSlots: [
            {
              slotIndex: 0,
              element: {
                id: "element-1",
                profileImageUrl: "https://example.com/element-profile.png",
                referenceImageUrls: "https://example.com/element-reference.png",
              },
              profileImageInternalMediaRef: elementProfileRef,
              referenceImageInternalMediaRefs: [elementReferenceRef],
            },
          ],
        },
      },
    };
    const params = makeParams(makeOutput(workflowReload));
    const { result } = renderHook(() => useAiStudioWorkflowReloadController(params));

    act(() => {
      result.current.reloadWorkflowFromOutput("out-1");
    });

    const selectionState = params.setReferenceSelectionState.mock.calls[0]?.[0];
    expect(selectionState).toEqual(
      expect.objectContaining({
        selectedTool: "video",
        referenceImageUrl: "https://example.com/video-first.png",
        motionReferenceVideoUrl: null,
        useReferenceImageIndicator: true,
      })
    );
    expect(selectionState?.extraImageUrls).toEqual([
      "https://example.com/video-last.png",
      null,
      null,
    ]);
    expect(selectionState?.referenceImageInternalMediaRefs).toEqual([
      firstFrameRef,
      lastFrameRef,
      null,
      null,
    ]);
    expect(params.setSeedance2ReferenceImageUrls).toHaveBeenCalledWith([
      "https://example.com/seed-image.png",
    ]);
    expect(params.setSeedance2ReferenceVideoUrls).toHaveBeenCalledWith([
      "https://example.com/seed-video.mp4",
    ]);
    expect(params.setSeedance2ReferenceAudioUrls).toHaveBeenCalledWith([
      "https://example.com/seed-audio.mp3",
    ]);
    expect(params.setKlingElements).toHaveBeenCalledWith([
      {
        id: "element-1",
        profileImageUrl: "https://example.com/element-profile.png",
        referenceImageUrls: "https://example.com/element-reference.png",
      },
    ]);
    expect(resolveInternalMediaRefForUrl("https://example.com/video-first.png")).toEqual(
      firstFrameRef
    );
    expect(resolveInternalMediaRefForUrl("https://example.com/seed-image.png")).toEqual(
      seedImageRef
    );
    expect(resolveInternalMediaRefForUrl("https://example.com/element-profile.png")).toEqual(
      elementProfileRef
    );
    expect(resolveInternalMediaRefForUrl("https://example.com/element-reference.png")).toEqual(
      elementReferenceRef
    );
  });

  it("hydrates audio workflow families", () => {
    const musicReload: WorkflowReloadConfigV1 = {
      ...makeImageReload(),
      originTool: "music",
      panelKind: "music",
      outputMode: "audio",
      prompt: { display: "Warm analog synth" },
      payload: {
        kind: "music",
        text: "Warm analog synth",
        lyrics: "golden morning",
        durationSeconds: 30,
        composerMode: "custom",
        instrumentalEnabled: true,
        singerEnabled: true,
        songBatchCount: 3,
      },
    };
    const soundReload: WorkflowReloadConfigV1 = {
      ...musicReload,
      originTool: "sound-effects",
      panelKind: "sound-effects",
      payload: {
        kind: "sound-effects",
        text: "Huge stone door opening",
        durationSeconds: 6,
        loop: true,
      },
    };
    const voiceReload: WorkflowReloadConfigV1 = {
      ...musicReload,
      originTool: "text-to-speech",
      panelKind: "voices",
      payload: {
        kind: "voiceover",
        script: "Welcome back.",
        voiceId: "voice-1",
        voiceName: "Voice One",
        outputFormat: "mp3_44100_128",
      },
    };

    let currentOutput = makeOutput(musicReload);
    const params = makeParams(currentOutput);
    params.findOutputById.mockImplementation(() => currentOutput);
    const { result, rerender } = renderHook(
      ({ revision }) => {
        void revision;
        return useAiStudioWorkflowReloadController(params);
      },
      { initialProps: { revision: 0 } }
    );

    act(() => result.current.reloadWorkflowFromOutput("out-1"));
    currentOutput = makeOutput(soundReload);
    rerender({ revision: 1 });
    act(() => result.current.reloadWorkflowFromOutput("out-1"));
    currentOutput = makeOutput(voiceReload);
    rerender({ revision: 2 });
    act(() => result.current.reloadWorkflowFromOutput("out-1"));

    expect(params.setMusicPromptDraft).toHaveBeenCalledWith("Warm analog synth");
    expect(params.setMusicLyricsDraft).toHaveBeenCalledWith("golden morning");
    expect(params.setMusicDurationSeconds).toHaveBeenCalledWith(30);
    expect(params.setMusicComposerMode).toHaveBeenCalledWith("custom");
    expect(params.setMusicInstrumentalEnabled).toHaveBeenCalledWith(true);
    expect(params.setMusicSingerEnabled).toHaveBeenCalledWith(true);
    expect(params.setMusicSongBatchCount).toHaveBeenCalledWith(3);
    expect(params.setSoundEffectsPromptDraft).toHaveBeenCalledWith("Huge stone door opening");
    expect(params.setSoundEffectsDurationSeconds).toHaveBeenCalledWith(6);
    expect(params.setSoundEffectsLoopEnabled).toHaveBeenCalledWith(true);
    expect(params.setVoiceScriptDraft).toHaveBeenCalledWith("Welcome back.");
    expect(params.setVoiceSelectedVoiceId).toHaveBeenCalledWith("voice-1");
    expect(setSelectedVoiceMock).toHaveBeenCalledWith("voice-1");
  });

  it("blocks local-only references and unavailable voices without mutating state", () => {
    const localReload = makeImageReload();
    const localReloadPayload = localReload.payload as WorkflowReloadImagePayload;
    localReloadPayload.referenceInputs = ["blob:http://local"];
    localReloadPayload.internalMediaRefs = [];
    let currentOutput = makeOutput(localReload);
    const params = makeParams(makeOutput(localReload));
    params.findOutputById.mockImplementation(() => currentOutput);
    const { result, rerender } = renderHook(
      ({ revision }) => {
        void revision;
        return useAiStudioWorkflowReloadController(params);
      },
      { initialProps: { revision: 0 } }
    );

    let blocked;
    act(() => {
      blocked = result.current.reloadWorkflowFromOutput("out-1");
    });
    expect(blocked).toEqual({ status: "source_unavailable", outputId: "out-1" });

    const missingVoiceReload: WorkflowReloadConfigV1 = {
      ...makeImageReload(),
      originTool: "text-to-speech",
      panelKind: "voices",
      outputMode: "audio",
      payload: {
        kind: "voiceover",
        script: "Hello",
        voiceId: "missing-voice",
        voiceName: "Gone",
        outputFormat: "mp3_44100_128",
      },
    };
    currentOutput = makeOutput(missingVoiceReload);
    rerender({ revision: 1 });
    act(() => {
      blocked = result.current.reloadWorkflowFromOutput("out-1");
    });

    expect(blocked).toEqual({ status: "voice_unavailable", outputId: "out-1" });
    expect(params.beginManualWorkflowReload).not.toHaveBeenCalled();
    expect(params.prepareCreateCharacterWorkflowReload).not.toHaveBeenCalled();
    expect(params.prepareImageStyleWorkflowReload).not.toHaveBeenCalled();
    expect(params.prepareStandardCreateWorkflowReload).not.toHaveBeenCalled();
  });
});
