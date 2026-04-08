import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoSubmissionArgs } from "../types";
import { getModelConfig } from "../../../logic/pricing";
import { handleVideoModelSubmission } from "../videoHandlers";
import {
  submitKieKlingImageToVideo,
  submitKieSeedanceVideo,
  submitKieVeoImageToVideo,
} from "../../../../../lib/falClient";
import { fetchWithAuth } from "../../../../../lib/authenticatedFetch";
import { getSignedMediaUrl } from "../../../../../lib/mediaSignedUrlCache";
import {
  KIE_KLING_30_MODEL_ID,
  KIE_SEEDANCE_15_PRO_MODEL_ID,
  KIE_VEO_31_FAST_I2V_MODEL_ID,
} from "../../../../../lib/model-runtime/providerModelIds";

vi.mock("../../../../../lib/falClient", () => ({
  submitKieKlingImageToVideo: vi.fn(),
  submitKieSeedanceVideo: vi.fn(),
  submitKieVeoImageToVideo: vi.fn(),
  submitFalSeedance: vi.fn(),
  submitFalSeedanceI2V: vi.fn(),
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
  videoAutoFix: false,
  videoCameraFixed: false,
  klingNegativePrompt: "blur",
  klingCfgScale: 0.5,
  klingWorkflowMode: "single",
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
      aspect_ratio: "16:9",
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

  it("submits single-image payload in standard mode with first/last generation type", async () => {
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
      generation_type: "FIRST_AND_LAST_FRAMES_2_VIDEO",
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

  it("submits prompt-only payload when Kie Veo is used without frame images", async () => {
    const args = makeArgs({
      finalModel: KIE_VEO_31_FAST_I2V_MODEL_ID,
      modelConfig: getModelConfig(KIE_VEO_31_FAST_I2V_MODEL_ID),
      videoReferenceMode: "standard",
      preparedImageInputs: [],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieVeoImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        image_url: undefined,
        image_urls: [],
        generation_type: "TEXT_2_VIDEO",
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

describe("handleVideoModelSubmission (Kie Seedance 1.5 Pro)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(submitKieSeedanceVideo).mockResolvedValue({ request_id: "kie-seedance-1" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("submits prompt-only Seedance payloads when no frame images are present", async () => {
    const args = makeArgs({
      finalModel: KIE_SEEDANCE_15_PRO_MODEL_ID,
      modelConfig: getModelConfig(KIE_SEEDANCE_15_PRO_MODEL_ID),
      preparedImageInputs: [],
      requestedDurationSeconds: 5,
      requestedResolution: "1080p",
      aspect: "21:9",
      videoReferenceMode: "standard",
      videoCameraFixed: true,
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieSeedanceVideo).toHaveBeenCalledWith({
      prompt: "A dancer twirls",
      input_urls: [],
      aspect_ratio: "21:9",
      duration: "8",
      resolution: "1080p",
      fixed_lens: true,
      generate_audio: true,
    });
    expect(args.startPollingWithGeneration).toHaveBeenCalledWith(
      "kie-seedance-1",
      "kie-seedance",
      undefined,
      { request_id: "kie-seedance-1" }
    );
  });

  it("submits one or two input URLs for Seedance image lanes", async () => {
    const args = makeArgs({
      finalModel: KIE_SEEDANCE_15_PRO_MODEL_ID,
      modelConfig: getModelConfig(KIE_SEEDANCE_15_PRO_MODEL_ID),
      preparedImageInputs: ["https://example.com/first.png", "https://example.com/last.png"],
      requestedDurationSeconds: 12,
      requestedResolution: "480p",
      aspect: "9:16",
      requestedAudio: false,
      videoReferenceMode: "standard",
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitKieSeedanceVideo).toHaveBeenCalledWith({
      prompt: "A dancer twirls",
      input_urls: ["https://example.com/first.png", "https://example.com/last.png"],
      aspect_ratio: "9:16",
      duration: "12",
      resolution: "480p",
      fixed_lens: false,
      generate_audio: false,
    });
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
        prompt: "First shot @redlantern @steamtrain",
        image_urls: ["https://example.com/start.png"],
        aspect_ratio: "16:9",
        resolution: "1080p",
        mode: "pro",
        generate_audio: true,
        sound: true,
        multi_shots: true,
        multi_prompt: [
          { prompt: "First shot @redlantern @steamtrain", duration: 5 },
          { prompt: "Second shot @redlantern @steamtrain", duration: 7 },
        ],
        kling_elements: [
          {
            name: "redlantern",
            description: "Reference images for Red Lantern",
            element_input_urls: [
              "https://example.com/element-a.png",
              "https://example.com/element-b.png",
            ],
          },
          {
            name: "steamtrain",
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

  it("auto-appends attached saved element aliases to single-shot Kling prompts", async () => {
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
        prompt: "the woman walks into the scene @taylor",
        kling_elements: [
          {
            name: "taylor",
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
        prompt: "the woman walks into the scene @taylorswift",
        kling_elements: [
          {
            name: "taylorswift",
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

  it("passes the selected aspect ratio through Kie Kling motion-control submits", async () => {
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
        aspect_ratio: "9:16",
        resolution: "720p",
        image_url: "https://example.com/character.png",
        video_url: "https://example.com/motion.mp4",
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
      "https://example.com/refreshed-taylor-front.png"
    );

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
    expect(submitKieKlingImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        kling_elements: [
          {
            name: "taylor",
            description: "Reference images for Taylor",
            element_input_urls: ["https://example.com/refreshed-taylor-front.png"],
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
        prompt: "Scene one shifts into scene two with @redlantern throughout.",
        image_urls: ["https://example.com/start.png", "https://example.com/end.png"],
        multi_shots: false,
        multi_prompt: undefined,
        kling_elements: [
          {
            name: "redlantern",
            description: "Reference images for Red Lantern",
            element_input_urls: ["https://example.com/element-a.png"],
          },
        ],
      })
    );
  });
});

describe("handleVideoModelSubmission (disabled Fal Kling routes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails closed for legacy Fal Kling image-to-video submits", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/kling-video/v3/pro/image-to-video",
      modelConfig: getModelConfig("fal-ai/kling-video/v3/pro/image-to-video"),
      videoReferenceMode: "standard",
      preparedImageInputs: ["https://example.com/start.png", "https://example.com/end.png"],
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Fal Kling 3.0 is disabled. Use Kie Kling 3.0 instead."
    );
  });

  it("fails closed for legacy Fal Kling text-to-video submits", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/kling-video/v3/pro/text-to-video",
      modelConfig: getModelConfig("fal-ai/kling-video/v3/pro/text-to-video"),
      videoReferenceMode: "standard",
      preparedImageInputs: [],
      videoReferenceImageUrl: null,
      motionReferenceVideoUrl: null,
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Fal Kling 3.0 is disabled. Use Kie Kling 3.0 instead."
    );
  });
});

describe("handleVideoModelSubmission (disabled Fal Veo routes)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails closed for legacy Fal Veo image-to-video submits", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/veo3.1/image-to-video",
      modelConfig: getModelConfig("fal-ai/veo3.1/image-to-video"),
      preparedImageInputs: ["https://example.com/reference.png"],
      videoReferenceMode: "standard",
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Fal Veo 3.1 is disabled. Use Kie Veo 3.1 instead."
    );
  });

  it("fails closed for legacy Fal Veo first-last submits", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/veo3.1/first-last-frame-to-video",
      modelConfig: getModelConfig("fal-ai/veo3.1/first-last-frame-to-video"),
      preparedImageInputs: ["https://example.com/start.png", "https://example.com/end.png"],
      videoReferenceMode: "standard",
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Fal Veo 3.1 is disabled. Use Kie Veo 3.1 instead."
    );
  });

  it("fails closed for legacy Fal Veo text submits", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/veo3.1",
      modelConfig: getModelConfig("fal-ai/veo3.1"),
      preparedImageInputs: [],
      videoReferenceImageUrl: null,
      motionReferenceVideoUrl: null,
      videoReferenceMode: "standard",
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Fal Veo 3.1 is disabled. Use Kie Veo 3.1 instead."
    );
  });
});

describe("handleVideoModelSubmission (Fal Seedance text-to-video)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fails closed for legacy Fal Seedance text-to-video submits", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
      modelConfig: getModelConfig("fal-ai/bytedance/seedance/v1.5/pro/text-to-video"),
      aspect: "21:9",
      requestedDurationSeconds: 12,
      requestedResolution: "720p",
      requestedAudio: true,
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Fal-hosted video generation is disabled. Use Kie Veo 3.1, Kie Kling 3.0, or Kie Seedance 1.5 instead."
    );
  });

  it("fails closed for legacy Fal Seedance image-to-video submits", async () => {
    const args = makeArgs({
      finalModel: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
      modelConfig: getModelConfig("fal-ai/bytedance/seedance/v1.5/pro/image-to-video"),
      preparedImageInputs: ["https://example.com/reference.png"],
      videoReferenceMode: "standard",
    });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      "Fal-hosted video generation is disabled. Use Kie Veo 3.1, Kie Kling 3.0, or Kie Seedance 1.5 instead."
    );
  });
});
