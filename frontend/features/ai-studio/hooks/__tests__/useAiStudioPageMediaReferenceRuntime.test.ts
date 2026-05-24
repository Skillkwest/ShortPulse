import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { InternalReferenceDragPayload } from "../../utils/dragDrop";
import type { StudioOutput } from "../../types";
import { useAiStudioPageMediaReferenceRuntime } from "../useAiStudioPageMediaReferenceRuntime";

vi.mock("../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

vi.mock("../../components/canvas/useAiStudioCanvasWorkspaceState", () => ({
  useAiStudioDualCanvasWorkspaceState: () => ({
    railCanvasProps: {},
    sessionState: {
      items: [],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    },
    hydrateSessionState: vi.fn(),
  }),
}));

const makeOutput = (overrides: Partial<StudioOutput>): StudioOutput =>
  ({
    id: "output-1",
    prompt: "Reference clip",
    mode: "video",
    aspect: "16:9",
    model: "Test model",
    status: "ready",
    timestamp: "now",
    taskState: "success",
    mediaSource: "generated",
    resultUrls: [],
    savedMediaIds: [],
    ...overrides,
  }) as StudioOutput;

const makePayload = (
  overrides: Partial<InternalReferenceDragPayload> = {}
): InternalReferenceDragPayload => ({
  origin: "ai-studio-reference-grid",
  referenceId: "output-1",
  outputId: "output-1",
  mediaId: null,
  imageIndex: 0,
  mediaKind: "video",
  referenceUrl: "https://signed.shortpulse.test/reference.mp4",
  referenceRenderUrl: "https://signed.shortpulse.test/reference.mp4",
  sourceSurface: "curated",
  ...overrides,
});

describe("useAiStudioPageMediaReferenceRuntime", () => {
  const defaultParams = {
    addCuratedReference: vi.fn(),
    addLibraryMediaReferenceToQuickSlot: vi.fn(async () => null),
    addLibraryPromptReferenceToQuickSlot: vi.fn(() => null),
    addPastedPromptReference: vi.fn(),
    reorderCuratedReference: vi.fn(),
    setActiveOutputId: vi.fn(),
  };

  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("resolves a storage-backed reference-grid video for the voice changer pipeline", async () => {
    const output = makeOutput({
      id: "output-video-1",
      prompt: "Launch cut",
      durationMs: 12_500,
      mimeType: "video/mp4",
      fullStoragePath: "user-1/generations/video/output-video-1/full.mp4",
      resultUrls: ["https://signed.shortpulse.test/reference-video.mp4"],
      savedMediaIds: ["media-video-1"],
    });

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
      })
    );

    const resolved = await result.current.resolveVoiceChangerInternalReferenceSource(
      makePayload({
        outputId: output.id,
        referenceId: output.id,
        referenceUrl: "https://signed.shortpulse.test/reference-video.mp4",
      })
    );

    expect(resolved).toMatchObject({
      kind: "video",
      origin: "reference-grid",
      name: "Launch cut",
      mimeType: "video/mp4",
      sourceUrl: "https://signed.shortpulse.test/reference-video.mp4",
      previewUrl: "https://signed.shortpulse.test/reference-video.mp4",
      storagePath: "user-1/generations/video/output-video-1/full.mp4",
      durationMs: 12_500,
      referenceOutputId: "output-video-1",
      referenceMediaId: "media-video-1",
    });
    expect(resolved?.file).toBeNull();
  });

  it("falls back to a browser file when a reference-grid video only has a local blob URL", async () => {
    const output = makeOutput({
      id: "output-local-video-1",
      prompt: "Local clip",
      durationMs: 8_000,
      mimeType: "video/mp4",
      localObjectUrl: "blob:https://shortpulse.test/local-video-1",
      previewUrl: "blob:https://shortpulse.test/local-video-1",
      savedMediaIds: ["media-local-video-1"],
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("blob:https://shortpulse.test/local-video-1");
      return {
        ok: true,
        blob: async () => new Blob(["video"], { type: "video/mp4" }),
      } as Response;
    }) as typeof fetch;

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
      })
    );

    const resolved = await result.current.resolveVoiceChangerInternalReferenceSource(
      makePayload({
        outputId: output.id,
        referenceId: output.id,
        referenceUrl: output.localObjectUrl,
        referenceRenderUrl: output.localObjectUrl,
      })
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(resolved).toMatchObject({
      kind: "video",
      origin: "reference-grid",
      referenceOutputId: "output-local-video-1",
      referenceMediaId: "media-local-video-1",
      durationMs: 8_000,
      storagePath: null,
    });
    expect(resolved?.file).toBeInstanceOf(File);
    expect(resolved?.file?.name).toBe("Local clip.mp4");
    expect(resolved?.file?.type).toBe("video/mp4");
  });
});
