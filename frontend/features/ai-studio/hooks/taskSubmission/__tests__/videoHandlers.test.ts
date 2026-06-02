import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoSubmissionArgs } from "../types";
import { getModelConfig } from "../../../logic/pricing";
import { handleVideoModelSubmission } from "../videoHandlers";
import { fetchWithAuth } from "../../../../../lib/authenticatedFetch";
import { getSignedMediaUrl } from "../../../../../lib/mediaSignedUrlCache";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_2_FAST_MODEL_ID,
  KIE_SEEDANCE_2_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../../lib/model-runtime/providerModelIds";

const falClientMocks = vi.hoisted(() => ({
  submitKieKlingImageToVideo: vi.fn(),
  submitKieSeedance2FastVideo: vi.fn(),
  submitKieSeedance2Video: vi.fn(),
  submitKieSeedanceVideo: vi.fn(),
  submitKieVeoImageToVideo: vi.fn(),
}));

vi.mock("../../../../../lib/falClient", () => {
  const submitQueuedGenerationByModelId = vi.fn((modelId: string, payload: unknown) => {
    switch (modelId) {
      case "kie-ai/kling-3.0":
        return falClientMocks.submitKieKlingImageToVideo(payload);
      case "kie-ai/seedance-2-fast":
        return falClientMocks.submitKieSeedance2FastVideo(payload);
      case "kie-ai/seedance-2":
        return falClientMocks.submitKieSeedance2Video(payload);
      case "kie-ai/veo-3.1-fast-i2v":
        return falClientMocks.submitKieVeoImageToVideo(payload);
      default:
        throw new Error(`Unexpected model ${modelId}`);
    }
  });
  return {
    submitQueuedGenerationByModelId,
  };
});

vi.mock("../../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));
vi.mock("../../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: vi.fn(),
}));

const {
  submitKieKlingImageToVideo,
  submitKieSeedance2FastVideo,
  submitKieSeedance2Video,
  submitKieVeoImageToVideo,
} = falClientMocks;

const makeArgs = (overrides: Partial<VideoSubmissionArgs> = {}): VideoSubmissionArgs => ({
  id: "out-1",
  finalModel: KIE_KLING_30_MODEL_ID,
  cleanedPrompt: "A dancer twirls",
  aspect: "16:9",
  requestedDurationSeconds: 6,
  requestedResolution: "1080p",
  requestedAudio: true,
  preparedImageInputs: ["https://example.com/character.png"],
  modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
  notifyGenerationFailure: vi.fn(),
  updateOutputById: vi.fn(),
  startPollingWithGeneration: vi.fn(),
  videoReferenceMode: "motion",
  videoReferenceImageUrl: "https://example.com/character.png",
  motionReferenceVideoUrl: "https://example.com/motion.mp4",
  videoCameraFixed: false,
  klingCfgScale: 0.5,
  klingWorkflowMode: "single",
  klingMultiPrompts: [],
  klingElements: [],
  ...overrides,
});

describe("handleVideoModelSubmission (Kling 3 motion)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(submitKieKlingImageToVideo).mockResolvedValue({ request_id: "req-123" });
    vi.mocked(getSignedMediaUrl).mockResolvedValue(
      "https://example.com/signed/motion-refreshed.mp4"
    );
  });

  it("builds and submits a motion payload with normalized prompt and mode", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      requestedAudio: false,
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith({
      prompt: "A dancer twirls",
      image_url: "https://example.com/character.png",
      image_urls: ["https://example.com/character.png"],
      input_urls: ["https://example.com/character.png"],
      video_url: "https://example.com/motion.mp4",
      video_urls: ["https://example.com/motion.mp4"],
      resolution: "1080p",
      mode: "1080p",
      generate_audio: false,
      character_orientation: "image",
      background_source: "input_video",
    });
    expect(args.startPollingWithGeneration).toHaveBeenCalledWith(
      "req-123",
      "kie-kling",
      {
        previewUrl: "https://example.com/character.png",
      },
      {
        request_id: "req-123",
      }
    );
  });

  it("passes selected 720p resolution for motion payloads", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      requestedResolution: "720p",
      requestedAudio: true,
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: "720p",
        mode: "720p",
        generate_audio: true,
      })
    );
  });

  it("fails fast when a local blob motion video leaks into submit", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      motionReferenceVideoUrl: "blob:video-123",
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Motion clip is not ready yet. Re-add it and wait for upload before generating."
    );
    expect(fetchWithAuth).not.toHaveBeenCalled();
    expect(submitKieKlingImageToVideo).not.toHaveBeenCalled();
  });

  it("fails fast when a localhost motion video leaks into submit", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      motionReferenceVideoUrl: "http://localhost:3000/local-motion.mp4",
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Motion clip is not ready yet. Re-add it and wait for upload before generating."
    );
    expect(fetchWithAuth).not.toHaveBeenCalled();
    expect(submitKieKlingImageToVideo).not.toHaveBeenCalled();
  });

  it("fails fast instead of attempting a blob upload during submit", async () => {
    const args = makeArgs({ motionReferenceVideoUrl: "blob:video-456" });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Motion clip is not ready yet. Re-add it and wait for upload before generating."
    );
    expect(submitKieKlingImageToVideo).not.toHaveBeenCalled();
  });

  it("fails fast even when a remembered blob-backed motion video leaks into submit", async () => {
    const args = makeArgs({ motionReferenceVideoUrl: "blob:video-remembered" });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Motion clip is not ready yet. Re-add it and wait for upload before generating."
    );
    expect(fetchWithAuth).not.toHaveBeenCalled();
    expect(submitKieKlingImageToVideo).not.toHaveBeenCalled();
  });

  it("refreshes expiring Supabase signed motion videos before submit", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const expSoon = Math.floor(Date.now() / 1000) + 60;
    const payload = Buffer.from(
      JSON.stringify({
        url: "media_library/user-1/videos/motion.mp4",
        exp: expSoon,
      })
    ).toString("base64url");
    const token = `header.${payload}.sig`;
    const signedUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/motion.mp4" +
      `?token=${token}`;
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      motionReferenceVideoUrl: signedUrl,
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(getSignedMediaUrl).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/videos/motion.mp4",
      forceRefresh: true,
    });
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: "1080p",
        mode: "1080p",
        video_urls: ["https://example.com/signed/motion-refreshed.mp4"],
      })
    );
  });

  it("fails gracefully when signed motion video cannot be refreshed", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const expSoon = Math.floor(Date.now() / 1000) + 60;
    const payload = Buffer.from(
      JSON.stringify({
        url: "media_library/user-1/videos/motion.mp4",
        exp: expSoon,
      })
    ).toString("base64url");
    const token = `header.${payload}.sig`;
    const signedUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/motion.mp4" +
      `?token=${token}`;
    vi.mocked(getSignedMediaUrl).mockResolvedValueOnce(null);
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      motionReferenceVideoUrl: signedUrl,
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      expect.stringContaining("Motion reference preparation failed")
    );
    expect(submitKieKlingImageToVideo).not.toHaveBeenCalled();
  });
});

describe("handleVideoModelSubmission (Kie Veo keyframes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(submitKieVeoImageToVideo).mockResolvedValue({ request_id: "kie-req-1" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("submits first+last frame payload in keyframes mode", async () => {
    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/veo-first.png",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/veo-last.png",
        }),
      } as Response);

    const args = makeArgs({
      finalModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
      modelConfig: getModelConfig(KIE_VEO_31_FAST_I2V_MODEL_ID),
      videoReferenceMode: "keyframes",
      aspect: "9:16",
      requestedDurationSeconds: 8,
      requestedResolution: "1080p",
      requestedAudio: false,
      preparedImageInputs: ["https://example.com/first.png", "https://example.com/last.png"],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieVeoImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/veo-first.png",
        image_urls: [
          "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/veo-first.png",
          "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/veo-last.png",
        ],
        generation_type: "FIRST_AND_LAST_FRAMES_2_VIDEO",
        aspect_ratio: "9:16",
        duration: 8,
        resolution: "1080p",
        generate_audio: false,
      })
    );
  });

  it("submits single-image payload in standard mode with first/last generation type", async () => {
    vi.mocked(submitKieVeoImageToVideo).mockResolvedValue({ request_id: "req-kie-veo-standard" });
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        url: "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/veo-single.png",
      }),
    } as Response);

    const handled = await handleVideoModelSubmission(
      makeArgs({
        finalModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
        modelConfig: getModelConfig(KIE_VEO_31_FAST_I2V_MODEL_ID),
        videoReferenceMode: "standard",
        requestedDurationSeconds: 4,
        requestedResolution: "720p",
        preparedImageInputs: ["https://example.com/first.png"],
      })
    );

    expect(handled).toBe(true);
    expect(submitKieVeoImageToVideo).toHaveBeenCalledWith({
      prompt: "A dancer twirls",
      image_url: "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/veo-single.png",
      image_urls: ["https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/veo-single.png"],
      generation_type: "FIRST_AND_LAST_FRAMES_2_VIDEO",
      aspect_ratio: "16:9",
      duration: 5,
      resolution: "720p",
      generate_audio: true,
    });
  });

  it("promotes Kie Veo standard mode to first+last when two frames are present", async () => {
    vi.mocked(submitKieVeoImageToVideo).mockResolvedValue({ request_id: "req-kie-veo-dual" });
    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/veo-standard-first.png",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/veo-standard-last.png",
        }),
      } as Response);

    const handled = await handleVideoModelSubmission(
      makeArgs({
        finalModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
        modelConfig: getModelConfig(KIE_VEO_31_FAST_I2V_MODEL_ID),
        videoReferenceMode: "standard",
        preparedImageInputs: ["https://example.com/first.png", "https://example.com/last.png"],
      })
    );

    expect(handled).toBe(true);
    expect(submitKieVeoImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url:
          "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/veo-standard-first.png",
        image_urls: [
          "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/veo-standard-first.png",
          "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/veo-standard-last.png",
        ],
        generation_type: "FIRST_AND_LAST_FRAMES_2_VIDEO",
      })
    );
  });

  it("submits prompt-only payload when Kie Veo is used without frame images", async () => {
    const args = makeArgs({
      finalModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
      modelConfig: getModelConfig(KIE_VEO_31_FAST_I2V_MODEL_ID),
      videoReferenceMode: "standard",
      aspect: "9:16",
      requestedDurationSeconds: 8,
      requestedResolution: "1080p",
      requestedAudio: false,
      preparedImageInputs: [],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieVeoImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: undefined,
        image_urls: [],
        generation_type: "TEXT_2_VIDEO",
        aspect_ratio: "9:16",
        duration: 8,
        resolution: "1080p",
        generate_audio: false,
      })
    );
  });

  it("blocks character-scoped media URLs before submit", async () => {
    const args = makeArgs({
      finalModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
      modelConfig: getModelConfig(KIE_VEO_31_FAST_I2V_MODEL_ID),
      videoReferenceMode: "keyframes",
      preparedImageInputs: [
        "https://example.supabase.co/storage/v1/object/sign/media_library/user/characters/char-a/first.png?token=abc",
        "https://example.com/last.png",
      ],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Character media references are blocked for video models. Use non-character media assets."
    );
    expect(submitKieVeoImageToVideo).not.toHaveBeenCalled();
  });
});

describe("handleVideoModelSubmission (Kie Seedance 2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () =>
          ({
            ok: true,
            status: 200,
            blob: async () =>
              new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }),
          }) as Response
      )
    );
    vi.mocked(fetchWithAuth).mockImplementation(async (_url, init) => {
      const headers = new Headers(init?.headers);
      const payload =
        typeof init?.body === "string" ? (JSON.parse(init.body) as { fileUrl?: string }) : {};
      const uploadPath = headers.get("x-shortpulse-upload-path")?.trim();
      const uploadFileName = headers.get("x-shortpulse-upload-filename")?.trim();
      return {
        ok: true,
        json: async () => ({
          url:
            payload.fileUrl ??
            (uploadPath
              ? `https://tempfile.aiquickdraw.com/${uploadPath}/${uploadFileName ?? "upload.png"}`
              : ""),
        }),
      } as Response;
    });
    vi.mocked(submitKieSeedance2FastVideo).mockResolvedValue({ request_id: "kie-seedance-2-fast" });
    vi.mocked(submitKieSeedance2Video).mockResolvedValue({ request_id: "kie-seedance-2" });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uploads first and last frame URLs to Kie temporary storage before submit", async () => {
    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/first-frame.png",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/last-frame.png",
        }),
      } as Response);

    const args = makeArgs({
      finalModel: KIE_SEEDANCE_2_MODEL_ID,
      modelConfig: getModelConfig(KIE_SEEDANCE_2_MODEL_ID),
      preparedImageInputs: ["https://example.com/first.png", "https://example.com/last.png"],
      requestedDurationSeconds: 10,
      requestedResolution: "720p",
      aspect: "9:16",
      requestedAudio: false,
      videoReferenceMode: "standard",
      seedance2InputMode: "first-last",
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(fetchWithAuth).toHaveBeenCalledTimes(2);
    expect(submitKieSeedance2Video).toHaveBeenCalledWith(
      expect.objectContaining({
        first_frame_url:
          "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/first-frame.png",
        last_frame_url:
          "https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/last-frame.png",
      })
    );
  });

  it("reuses current Kie RedPanda temp-hosted frame URLs without re-uploading", async () => {
    const args = makeArgs({
      finalModel: KIE_SEEDANCE_2_MODEL_ID,
      modelConfig: getModelConfig(KIE_SEEDANCE_2_MODEL_ID),
      preparedImageInputs: [
        "https://tempfile.redpandaai.co/shortpulse/kie-video/images/first-frame.png",
        "https://tempfile.redpandaai.co/shortpulse/kie-video/images/last-frame.png",
      ],
      requestedDurationSeconds: 10,
      requestedResolution: "720p",
      aspect: "9:16",
      requestedAudio: false,
      videoReferenceMode: "standard",
      seedance2InputMode: "first-last",
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(fetchWithAuth).not.toHaveBeenCalled();
    expect(submitKieSeedance2Video).toHaveBeenCalledWith(
      expect.objectContaining({
        first_frame_url:
          "https://tempfile.redpandaai.co/shortpulse/kie-video/images/first-frame.png",
        last_frame_url: "https://tempfile.redpandaai.co/shortpulse/kie-video/images/last-frame.png",
      })
    );
  });

  it("preserves selected 480p resolution for Seedance 2 submits", async () => {
    const args = makeArgs({
      finalModel: KIE_SEEDANCE_2_MODEL_ID,
      modelConfig: getModelConfig(KIE_SEEDANCE_2_MODEL_ID),
      preparedImageInputs: [],
      requestedDurationSeconds: 15,
      requestedResolution: "480p",
      requestedAudio: true,
      videoReferenceMode: "standard",
      seedance2InputMode: "text",
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieSeedance2Video).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: "480p",
        duration: "15",
        generate_audio: true,
      })
    );
  });

  it("preserves selected 480p resolution for Seedance 2 Fast submits", async () => {
    const args = makeArgs({
      finalModel: KIE_SEEDANCE_2_FAST_MODEL_ID,
      modelConfig: getModelConfig(KIE_SEEDANCE_2_FAST_MODEL_ID),
      preparedImageInputs: [],
      requestedDurationSeconds: 10,
      requestedResolution: "480p",
      requestedAudio: false,
      videoReferenceMode: "standard",
      seedance2InputMode: "text",
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieSeedance2FastVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: "480p",
        duration: "10",
        generate_audio: false,
      })
    );
  });

  it("fails closed when Seedance receives an unsupported resolution", async () => {
    const args = makeArgs({
      finalModel: KIE_SEEDANCE_2_MODEL_ID,
      modelConfig: getModelConfig(KIE_SEEDANCE_2_MODEL_ID),
      preparedImageInputs: [],
      requestedResolution: "4k",
      videoReferenceMode: "standard",
      seedance2InputMode: "text",
    });

    await expect(handleVideoModelSubmission(args)).rejects.toThrow(
      "Seedance 2.0 submit uses unsupported resolution: 4k. Allowed: 1080p, 720p, 480p"
    );
    expect(submitKieSeedance2Video).not.toHaveBeenCalled();
  });

  it("keeps Seedance 2 on the single-shot Kie payload when stale custom prompts exist", async () => {
    const args = makeArgs({
      finalModel: KIE_SEEDANCE_2_MODEL_ID,
      modelConfig: getModelConfig(KIE_SEEDANCE_2_MODEL_ID),
      cleanedPrompt: "Direct @redlantern through the square",
      preparedImageInputs: [],
      requestedDurationSeconds: 15,
      requestedResolution: "1080p",
      requestedAudio: true,
      videoReferenceMode: "standard",
      klingWorkflowMode: "custom",
      klingMultiPrompts: [
        { id: "shot-1", prompt: "Follow @redlantern past the crowd", duration: 5 },
        { id: "shot-2", prompt: "Reveal the skyline behind @redlantern", duration: 10 },
      ],
      klingElements: [
        {
          id: "element-1",
          slotIndex: 0,
          name: "Red Lantern",
          alias: "redlantern",
          description: "Warm lacquered lantern",
          frontalImageUrl: "https://example.com/red-lantern-front.png",
          referenceImageUrls: "https://example.com/red-lantern-side.png",
          videoUrl: "https://example.com/red-lantern-motion.mp4",
        },
      ],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieSeedance2Video).toHaveBeenCalledWith({
      prompt: expect.stringContaining("Direct Red Lantern through the square"),
      reference_image_urls: [
        "https://example.com/red-lantern-front.png",
        "https://example.com/red-lantern-side.png",
      ],
      reference_video_urls: ["https://example.com/red-lantern-motion.mp4"],
      aspect_ratio: "16:9",
      duration: "15",
      resolution: "1080p",
      generate_audio: true,
      return_last_frame: false,
      web_search: false,
    });
    expect(vi.mocked(submitKieSeedance2Video).mock.calls[0]?.[0]?.prompt).toContain(
      "Linked reference subjects: Red Lantern: Warm lacquered lantern."
    );
    expect(vi.mocked(submitKieSeedance2Video).mock.calls[0]?.[0]?.prompt).not.toContain(
      "Storyboard:"
    );
    expect(vi.mocked(submitKieSeedance2Video).mock.calls[0]?.[0]?.prompt).not.toContain("Shot 1");
  });

  it("fails closed when Seedance linked assets are mixed with first/last frame mode", async () => {
    const args = makeArgs({
      finalModel: KIE_SEEDANCE_2_MODEL_ID,
      modelConfig: getModelConfig(KIE_SEEDANCE_2_MODEL_ID),
      preparedImageInputs: ["https://example.com/first-frame.png"],
      videoReferenceMode: "standard",
      seedance2InputMode: "first-frame",
      klingElements: [
        {
          id: "element-1",
          slotIndex: 0,
          name: "Steam Train",
          alias: "steamtrain",
          frontalImageUrl: "",
          referenceImageUrls: "",
          videoUrl: "https://example.com/steamtrain-motion.mp4",
        },
      ],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Seedance 2.0 linked assets cannot be combined with first/last frame mode."
    );
    expect(submitKieSeedance2Video).not.toHaveBeenCalled();
  });
});

describe("handleVideoModelSubmission (Kie Kling standard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(submitKieKlingImageToVideo).mockResolvedValue({ request_id: "kie-kling-std-1" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        async () =>
          ({
            ok: true,
            status: 200,
            blob: async () =>
              new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: "image/png" }),
          }) as Response
      )
    );
    vi.mocked(fetchWithAuth).mockImplementation(async (_url, init) => {
      const headers = new Headers(init?.headers);
      const payload =
        typeof init?.body === "string" ? (JSON.parse(init.body) as { fileUrl?: string }) : {};
      const uploadPath = headers.get("x-shortpulse-upload-path")?.trim();
      const uploadFileName = headers.get("x-shortpulse-upload-filename")?.trim();
      return {
        ok: true,
        json: async () => ({
          url:
            payload.fileUrl ??
            (uploadPath
              ? `https://tempfile.aiquickdraw.com/${uploadPath}/${uploadFileName ?? "upload.png"}`
              : ""),
        }),
      } as Response;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("passes selected resolution through the Kie Kling standard payload", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      videoReferenceMode: "standard",
      requestedResolution: "720p",
      requestedDurationSeconds: 14,
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        aspect_ratio: "16:9",
        duration: 14,
        resolution: "720p",
        mode: "std",
        sound: true,
        multi_shots: false,
      })
    );
    expect(args.startPollingWithGeneration).toHaveBeenCalledWith(
      "kie-kling-std-1",
      "kie-kling",
      undefined,
      { request_id: "kie-kling-std-1" }
    );
  });

  it("builds multi-shot and element payloads for Kie Kling standard submits", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      videoReferenceMode: "standard",
      requestedResolution: "1080p",
      requestedAudio: false,
      klingWorkflowMode: "custom",
      preparedImageInputs: ["https://example.com/start.png", "https://example.com/end.png"],
      klingMultiPrompts: [
        { id: "shot-1", prompt: "First shot", duration: 5 },
        { id: "shot-2", prompt: "Second shot", duration: 7 },
      ],
      klingElements: [
        {
          id: "element-1",
          slotIndex: 0,
          name: "Red Lantern",
          alias: "redlantern",
          frontalImageUrl: "https://example.com/element-a.png",
          referenceImageUrls: "https://example.com/element-b.png",
          videoUrl: "",
        },
        {
          id: "element-2",
          slotIndex: 1,
          name: "Steam Train",
          alias: "steamtrain",
          frontalImageUrl: "",
          referenceImageUrls: "",
          videoUrl: "https://example.com/element-video.mp4",
        },
      ],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "First shot @element1 @element2",
        image_urls: ["https://example.com/start.png"],
        aspect_ratio: "16:9",
        resolution: "1080p",
        mode: "pro",
        generate_audio: true,
        sound: true,
        multi_shots: true,
        multi_prompt: [
          { prompt: "First shot @element1 @element2", duration: 5 },
          { prompt: "Second shot @element1 @element2", duration: 7 },
        ],
        kling_elements: [
          {
            name: "element1",
            description: "Reference images for Red Lantern",
            element_input_urls: [
              "https://example.com/element-a.png",
              "https://example.com/element-b.png",
            ],
          },
          {
            name: "element2",
            description: "Reference video for Steam Train",
            element_input_video_urls: ["https://example.com/element-video.mp4"],
          },
        ],
      })
    );
  });

  it("keeps Single mode isolated from stale custom-shot prompts", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      videoReferenceMode: "standard",
      klingWorkflowMode: "single",
      cleanedPrompt: "One clean single-shot prompt",
      preparedImageInputs: ["https://example.com/start.png", "https://example.com/end.png"],
      klingMultiPrompts: [
        { id: "shot-1", prompt: "Stale custom shot one", duration: 5 },
        { id: "shot-2", prompt: "Stale custom shot two", duration: 7 },
      ],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "One clean single-shot prompt",
        image_urls: ["https://example.com/start.png", "https://example.com/end.png"],
        multi_shots: false,
        multi_prompt: undefined,
      })
    );
  });

  it("auto-appends attached saved element name tokens to single-shot Kling prompts", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      videoReferenceMode: "standard",
      cleanedPrompt: "the woman walks into the scene",
      preparedImageInputs: ["https://example.com/start.png"],
      klingElements: [
        {
          id: "element-1",
          slotIndex: 0,
          name: "Taylor",
          alias: "taylor",
          frontalImageUrl: "https://example.com/taylor-front.png",
          referenceImageUrls: "https://example.com/taylor-side.png",
          videoUrl: "",
        },
      ],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "the woman walks into the scene @element1",
        kling_elements: [
          {
            name: "element1",
            description: "Reference images for Taylor",
            element_input_urls: [
              "https://example.com/taylor-front.png",
              "https://example.com/taylor-side.png",
            ],
          },
        ],
      })
    );
  });

  it("rewrites legacy element aliases to canonical slot tokens for Kling prompts", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      videoReferenceMode: "standard",
      cleanedPrompt: "the woman walks into the scene with @legacylamp",
      preparedImageInputs: ["https://example.com/start.png"],
      klingElements: [
        {
          id: "element-1",
          slotIndex: 0,
          sourceKind: "element",
          name: "Red Lantern",
          alias: "legacylamp",
          frontalImageUrl: "https://example.com/red-lantern-front.png",
          referenceImageUrls: "https://example.com/red-lantern-side.png",
          videoUrl: "",
        },
      ],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "the woman walks into the scene with @element1",
        kling_elements: [
          {
            name: "element1",
            description: "Reference images for Red Lantern",
            element_input_urls: [
              "https://example.com/red-lantern-front.png",
              "https://example.com/red-lantern-side.png",
            ],
          },
        ],
      })
    );
  });

  it("derives attached character tokens from the character name when alias is absent", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      videoReferenceMode: "standard",
      cleanedPrompt: "the woman walks into the scene",
      preparedImageInputs: ["https://example.com/start.png"],
      klingElements: [
        {
          id: "character-1",
          slotIndex: 0,
          sourceKind: "character",
          sourceCharacterId: "character-taylor",
          name: "Taylor Swift",
          alias: "",
          frontalImageUrl: "https://example.com/taylor-front.png",
          referenceImageUrls: "https://example.com/taylor-side.png",
          videoUrl: "",
        },
      ],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "the woman walks into the scene @element1",
        kling_elements: [
          {
            name: "element1",
            description: "Reference images for Taylor Swift",
            element_input_urls: [
              "https://example.com/taylor-front.png",
              "https://example.com/taylor-side.png",
            ],
          },
        ],
      })
    );
  });

  it("submits Kling motion-control without standard-video aspect fields", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      videoReferenceMode: "motion",
      aspect: "9:16",
      videoReferenceImageUrl: "https://example.com/character.png",
      motionReferenceVideoUrl: "https://example.com/motion.mp4",
      preparedImageInputs: ["https://example.com/character.png"],
      requestedResolution: "720p",
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: "720p",
        image_url: "https://example.com/character.png",
        video_url: "https://example.com/motion.mp4",
      })
    );
    expect(submitKieKlingImageToVideo).not.toHaveBeenCalledWith(
      expect.objectContaining({
        aspect_ratio: expect.any(String),
      })
    );
  });

  it("refreshes signed Kling element media before submit", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const expSoon = Math.floor(Date.now() / 1000) + 60;
    const payload = Buffer.from(
      JSON.stringify({
        url: "media_library/user-1/elements/taylor/front.png",
        exp: expSoon,
      })
    ).toString("base64url");
    const token = `header.${payload}.sig`;
    const signedUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/elements/taylor/front.png" +
      `?token=${token}`;
    vi.mocked(getSignedMediaUrl).mockResolvedValueOnce(
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/elements/taylor/front.png?token=fresh"
    );
    const fetchMock = vi.mocked(fetch);
    vi.mocked(fetchWithAuth).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        url: "https://tempfile.aiquickdraw.com/shortpulse/kling-elements/images/taylor-front.png",
      }),
    } as Response);

    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      videoReferenceMode: "standard",
      cleanedPrompt: "the woman walks into the scene",
      preparedImageInputs: ["https://example.com/start.png"],
      klingElements: [
        {
          id: "element-1",
          slotIndex: 0,
          name: "Taylor",
          alias: "taylor",
          frontalImageUrl: signedUrl,
          referenceImageUrls: "",
          videoUrl: "",
        },
      ],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(getSignedMediaUrl).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/elements/taylor/front.png",
      forceRefresh: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/elements/taylor/front.png?token=fresh"
    );
    expect(fetchWithAuth).toHaveBeenCalledWith(
      "/api/kie/upload-url",
      expect.objectContaining({
        method: "POST",
        body: expect.any(Blob),
        headers: expect.objectContaining({
          "x-shortpulse-upload-path": "shortpulse/kie-video/images",
        }),
      })
    );
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        kling_elements: [
          {
            name: "element1",
            description: "Reference images for Taylor",
            element_input_urls: [
              "https://tempfile.aiquickdraw.com/shortpulse/kling-elements/images/taylor-front.png",
            ],
          },
        ],
      })
    );
  });

  it("uploads signed Seedance multimodal reference images through the binary Kie path", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const expSoon = Math.floor(Date.now() / 1000) + 60;
    const payload = Buffer.from(
      JSON.stringify({
        url: "media_library/user-1/references/red-lantern-front.png",
        exp: expSoon,
      })
    ).toString("base64url");
    const token = `header.${payload}.sig`;
    const signedReferenceUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/references/red-lantern-front.png" +
      `?token=${token}`;
    const fetchMock = vi.mocked(fetch);

    const args = makeArgs({
      finalModel: KIE_SEEDANCE_2_MODEL_ID,
      modelConfig: getModelConfig(KIE_SEEDANCE_2_MODEL_ID),
      cleanedPrompt: "Direct @redlantern through the square",
      preparedImageInputs: [],
      requestedDurationSeconds: 15,
      requestedResolution: "1080p",
      requestedAudio: true,
      videoReferenceMode: "standard",
      seedance2InputMode: "multimodal",
      seedance2ReferenceImageUrls: [signedReferenceUrl],
      klingElements: [],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(signedReferenceUrl);
    expect(fetchWithAuth).toHaveBeenCalledWith(
      "/api/kie/upload-url",
      expect.objectContaining({
        method: "POST",
        body: expect.any(Blob),
        headers: expect.objectContaining({
          "x-shortpulse-upload-path": "shortpulse/kie-video/images",
        }),
      })
    );
    expect(submitKieSeedance2Video).toHaveBeenCalledWith(
      expect.objectContaining({
        reference_image_urls: [
          expect.stringContaining("https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/"),
        ],
      })
    );
  });

  it("uploads non-Supabase signed Seedance references through the binary Kie path", async () => {
    const signedReferenceUrl =
      "https://cdn.example.com/red-lantern-front.png?X-Amz-Signature=test-signature&X-Amz-Security-Token=session-token";
    const fetchMock = vi.mocked(fetch);

    const args = makeArgs({
      finalModel: KIE_SEEDANCE_2_MODEL_ID,
      modelConfig: getModelConfig(KIE_SEEDANCE_2_MODEL_ID),
      cleanedPrompt: "Direct @redlantern through the square",
      preparedImageInputs: [],
      requestedDurationSeconds: 15,
      requestedResolution: "1080p",
      requestedAudio: true,
      videoReferenceMode: "standard",
      seedance2InputMode: "multimodal",
      seedance2ReferenceImageUrls: [signedReferenceUrl],
      klingElements: [],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(signedReferenceUrl);
    expect(fetchWithAuth).toHaveBeenCalledWith(
      "/api/kie/upload-url",
      expect.objectContaining({
        method: "POST",
        body: expect.any(Blob),
        headers: expect.objectContaining({
          "x-shortpulse-upload-path": "shortpulse/kie-video/images",
        }),
      })
    );
    expect(submitKieSeedance2Video).toHaveBeenCalledWith(
      expect.objectContaining({
        reference_image_urls: [
          expect.stringContaining("https://tempfile.aiquickdraw.com/shortpulse/kie-video/images/"),
        ],
      })
    );
  });

  it("uploads Kling element reference images to Kie temporary storage before submit", async () => {
    vi.mocked(fetchWithAuth)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://tempfile.aiquickdraw.com/shortpulse/kling-elements/images/taylor-front.png",
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          url: "https://tempfile.aiquickdraw.com/shortpulse/kling-elements/images/taylor-side.png",
        }),
      } as Response);

    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      videoReferenceMode: "standard",
      cleanedPrompt: "the woman walks into the scene",
      preparedImageInputs: ["https://example.com/start.png"],
      klingElements: [
        {
          id: "element-1",
          slotIndex: 0,
          name: "Taylor",
          alias: "taylor",
          frontalImageUrl: "https://example.com/taylor-front.png",
          referenceImageUrls: "https://example.com/taylor-side.png",
          videoUrl: "",
        },
      ],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(fetchWithAuth).toHaveBeenCalledTimes(2);
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        kling_elements: [
          {
            name: "element1",
            description: "Reference images for Taylor",
            element_input_urls: [
              "https://tempfile.aiquickdraw.com/shortpulse/kling-elements/images/taylor-front.png",
              "https://tempfile.aiquickdraw.com/shortpulse/kling-elements/images/taylor-side.png",
            ],
          },
        ],
      })
    );
  });

  it("keeps Multi mode on the single-shot route while still sending optional last frame", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      videoReferenceMode: "standard",
      klingWorkflowMode: "multi",
      cleanedPrompt: "Scene one shifts into scene two with @redlantern throughout.",
      preparedImageInputs: ["https://example.com/start.png", "https://example.com/end.png"],
      klingElements: [
        {
          id: "element-1",
          slotIndex: 0,
          name: "Red Lantern",
          alias: "redlantern",
          frontalImageUrl: "https://example.com/element-a.png",
          referenceImageUrls: "",
          videoUrl: "",
        },
      ],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Scene one shifts into scene two with @element1 throughout.",
        image_urls: ["https://example.com/start.png", "https://example.com/end.png"],
        multi_shots: false,
        multi_prompt: undefined,
        kling_elements: [
          {
            name: "element1",
            description: "Reference images for Red Lantern",
            element_input_urls: ["https://example.com/element-a.png"],
          },
        ],
      })
    );
  });
});

describe("handleVideoModelSubmission (retired Fal video routes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does not own retired Fal video model ids", async () => {
    const retiredModelIds = [
      "fal-ai/kling-video/v3/pro/image-to-video",
      "fal-ai/kling-video/v3/pro/text-to-video",
      "fal-ai/veo3.1/image-to-video",
      "fal-ai/veo3.1/first-last-frame-to-video",
      "fal-ai/veo3.1",
      "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
      "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    ];

    for (const finalModel of retiredModelIds) {
      const args = makeArgs({
        finalModel,
        modelConfig: getModelConfig(finalModel),
        videoReferenceMode: "standard",
        preparedImageInputs: [],
        videoReferenceImageUrl: null,
        motionReferenceVideoUrl: null,
      });

      await expect(handleVideoModelSubmission(args)).resolves.toBe(false);
      expect(args.notifyGenerationFailure).not.toHaveBeenCalled();
    }
  });
});
