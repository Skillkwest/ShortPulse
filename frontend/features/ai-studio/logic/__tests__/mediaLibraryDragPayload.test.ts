import { describe, expect, it, vi } from "vitest";
import {
  getMediaLibraryBulkMediaDragTypes,
  getMediaLibraryDragTypes,
  hasMediaLibraryBulkMediaDragTypeHints,
  hasMediaLibraryDragTypeHints,
  MEDIA_LIBRARY_BULK_DRAG_MAX_ITEMS,
  MEDIA_LIBRARY_BULK_DRAG_MAX_SERIALIZED_CHARS,
  readMediaLibraryBulkMediaDragPayload,
  readMediaLibraryDragPayload,
  writeMediaLibraryBulkMediaDragPayload,
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

  it("bounds waveform peaks in custom and fallback media drag payloads", () => {
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
        url: "https://example.com/audio.mp3",
        fileType: "audio",
        waveformPeaks: Array.from({ length: 500 }, (_, index) => index % 101),
      },
    });

    const customPayload = readMediaLibraryDragPayload(transfer);
    expect(customPayload?.kind).toBe("libraryMedia");
    expect(
      customPayload?.kind === "libraryMedia" ? customPayload.payload.waveformPeaks : null
    ).toHaveLength(56);
    expect(
      JSON.parse(transferData.get("text/shortpulse-media-library-waveform-peaks") ?? "[]")
    ).toHaveLength(56);
  });

  it("serializes and parses bulk library media payloads separately from single-item payloads", () => {
    const transferData = new Map<string, string>();
    const transferTypes: string[] = [];
    const transfer = {
      get types() {
        return transferTypes;
      },
      setData: vi.fn((type: string, value: string) => {
        transferData.set(type, value);
        transferTypes.splice(0, transferTypes.length, ...transferData.keys());
      }),
      getData: vi.fn((type: string) => transferData.get(type) ?? ""),
    } as unknown as DataTransfer;

    writeMediaLibraryBulkMediaDragPayload(transfer, {
      kind: "bulkLibraryMedia",
      source: "mediaLibrary",
      payload: {
        draggedItemId: "media-2",
        originFolderId: "all_items",
        items: [
          {
            id: "media-1",
            url: "https://example.com/a.png",
            fileType: "image",
            filename: "a.png",
          },
          {
            id: "media-2",
            url: "https://example.com/b.mp4",
            fileType: "video",
            filename: "b.mp4",
            previewPosterUrl: "https://example.com/b-poster.jpg",
          },
          {
            id: "media-3",
            url: "https://example.com/c.mp3",
            fileType: "audio",
            filename: "c.mp3",
            waveformPeaks: Array.from({ length: 500 }, (_, index) => index % 101),
          },
        ],
      },
    });

    expect(transfer.setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-bulk-marker",
      "shortpulse-media-library-bulk-v1"
    );
    expect(readMediaLibraryDragPayload(transfer)).toBeNull();
    expect(readMediaLibraryBulkMediaDragPayload(transfer)).toEqual({
      kind: "bulkLibraryMedia",
      source: "mediaLibrary",
      payload: {
        draggedItemId: "media-2",
        originFolderId: "all_items",
        items: [
          expect.objectContaining({
            id: "media-1",
            url: "https://example.com/a.png",
            fileType: "image",
          }),
          expect.objectContaining({
            id: "media-2",
            url: "https://example.com/b.mp4",
            fileType: "video",
            previewPosterUrl: "https://example.com/b-poster.jpg",
          }),
          expect.objectContaining({
            id: "media-3",
            url: "https://example.com/c.mp3",
            fileType: "audio",
            waveformPeaks: expect.arrayContaining([expect.any(Number)]),
          }),
        ],
      },
    });
    const parsedBulk = readMediaLibraryBulkMediaDragPayload(transfer);
    const parsedAudioItem = parsedBulk?.payload.items.find((item) => item.id === "media-3");
    expect(parsedAudioItem?.waveformPeaks).toHaveLength(56);
  });

  it("caps and compacts oversized bulk media drag payloads", () => {
    const transferData = new Map<string, string>();
    const transfer = {
      setData: vi.fn((type: string, value: string) => {
        transferData.set(type, value);
      }),
      getData: vi.fn((type: string) => transferData.get(type) ?? ""),
    } as unknown as DataTransfer;
    const longPrompt = "prompt ".repeat(1_000);
    const longTranscript = "transcript ".repeat(1_000);

    writeMediaLibraryBulkMediaDragPayload(transfer, {
      kind: "bulkLibraryMedia",
      source: "mediaLibrary",
      payload: {
        draggedItemId: "media-0",
        originFolderId: "all_items",
        items: Array.from({ length: MEDIA_LIBRARY_BULK_DRAG_MAX_ITEMS + 12 }, (_, index) => ({
          id: `media-${index}`,
          url: `https://example.com/media-${index}.png`,
          fileType: "image",
          promptText: longPrompt,
          transcriptText: longTranscript,
          workflowReload: { large: "workflow".repeat(1_000) },
          generationReplay: { large: "replay".repeat(1_000) },
          characterContext: { large: "character".repeat(1_000) },
          styleContext: { large: "style".repeat(1_000) },
        })),
      },
    });

    const serialized = transferData.get("application/x-shortpulse-media-library-items") ?? "";
    const parsed = readMediaLibraryBulkMediaDragPayload(transfer);
    expect(serialized.length).toBeLessThanOrEqual(MEDIA_LIBRARY_BULK_DRAG_MAX_SERIALIZED_CHARS);
    expect(parsed?.payload.items).toHaveLength(MEDIA_LIBRARY_BULK_DRAG_MAX_ITEMS);
    expect(parsed?.payload.items[0]).toMatchObject({
      id: "media-0",
      url: "https://example.com/media-0.png",
      fileType: "image",
      workflowReload: null,
      generationReplay: null,
      characterContext: null,
      styleContext: null,
    });
    expect(parsed?.payload.items[0]?.promptText).toHaveLength(2_048);
    expect(parsed?.payload.items[0]?.transcriptText).toHaveLength(2_048);
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
        modelId: null,
        transcriptText: null,
        previewStoragePath: null,
        fullStoragePath: null,
        previewUrl: null,
        previewPosterUrl: null,
        previewPosterStoragePath: null,
        fullUrl: null,
        companionArtUrl: null,
        companionArtStoragePath: null,
        displayTitle: null,
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
        modelId: null,
        transcriptText: null,
        previewStoragePath: null,
        fullStoragePath: null,
        previewUrl: null,
        previewPosterUrl: null,
        previewPosterStoragePath: null,
        fullUrl: null,
        companionArtUrl: null,
        companionArtStoragePath: null,
        displayTitle: null,
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
        modelId: "kie-ai/kling-3.0",
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
    expect(transfer.setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-model-id",
      "kie-ai/kling-3.0"
    );
    expect(readMediaLibraryDragPayload(transfer)).toEqual({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: expect.objectContaining({
        id: "media-generated-1",
        source: "ai_studio",
        sourceRef: "generation-1",
        generationId: "generation-1",
        modelId: "kie-ai/kling-3.0",
        workflowReload,
      }),
    });
  });

  it("exposes both drag transfer types", () => {
    expect(getMediaLibraryDragTypes()).toContain("application/x-shortpulse-media-library-item");
    expect(getMediaLibraryDragTypes()).toContain("text/x-shortpulse-media-library-item");
    expect(getMediaLibraryDragTypes()).toContain("text/shortpulse-media-library-marker");
  });

  it("exposes and detects bulk drag transfer types without single-item hints", () => {
    expect(getMediaLibraryBulkMediaDragTypes()).toContain(
      "application/x-shortpulse-media-library-items"
    );
    expect(getMediaLibraryBulkMediaDragTypes()).toContain("text/x-shortpulse-media-library-items");
    expect(getMediaLibraryBulkMediaDragTypes()).toContain(
      "text/shortpulse-media-library-bulk-marker"
    );
    expect(getMediaLibraryDragTypes()).not.toContain(
      "application/x-shortpulse-media-library-items"
    );

    const transfer = {
      types: ["text/shortpulse-media-library-bulk-marker"],
      getData: vi.fn(() => {
        throw new Error("payload read should not be required");
      }),
    } as unknown as DataTransfer;

    expect(hasMediaLibraryBulkMediaDragTypeHints(transfer)).toBe(true);
    expect(hasMediaLibraryDragTypeHints(transfer)).toBe(false);
    expect(transfer.getData).not.toHaveBeenCalled();
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
        displayTitle: "Neon Rain",
        companionArtUrl: "https://cdn.test/audio-cover.webp",
        companionArtStoragePath: "user-1/generations/audio/media-audio-1/companion-art/cover.webp",
      },
    });

    expect(transfer.setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-display-title",
      "Neon Rain"
    );
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
        displayTitle: "Neon Rain",
        companionArtUrl: "https://cdn.test/audio-cover.webp",
        companionArtStoragePath: "user-1/generations/audio/media-audio-1/companion-art/cover.webp",
      }),
    });
  });
});
