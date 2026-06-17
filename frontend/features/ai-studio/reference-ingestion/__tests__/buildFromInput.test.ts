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

describe("buildStudioOutputsFromReferenceInput", () => {
  beforeEach(() => {
    mapUploadsFromFilesMock.mockReset();
  });

  it("routes file ingestion through mapUploadsFromFiles", async () => {
    const context = createContext();
    const expected = [makeOutput("upload-1")];
    mapUploadsFromFilesMock.mockResolvedValue({ outputs: expected, rejectedFileCount: 0 });

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
    mapUploadsFromFilesMock.mockResolvedValue({ outputs: expected, rejectedFileCount: 0 });

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
    const context: ReferenceIngestionContext = {
      ...createContext(),
      nowIso: () => "2026-05-25T12:34:56.000Z",
    };
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
          createdAt: "2026-05-01T00:00:00.000Z",
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
    expect(output?.mediaSource).toBe("library");
    expect(output?.createdAt).toBe("2026-05-25T12:34:56.000Z");
    expect(output?.previewStoragePath).toBe("user/preview.jpg");
    expect(output?.fullStoragePath).toBe("user/full.jpg");
    expect(output?.resultUrls).toEqual(["https://example.com/preview.jpg"]);
    expect(output?.savedMediaIds).toEqual(["media-1"]);
    expect(output?.saveState).toBe("saved");
  });

  it("builds reloadable generated output from AI Studio library media with workflow metadata", async () => {
    const context: ReferenceIngestionContext = {
      ...createContext(),
      nowIso: () => "2026-05-25T12:34:56.000Z",
    };
    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload: {
          id: "media-generated-1",
          url: "https://example.com/preview.jpg",
          fileType: "image",
          filename: "Reference A",
          source: "ai_studio",
          sourceRef: "generation-1",
          generationId: "generation-1",
          workflowReload,
          previewStoragePath: "user/preview.jpg",
          fullStoragePath: "user/full.jpg",
        },
      },
      context
    );

    expect(result.outputs).toHaveLength(1);
    const [output] = result.outputs;
    expect(output).toEqual(
      expect.objectContaining({
        id: "library-id-1",
        prompt: "A glass lighthouse",
        mode: "image",
        aspect: "16:9",
        model: "fal-ai/imagen4/preview",
        modelId: "fal-ai/imagen4/preview",
        generationId: "generation-1",
        timestamp: "Generation",
        mediaSource: "generated",
        createdAt: "2026-05-25T12:34:56.000Z",
        workflowReload,
        savedMediaIds: ["media-generated-1"],
      })
    );
  });

  it("preserves workflow metadata when an AI Studio video reference has legacy image-shaped reload metadata", async () => {
    const context: ReferenceIngestionContext = {
      ...createContext(),
      nowIso: () => "2026-05-25T12:34:56.000Z",
    };
    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload: {
          id: "media-video-legacy-reload-1",
          url: "https://example.com/signed-generated-video",
          fileType: "video",
          filename: "Generated video.mp4",
          source: "ai_studio",
          sourceRef: "generation-video-1",
          generationId: "generation-video-1",
          modelId: "kie-ai/kling-3.0",
          workflowReload,
          previewStoragePath: "user/video/preview.mp4",
          previewPosterStoragePath: "user/video/poster.jpg",
          fullStoragePath: "user/video/full.mp4",
        },
      },
      context
    );

    expect(result.outputs).toHaveLength(1);
    const [output] = result.outputs;
    expect(output).toEqual(
      expect.objectContaining({
        id: "library-id-1",
        mode: "video",
        model: "kie-ai/kling-3.0",
        modelId: "kie-ai/kling-3.0",
        mediaSource: "generated",
        generationId: "generation-video-1",
        workflowReload,
        previewTier: "preview_loop",
        previewPosterStoragePath: "user/video/poster.jpg",
      })
    );
  });

  it("builds library media output from durable authority without a current signed URL", async () => {
    const context: ReferenceIngestionContext = {
      ...createContext(),
      nowIso: () => "2026-05-25T12:34:56.000Z",
    };
    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload: {
          id: "media-durable-1",
          url: null,
          fileType: "image",
          filename: "Durable Reference",
          previewStoragePath: "user/variants/images/durable/thumb.webp",
          fullStoragePath: "user/generations/images/durable/full.png",
        },
      },
      context
    );

    expect(result.outputs).toHaveLength(1);
    const [output] = result.outputs;
    expect(output?.previewUrl).toBeUndefined();
    expect(output?.resultUrls).toBeUndefined();
    expect(output?.previewStoragePath).toBe("user/variants/images/durable/thumb.webp");
    expect(output?.fullStoragePath).toBe("user/generations/images/durable/full.png");
    expect(output?.savedMediaIds).toEqual(["media-durable-1"]);
    expect(output?.createdAt).toBe("2026-05-25T12:34:56.000Z");
  });

  it("stamps library prompt references with the grid insertion time", async () => {
    const context: ReferenceIngestionContext = {
      ...createContext(),
      nowIso: () => "2026-05-25T12:34:56.000Z",
    };
    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "libraryPrompt",
        source: "mediaLibrary",
        payload: {
          id: "prompt-1",
          promptText: "  moody studio portrait  ",
          createdAt: "2026-05-01T00:00:00.000Z",
        },
      },
      context
    );

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]).toEqual(
      expect.objectContaining({
        id: "prompt-library-id-1",
        prompt: "moody studio portrait",
        timestamp: "Library",
        createdAt: "2026-05-25T12:34:56.000Z",
        mediaSource: "prompt",
      })
    );
  });

  it("preserves transcript text for library media outputs", async () => {
    const context = createContext();
    const result = await buildStudioOutputsFromReferenceInput(
      {
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload: {
          id: "media-transcript-1",
          url: "https://example.com/voice-video.mp4",
          fileType: "video",
          filename: "clip.mp4 -> Narrator video",
          promptText: "clip.mp4 -> Narrator video",
          transcriptText: "I can hear the city waking up below us.",
          source: "ai_studio",
        },
      },
      context
    );

    expect(result.outputs).toHaveLength(1);
    expect(result.outputs[0]).toEqual(
      expect.objectContaining({
        prompt: "clip.mp4 -> Narrator video",
        transcriptText: "I can hear the city waking up below us.",
        mediaSource: "library",
      })
    );
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
          previewStoragePath: "user/generations/videos/media-video-1.mp4",
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
    expect(output?.previewStoragePath).toBe("user/generations/videos/media-video-1.mp4");
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
          companionArtUrl: "https://example.com/library-audio-cover.webp",
          companionArtStoragePath: "user/library-audio-cover.webp",
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
    expect(output?.companionArtUrl).toBe("https://example.com/library-audio-cover.webp");
    expect(output?.companionArtStoragePath).toBe("user/library-audio-cover.webp");
    expect(output?.savedMediaIds).toEqual(["media-audio-1"]);
    expect(output?.saveState).toBe("saved");
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
