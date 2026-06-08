import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { addBreadcrumb } from "../../../../lib/clientBreadcrumbs";
import type { AiStudioKlingElement } from "../../logic/klingElements";
import type { StudioOutput, ToolId, WorkflowReloadConfigV1 } from "../../types";
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

const makeSetter = <T>() => vi.fn<[T | ((current: T) => T)], void>();

const makeParams = (output: StudioOutput | null) => ({
  beginManualWorkflowReload: vi.fn(),
  findOutputById: vi.fn(() => output),
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
  setMusicDurationSeconds: makeSetter<number>(),
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
  setSoundEffectsDurationSeconds: makeSetter<number>(),
  setSoundEffectsLoopEnabled: makeSetter<boolean>(),
  setSoundEffectsPromptDraft: vi.fn(),
  setStandardCreatePrompt: vi.fn(),
  setUiNotice: makeSetter<string | null>(),
  setVideoAutoFix: makeSetter<boolean>(),
  setVideoCameraFixed: makeSetter<boolean>(),
  setVideoDurationSeconds: makeSetter<number>(),
  setVideoGenerateAudio: makeSetter<boolean>(),
  setVideoReferenceMode: makeSetter<"standard" | "modify" | "keyframes" | "kling3" | "motion">(),
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
    expect(params.setStandardCreatePrompt).toHaveBeenCalledWith("A luminous harbor");
    expect(params.setModel).toHaveBeenCalledWith("fal-ai/bytedance/seedream/v4.5/text-to-image");
    expect(params.setAspect).toHaveBeenCalledWith("9:16");
    expect(params.setImageResolution).toHaveBeenCalledWith("2K");
    expect(params.setReferenceSelectionState).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedTool: "create",
        referenceImageUrl: "https://example.com/ref-a.png",
        extraImageUrls: ["https://example.com/ref-b.png", null, null],
        referenceImageInternalMediaRefs: workflowReload.payload.internalMediaRefs,
      })
    );
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

    expect(params.setSelectedTool).toHaveBeenCalledWith("kling");
    expect(params.setVideoReferenceText).toHaveBeenCalledWith("A sweeping crane shot");
    expect(params.setVideoReferenceMode).toHaveBeenCalledWith("motion");
    expect(params.setVideoDurationSeconds).toHaveBeenCalledWith(8);
    expect(params.setVideoResolution).toHaveBeenCalledWith("1080p");
    expect(params.setVideoGenerateAudio).toHaveBeenCalledWith(true);
    expect(params.setMotionReferenceVideoUrl).toHaveBeenCalledWith(
      "https://example.com/motion.mp4"
    );
    expect(params.setSeedance2InputMode).toHaveBeenCalledWith("multimodal");
    expect(params.setKlingWorkflowMode).toHaveBeenCalledWith("custom");
    expect(params.setKlingVoiceIds).toHaveBeenCalledWith(["voice-1", "voice-2"]);
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
    localReload.payload.referenceInputs = ["blob:http://local"];
    localReload.payload.internalMediaRefs = [];
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
  });
});
