import { describe, expect, it } from "vitest";
import type { StudioOutput } from "../../types";
import {
  buildWorkflowReloadConfigV1,
  canReloadWorkflowOutput,
  deriveImageWorkflowReloadFromGenerationReplay,
  isWorkflowReloadConfigV1,
  resolveWorkflowReloadConfigForOutput,
} from "../workflowReload";

describe("workflowReload", () => {
  it("builds a normalized image reload config", () => {
    const reload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-06T12:00:00.000Z",
      originTool: "create",
      panelKind: "create",
      outputMode: "image",
      projectId: " project-1 ",
      createMode: "standard",
      prompt: {
        display: "Visible prompt",
        submission: "Visible prompt plus style",
      },
      model: {
        id: " kie-ai/gpt-image-2-text-to-image ",
      },
      payload: {
        kind: "image",
        submitTool: "create",
        aspect: "9:16",
        imageResolution: "2K",
        referenceInputs: [" https://example.com/a.png ", ""],
        internalMediaRefs: [
          {
            version: 1,
            kind: "storage_object",
            bucket: "media_library",
            storagePath: "user-1/images/ref.png",
            mediaFileId: "media-1",
          },
        ],
        characterContext: {
          applied: true,
          characterId: "char-1",
        },
        styleContext: {
          applied: true,
          styleId: "style-1",
        },
      },
    });

    expect(reload).toEqual({
      version: 1,
      source: "ai_studio_generation",
      capturedAt: "2026-06-06T12:00:00.000Z",
      originTool: "create",
      panelKind: "create",
      outputMode: "image",
      restoreBehavior: "navigate_and_hydrate",
      projectId: "project-1",
      createMode: "standard",
      pulse: null,
      prompt: {
        display: "Visible prompt",
        submission: "Visible prompt plus style",
      },
      model: {
        id: "kie-ai/gpt-image-2-text-to-image",
      },
      payload: {
        kind: "image",
        submitTool: "create",
        aspect: "9:16",
        imageResolution: "2K",
        referenceInputs: ["https://example.com/a.png"],
        internalMediaRefs: [
          {
            version: 1,
            kind: "storage_object",
            bucket: "media_library",
            storagePath: "user-1/images/ref.png",
            mediaFileId: "media-1",
          },
        ],
        characterContext: {
          applied: true,
          characterId: "char-1",
        },
        styleContext: {
          applied: true,
          styleId: "style-1",
        },
      },
    });
    expect(isWorkflowReloadConfigV1(reload)).toBe(true);
  });

  it("builds video and audio reload configs for supported payloads", () => {
    const videoReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-06T12:00:00.000Z",
      originTool: "video",
      panelKind: "video",
      outputMode: "video",
      prompt: { display: "A cinematic tracking shot" },
      model: { id: "kie-ai/kling-3.0" },
      payload: {
        kind: "video",
        aspect: "16:9",
        videoReferenceMode: "standard",
        durationSeconds: 8,
        resolution: "1080p",
        generateAudio: true,
        cameraFixed: false,
        autoFix: true,
        referenceInputs: ["https://example.com/frame.png"],
        klingCfgScale: 0.7,
        klingWorkflowMode: "multi",
        klingShotType: "customize",
        klingVoiceIds: ["voice-a", "voice-b"],
        klingMultiPrompts: [{ id: "shot-1", prompt: "Push in", duration: 4 }],
        klingElements: [{ id: "element-1", name: "Hero prop" }],
      },
    });
    const musicReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-06T12:00:00.000Z",
      originTool: "music",
      panelKind: "music",
      outputMode: "audio",
      prompt: { display: "Warm indie folk cue" },
      model: { id: "elevenlabs/music" },
      payload: {
        kind: "music",
        text: "Warm indie folk cue",
        lyrics: "",
        durationSeconds: 30,
        bpm: 112,
        mode: "instrumental",
        structure: "loop",
        energyPercent: 58,
        outputFormat: "mp3_44100_128",
        composerMode: "simple",
        singerEnabled: false,
        songBatchCount: 2,
      },
    });
    const sfxReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-06T12:00:00.000Z",
      originTool: "sound-effects",
      panelKind: "sound-effects",
      outputMode: "audio",
      prompt: { display: "Glass shatter" },
      model: { id: "elevenlabs/sound-effects" },
      payload: {
        kind: "sound-effects",
        text: "Glass shatter",
        durationSeconds: 3,
        loop: false,
        promptInfluence: 0.3,
        outputFormat: "mp3_44100_128",
      },
    });

    expect(isWorkflowReloadConfigV1(videoReload)).toBe(true);
    expect(isWorkflowReloadConfigV1(musicReload)).toBe(true);
    expect(isWorkflowReloadConfigV1(sfxReload)).toBe(true);
  });

  it("builds voice reload configs with voice identity and source authority", () => {
    const voiceoverReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-06T12:00:00.000Z",
      originTool: "text-to-speech",
      panelKind: "voices",
      outputMode: "audio",
      prompt: { display: "Read this line" },
      model: { id: "elevenlabs/text-to-speech" },
      payload: {
        kind: "voiceover",
        script: "Read this line",
        voiceId: "voice-1",
        voiceName: "Narrator",
        outputFormat: "mp3_44100_128",
        config: { stability: 0.5 },
      },
    });
    const voiceChangerReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-06T12:00:00.000Z",
      originTool: "voice-changer",
      panelKind: "voices",
      outputMode: "audio",
      prompt: { display: "source.wav -> Narrator" },
      model: { id: "elevenlabs/voice-changer" },
      payload: {
        kind: "voice-changer",
        source: {
          name: "source.wav",
          origin: "storage",
          storagePath: "user-1/voice-changer/source.wav",
          internalMediaRef: {
            version: 1,
            kind: "storage_object",
            bucket: "media_library",
            storagePath: "user-1/voice-changer/source.wav",
          },
        },
        voiceId: "voice-1",
        voiceName: "Narrator",
        outputFormat: "mp3_44100_128",
        modelId: "elevenlabs/voice-changer",
        inputFormat: "wav",
        removeBackgroundNoise: true,
        voiceSettings: { stability: 0.5 },
      },
    });

    expect(isWorkflowReloadConfigV1(voiceoverReload)).toBe(true);
    expect(isWorkflowReloadConfigV1(voiceChangerReload)).toBe(true);
  });

  it("derives a documented image reload config from valid generation replay", () => {
    const reload = deriveImageWorkflowReloadFromGenerationReplay({
      version: 2,
      mode: "image",
      submitTool: "edit",
      modelId: "fal-ai/bytedance/seedream/v4.5/edit",
      displayPrompt: "Visible prompt",
      submissionPrompt: "Hidden style + visible prompt",
      aspect: "1:1",
      imageResolution: null,
      referenceInputs: ["https://example.com/ref.png"],
      internalMediaRefs: [],
      capturedAt: "2026-06-06T12:00:00.000Z",
    });

    expect(reload).toEqual(
      expect.objectContaining({
        originTool: "edit",
        panelKind: "edit",
        outputMode: "image",
        prompt: {
          display: "Visible prompt",
          submission: "Hidden style + visible prompt",
        },
      })
    );
    expect(reload?.payload).toEqual(
      expect.objectContaining({
        kind: "image",
        submitTool: "edit",
        referenceInputs: ["https://example.com/ref.png"],
      })
    );
  });

  it("only allows reload for generated outputs with valid metadata or image replay compatibility", () => {
    const baseOutput: StudioOutput = {
      id: "out-1",
      prompt: "Prompt",
      mode: "image",
      aspect: "1:1",
      model: "Model",
      status: "ready",
      timestamp: "Now",
      mediaSource: "generated",
      previewUrl: "https://example.com/image.png",
    };
    const workflowReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-06T12:00:00.000Z",
      originTool: "create",
      panelKind: "create",
      outputMode: "image",
      prompt: { display: "Prompt" },
      model: { id: "model-1" },
      payload: {
        kind: "image",
        submitTool: "create",
        aspect: "1:1",
        imageResolution: null,
        referenceInputs: [],
      },
    });

    expect(
      canReloadWorkflowOutput({ ...baseOutput, workflowReload: workflowReload ?? undefined })
    ).toBe(true);
    expect(
      canReloadWorkflowOutput({
        ...baseOutput,
        workflowReload: workflowReload ?? undefined,
        mediaSource: "upload",
      })
    ).toBe(false);
    expect(
      canReloadWorkflowOutput({
        ...baseOutput,
        generationReplay: {
          version: 1,
          mode: "image",
          submitTool: "create",
          modelId: "model-1",
          displayPrompt: "Prompt",
          submissionPrompt: "Prompt",
          aspect: "1:1",
          imageResolution: null,
          referenceInputs: [],
          capturedAt: "2026-06-06T12:00:00.000Z",
        },
      })
    ).toBe(true);
    expect(resolveWorkflowReloadConfigForOutput(baseOutput)).toBeNull();
  });

  it("rejects malformed reload metadata", () => {
    expect(
      buildWorkflowReloadConfigV1({
        capturedAt: "2026-06-06T12:00:00.000Z",
        originTool: "media-library",
        panelKind: "media-library",
        outputMode: "image",
        prompt: { display: "Prompt" },
        model: { id: "model-1" },
        payload: {
          kind: "image",
          submitTool: "create",
          aspect: "1:1",
          imageResolution: null,
          referenceInputs: [],
        },
      })
    ).toBeNull();
    expect(
      isWorkflowReloadConfigV1({
        version: 1,
        source: "ai_studio_generation",
        capturedAt: "2026-06-06T12:00:00.000Z",
        originTool: "create",
        panelKind: "create",
        outputMode: "image",
        restoreBehavior: "navigate_and_hydrate",
        prompt: { display: "Prompt" },
        model: { id: "model-1" },
        payload: {
          kind: "image",
          submitTool: "create",
          aspect: "",
          imageResolution: null,
          referenceInputs: [],
        },
      })
    ).toBe(false);
    expect(
      buildWorkflowReloadConfigV1({
        capturedAt: "2026-06-06T12:00:00.000Z",
        originTool: "create",
        panelKind: "create",
        outputMode: "audio",
        prompt: { display: "Prompt" },
        model: { id: "model-1" },
        payload: {
          kind: "image",
          submitTool: "create",
          aspect: "1:1",
          imageResolution: null,
          referenceInputs: [],
        },
      })
    ).toBeNull();
  });
});
