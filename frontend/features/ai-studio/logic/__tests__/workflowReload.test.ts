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
        expertEditReferences: {
          version: 1,
          maxSecondarySlotCount: 10,
          primaryReferenceInputIndex: 0,
          secondarySlots: [
            {
              slotIndex: 9,
              referenceInputIndex: 0,
              internalMediaRef: {
                version: 1,
                kind: "storage_object",
                bucket: "media_library",
                storagePath: "user-1/images/ref.png",
                mediaFileId: "media-1",
              },
            },
            { slotIndex: 99, referenceInputIndex: 0 },
            { slotIndex: 0, referenceInputIndex: 99 },
          ],
          restoreSecondarySlots: [
            { slotIndex: 1, sourceUrl: " https://example.com/restore-2.png " },
            { slotIndex: 99, sourceUrl: "https://example.com/out-of-range.png" },
            { slotIndex: 2, sourceUrl: "blob:http://localhost/local-only" },
          ],
        },
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
        expertEditReferences: {
          version: 1,
          maxSecondarySlotCount: 10,
          primaryReferenceInputIndex: 0,
          secondarySlots: [
            {
              slotIndex: 9,
              referenceInputIndex: 0,
              internalMediaRef: {
                version: 1,
                kind: "storage_object",
                bucket: "media_library",
                storagePath: "user-1/images/ref.png",
                mediaFileId: "media-1",
              },
            },
          ],
          restoreSecondarySlots: [{ slotIndex: 1, sourceUrl: "https://example.com/restore-2.png" }],
        },
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
        styleContext: {
          applied: true,
          styleId: "video-style",
          stylePrompt: "high-contrast coastal grit",
        },
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
    expect(videoReload?.payload).toEqual(
      expect.objectContaining({
        kind: "video",
        styleContext: {
          applied: true,
          styleId: "video-style",
          stylePrompt: "high-contrast coastal grit",
        },
      })
    );
    const lipSyncReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-06T12:00:00.000Z",
      originTool: "video",
      panelKind: "video",
      outputMode: "video",
      prompt: { display: "" },
      model: { id: "fal-ai/bytedance/omnihuman/v1.5" },
      payload: {
        kind: "video",
        aspect: "9:16",
        videoReferenceMode: "lip-sync",
        motionReferenceVideoUrl: "https://example.com/motion-should-not-leak.mp4",
        lipSyncAudioUrl: " https://example.com/voice.mp3 ",
        lipSyncAudioDurationMs: 12_400,
        lipSyncTurboMode: true,
        durationSeconds: 6,
        resolution: "720p",
        generateAudio: false,
        cameraFixed: false,
        autoFix: false,
        referenceInputs: [" https://example.com/character.png "],
      },
    });

    expect(lipSyncReload?.payload).toEqual(
      expect.objectContaining({
        kind: "video",
        videoReferenceMode: "lip-sync",
        motionReferenceVideoUrl: null,
        lipSyncAudioUrl: "https://example.com/voice.mp3",
        lipSyncAudioDurationMs: 12_400,
        lipSyncTurboMode: true,
        resolution: "720p",
        referenceInputs: ["https://example.com/character.png"],
      })
    );

    const localLipSyncReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-06T12:00:00.000Z",
      originTool: "video",
      panelKind: "video",
      outputMode: "video",
      prompt: { display: "" },
      model: { id: "fal-ai/bytedance/omnihuman/v1.5" },
      payload: {
        kind: "video",
        aspect: "9:16",
        videoReferenceMode: "lip-sync",
        durationSeconds: null,
        resolution: null,
        generateAudio: null,
        cameraFixed: null,
        autoFix: null,
        lipSyncAudioUrl: "blob:http://localhost/local-voice",
        lipSyncAudioDurationMs: 12_400,
        referenceInputs: ["https://example.com/character.png"],
      },
    });

    expect(localLipSyncReload?.payload).toEqual(
      expect.objectContaining({
        lipSyncAudioUrl: null,
        lipSyncAudioDurationMs: null,
      })
    );

    const motionReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-06T12:00:00.000Z",
      originTool: "video",
      panelKind: "video",
      outputMode: "video",
      prompt: { display: "" },
      model: { id: "kie-ai/kling-3.0" },
      payload: {
        kind: "video",
        aspect: "9:16",
        videoReferenceMode: "motion",
        motionReferenceVideoUrl: " https://example.com/motion.mp4 ",
        durationSeconds: null,
        resolution: null,
        generateAudio: null,
        cameraFixed: null,
        autoFix: null,
        lipSyncAudioUrl: "https://example.com/voice-should-not-leak.mp3",
        lipSyncAudioDurationMs: 12_400,
        lipSyncTurboMode: true,
        referenceInputs: ["https://example.com/character.png"],
      },
    });

    expect(motionReload?.payload).toEqual(
      expect.objectContaining({
        videoReferenceMode: "motion",
        motionReferenceVideoUrl: "https://example.com/motion.mp4",
        lipSyncAudioUrl: null,
        lipSyncAudioDurationMs: null,
        lipSyncTurboMode: null,
      })
    );
    expect(isWorkflowReloadConfigV1(musicReload)).toBe(true);
    expect(isWorkflowReloadConfigV1(sfxReload)).toBe(true);
  });

  it("normalizes video reference sidecar metadata", () => {
    const firstFrameRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user/video/first-frame.png",
    };
    const referenceImageRef = {
      version: 1 as const,
      kind: "storage_object" as const,
      bucket: "media_library",
      storagePath: "user/video/reference.png",
    };
    const reload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-06T12:00:00.000Z",
      originTool: "video",
      panelKind: "video",
      outputMode: "video",
      prompt: { display: "Restore video refs" },
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
        referenceInputs: [],
        videoReferences: {
          version: 1,
          firstFrame: {
            sourceUrl: "blob:http://localhost/first-frame",
            internalMediaRef: firstFrameRef,
          },
          lastFrame: {
            sourceUrl: "blob:http://localhost/missing-last-frame",
          },
          seedance2ReferenceImages: [
            { slotIndex: 0, sourceUrl: " https://example.com/seed-image.png " },
            { slotIndex: 0, sourceUrl: "https://example.com/duplicate.png" },
            { slotIndex: 1, sourceUrl: "data:image/png;base64,missing" },
          ],
          klingElementSlots: [
            {
              slotIndex: 0,
              element: {
                id: "element-1",
                profileImageUrl: "data:image/png;base64,missing-profile",
                referenceImageUrls:
                  "https://example.com/reference.png, blob:http://localhost/missing-reference",
              },
              referenceImageInternalMediaRefs: [referenceImageRef],
            },
          ],
        },
      },
    });

    expect(reload?.payload).toEqual(
      expect.objectContaining({
        kind: "video",
        videoReferences: {
          version: 1,
          firstFrame: {
            sourceUrl: "blob:http://localhost/first-frame",
            internalMediaRef: firstFrameRef,
          },
          seedance2ReferenceImages: [
            { slotIndex: 0, sourceUrl: "https://example.com/seed-image.png" },
          ],
          klingElementSlots: [
            {
              slotIndex: 0,
              element: {
                id: "element-1",
                profileImageUrl: null,
                referenceImageUrls: "https://example.com/reference.png",
                slotIndex: 0,
              },
              referenceImageInternalMediaRefs: [referenceImageRef],
            },
          ],
        },
      })
    );
    expect(isWorkflowReloadConfigV1(reload)).toBe(true);
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

  it("does not coerce audio workflow reload metadata into a video reload", () => {
    const voiceChangerReload = buildWorkflowReloadConfigV1({
      capturedAt: "2026-06-06T12:00:00.000Z",
      originTool: "voice-changer",
      panelKind: "voices",
      outputMode: "audio",
      prompt: { display: "source.mp4 -> Narrator" },
      model: { id: "elevenlabs/voice-changer" },
      payload: {
        kind: "voice-changer",
        source: {
          name: "source.mp4",
          origin: "storage",
          storagePath: "user-1/voice-changer/source.wav",
          extractedFrom: {
            name: "source.mp4",
            storagePath: "user-1/voice-changer/source.mp4",
            mimeType: "video/mp4",
            aspect: "16:9",
          },
        },
        voiceId: "voice-1",
        voiceName: "Narrator",
        outputFormat: "mp3_44100_128",
        modelId: "elevenlabs/voice-changer",
        inputFormat: "wav",
        removeBackgroundNoise: true,
        voiceSettings: { stability: 1 },
      },
    });
    const remuxedVideoOutput: StudioOutput = {
      id: "generated:video-1",
      prompt: "source.mp4 -> Narrator video",
      mode: "video",
      aspect: "16:9",
      model: "ElevenLabs Voice Changer",
      modelId: "elevenlabs/voice-changer",
      status: "ready",
      timestamp: "Just now",
      taskState: "success",
      mediaSource: "generated",
      mimeType: "video/mp4",
      previewUrl: "https://example.com/remuxed.mp4",
      workflowReload: voiceChangerReload ?? undefined,
    };

    expect(resolveWorkflowReloadConfigForOutput(remuxedVideoOutput)).toBeNull();
    expect(
      resolveWorkflowReloadConfigForOutput(remuxedVideoOutput, { mediaKindHint: "video" })
    ).toBeNull();
    expect(canReloadWorkflowOutput(remuxedVideoOutput)).toBe(false);
    expect(canReloadWorkflowOutput(remuxedVideoOutput, { mediaKindHint: "video" })).toBe(false);
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
    expect(
      canReloadWorkflowOutput({
        ...baseOutput,
        previewUrl: "https://example.com/video.mp4",
        generationReplay: {
          version: 1,
          mode: "image",
          submitTool: "edit",
          modelId: "model-1",
          displayPrompt: "Prompt",
          submissionPrompt: "Prompt",
          aspect: "1:1",
          imageResolution: null,
          referenceInputs: [],
          capturedAt: "2026-06-06T12:00:00.000Z",
        },
      })
    ).toBe(false);
    expect(
      resolveWorkflowReloadConfigForOutput({
        ...baseOutput,
        previewUrl: "https://example.com/video.mp4",
        generationReplay: {
          version: 1,
          mode: "image",
          submitTool: "edit",
          modelId: "model-1",
          displayPrompt: "Prompt",
          submissionPrompt: "Prompt",
          aspect: "1:1",
          imageResolution: null,
          referenceInputs: [],
          capturedAt: "2026-06-06T12:00:00.000Z",
        },
      })
    ).toBeNull();
    expect(
      resolveWorkflowReloadConfigForOutput(
        {
          ...baseOutput,
          modelId: "kie-ai/kling-3.0",
          previewUrl: "https://example.com/video.mp4",
          generationReplay: {
            version: 1,
            mode: "image",
            submitTool: "edit",
            modelId: "model-1",
            displayPrompt: "Prompt",
            submissionPrompt: "Prompt",
            aspect: "1:1",
            imageResolution: null,
            referenceInputs: ["https://example.com/first-frame.png"],
            capturedAt: "2026-06-06T12:00:00.000Z",
          },
        },
        { mediaKindHint: "video" }
      )
    ).toEqual(
      expect.objectContaining({
        originTool: "video",
        panelKind: "video",
        outputMode: "video",
        model: { id: "kie-ai/kling-3.0" },
        payload: expect.objectContaining({
          kind: "video",
          videoReferenceMode: "standard",
          referenceInputs: ["https://example.com/first-frame.png"],
        }),
      })
    );
    expect(
      resolveWorkflowReloadConfigForOutput({
        ...baseOutput,
        mode: "image",
        modelId: "kie-ai/kling-3.0",
        mimeType: "video/mp4",
        fullStoragePath: "user-1/generations/videos/generated-video.mp4",
        durationMs: 6_000,
        generationReplay: {
          version: 2,
          mode: "image",
          submitTool: "edit",
          modelId: "fal-ai/bytedance/seedream/v4.5/edit",
          displayPrompt: "Restore this as video without a surface hint",
          submissionPrompt: "Restore this as video without a surface hint",
          aspect: "16:9",
          imageResolution: "2K",
          referenceInputs: ["https://example.com/first-frame.png"],
          internalMediaRefs: [],
          capturedAt: "2026-06-06T12:00:00.000Z",
        },
      })
    ).toEqual(
      expect.objectContaining({
        originTool: "video",
        panelKind: "video",
        outputMode: "video",
        model: { id: "kie-ai/kling-3.0" },
        payload: expect.objectContaining({
          kind: "video",
          videoReferenceMode: "standard",
          durationSeconds: 6,
          referenceInputs: ["https://example.com/first-frame.png"],
        }),
      })
    );
    expect(
      resolveWorkflowReloadConfigForOutput({
        ...baseOutput,
        mode: "video",
        modelId: "kie-ai/kling-3.0",
        previewUrl: "https://example.com/signed-video",
        workflowReload: workflowReload ?? undefined,
      })
    ).toEqual(
      expect.objectContaining({
        originTool: "video",
        panelKind: "video",
        outputMode: "video",
        model: { id: "kie-ai/kling-3.0" },
        payload: expect.objectContaining({
          kind: "video",
          videoReferenceMode: "standard",
        }),
      })
    );
    expect(
      resolveWorkflowReloadConfigForOutput({
        ...baseOutput,
        mode: "image",
        modelId: "kie-ai/kling-3.0",
        previewUrl: "https://example.com/signed-generated-video",
        workflowReload: workflowReload ?? undefined,
      })
    ).toEqual(
      expect.objectContaining({
        originTool: "video",
        panelKind: "video",
        outputMode: "video",
        model: { id: "kie-ai/kling-3.0" },
        payload: expect.objectContaining({
          kind: "video",
          durationSeconds: null,
        }),
      })
    );
    expect(
      canReloadWorkflowOutput({
        ...baseOutput,
        workflowReload: {
          version: 1,
          source: "ai_studio_generation",
          capturedAt: "2026-06-06T12:00:00.000Z",
          originTool: "video",
          panelKind: "video",
          outputMode: "video",
          restoreBehavior: "navigate_and_hydrate",
          pulse: null,
          prompt: { display: "Prompt" },
          model: { id: "model-1" },
          payload: {
            kind: "image",
            submitTool: "edit",
            aspect: "1:1",
            imageResolution: null,
            referenceInputs: [],
          },
        },
        generationReplay: {
          version: 1,
          mode: "image",
          submitTool: "edit",
          modelId: "model-1",
          displayPrompt: "Prompt",
          submissionPrompt: "Prompt",
          aspect: "1:1",
          imageResolution: null,
          referenceInputs: [],
          capturedAt: "2026-06-06T12:00:00.000Z",
        },
      })
    ).toBe(false);
    expect(resolveWorkflowReloadConfigForOutput(baseOutput)).toBeNull();
  });

  it("allows video workflow reload only for generated video outputs with valid metadata", () => {
    const baseOutput: StudioOutput = {
      id: "video-out-1",
      prompt: "A cinematic tracking shot",
      mode: "video",
      aspect: "16:9",
      model: "Kling 3.0",
      status: "ready",
      timestamp: "Now",
      mediaSource: "generated",
      previewUrl: "https://example.com/video.mp4",
    };
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
      },
    });

    expect(
      canReloadWorkflowOutput({ ...baseOutput, workflowReload: videoReload ?? undefined })
    ).toBe(true);
    expect(
      canReloadWorkflowOutput({
        ...baseOutput,
        workflowReload: videoReload ?? undefined,
        mediaSource: "upload",
      })
    ).toBe(false);
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
