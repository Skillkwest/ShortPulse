import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoSubmissionArgs } from "../types";
import { getModelConfig } from "../../../logic/pricing";
import { handleVideoModelSubmission } from "../videoHandlers";
import {
  submitFalKlingV3ImageToVideo,
  submitFalVeoImageToVideo,
  submitKieKlingImageToVideo,
  submitKieVeoImageToVideo,
} from "../../../../../lib/falClient";
import { fetchWithAuth } from "../../../../../lib/authenticatedFetch";
import { getSignedMediaUrl } from "../../../../../lib/mediaSignedUrlCache";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../../lib/model-runtime/providerModelIds";

vi.mock("../../../../../lib/falClient", () => ({
  submitFalKlingV3ImageToVideo: vi.fn(),
  submitKieKlingImageToVideo: vi.fn(),
  submitKieVeoImageToVideo: vi.fn(),
  submitFalKlingV3Text: vi.fn(),
  submitFalSeedance: vi.fn(),
  submitFalSeedanceI2V: vi.fn(),
  submitFalSoraPro: vi.fn(),
  submitFalVeo: vi.fn(),
  submitFalVeoFirstLast: vi.fn(),
  submitFalVeoImageToVideo: vi.fn(),
}));

vi.mock("../../../../../lib/authenticatedFetch", () => ({
  fetchWithAuth: vi.fn(),
}));
vi.mock("../../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: vi.fn(),
}));

const makeArgs = (overrides: Partial<VideoSubmissionArgs> = {}): VideoSubmissionArgs => ({
  id: "out-1",
  finalModel: "fal-ai/kling-video/v3/pro/image-to-video",
  cleanedPrompt: "A dancer twirls",
  aspect: "16:9",
  requestedDurationSeconds: 6,
  requestedResolution: "1080p",
  requestedAudio: true,
  preparedImageInputs: ["https://example.com/character.png"],
  modelConfig: getModelConfig("fal-ai/kling-video/v3/pro/image-to-video"),
  notifyGenerationFailure: vi.fn(),
  updateOutputById: vi.fn(),
  startPollingWithGeneration: vi.fn(),
  videoReferenceMode: "motion",
  videoReferenceImageUrl: "https://example.com/character.png",
  motionReferenceVideoUrl: "https://example.com/motion.mp4",
  videoAutoFix: false,
  videoCameraFixed: false,
  klingNegativePrompt: "blur",
  klingCfgScale: 0.5,
  klingShotType: "customize",
  klingVoiceIds: ["", ""],
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

  it("builds and submits a motion payload with normalized prompt/duration/aspect", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
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
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: "720p",
        mode: "720p",
      })
    );
  });

  it("uploads blob motion video before submitting and updates timestamps", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      cleanedPrompt: "Already tagged @Element1",
      motionReferenceVideoUrl: "blob:video-123",
    });

    const blob = new Blob(["video"], { type: "video/mp4" });
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      blob: async () => blob,
    } as Response);
    vi.mocked(fetchWithAuth).mockResolvedValue({
      ok: true,
      json: async () => ({
        url: "https://cdn.example.com/motion.mp4",
        path: "user-1/videos/motion.mp4",
        size: blob.size,
      }),
    } as Response);

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith("blob:video-123");
    expect(fetchWithAuth).toHaveBeenCalledWith(
      "/api/upload-video",
      expect.objectContaining({ method: "POST" })
    );
    expect(args.updateOutputById).toHaveBeenCalled();
    expect(args.updateOutputById).toHaveBeenCalledWith("out-1", expect.any(Function));
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Already tagged @Element1",
        resolution: "1080p",
        mode: "1080p",
        video_urls: ["https://cdn.example.com/motion.mp4"],
      })
    );
  });

  it("uploads localhost motion video urls before submitting to Kie", async () => {
    const args = makeArgs({
      finalModel: KIE_KLING_30_MODEL_ID,
      modelConfig: getModelConfig(KIE_KLING_30_MODEL_ID),
      motionReferenceVideoUrl: "http://localhost:3000/local-motion.mp4",
    });

    const blob = new Blob(["video"], { type: "video/mp4" });
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      blob: async () => blob,
    } as Response);
    vi.mocked(fetchWithAuth).mockResolvedValue({
      ok: true,
      json: async () => ({
        url: "https://cdn.example.com/motion-uploaded.mp4",
        path: "user-1/videos/motion-uploaded.mp4",
        size: blob.size,
      }),
    } as Response);

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith("http://localhost:3000/local-motion.mp4");
    expect(fetchWithAuth).toHaveBeenCalledWith(
      "/api/upload-video",
      expect.objectContaining({ method: "POST" })
    );
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        video_urls: ["https://cdn.example.com/motion-uploaded.mp4"],
      })
    );
  });

  it("fails gracefully when blob upload fails", async () => {
    const args = makeArgs({ motionReferenceVideoUrl: "blob:video-456" });

    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network failure"));

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Video upload failed: network failure"
    );
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
    vi.restoreAllMocks();
  });

  it("submits first+last frame payload in keyframes mode", async () => {
    const args = makeArgs({
      finalModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
      modelConfig: getModelConfig(KIE_VEO_31_FAST_I2V_MODEL_ID),
      videoReferenceMode: "keyframes",
      preparedImageInputs: ["https://example.com/first.png", "https://example.com/last.png"],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieVeoImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: "https://example.com/first.png",
        image_urls: ["https://example.com/first.png", "https://example.com/last.png"],
        generation_type: "FIRST_AND_LAST_FRAMES_2_VIDEO",
      })
    );
  });

  it("submits single-image payload in standard mode with reference generation type", async () => {
    vi.mocked(submitKieVeoImageToVideo).mockResolvedValue({ request_id: "req-kie-veo-standard" });

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
      image_url: "https://example.com/first.png",
      image_urls: ["https://example.com/first.png"],
      generation_type: "REFERENCE_2_VIDEO",
      aspect_ratio: "16:9",
      duration: 5,
      resolution: "720p",
      generate_audio: true,
    });
  });

  it("promotes Kie Veo standard mode to first+last when two frames are present", async () => {
    vi.mocked(submitKieVeoImageToVideo).mockResolvedValue({ request_id: "req-kie-veo-dual" });

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
        image_url: "https://example.com/first.png",
        image_urls: ["https://example.com/first.png", "https://example.com/last.png"],
        generation_type: "FIRST_AND_LAST_FRAMES_2_VIDEO",
      })
    );
  });

  it("fails when keyframes mode does not provide both frames", async () => {
    const args = makeArgs({
      finalModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
      modelConfig: getModelConfig(KIE_VEO_31_FAST_I2V_MODEL_ID),
      videoReferenceMode: "keyframes",
      preparedImageInputs: ["https://example.com/only-first.png"],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Kie Veo 3.1 Fast I2V keyframes mode requires both first and last frame images."
    );
    expect(submitKieVeoImageToVideo).not.toHaveBeenCalled();
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

describe("handleVideoModelSubmission (Kie Kling standard)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(submitKieKlingImageToVideo).mockResolvedValue({ request_id: "kie-kling-std-1" });
  });

  afterEach(() => {
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
      preparedImageInputs: ["https://example.com/start.png", "https://example.com/end.png"],
      klingMultiPrompts: [
        { id: "shot-1", prompt: "First shot", duration: 5 },
        { id: "shot-2", prompt: "Second shot", duration: 7 },
      ],
      klingElements: [
        {
          id: "element-1",
          frontalImageUrl: "https://example.com/element-a.png",
          referenceImageUrls: "https://example.com/element-b.png",
          videoUrl: "",
        },
        {
          id: "element-2",
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
        image_urls: ["https://example.com/start.png"],
        resolution: "1080p",
        mode: "pro",
        generate_audio: true,
        sound: true,
        multi_shots: true,
        multi_prompt: [
          { prompt: "First shot", duration: 5 },
          { prompt: "Second shot", duration: 7 },
        ],
        kling_elements: [
          {
            name: "Element01",
            description: "Reference images for Element01",
            element_input_urls: [
              "https://example.com/element-a.png",
              "https://example.com/element-b.png",
            ],
          },
          {
            name: "Element02",
            description: "Reference video for Element02",
            element_input_video_urls: ["https://example.com/element-video.mp4"],
          },
        ],
      })
    );
  });
});

describe("handleVideoModelSubmission (Kling 3 non-motion element videos)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(submitFalKlingV3ImageToVideo).mockResolvedValue({ request_id: "req-456" });
    vi.mocked(getSignedMediaUrl).mockResolvedValue(
      "https://example.com/signed/element-video-refreshed.mp4"
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes expiring Kling element video URLs before submit", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const expSoon = Math.floor(Date.now() / 1000) + 60;
    const payload = Buffer.from(
      JSON.stringify({
        url: "media_library/user-1/videos/element.mp4",
        exp: expSoon,
      })
    ).toString("base64url");
    const token = `header.${payload}.sig`;
    const signedElementVideoUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/element.mp4" +
      `?token=${token}`;
    const args = makeArgs({
      videoReferenceMode: "kling3",
      motionReferenceVideoUrl: null,
      klingElements: [
        {
          id: "element-1",
          frontalImageUrl: "",
          referenceImageUrls: "",
          videoUrl: signedElementVideoUrl,
        },
      ],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(getSignedMediaUrl).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/videos/element.mp4",
      forceRefresh: true,
    });
    expect(submitFalKlingV3ImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        resolution: "1080p",
        elements: [{ video_url: "https://example.com/signed/element-video-refreshed.mp4" }],
      })
    );
  });

  it("fails gracefully when Kling element video URL refresh fails", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const expSoon = Math.floor(Date.now() / 1000) + 60;
    const payload = Buffer.from(
      JSON.stringify({
        url: "media_library/user-1/videos/element.mp4",
        exp: expSoon,
      })
    ).toString("base64url");
    const token = `header.${payload}.sig`;
    const signedElementVideoUrl =
      "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/videos/element.mp4" +
      `?token=${token}`;
    vi.mocked(getSignedMediaUrl).mockResolvedValueOnce(null);
    const args = makeArgs({
      videoReferenceMode: "kling3",
      motionReferenceVideoUrl: null,
      klingElements: [
        {
          id: "element-1",
          frontalImageUrl: "",
          referenceImageUrls: "",
          videoUrl: signedElementVideoUrl,
        },
      ],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      expect.stringContaining("Kling element reference preparation failed")
    );
    expect(submitFalKlingV3ImageToVideo).not.toHaveBeenCalled();
  });

  it("passes end frame, intelligent shot type, voices, and image elements for Fal Kling standard submits", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/kling-video/v3/pro/image-to-video",
      modelConfig: getModelConfig("fal-ai/kling-video/v3/pro/image-to-video"),
      videoReferenceMode: "standard",
      requestedDurationSeconds: 9,
      requestedResolution: "720p",
      requestedAudio: true,
      preparedImageInputs: ["https://example.com/start.png", "https://example.com/end.png"],
      klingShotType: "intelligent",
      klingVoiceIds: [" voice_a ", "voice_b"],
      klingNegativePrompt: "bad anatomy, blur",
      klingCfgScale: 0.9,
      klingMultiPrompts: [
        { id: "shot-1", prompt: " First beat ", duration: 5 },
        { id: "shot-2", prompt: "Second beat", duration: 8 },
      ],
      klingElements: [
        {
          id: "element-1",
          frontalImageUrl: " https://example.com/front.png ",
          referenceImageUrls: "https://example.com/ref-a.png,\nhttps://example.com/ref-b.png",
          videoUrl: "",
        },
      ],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitFalKlingV3ImageToVideo).toHaveBeenCalledWith({
      prompt: "A dancer twirls",
      start_image_url: "https://example.com/start.png",
      end_image_url: "https://example.com/end.png",
      duration: 9,
      aspect_ratio: "16:9",
      resolution: "720p",
      negative_prompt: "bad anatomy, blur",
      cfg_scale: 0.9,
      generate_audio: true,
      voice_ids: ["voice_a", "voice_b"],
      multi_prompt: [
        { prompt: "First beat", duration: 5 },
        { prompt: "Second beat", duration: 8 },
      ],
      shot_type: "intelligent",
      elements: [
        {
          frontal_image_url: "https://example.com/front.png",
          reference_image_urls: ["https://example.com/ref-a.png", "https://example.com/ref-b.png"],
        },
      ],
    });
  });
});

describe("handleVideoModelSubmission (Fal Veo 3.1 image-to-video)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(submitFalVeoImageToVideo).mockResolvedValue({ request_id: "veo-i2v-1" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits the normalized Veo image-to-video payload with a primary image reference", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/veo3.1/image-to-video",
      modelConfig: getModelConfig("fal-ai/veo3.1/image-to-video"),
      aspect: "4:5",
      requestedDurationSeconds: 7,
      requestedResolution: "4k",
      requestedAudio: true,
      preparedImageInputs: ["https://example.com/reference.png"],
      videoReferenceMode: "standard",
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitFalVeoImageToVideo).toHaveBeenCalledWith({
      prompt: "A dancer twirls",
      image_url: "https://example.com/reference.png",
      image_urls: ["https://example.com/reference.png"],
      aspect_ratio: "auto",
      duration: "8s",
      resolution: "4k",
      generate_audio: true,
      auto_fix: false,
      enable_safety_checker: false,
      safety_tolerance: 5,
    });
    expect(args.startPollingWithGeneration).toHaveBeenCalledWith(
      "veo-i2v-1",
      "fal-veo-i2v",
      undefined,
      { request_id: "veo-i2v-1" }
    );
  });

  it("fails when Veo image-to-video is submitted without a prepared reference image", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/veo3.1/image-to-video",
      modelConfig: getModelConfig("fal-ai/veo3.1/image-to-video"),
      preparedImageInputs: [],
      videoReferenceImageUrl: null,
      motionReferenceVideoUrl: null,
      videoReferenceMode: "standard",
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Veo 3.1 image-to-video requires a reference image."
    );
    expect(submitFalVeoImageToVideo).not.toHaveBeenCalled();
  });
});
