import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VideoSubmissionArgs } from "../types";
import { getModelConfig } from "../../../logic/pricing";
import { handleVideoModelSubmission } from "../videoHandlers";
import { submitFalKlingV3ImageToVideo } from "../../../../../lib/falClient";
import { fetchWithAuth } from "../../../../../lib/authenticatedFetch";
import { getSignedMediaUrl } from "../../../../../lib/mediaSignedUrlCache";

vi.mock("../../../../../lib/falClient", () => ({
  submitFalKlingV3ImageToVideo: vi.fn(),
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
    vi.mocked(submitFalKlingV3ImageToVideo).mockResolvedValue({ request_id: "req-123" });
    vi.mocked(getSignedMediaUrl).mockResolvedValue(
      "https://example.com/signed/motion-refreshed.mp4"
    );
  });

  it("builds and submits a motion payload with normalized prompt/duration/aspect", async () => {
    const args = makeArgs();

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(submitFalKlingV3ImageToVideo).toHaveBeenCalledWith({
      prompt: "A dancer twirls @Element1",
      start_image_url: "https://example.com/character.png",
      duration: 6,
      aspect_ratio: "16:9",
      negative_prompt: "blur",
      cfg_scale: 0.5,
      generate_audio: true,
      elements: [
        {
          video_url: "https://example.com/motion.mp4",
          frontal_image_url: "https://example.com/character.png",
        },
      ],
    });
    expect(args.startPollingWithGeneration).toHaveBeenCalledWith(
      "req-123",
      "fal-kling-3",
      {
        previewUrl: "https://example.com/character.png",
      },
      {
        request_id: "req-123",
      }
    );
  });

  it("uploads blob motion video before submitting and updates timestamps", async () => {
    const args = makeArgs({
      cleanedPrompt: "Already tagged @Element1",
      motionReferenceVideoUrl: "blob:video-123",
    });

    const blob = new Blob(["video"], { type: "video/mp4" });
    vi.spyOn(global, "fetch").mockResolvedValue({
      blob: async () => blob,
    } as Response);
    vi.mocked(fetchWithAuth).mockResolvedValue({
      ok: true,
      json: async () => ({ url: "https://cdn.example.com/motion.mp4" }),
    } as Response);

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(global.fetch).toHaveBeenCalledWith("blob:video-123");
    expect(fetchWithAuth).toHaveBeenCalledWith(
      "/api/upload-video",
      expect.objectContaining({ method: "POST" })
    );
    expect(args.updateOutputById).toHaveBeenCalledTimes(2);
    expect(submitFalKlingV3ImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: "Already tagged @Element1",
        elements: [
          {
            video_url: "https://cdn.example.com/motion.mp4",
            frontal_image_url: "https://example.com/character.png",
          },
        ],
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
    expect(submitFalKlingV3ImageToVideo).not.toHaveBeenCalled();
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
    const args = makeArgs({ motionReferenceVideoUrl: signedUrl });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(getSignedMediaUrl).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/videos/motion.mp4",
      forceRefresh: true,
    });
    expect(submitFalKlingV3ImageToVideo).toHaveBeenCalledWith(
      expect.objectContaining({
        elements: [
          {
            video_url: "https://example.com/signed/motion-refreshed.mp4",
            frontal_image_url: "https://example.com/character.png",
          },
        ],
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
    const args = makeArgs({ motionReferenceVideoUrl: signedUrl });

    const handled = await handleVideoModelSubmission(args);

    expect(handled).toBe(true);
    expect(args.notifyGenerationFailure).toHaveBeenCalledWith(
      "out-1",
      expect.stringContaining("Motion reference preparation failed")
    );
    expect(submitFalKlingV3ImageToVideo).not.toHaveBeenCalled();
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
});
