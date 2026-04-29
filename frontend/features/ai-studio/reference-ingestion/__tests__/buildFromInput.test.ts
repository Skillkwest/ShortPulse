/**
 * Unit tests for canonical reference ingestion adapter.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StudioOutput } from "../../types";
import type { ReferenceIngestionContext } from "../types";
import {
  buildStudioOutputsFromReferenceInput,
  buildStudioOutputsFromReferenceInputSync,
} from "../buildFromInput";

const mapUploadsFromFilesMock = vi.fn();

vi.mock("../../logic/stateParsers", () => ({
  mapUploadsFromFiles: (...args: unknown[]) => mapUploadsFromFilesMock(...args),
  isAudioUrl: (value: string | null | undefined) => Boolean(value?.includes(".mp3")),
  isVideoUrl: (value: string | null | undefined) => Boolean(value?.includes(".mp4")),
}));

const createContext = (): ReferenceIngestionContext => {
  let count = 0;
  return {
    mode: "image",
    aspect: "9:16",
    model: "fal-ai/model",
    resolveModelLabel: (value?: string) => (value ? `Model(${value})` : "Choose Model"),
    randomId: () => {
      count += 1;
      return `id-${count}`;
    },
  };
};

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: id,
  mode: "image",
  aspect: "9:16",
  model: "Model(fal-ai/model)",
  status: "ready",
  timestamp: "Now",
  ...overrides,
});

describe("buildStudioOutputsFromReferenceInput", () => {
  beforeEach(() => {
    mapUploadsFromFilesMock.mockReset();
  });

  it("routes file ingestion through mapUploadsFromFiles", async () => {
    const context = createContext();
    const expected = [makeOutput("upload-1")];
    mapUploadsFromFilesMock.mockResolvedValue(expected);

    const files = {
      length: 0,
      item: () => null,
    } as unknown as FileList;

    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "files",
        source: "filePicker",
        files,
      },
      context
    );

    expect(result.outputs).toBe(expected);
    expect(mapUploadsFromFilesMock).toHaveBeenCalledWith(
      files,
      "image",
      "9:16",
      "fal-ai/model",
      context.resolveModelLabel,
      context.randomId,
      "filePicker"
    );
  });

  it("passes drop source through canonical file ingestion", async () => {
    const context = createContext();
    const expected = [makeOutput("upload-drop-1")];
    mapUploadsFromFilesMock.mockResolvedValue(expected);

    const files = {
      length: 0,
      item: () => null,
    } as unknown as FileList;

    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "files",
        source: "drop",
        files,
      },
      context
    );

    expect(result.outputs).toBe(expected);
    expect(mapUploadsFromFilesMock).toHaveBeenCalledWith(
      files,
      "image",
      "9:16",
      "fal-ai/model",
      context.resolveModelLabel,
      context.randomId,
      "drop"
    );
  });

  it("throws for file ingestion on sync adapter", () => {
    const context = createContext();
    const files = {
      length: 0,
      item: () => null,
    } as unknown as FileList;

    expect(() =>
      buildStudioOutputsFromReferenceInputSync(
        {
          kind: "files",
          source: "filePicker",
          files,
        },
        context
      )
    ).toThrowError("does not support file inputs");
  });

  it("builds agent prompt reference output", async () => {
    const context = createContext();
    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "prompt",
        source: "agent",
        promptText: "  cinematic portrait  ",
      },
      context
    );

    expect(result.outputs).toHaveLength(1);
    const [output] = result.outputs;
    expect(output?.id).toBe("prompt-id-1");
    expect(output?.prompt).toBe("cinematic portrait");
    expect(output?.timestamp).toBe("Agent");
    expect(output?.mediaSource).toBe("prompt");
  });

  it("builds pasted prompt reference output", async () => {
    const context = createContext();
    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "prompt",
        source: "paste",
        promptText: "  drone shot over city  ",
      },
      context
    );

    expect(result.outputs).toHaveLength(1);
    const [output] = result.outputs;
    expect(output?.id).toBe("prompt-paste-id-1");
    expect(output?.timestamp).toBe("Clipboard");
    expect(output?.prompt).toBe("drone shot over city");
  });

  it("builds pasted media output with video semantics", async () => {
    const context = createContext();
    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "mediaUrl",
        source: "paste",
        url: "https://cdn.example.com/demo.mp4",
        mimeType: "video/mp4",
      },
      context
    );

    expect(result.outputs).toHaveLength(1);
    const [output] = result.outputs;
    expect(output?.id).toBe("media-paste-id-1");
    expect(output?.mode).toBe("video");
    expect(output?.previewTier).toBe("preview_loop");
    expect(output?.mediaSource).toBe("clipboard");
  });

  it("builds pasted media output with audio semantics", async () => {
    const context = createContext();
    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "mediaUrl",
        source: "paste",
        url: "https://cdn.example.com/demo.mp3",
        mimeType: "audio/mpeg",
      },
      context
    );

    expect(result.outputs).toHaveLength(1);
    const [output] = result.outputs;
    expect(output?.id).toBe("media-paste-id-1");
    expect(output?.mode).toBe("audio");
    expect(output?.previewTier).toBe("full");
    expect(output?.mediaSource).toBe("clipboard");
    expect(output?.mimeType).toBe("audio/mpeg");
  });

  it("builds library media output with generation source semantics", async () => {
    const context = createContext();
    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload: {
          id: "media-1",
          url: "https://example.com/preview.jpg",
          fileType: "image",
          filename: "Reference A",
          source: "ai_studio",
          previewStoragePath: "user/preview.jpg",
          fullStoragePath: "user/full.jpg",
        },
      },
      context
    );

    expect(result.outputs).toHaveLength(1);
    const [output] = result.outputs;
    expect(output?.id).toBe("library-id-1");
    expect(output?.timestamp).toBe("Generation");
    expect(output?.mediaSource).toBe("generated");
    expect(output?.previewStoragePath).toBe("user/preview.jpg");
    expect(output?.fullStoragePath).toBe("user/full.jpg");
    expect(output?.resultUrls).toEqual(["https://example.com/preview.jpg"]);
    expect(output?.savedMediaIds).toEqual(["media-1"]);
  });

  it("preserves distinct preview and full URLs for library media", async () => {
    const context = createContext();
    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload: {
          id: "media-2",
          url: "https://example.com/fallback-preview.jpg",
          fileType: "image",
          previewUrl: "https://example.com/thumb.jpg",
          fullUrl: "https://example.com/full.jpg",
          previewStoragePath: "user/thumb.jpg",
          fullStoragePath: "user/full.jpg",
        },
      },
      context
    );

    expect(result.outputs).toHaveLength(1);
    const [output] = result.outputs;
    expect(output?.previewUrl).toBe("https://example.com/thumb.jpg");
    expect(output?.resultUrls).toEqual(["https://example.com/full.jpg"]);
    expect(output?.previewStoragePath).toBe("user/thumb.jpg");
    expect(output?.fullStoragePath).toBe("user/full.jpg");
  });

  it("builds library video output with poster preview metadata", async () => {
    const context = createContext();
    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload: {
          id: "media-video-1",
          url: "https://example.com/video.mp4",
          fileType: "video",
          previewUrl: "https://example.com/poster.jpg",
          previewPosterUrl: "https://example.com/poster.jpg",
          fullUrl: "https://example.com/video.mp4",
          previewStoragePath: "user/variants/videos/media-video-1/poster_720.jpg",
          previewPosterStoragePath: "user/variants/videos/media-video-1/poster_720.jpg",
          fullStoragePath: "user/generations/videos/media-video-1.mp4",
        },
      },
      context
    );

    expect(result.outputs).toHaveLength(1);
    const [output] = result.outputs;
    expect(output?.mode).toBe("video");
    expect(output?.previewUrl).toBe("https://example.com/poster.jpg");
    expect(output?.previewPosterUrl).toBe("https://example.com/poster.jpg");
    expect(output?.previewPosterStoragePath).toBe(
      "user/variants/videos/media-video-1/poster_720.jpg"
    );
    expect(output?.resultUrls).toEqual(["https://example.com/video.mp4"]);
    expect(output?.previewStoragePath).toBe("user/variants/videos/media-video-1/poster_720.jpg");
    expect(output?.fullStoragePath).toBe("user/generations/videos/media-video-1.mp4");
  });

  it("builds library media output with audio semantics", async () => {
    const context = createContext();
    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload: {
          id: "media-audio-1",
          url: "https://example.com/library-audio.mp3",
          fileType: "audio",
          filename: "Library Audio",
          previewStoragePath: "user/library-audio.mp3",
          fullStoragePath: "user/library-audio.mp3",
        },
      },
      context
    );

    expect(result.outputs).toHaveLength(1);
    const [output] = result.outputs;
    expect(output?.mode).toBe("audio");
    expect(output?.previewTier).toBe("full");
    expect(output?.previewUrl).toBe("https://example.com/library-audio.mp3");
    expect(output?.resultUrls).toEqual(["https://example.com/library-audio.mp3"]);
    expect(output?.savedMediaIds).toEqual(["media-audio-1"]);
  });

  it("builds library prompt output with saved state", async () => {
    const context = createContext();
    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "libraryPrompt",
        source: "mediaLibrary",
        payload: {
          id: "prompt-1",
          promptText: "  dramatic skyline  ",
        },
      },
      context
    );

    expect(result.outputs).toHaveLength(1);
    const [output] = result.outputs;
    expect(output?.id).toBe("prompt-library-id-1");
    expect(output?.status).toBe("saved");
    expect(output?.timestamp).toBe("Library");
    expect(output?.promptId).toBe("prompt-1");
  });

  it("returns empty outputs for invalid prompt and media-url inputs", async () => {
    const context = createContext();
    const promptResult = await buildStudioOutputsFromReferenceInput(
      {
        kind: "prompt",
        source: "paste",
        promptText: "   ",
      },
      context
    );
    const mediaResult = await buildStudioOutputsFromReferenceInput(
      {
        kind: "mediaUrl",
        source: "paste",
        url: "   ",
      },
      context
    );

    expect(promptResult.outputs).toEqual([]);
    expect(mediaResult.outputs).toEqual([]);
  });
});
