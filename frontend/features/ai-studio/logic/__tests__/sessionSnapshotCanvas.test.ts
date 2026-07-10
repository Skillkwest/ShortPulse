import { describe, expect, it } from "vitest";
import {
  AI_STUDIO_CANVAS_ITEM_HARD_CAP,
  clampCanvasSceneItemsToHardCap,
  parseAiStudioSessionCanvasState,
  serializeAiStudioSessionCanvasState,
  type AiStudioSessionCanvasState,
} from "../sessionSnapshotCanvas";

const createCanvasState = (itemCount: number): AiStudioSessionCanvasState => ({
  items: Array.from({ length: itemCount }, (_, index) => ({
    id: `text-${index + 1}`,
    kind: "text" as const,
    x: index,
    y: index,
    z: index + 1,
    selected: index === itemCount - 1,
    outputId: null,
    sourceSurface: null,
    text: `Item ${index + 1}`,
    width: 260,
    height: 120,
  })),
  draftTextEntry: { x: 10, y: 20, value: "draft" },
  textEditSession: { itemId: "text-1", value: "editing" },
  draftOwnerInstanceId: "main",
  textEditOwnerInstanceId: "rail",
  mainCamera: { x: 0, y: 0, zoom: 1 },
  railCamera: { x: 4, y: -8, zoom: 1.2 },
});

describe("sessionSnapshotCanvas", () => {
  it("enforces the hard cap with deterministic z-order trimming", () => {
    const items = Array.from({ length: AI_STUDIO_CANVAS_ITEM_HARD_CAP + 5 }, (_, index) => ({
      id: `item-${index + 1}`,
      kind: "text" as const,
      x: index,
      y: index,
      z: index + 1,
      selected: false,
      outputId: null,
      sourceSurface: null,
      text: `Text ${index + 1}`,
      width: 260,
      height: 120,
    }));

    const capped = clampCanvasSceneItemsToHardCap(items);
    expect(capped).toHaveLength(AI_STUDIO_CANVAS_ITEM_HARD_CAP);
    expect(capped[0]?.id).toBe("item-6");
    expect(capped.at(-1)?.id).toBe(`item-${AI_STUDIO_CANVAS_ITEM_HARD_CAP + 5}`);
  });

  it("preserves selected live-session items when hard-cap trimming applies", () => {
    const items = Array.from({ length: AI_STUDIO_CANVAS_ITEM_HARD_CAP + 1 }, (_, index) => ({
      id: `item-${index + 1}`,
      kind: "text" as const,
      x: index,
      y: index,
      z: index + 1,
      selected: index === 0,
      outputId: null,
      sourceSurface: null,
      text: `Text ${index + 1}`,
      width: 260,
      height: 120,
    }));

    const capped = clampCanvasSceneItemsToHardCap(items);
    expect(capped).toHaveLength(AI_STUDIO_CANVAS_ITEM_HARD_CAP);
    expect(capped.some((item) => item.id === "item-1" && item.selected)).toBe(true);
    expect(capped.some((item) => item.id === "item-2")).toBe(false);
    expect(capped.at(-1)?.id).toBe(`item-${AI_STUDIO_CANVAS_ITEM_HARD_CAP + 1}`);
  });

  it("serializes durable canvas state and drops non-durable image URLs", () => {
    const state = createCanvasState(AI_STUDIO_CANVAS_ITEM_HARD_CAP + 1);
    const renderImageUrl =
      "https://project.supabase.co/storage/v1/render/image/sign/media_library/user-1/render.png?token=test-token&width=320";
    state.items.unshift({
      id: "blob-image",
      kind: "image",
      x: 1,
      y: 2,
      z: 99,
      selected: false,
      outputId: null,
      sourceSurface: "all-refs",
      mediaId: null,
      src: "blob:http://localhost/non-durable",
      alt: "blob",
      width: 220,
      height: 123,
    });
    state.items.unshift({
      id: "render-image",
      kind: "image",
      x: 1,
      y: 2,
      z: 100,
      selected: false,
      outputId: null,
      sourceSurface: "all-refs",
      mediaId: null,
      src: renderImageUrl,
      alt: "render",
      width: 220,
      height: 123,
    });

    const snapshot = serializeAiStudioSessionCanvasState(state);

    expect(snapshot.scene.items).toHaveLength(AI_STUDIO_CANVAS_ITEM_HARD_CAP);
    expect(snapshot.meta.truncatedItemCount).toBe(1);
    expect(snapshot.meta.skippedNonDurableImageCount).toBe(2);
    expect(snapshot.transient.draftOwnerInstanceId).toBe("main");
    expect(snapshot.viewports.rail.zoom).toBe(1.2);
  });

  it("parses partial canvas payloads safely with normalized defaults", () => {
    const parsed = parseAiStudioSessionCanvasState({
      scene: {
        items: [
          {
            id: "text-1",
            kind: "text",
            x: 10,
            y: 20,
            z: 1,
            selected: true,
            outputId: null,
            sourceSurface: "all-refs",
            text: "hello",
            width: 260,
            height: 180,
          },
          {
            id: "image-1",
            kind: "image",
            x: 4,
            y: 8,
            z: 2,
            selected: false,
            outputId: null,
            sourceSurface: "curated",
            mediaId: null,
            src: "https://example.com/image.png",
            alt: "image",
            width: 220,
            height: 110,
          },
        ],
      },
      viewports: {
        main: { x: 1.111, y: -2.222, zoom: 9 },
        rail: { x: 0, y: 0, zoom: -1 },
      },
      transient: {
        draftTextEntry: { x: 1, y: 2, value: "draft" },
        textEditSession: { itemId: "text-1", value: "editing" },
        draftOwnerInstanceId: "rail",
        textEditOwnerInstanceId: "main",
      },
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.items).toHaveLength(2);
    expect(parsed?.mainCamera.zoom).toBe(2.5);
    expect(parsed?.railCamera.zoom).toBe(0.2);
    expect(parsed?.draftOwnerInstanceId).toBe("rail");
    expect(parsed?.textEditSession?.itemId).toBe("text-1");
  });

  it("round-trips resized text widths through session serialization", () => {
    const state = createCanvasState(1);
    state.items = [
      {
        id: "text-resized",
        kind: "text",
        x: 42,
        y: 84,
        z: 1,
        selected: true,
        outputId: null,
        sourceSurface: null,
        text: "Wide note",
        width: 412,
        height: 236,
      },
    ];

    const snapshot = serializeAiStudioSessionCanvasState(state);
    expect(snapshot.scene.items[0]).toMatchObject({
      id: "text-resized",
      width: 412,
      height: 236,
    });

    const parsed = parseAiStudioSessionCanvasState(snapshot);
    expect(parsed?.items[0]).toMatchObject({
      id: "text-resized",
      width: 412,
      height: 236,
    });
  });

  it("round-trips durable audio canvas items without coercing optional metadata", () => {
    const state = createCanvasState(0);
    state.items = [
      {
        id: "audio-1",
        kind: "audio",
        x: 12,
        y: 24,
        z: 3,
        selected: true,
        outputId: "output-audio-1",
        sourceSurface: "all-refs",
        mediaId: "media-audio-1",
        audioUrl: "https://example.com/audio-reference.mp3",
        audioStoragePath: "user-1/audio/audio-reference.mp3",
        title: "Canvas audio",
        companionArtUrl: "https://example.com/audio-reference-cover.webp",
        companionArtStoragePath: "user-1/audio/audio-reference-cover.webp",
        audioSourceMode: "sound-effects",
        durationMs: null,
        waveformPeaks: [10, 45, 80, 45, 10],
        width: 160,
        height: 200,
      },
    ];

    const snapshot = serializeAiStudioSessionCanvasState(state);
    expect(snapshot.scene.items).toEqual([
      expect.objectContaining({
        id: "audio-1",
        kind: "audio",
        audioStoragePath: "user-1/audio/audio-reference.mp3",
        title: "Canvas audio",
        companionArtUrl: "https://example.com/audio-reference-cover.webp",
        companionArtStoragePath: "user-1/audio/audio-reference-cover.webp",
        audioSourceMode: "sound-effects",
        durationMs: null,
        waveformPeaks: [10, 45, 80, 45, 10],
        width: 200,
        height: 200,
      }),
    ]);

    const parsed = parseAiStudioSessionCanvasState(snapshot);
    expect(parsed?.items).toEqual([
      expect.objectContaining({
        id: "audio-1",
        kind: "audio",
        audioStoragePath: "user-1/audio/audio-reference.mp3",
        title: "Canvas audio",
        companionArtUrl: "https://example.com/audio-reference-cover.webp",
        companionArtStoragePath: "user-1/audio/audio-reference-cover.webp",
        audioSourceMode: "sound-effects",
        durationMs: null,
        waveformPeaks: [10, 45, 80, 45, 10],
        width: 200,
        height: 200,
      }),
    ]);
  });

  it("bounds oversized audio waveform peaks in canvas snapshots", () => {
    const state = createCanvasState(0);
    state.items = [
      {
        id: "audio-1",
        kind: "audio",
        x: 12,
        y: 24,
        z: 3,
        selected: true,
        outputId: "output-audio-1",
        sourceSurface: "all-refs",
        mediaId: "media-audio-1",
        audioUrl: "https://example.com/audio-reference.mp3",
        audioStoragePath: "user-1/audio/audio-reference.mp3",
        title: "Canvas audio",
        companionArtUrl: null,
        companionArtStoragePath: null,
        audioSourceMode: "sound-effects",
        durationMs: null,
        waveformPeaks: Array.from({ length: 500 }, (_, index) => index % 101),
        width: 160,
        height: 200,
      },
    ];

    const snapshot = serializeAiStudioSessionCanvasState(state);
    const item = snapshot.scene.items[0];
    expect(item?.kind).toBe("audio");
    expect(item?.kind === "audio" ? item.waveformPeaks : null).toHaveLength(56);
    const parsedItem = parseAiStudioSessionCanvasState(snapshot)?.items[0];
    expect(parsedItem?.kind).toBe("audio");
    expect(parsedItem?.kind === "audio" ? parsedItem.waveformPeaks : null).toHaveLength(56);
  });

  it("round-trips durable video canvas items with poster metadata", () => {
    const state = createCanvasState(0);
    state.items = [
      {
        id: "video-1",
        kind: "video",
        x: 18,
        y: 36,
        z: 4,
        selected: true,
        outputId: "output-video-1",
        sourceSurface: "curated",
        mediaId: "media-video-1",
        videoUrl: "https://example.com/video-reference.mp4",
        videoStoragePath: "user-1/video/video-reference.mp4",
        posterUrl: "https://example.com/video-reference-poster.webp",
        posterStoragePath: "user-1/video/video-reference-poster.webp",
        title: "Canvas video",
        durationMs: 8_000,
        width: 275,
        height: 154.69,
      },
    ];

    const snapshot = serializeAiStudioSessionCanvasState(state);
    expect(snapshot.scene.items).toEqual([
      expect.objectContaining({
        id: "video-1",
        kind: "video",
        videoUrl: "https://example.com/video-reference.mp4",
        videoStoragePath: "user-1/video/video-reference.mp4",
        posterUrl: "https://example.com/video-reference-poster.webp",
        posterStoragePath: "user-1/video/video-reference-poster.webp",
        title: "Canvas video",
        durationMs: 8_000,
      }),
    ]);

    const parsed = parseAiStudioSessionCanvasState(snapshot);
    expect(parsed?.items).toEqual([
      expect.objectContaining({
        id: "video-1",
        kind: "video",
        videoUrl: "https://example.com/video-reference.mp4",
        videoStoragePath: "user-1/video/video-reference.mp4",
        posterUrl: "https://example.com/video-reference-poster.webp",
        posterStoragePath: "user-1/video/video-reference-poster.webp",
        title: "Canvas video",
        durationMs: 8_000,
        width: 275,
        height: 154.69,
      }),
    ]);
  });

  it("drops non-durable audio URLs during serialization", () => {
    const state = createCanvasState(0);
    state.items = [
      {
        id: "audio-blob",
        kind: "audio",
        x: 0,
        y: 0,
        z: 1,
        selected: false,
        outputId: null,
        sourceSurface: null,
        mediaId: null,
        audioUrl: "blob:http://localhost/transient-audio",
        title: "Transient audio",
        durationMs: 1500,
        waveformPeaks: [20, 50, 20],
        width: 160,
        height: 200,
      },
    ];

    const snapshot = serializeAiStudioSessionCanvasState(state);
    expect(snapshot.scene.items).toHaveLength(0);
    expect(snapshot.meta.skippedNonDurableImageCount).toBe(1);
  });

  it("round-trips image storage authority and rejects signed URLs as storage paths", () => {
    const state = createCanvasState(0);
    state.items = [
      {
        id: "image-with-storage",
        kind: "image",
        x: 10,
        y: 20,
        z: 2,
        selected: false,
        outputId: null,
        sourceSurface: "all-refs",
        mediaId: null,
        src: "https://signed.shortpulse.test/render/image.png",
        srcStoragePath: "user-1/images/canonical-image.png",
        alt: "Stored image",
        width: 320,
        height: 180,
      },
      {
        id: "image-with-signed-storage",
        kind: "image",
        x: 20,
        y: 30,
        z: 3,
        selected: false,
        outputId: null,
        sourceSurface: "all-refs",
        mediaId: null,
        src: "https://signed.shortpulse.test/render/signed-image.png",
        srcStoragePath: "https://signed.shortpulse.test/not-a-storage-path.png",
        alt: "Signed path should not persist as authority",
        width: 320,
        height: 180,
      },
    ];

    const snapshot = serializeAiStudioSessionCanvasState(state);
    expect(snapshot.scene.items).toEqual([
      expect.objectContaining({
        id: "image-with-storage",
        srcStoragePath: "user-1/images/canonical-image.png",
      }),
      expect.objectContaining({
        id: "image-with-signed-storage",
        srcStoragePath: null,
      }),
    ]);

    const parsed = parseAiStudioSessionCanvasState(snapshot);
    expect(parsed?.items[0]).toMatchObject({
      id: "image-with-storage",
      srcStoragePath: "user-1/images/canonical-image.png",
    });
    expect(parsed?.items[1]).toMatchObject({
      id: "image-with-signed-storage",
    });
    expect(parsed?.items[1]).not.toHaveProperty("srcStoragePath");
  });
});
