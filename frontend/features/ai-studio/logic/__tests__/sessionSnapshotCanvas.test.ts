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

  it("serializes durable canvas state and drops non-durable image URLs", () => {
    const state = createCanvasState(AI_STUDIO_CANVAS_ITEM_HARD_CAP + 1);
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

    const snapshot = serializeAiStudioSessionCanvasState(state);

    expect(snapshot.scene.items).toHaveLength(AI_STUDIO_CANVAS_ITEM_HARD_CAP);
    expect(snapshot.meta.truncatedItemCount).toBe(1);
    expect(snapshot.meta.skippedNonDurableImageCount).toBe(1);
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
        title: "Canvas audio",
        companionArtUrl: "https://example.com/audio-reference-cover.webp",
        companionArtStoragePath: "user-1/audio/audio-reference-cover.webp",
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
        title: "Canvas audio",
        companionArtUrl: "https://example.com/audio-reference-cover.webp",
        companionArtStoragePath: "user-1/audio/audio-reference-cover.webp",
        durationMs: null,
        waveformPeaks: [10, 45, 80, 45, 10],
      }),
    ]);

    const parsed = parseAiStudioSessionCanvasState(snapshot);
    expect(parsed?.items).toEqual([
      expect.objectContaining({
        id: "audio-1",
        kind: "audio",
        title: "Canvas audio",
        companionArtUrl: "https://example.com/audio-reference-cover.webp",
        companionArtStoragePath: "user-1/audio/audio-reference-cover.webp",
        durationMs: null,
        waveformPeaks: [10, 45, 80, 45, 10],
        width: 160,
        height: 200,
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
});
