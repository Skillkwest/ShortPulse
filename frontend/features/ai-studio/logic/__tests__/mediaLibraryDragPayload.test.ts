import { describe, expect, it, vi } from "vitest";
import {
  getMediaLibraryDragTypes,
  hasMediaLibraryDragTypeHints,
  readMediaLibraryDragPayload,
  writeMediaLibraryDragPayload,
} from "../mediaLibraryDragPayload";

describe("mediaLibraryDragPayload", () => {
  it("serializes and parses library media payloads", () => {
    const setData = vi.fn();
    const transfer = {
      setData,
      getData: vi.fn((type: string) => {
        if (type === "application/x-shortpulse-media-library-item") {
          return JSON.stringify({
            kind: "libraryMedia",
            source: "mediaLibrary",
            payload: {
              id: "media-1",
              url: "https://example.com/a.png",
              fileType: "image",
            },
          });
        }
        return "";
      }),
    } as unknown as DataTransfer;

    writeMediaLibraryDragPayload(transfer, {
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-1",
        url: "https://example.com/a.png",
        fileType: "image",
      },
    });

    expect(setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-marker",
      "shortpulse-media-library-v1"
    );
    expect(setData).toHaveBeenCalledWith("text/shortpulse-media-library-kind", "libraryMedia");
    expect(setData).toHaveBeenCalledWith("text/shortpulse-media-library-id", "media-1");
    expect(setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-url",
      "https://example.com/a.png"
    );
    expect(readMediaLibraryDragPayload(transfer)).toEqual({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-1",
        url: "https://example.com/a.png",
        fileType: "image",
      },
    });
  });

  it("returns null for malformed payloads", () => {
    const transfer = {
      getData: vi.fn(() => "not-json"),
    } as unknown as DataTransfer;
    expect(readMediaLibraryDragPayload(transfer)).toBeNull();
  });

  it("reconstructs library media payloads from text/* fallback marker data", () => {
    const transfer = {
      getData: vi.fn((type: string) => {
        if (type === "application/x-shortpulse-media-library-item") return "";
        if (type === "text/x-shortpulse-media-library-item") return "";
        if (type === "text/shortpulse-media-library-marker") return "shortpulse-media-library-v1";
        if (type === "text/shortpulse-media-library-kind") return "libraryMedia";
        if (type === "text/shortpulse-media-library-id") return "media-fallback";
        if (type === "text/shortpulse-media-library-file-type") return "image";
        if (type === "text/reference-url") return "https://example.com/fallback.png";
        if (type === "text/prompt") return "fallback prompt";
        return "";
      }),
    } as unknown as DataTransfer;

    expect(readMediaLibraryDragPayload(transfer)).toEqual({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-fallback",
        url: "https://example.com/fallback.png",
        fileType: "image",
        originFolderId: null,
        filename: null,
        promptText: "fallback prompt",
        source: null,
        sourceRef: null,
        generationId: null,
        transcriptText: null,
        previewStoragePath: null,
        fullStoragePath: null,
        previewUrl: null,
        previewPosterUrl: null,
        previewPosterStoragePath: null,
        fullUrl: null,
        companionArtUrl: null,
        companionArtStoragePath: null,
        durationMs: null,
        waveformPeaks: null,
        audioSourceMode: null,
        width: undefined,
        height: undefined,
      },
    });
  });

  it("infers audio file type from fallback URL markers", () => {
    const transfer = {
      getData: vi.fn((type: string) => {
        if (type === "application/x-shortpulse-media-library-item") return "";
        if (type === "text/x-shortpulse-media-library-item") return "";
        if (type === "text/shortpulse-media-library-marker") return "shortpulse-media-library-v1";
        if (type === "text/shortpulse-media-library-kind") return "libraryMedia";
        if (type === "text/shortpulse-media-library-id") return "media-audio-fallback";
        if (type === "text/reference-url") return "https://example.com/fallback-audio.mp3";
        return "";
      }),
    } as unknown as DataTransfer;

    expect(readMediaLibraryDragPayload(transfer)).toEqual({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-audio-fallback",
        url: "https://example.com/fallback-audio.mp3",
        fileType: "audio",
        originFolderId: null,
        filename: null,
        promptText: null,
        source: null,
        sourceRef: null,
        generationId: null,
        transcriptText: null,
        previewStoragePath: null,
        fullStoragePath: null,
        previewUrl: null,
        previewPosterUrl: null,
        previewPosterStoragePath: null,
        fullUrl: null,
        companionArtUrl: null,
        companionArtStoragePath: null,
        durationMs: null,
        waveformPeaks: null,
        audioSourceMode: null,
        width: undefined,
        height: undefined,
      },
    });
  });

  it("serializes and parses library video poster payloads", () => {
    const transferData = new Map<string, string>();
    const transfer = {
      setData: vi.fn((type: string, value: string) => {
        transferData.set(type, value);
      }),
      getData: vi.fn((type: string) => transferData.get(type) ?? ""),
    } as unknown as DataTransfer;

    writeMediaLibraryDragPayload(transfer, {
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-video-1",
        url: "https://cdn.test/video.mp4",
        fileType: "video",
        previewUrl: "https://cdn.test/poster.jpg",
        previewPosterUrl: "https://cdn.test/poster.jpg",
        previewPosterStoragePath: "user-1/variants/videos/media-video-1/poster_720.jpg",
        fullUrl: "https://cdn.test/video.mp4",
        previewStoragePath: "user-1/generations/videos/media-video-1.mp4",
        fullStoragePath: "user-1/generations/videos/media-video-1.mp4",
      },
    });

    expect(transfer.setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-preview-poster-url",
      "https://cdn.test/poster.jpg"
    );
    expect(readMediaLibraryDragPayload(transfer)).toEqual({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: expect.objectContaining({
        id: "media-video-1",
        fileType: "video",
        previewUrl: "https://cdn.test/poster.jpg",
        previewPosterUrl: "https://cdn.test/poster.jpg",
        previewPosterStoragePath: "user-1/variants/videos/media-video-1/poster_720.jpg",
        previewStoragePath: "user-1/generations/videos/media-video-1.mp4",
        fullUrl: "https://cdn.test/video.mp4",
      }),
    });
  });

  it("preserves transcript text in custom and fallback media payload fields", () => {
    const transferData = new Map<string, string>();
    const transfer = {
      setData: vi.fn((type: string, value: string) => {
        transferData.set(type, value);
      }),
      getData: vi.fn((type: string) => transferData.get(type) ?? ""),
    } as unknown as DataTransfer;

    writeMediaLibraryDragPayload(transfer, {
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-transcript-1",
        url: "https://cdn.test/voice-video.mp4",
        fileType: "video",
        promptText: "clip.mp4 -> Narrator video",
        transcriptText: "I can hear the city waking up below us.",
      },
    });

    expect(transfer.setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-transcript",
      "I can hear the city waking up below us."
    );
    expect(readMediaLibraryDragPayload(transfer)).toEqual({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: expect.objectContaining({
        id: "media-transcript-1",
        promptText: "clip.mp4 -> Narrator video",
        transcriptText: "I can hear the city waking up below us.",
      }),
    });
  });

  it("serializes generated media source refs and reload metadata in the custom payload", () => {
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
    };
    const transferData = new Map<string, string>();
    const transfer = {
      setData: vi.fn((type: string, value: string) => {
        transferData.set(type, value);
      }),
      getData: vi.fn((type: string) => transferData.get(type) ?? ""),
    } as unknown as DataTransfer;

    writeMediaLibraryDragPayload(transfer, {
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-generated-1",
        url: "https://cdn.test/generated.png",
        fileType: "image",
        source: "ai_studio",
        sourceRef: "generation-1",
        generationId: "generation-1",
        workflowReload,
      },
    });

    expect(transfer.setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-source-ref",
      "generation-1"
    );
    expect(transfer.setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-generation-id",
      "generation-1"
    );
    expect(readMediaLibraryDragPayload(transfer)).toEqual({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: expect.objectContaining({
        id: "media-generated-1",
        source: "ai_studio",
        sourceRef: "generation-1",
        generationId: "generation-1",
        workflowReload,
      }),
    });
  });

  it("exposes both drag transfer types", () => {
    expect(getMediaLibraryDragTypes()).toContain("application/x-shortpulse-media-library-item");
    expect(getMediaLibraryDragTypes()).toContain("text/x-shortpulse-media-library-item");
    expect(getMediaLibraryDragTypes()).toContain("text/shortpulse-media-library-marker");
  });

  it("detects media-library drag hints without reading payload data", () => {
    const getData = vi.fn(() => {
      throw new Error("payload read should not be required");
    });
    const transfer = {
      types: ["text/shortpulse-media-library-marker", "text/shortpulse-media-library-kind"],
      getData,
    } as unknown as DataTransfer;

    expect(hasMediaLibraryDragTypeHints(transfer)).toBe(true);
    expect(getData).not.toHaveBeenCalled();
  });

  it("keeps writing fallback payload fields when custom MIME transfer writes fail", () => {
    const setData = vi.fn((type: string) => {
      if (
        type === "application/x-shortpulse-media-library-item" ||
        type === "text/x-shortpulse-media-library-item"
      ) {
        throw new Error("unsupported transfer type");
      }
    });
    const transfer = {
      setData,
      getData: vi.fn(() => ""),
    } as unknown as DataTransfer;

    expect(() =>
      writeMediaLibraryDragPayload(transfer, {
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload: {
          id: "media-safe-write",
          url: "https://example.com/safe-write.png",
          fileType: "image",
        },
      })
    ).not.toThrow();

    expect(setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-marker",
      "shortpulse-media-library-v1"
    );
    expect(setData).toHaveBeenCalledWith("text/shortpulse-media-library-kind", "libraryMedia");
    expect(setData).toHaveBeenCalledWith("text/shortpulse-media-library-id", "media-safe-write");
    expect(setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-url",
      "https://example.com/safe-write.png"
    );
  });

  it("serializes and parses companion-art payload fields for audio library media", () => {
    const transferData = new Map<string, string>();
    const transfer = {
      setData: vi.fn((type: string, value: string) => {
        transferData.set(type, value);
      }),
      getData: vi.fn((type: string) => transferData.get(type) ?? ""),
    } as unknown as DataTransfer;

    writeMediaLibraryDragPayload(transfer, {
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-audio-1",
        url: "https://cdn.test/audio.mp3",
        fileType: "audio",
        companionArtUrl: "https://cdn.test/audio-cover.webp",
        companionArtStoragePath: "user-1/generations/audio/media-audio-1/companion-art/cover.webp",
      },
    });

    expect(transfer.setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-companion-art-url",
      "https://cdn.test/audio-cover.webp"
    );
    expect(readMediaLibraryDragPayload(transfer)).toEqual({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: expect.objectContaining({
        id: "media-audio-1",
        fileType: "audio",
        companionArtUrl: "https://cdn.test/audio-cover.webp",
        companionArtStoragePath: "user-1/generations/audio/media-audio-1/companion-art/cover.webp",
      }),
    });
  });
});
