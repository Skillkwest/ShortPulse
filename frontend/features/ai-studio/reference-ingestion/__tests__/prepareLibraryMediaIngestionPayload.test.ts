/**
 * Unit tests for media-library ingestion payload preparation.
 * Verifies storage-path re-signing and URL refresh/fallback behavior.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { prepareLibraryMediaIngestionPayload } from "../prepareLibraryMediaIngestionPayload";

const workflowReload = {
  version: 1,
  source: "ai_studio_generation",
  capturedAt: "2026-06-15T10:00:00.000Z",
  originTool: "create",
  panelKind: "create",
  outputMode: "image",
  restoreBehavior: "navigate_and_hydrate",
  prompt: { display: "A glass lighthouse" },
  model: { id: "fal-ai/imagen4/preview" },
  payload: {
    kind: "image",
    submitTool: "create",
    aspect: "16:9",
    imageResolution: "1K",
    referenceInputs: [],
    internalMediaRefs: [],
  },
} as const;

const generationReplay = {
  version: 1,
  mode: "image",
  submitTool: "create",
  modelId: "fal-ai/imagen4/preview",
  displayPrompt: "A glass lighthouse",
  submissionPrompt: "A glass lighthouse",
  aspect: "16:9",
  imageResolution: "1K",
  referenceInputs: [],
  capturedAt: "2026-06-15T10:00:00.000Z",
} as const;

const characterContext = {
  applied: true,
  characterId: "character-1",
  characterName: "Rózalin Belaroa",
  lookId: "main",
  lookName: "Main",
  characterProfileImageUrl: "https://cdn.test/character.png",
} as const;

const styleContext = {
  applied: true,
  styleId: "style-1",
  styleName: "Digicam Photorealism",
  stylePrompt: "photoreal editorial lighting",
  stylePreviewImageUrl: "https://cdn.test/style.png",
} as const;

const {
  getSignedMediaUrlMock,
  refreshSupabaseSignedUrlIfNeededMock,
  mediaFilesMaybeSingleMock,
  mediaFilesSelectMock,
  mediaFilesFromMock,
  ensureSupabaseQueryClientMock,
} = vi.hoisted(() => {
  const mediaFilesMaybeSingleMock = vi.fn();
  const mediaFilesSelectMock = vi.fn(() => ({
    eq: vi.fn(() => ({
      limit: vi.fn(() => ({
        maybeSingle: mediaFilesMaybeSingleMock,
      })),
    })),
  }));
  const mediaFilesFromMock = vi.fn(() => ({
    select: mediaFilesSelectMock,
  }));
  return {
    getSignedMediaUrlMock: vi.fn(),
    refreshSupabaseSignedUrlIfNeededMock: vi.fn(),
    mediaFilesMaybeSingleMock,
    mediaFilesSelectMock,
    mediaFilesFromMock,
    ensureSupabaseQueryClientMock: vi.fn(() => ({
      from: mediaFilesFromMock,
    })),
  };
});

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: getSignedMediaUrlMock,
}));

vi.mock("../../utils/imageUpload", async () => {
  const actual =
    await vi.importActual<typeof import("../../utils/imageUpload")>("../../utils/imageUpload");
  return {
    ...actual,
    refreshSupabaseSignedUrlIfNeeded: refreshSupabaseSignedUrlIfNeededMock,
  };
});

vi.mock("../../../../lib/supabaseClient", () => ({
  ensureSupabaseQueryClient: ensureSupabaseQueryClientMock,
}));

describe("prepareLibraryMediaIngestionPayload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshSupabaseSignedUrlIfNeededMock.mockImplementation(async (value: string) => value);
    getSignedMediaUrlMock.mockResolvedValue(null);
    mediaFilesMaybeSingleMock.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it("refreshes preview/full URLs from storage paths when available", async () => {
    getSignedMediaUrlMock.mockImplementation(async ({ storagePath }: { storagePath: string }) => {
      if (storagePath === "user-1/previews/ref-1.jpg") {
        return "https://signed.example.com/previews/ref-1.jpg";
      }
      if (storagePath === "user-1/full/ref-1.jpg") {
        return "https://signed.example.com/full/ref-1.jpg";
      }
      return null;
    });

    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-1",
      url: "https://expired.example.com/ref-1.jpg",
      fileType: "image",
      previewStoragePath: " user-1/previews/ref-1.jpg ",
      fullStoragePath: " user-1/full/ref-1.jpg ",
      previewUrl: "https://expired.example.com/ref-1-preview.jpg",
      fullUrl: "https://expired.example.com/ref-1-full.jpg",
    });

    expect(result.previewStoragePath).toBe("user-1/previews/ref-1.jpg");
    expect(result.fullStoragePath).toBe("user-1/full/ref-1.jpg");
    expect(result.previewUrl).toBe("https://signed.example.com/previews/ref-1.jpg");
    expect(result.fullUrl).toBe("https://signed.example.com/full/ref-1.jpg");
    expect(result.url).toBe("https://signed.example.com/full/ref-1.jpg");
    expect(refreshSupabaseSignedUrlIfNeededMock).not.toHaveBeenCalled();
  });

  it("signs storage-only media-library payloads without requiring a stale URL", async () => {
    getSignedMediaUrlMock.mockImplementation(async ({ storagePath }: { storagePath: string }) => {
      if (storagePath === "user-1/previews/storage-only.jpg") {
        return "https://signed.example.com/previews/storage-only.jpg";
      }
      if (storagePath === "user-1/full/storage-only.jpg") {
        return "https://signed.example.com/full/storage-only.jpg";
      }
      return null;
    });

    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-storage-only",
      url: null,
      fileType: "image",
      previewStoragePath: "user-1/previews/storage-only.jpg",
      fullStoragePath: "user-1/full/storage-only.jpg",
    });

    expect(result.previewStoragePath).toBe("user-1/previews/storage-only.jpg");
    expect(result.fullStoragePath).toBe("user-1/full/storage-only.jpg");
    expect(result.previewUrl).toBe("https://signed.example.com/previews/storage-only.jpg");
    expect(result.fullUrl).toBe("https://signed.example.com/full/storage-only.jpg");
    expect(result.url).toBe("https://signed.example.com/full/storage-only.jpg");
    expect(refreshSupabaseSignedUrlIfNeededMock).not.toHaveBeenCalled();
  });

  it("falls back to existing payload URLs when signing/refresh cannot resolve", async () => {
    getSignedMediaUrlMock.mockResolvedValue(null);
    refreshSupabaseSignedUrlIfNeededMock.mockRejectedValue(
      new Error("Reference URL expired and could not be refreshed.")
    );

    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-2",
      url: "https://expired.example.com/base.jpg",
      fileType: "image",
      previewStoragePath: "user-1/previews/missing.jpg",
      fullStoragePath: "user-1/full/missing.jpg",
      previewUrl: "https://expired.example.com/preview.jpg",
      fullUrl: "https://expired.example.com/full.jpg",
    });

    expect(result.previewUrl).toBe("https://expired.example.com/preview.jpg");
    expect(result.fullUrl).toBe("https://expired.example.com/full.jpg");
    expect(result.url).toBe("https://expired.example.com/full.jpg");
  });

  it("keeps non-signed external URLs unchanged when storage paths are absent", async () => {
    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-3",
      url: "https://cdn.example.com/reference.jpg",
      fileType: "image",
      previewUrl: "https://cdn.example.com/reference.jpg",
    });

    expect(getSignedMediaUrlMock).not.toHaveBeenCalled();
    expect(result.url).toBe("https://cdn.example.com/reference.jpg");
    expect(result.previewUrl).toBe("https://cdn.example.com/reference.jpg");
    expect(result.fullUrl).toBe("https://cdn.example.com/reference.jpg");
  });

  it("refreshes signed object URLs when no storage paths are provided", async () => {
    refreshSupabaseSignedUrlIfNeededMock.mockResolvedValue("https://signed.example.com/fresh.jpg");

    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-4",
      url: "https://example.supabase.co/storage/v1/object/sign/media_library/user-1/ref.jpg?token=expired",
      fileType: "image",
    });

    expect(getSignedMediaUrlMock).not.toHaveBeenCalled();
    expect(refreshSupabaseSignedUrlIfNeededMock).toHaveBeenCalledTimes(1);
    expect(result.url).toBe("https://signed.example.com/fresh.jpg");
    expect(result.previewUrl).toBe("https://signed.example.com/fresh.jpg");
    expect(result.fullUrl).toBe("https://signed.example.com/fresh.jpg");
  });

  it("falls back to media-id storage path lookup when payload path hints are missing", async () => {
    mediaFilesMaybeSingleMock.mockResolvedValue({
      data: {
        thumb_variant_path: "user-1/previews/by-id.jpg",
        storage_path: "user-1/full/by-id.jpg",
      },
      error: null,
    });
    getSignedMediaUrlMock.mockImplementation(async ({ storagePath }: { storagePath: string }) => {
      if (storagePath === "user-1/previews/by-id.jpg") {
        return "https://signed.example.com/previews/by-id.jpg";
      }
      if (storagePath === "user-1/full/by-id.jpg") {
        return "https://signed.example.com/full/by-id.jpg";
      }
      return null;
    });

    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-by-id",
      url: "https://expired.example.com/by-id.jpg",
      fileType: "image",
      previewStoragePath: null,
      fullStoragePath: null,
    });

    expect(ensureSupabaseQueryClientMock).toHaveBeenCalledTimes(1);
    expect(mediaFilesFromMock).toHaveBeenCalledWith("media_files");
    expect(result.previewStoragePath).toBe("user-1/previews/by-id.jpg");
    expect(result.fullStoragePath).toBe("user-1/full/by-id.jpg");
    expect(result.previewUrl).toBe("https://signed.example.com/previews/by-id.jpg");
    expect(result.fullUrl).toBe("https://signed.example.com/full/by-id.jpg");
    expect(result.url).toBe("https://signed.example.com/full/by-id.jpg");
  });

  it("queries canonical media_files storage, source, and metadata columns for media-id fallback", async () => {
    mediaFilesMaybeSingleMock.mockResolvedValueOnce({
      data: {
        storage_path: "user-1/full/by-storage-only.jpg",
      },
      error: null,
    });
    getSignedMediaUrlMock.mockImplementation(async ({ storagePath }: { storagePath: string }) => {
      if (storagePath === "user-1/full/by-storage-only.jpg") {
        return "https://signed.example.com/full/by-storage-only.jpg";
      }
      return null;
    });

    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-by-storage-only",
      url: "https://expired.example.com/by-storage-only.jpg",
      fileType: "image",
      previewStoragePath: null,
      fullStoragePath: null,
    });

    expect(mediaFilesSelectMock).toHaveBeenCalledWith(
      "filename, file_type, duration_seconds, width, height, source, source_ref, metadata, storage_path, poster_variant_path, thumb_variant_path, preview_variant_path"
    );
    expect(mediaFilesSelectMock).not.toHaveBeenCalledWith(
      expect.stringContaining("preview_storage_path")
    );
    expect(result.previewStoragePath).toBe("user-1/full/by-storage-only.jpg");
    expect(result.fullStoragePath).toBe("user-1/full/by-storage-only.jpg");
    expect(result.previewUrl).toBe("https://signed.example.com/full/by-storage-only.jpg");
    expect(result.fullUrl).toBe("https://signed.example.com/full/by-storage-only.jpg");
    expect(result.url).toBe("https://signed.example.com/full/by-storage-only.jpg");
  });

  it("hydrates AI Studio source refs and workflow reload metadata from media-id fallback", async () => {
    mediaFilesMaybeSingleMock.mockResolvedValueOnce({
      data: {
        filename: "generated.png",
        source: "ai_studio",
        source_ref: "generation-1",
        duration_seconds: 15,
        width: 1280,
        height: 720,
        metadata: {
          model_id: "kie-ai/kling-3.0",
          workflow_reload: workflowReload,
          generation_replay: generationReplay,
          character_context: characterContext,
          style_context: styleContext,
        },
        thumb_variant_path: "user-1/previews/generated.jpg",
        storage_path: "user-1/full/generated.jpg",
      },
      error: null,
    });
    getSignedMediaUrlMock.mockImplementation(async ({ storagePath }: { storagePath: string }) => {
      if (storagePath === "user-1/previews/generated.jpg") {
        return "https://signed.example.com/previews/generated.jpg";
      }
      if (storagePath === "user-1/full/generated.jpg") {
        return "https://signed.example.com/full/generated.jpg";
      }
      return null;
    });

    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-generated-1",
      url: "https://expired.example.com/generated.jpg",
      fileType: "image",
      previewStoragePath: null,
      fullStoragePath: null,
    });

    expect(result.source).toBe("ai_studio");
    expect(result.sourceRef).toBe("generation-1");
    expect(result.generationId).toBe("generation-1");
    expect(result.modelId).toBe("kie-ai/kling-3.0");
    expect(result.workflowReload).toEqual(workflowReload);
    expect(result.generationReplay).toEqual(generationReplay);
    expect(result.characterContext).toEqual(characterContext);
    expect(result.styleContext).toEqual(styleContext);
    expect(result.filename).toBe("generated.png");
    expect(result.durationMs).toBe(15_000);
    expect(result.width).toBe(1280);
    expect(result.height).toBe(720);
  });

  it("hydrates audio display title and companion art from media-id fallback metadata", async () => {
    mediaFilesMaybeSingleMock.mockResolvedValueOnce({
      data: {
        filename: "reference-audio-1782190088726-ezl75p.wav",
        source: "ai_studio",
        source_ref: "generation-audio-1",
        metadata: {
          display_title: "Quiet Signal",
          companion_art_storage_path:
            "user-1/generations/audio/generation-audio-1/companion-art/cover.webp",
        },
        storage_path: "user-1/generations/audio/reference-audio-1782190088726-ezl75p.wav",
      },
      error: null,
    });
    getSignedMediaUrlMock.mockImplementation(async ({ storagePath }: { storagePath: string }) => {
      if (storagePath === "user-1/generations/audio/reference-audio-1782190088726-ezl75p.wav") {
        return "https://signed.example.com/audio/quiet-signal.wav";
      }
      if (storagePath === "user-1/generations/audio/generation-audio-1/companion-art/cover.webp") {
        return "https://signed.example.com/audio/quiet-signal-cover.webp";
      }
      return null;
    });

    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-audio-1",
      url: "https://expired.example.com/reference-audio-1782190088726-ezl75p.wav",
      fileType: "audio",
      previewStoragePath: null,
      fullStoragePath: null,
    });

    expect(result.displayTitle).toBe("Quiet Signal");
    expect(result.companionArtStoragePath).toBe(
      "user-1/generations/audio/generation-audio-1/companion-art/cover.webp"
    );
    expect(result.companionArtUrl).toBe("https://signed.example.com/audio/quiet-signal-cover.webp");
    expect(result.url).toBe("https://signed.example.com/audio/quiet-signal.wav");
  });

  it("prefers generated-audio projection title and companion art over stale media metadata", async () => {
    mediaFilesMaybeSingleMock
      .mockResolvedValueOnce({
        data: {
          filename: "reference-audio-1782190088726-ezl75p.wav",
          source: "ai_studio",
          source_ref: "generation-audio-2",
          metadata: {
            display_title: "Stale Metadata Title",
            companion_art_storage_path:
              "user-1/generations/audio/generation-audio-2/companion-art/stale.webp",
          },
          storage_path: "user-1/generations/audio/reference-audio-1782190088726-ezl75p.wav",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          display_title: "Projection Title",
          companion_art_storage_path:
            "user-1/generations/audio/generation-audio-2/companion-art/cover.webp",
        },
        error: null,
      });
    getSignedMediaUrlMock.mockImplementation(async ({ storagePath }: { storagePath: string }) => {
      if (storagePath === "user-1/generations/audio/reference-audio-1782190088726-ezl75p.wav") {
        return "https://signed.example.com/audio/projection.wav";
      }
      if (storagePath === "user-1/generations/audio/generation-audio-2/companion-art/cover.webp") {
        return "https://signed.example.com/audio/projection-cover.webp";
      }
      return null;
    });

    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-audio-2",
      url: "https://expired.example.com/reference-audio-1782190088726-ezl75p.wav",
      fileType: "audio",
      previewStoragePath: null,
      fullStoragePath: null,
    });

    expect(mediaFilesFromMock).toHaveBeenCalledWith("generation_projection");
    expect(mediaFilesSelectMock).toHaveBeenCalledWith("display_title, companion_art_storage_path");
    expect(result.displayTitle).toBe("Projection Title");
    expect(result.companionArtStoragePath).toBe(
      "user-1/generations/audio/generation-audio-2/companion-art/cover.webp"
    );
    expect(result.companionArtUrl).toBe("https://signed.example.com/audio/projection-cover.webp");
  });

  it("normalizes poster-backed video preview storage to the playable full storage path", async () => {
    getSignedMediaUrlMock.mockImplementation(async ({ storagePath }: { storagePath: string }) => {
      if (storagePath === "user-1/generations/videos/media-video-1.mp4") {
        return "https://signed.example.com/videos/media-video-1.mp4";
      }
      if (storagePath === "user-1/variants/videos/media-video-1/poster_720.jpg") {
        return "https://signed.example.com/videos/media-video-1-poster.jpg";
      }
      return null;
    });

    const result = await prepareLibraryMediaIngestionPayload({
      id: "media-video-1",
      url: "https://expired.example.com/media-video-1.mp4",
      fileType: "video",
      previewStoragePath: "user-1/variants/videos/media-video-1/poster_720.jpg",
      previewPosterStoragePath: "user-1/variants/videos/media-video-1/poster_720.jpg",
      fullStoragePath: "user-1/generations/videos/media-video-1.mp4",
      previewUrl: "https://expired.example.com/media-video-1-poster.jpg",
      previewPosterUrl: "https://expired.example.com/media-video-1-poster.jpg",
      fullUrl: "https://expired.example.com/media-video-1.mp4",
    });

    expect(result.previewStoragePath).toBe("user-1/generations/videos/media-video-1.mp4");
    expect(result.previewPosterStoragePath).toBe(
      "user-1/variants/videos/media-video-1/poster_720.jpg"
    );
    expect(result.previewUrl).toBe("https://signed.example.com/videos/media-video-1.mp4");
    expect(result.previewPosterUrl).toBe(
      "https://signed.example.com/videos/media-video-1-poster.jpg"
    );
    expect(result.fullUrl).toBe("https://signed.example.com/videos/media-video-1.mp4");
  });
});
