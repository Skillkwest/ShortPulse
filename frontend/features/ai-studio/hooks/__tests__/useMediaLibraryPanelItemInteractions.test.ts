import type React from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readMediaLibraryDragPayload } from "../../logic/mediaLibraryDragPayload";
import type { MediaFileRow } from "../../logic/mediaLibraryModalModel";
import { useMediaLibraryPanelItemInteractions } from "../useMediaLibraryPanelItemInteractions";
import { extractPromptDropText, hasInternalReferenceDragTypeHints } from "../../utils/dragDrop";

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
} as const;

const styleContext = {
  applied: true,
  styleId: "style-1",
  styleName: "Digicam Photorealism",
  stylePrompt: "photoreal editorial lighting",
} as const;

const createMutableTransfer = () => {
  const store = new Map<string, string>();
  return {
    get types() {
      return Array.from(store.keys());
    },
    getData: (type: string) => store.get(type) ?? "",
    setData: (type: string, value: string) => {
      store.set(type, value);
    },
    setDragImage: vi.fn(),
    effectAllowed: "all",
  } as unknown as DataTransfer;
};

describe("useMediaLibraryPanelItemInteractions", () => {
  it("starts media drags from durable storage identity when signedUrl is not ready", () => {
    const file: MediaFileRow = {
      id: "media-1",
      filename: "stored-frame.png",
      storage_path: "user-1/media/stored-frame.png",
      preview_storage_path: "user-1/media/thumbs/stored-frame.webp",
      file_type: "image/png",
      metadata: { prompt: "Stored frame" },
      signedUrl: null,
    };
    const currentTarget = document.createElement("button");
    const dataTransfer = createMutableTransfer();
    const preventDefault = vi.fn();
    const { result } = renderHook(() =>
      useMediaLibraryPanelItemInteractions({
        activeFolderId: "all_items",
      })
    );

    result.current.handleMediaCardDragStart(
      {
        currentTarget,
        dataTransfer,
        preventDefault,
      } as unknown as React.DragEvent<HTMLElement>,
      file
    );

    const payload = readMediaLibraryDragPayload(dataTransfer);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(dataTransfer.effectAllowed).toBe("copy");
    expect(currentTarget).toHaveClass("is-dragging");
    expect(payload).toMatchObject({
      kind: "libraryMedia",
      payload: {
        id: "media-1",
        url: "user-1/media/stored-frame.png",
        previewStoragePath: "user-1/media/thumbs/stored-frame.webp",
        fullStoragePath: "user-1/media/stored-frame.png",
      },
    });
  });

  it("writes rendered video card aspect into media drag dimensions", () => {
    const file: MediaFileRow = {
      id: "media-video-1",
      filename: "wide-video.mp4",
      storage_path: "user-1/media/wide-video.mp4",
      preview_storage_path: "user-1/variants/wide-video-poster.webp",
      poster_variant_path: "user-1/variants/wide-video-poster.webp",
      file_type: "video/mp4",
      metadata: null,
      signedUrl: "https://signed.example.com/wide-video.mp4",
    };
    const currentTarget = document.createElement("button");
    const dataTransfer = createMutableTransfer();
    const { result } = renderHook(() =>
      useMediaLibraryPanelItemInteractions({
        activeFolderId: "all_items",
      })
    );

    result.current.handleMediaCardDragStart(
      {
        currentTarget,
        dataTransfer,
        preventDefault: vi.fn(),
      } as unknown as React.DragEvent<HTMLElement>,
      file,
      {
        aspectRatio: 16 / 9,
        posterPreviewUrl: "https://signed.example.com/wide-video-poster.webp",
      }
    );

    const payload = readMediaLibraryDragPayload(dataTransfer);
    expect(payload).toMatchObject({
      kind: "libraryMedia",
      payload: {
        id: "media-video-1",
        fileType: "video",
        width: 1820,
        height: 1024,
      },
    });
  });

  it("writes video drag payloads for path-proven videos with stale file_type", () => {
    const file: MediaFileRow = {
      id: "media-stale-video-1",
      filename: "restored-video.png",
      storage_path: "user-1/media/restored-video.mp4",
      preview_storage_path: "user-1/media/restored-video.mp4",
      poster_variant_path: "user-1/media/restored-video-poster.jpg",
      file_type: "image/png",
      metadata: null,
      signedUrl: "https://signed.example.com/restored-video.mp4",
    };
    const currentTarget = document.createElement("button");
    const dataTransfer = createMutableTransfer();
    const { result } = renderHook(() =>
      useMediaLibraryPanelItemInteractions({
        activeFolderId: "all_items",
      })
    );

    result.current.handleMediaCardDragStart(
      {
        currentTarget,
        dataTransfer,
        preventDefault: vi.fn(),
      } as unknown as React.DragEvent<HTMLElement>,
      file,
      {
        aspectRatio: 16 / 9,
        posterPreviewUrl: "https://signed.example.com/restored-video-poster.jpg",
      }
    );

    const payload = readMediaLibraryDragPayload(dataTransfer);
    expect(payload).toMatchObject({
      kind: "libraryMedia",
      payload: {
        id: "media-stale-video-1",
        fileType: "video",
        previewPosterStoragePath: "user-1/media/restored-video-poster.jpg",
      },
    });
  });

  it("preserves generated metadata in media drags from saved AI Studio rows", () => {
    const file: MediaFileRow = {
      id: "media-generated-1",
      filename: "generated.png",
      storage_path: "user-1/media/generated.png",
      preview_storage_path: "user-1/media/generated-thumb.webp",
      file_type: "image/png",
      source: "ai_studio",
      source_ref: "generation-1",
      metadata: {
        model_id: "fal-ai/imagen4/preview",
        workflow_reload: workflowReload,
        generation_replay: generationReplay,
        character_context: characterContext,
        style_context: styleContext,
      },
      signedUrl: "https://signed.example.com/generated.png",
    };
    const currentTarget = document.createElement("button");
    const dataTransfer = createMutableTransfer();
    const { result } = renderHook(() =>
      useMediaLibraryPanelItemInteractions({
        activeFolderId: "all_items",
      })
    );

    result.current.handleMediaCardDragStart(
      {
        currentTarget,
        dataTransfer,
        preventDefault: vi.fn(),
      } as unknown as React.DragEvent<HTMLElement>,
      file
    );

    expect(readMediaLibraryDragPayload(dataTransfer)).toMatchObject({
      kind: "libraryMedia",
      payload: {
        id: "media-generated-1",
        source: "ai_studio",
        sourceRef: "generation-1",
        modelId: "fal-ai/imagen4/preview",
        workflowReload,
        generationReplay,
        characterContext,
        styleContext,
      },
    });
  });

  it("uses session-backed full prompt text for saved prompt card drags", () => {
    const currentTarget = document.createElement("button");
    const dataTransfer = createMutableTransfer();
    const fullPrompt = `Saved prompt opening. ${"Detailed shot direction. ".repeat(80)}Saved prompt ending.`;
    const shortenedPrompt = fullPrompt.slice(0, 1000);
    const { result } = renderHook(() =>
      useMediaLibraryPanelItemInteractions({
        activeFolderId: "prompt-folder",
      })
    );

    result.current.handlePromptCardDragStart(
      {
        currentTarget,
        dataTransfer,
        preventDefault: vi.fn(),
      } as unknown as React.DragEvent<HTMLButtonElement>,
      {
        id: "prompt-long-1",
        title: "Long prompt",
        prompt_text: fullPrompt,
        created_at: "2026-06-25T00:00:00.000Z",
      }
    );
    dataTransfer.setData("text/prompt", shortenedPrompt);
    dataTransfer.setData("text/plain", shortenedPrompt);

    const payload = readMediaLibraryDragPayload(dataTransfer);
    expect(payload).toMatchObject({
      kind: "libraryPrompt",
      payload: {
        id: "prompt-long-1",
        promptText: fullPrompt,
      },
    });
    expect(hasInternalReferenceDragTypeHints(dataTransfer)).toBe(false);
    expect(extractPromptDropText(dataTransfer)).toBe(fullPrompt);
  });
});
