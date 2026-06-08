import { describe, expect, it } from "vitest";
import { buildCanvasTearOutPayload } from "../canvasTearOutPayload";
import type { CanvasSceneItem } from "../canvasTypes";
import type { StudioOutput } from "../../../types";

const baseItem = {
  x: 10,
  y: 20,
  z: 1,
  width: 120,
  height: 90,
  selected: false,
  sourceSurface: null,
} satisfies Omit<CanvasSceneItem, "id" | "kind" | "outputId">;

const makeOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "output-image-1",
  prompt: "Output prompt",
  mode: "image",
  aspect: "16:9",
  model: "Test model",
  status: "ready",
  timestamp: "now",
  previewUrl: "https://cdn.shortpulse.test/output.png",
  resultUrls: ["https://cdn.shortpulse.test/output.png"],
  savedMediaIds: ["media-output-1"],
  previewStoragePath: "user/output-preview.png",
  fullStoragePath: "user/output-full.png",
  mimeType: "image/png",
  ...overrides,
});

describe("buildCanvasTearOutPayload", () => {
  it("exports trimmed text items", () => {
    const payload = buildCanvasTearOutPayload({
      ...baseItem,
      id: "text-1",
      kind: "text",
      outputId: null,
      text: "  Prompt from Canvas  ",
      width: 260,
      height: 88,
    });

    expect(payload).toEqual({
      kind: "text",
      text: "Prompt from Canvas",
    });
  });

  it("rejects empty text items", () => {
    const payload = buildCanvasTearOutPayload({
      ...baseItem,
      id: "text-empty",
      kind: "text",
      outputId: null,
      text: "   ",
      width: 260,
      height: 88,
    });

    expect(payload).toEqual({
      kind: "unsupported",
      reason: "empty_text",
    });
  });

  it("exports image items with live output authority", () => {
    const output = makeOutput();
    const payload = buildCanvasTearOutPayload(
      {
        ...baseItem,
        id: "image-1",
        kind: "image",
        outputId: output.id,
        mediaId: "media-item-1",
        src: "https://cdn.shortpulse.test/canvas.png",
        alt: "Canvas image",
        width: 320,
        height: 180,
      },
      {
        getOutputById: (id) => (id === output.id ? output : null),
      }
    );

    expect(payload).toMatchObject({
      kind: "image",
      internalPayload: {
        referenceId: "output-image-1",
        outputId: "output-image-1",
        mediaId: "media-item-1",
        mediaKind: "image",
        previewStoragePath: "user/output-preview.png",
        fullStoragePath: "user/output-full.png",
        referenceUrl: "https://cdn.shortpulse.test/output.png",
        referenceRenderUrl: "https://cdn.shortpulse.test/canvas.png",
        sourceSurface: "all-refs",
        width: 320,
        height: 180,
        sessionBacked: true,
      },
      composerImagePayload: {
        referenceId: "output-image-1",
        outputId: "output-image-1",
        mediaId: "media-item-1",
        displayArtifactUrl: "https://cdn.shortpulse.test/canvas.png",
        displayArtifactKind: "url",
        promptText: "Output prompt",
        mimeType: "image/png",
      },
    });
  });

  it("exports restored mediaId-only image items without live output", () => {
    const payload = buildCanvasTearOutPayload({
      ...baseItem,
      id: "image-media-only",
      kind: "image",
      outputId: null,
      mediaId: "media-restored-1",
      src: "https://cdn.shortpulse.test/restored-signed.png",
      alt: "Restored image",
      width: 200,
      height: 120,
    });

    expect(payload).toMatchObject({
      kind: "image",
      internalPayload: {
        referenceId: "media-restored-1",
        outputId: null,
        mediaId: "media-restored-1",
        mediaKind: "image",
        referenceUrl: null,
        referenceRenderUrl: "https://cdn.shortpulse.test/restored-signed.png",
        sourceSurface: "all-refs",
        sessionBacked: true,
      },
      composerImagePayload: {
        referenceId: "media-restored-1",
        outputId: null,
        mediaId: "media-restored-1",
        displayArtifactUrl: "https://cdn.shortpulse.test/restored-signed.png",
      },
    });
  });

  it("exports video and audio items for media-slot tear-out", () => {
    const videoPayload = buildCanvasTearOutPayload({
      ...baseItem,
      id: "video-1",
      kind: "video",
      outputId: "output-video-1",
      mediaId: "media-video-1",
      videoUrl: "https://cdn.shortpulse.test/video.mp4",
      width: 320,
      height: 180,
    });
    const audioPayload = buildCanvasTearOutPayload({
      ...baseItem,
      id: "audio-1",
      kind: "audio",
      outputId: "output-audio-1",
      mediaId: "media-audio-1",
      audioUrl: "https://cdn.shortpulse.test/audio.mp3",
      title: "Audio",
      width: 160,
      height: 220,
      durationMs: 9000,
      audioSourceMode: "music",
    });

    expect(videoPayload).toMatchObject({
      kind: "video",
      videoUrl: "https://cdn.shortpulse.test/video.mp4",
      outputId: "output-video-1",
      mediaId: "media-video-1",
      internalPayload: {
        referenceId: "output-video-1",
        outputId: "output-video-1",
        mediaId: "media-video-1",
        mediaKind: "video",
        referenceUrl: "https://cdn.shortpulse.test/video.mp4",
        referenceRenderUrl: "https://cdn.shortpulse.test/video.mp4",
        sourceSurface: "all-refs",
        sessionBacked: true,
      },
    });
    expect(audioPayload).toMatchObject({
      kind: "audio",
      audioUrl: "https://cdn.shortpulse.test/audio.mp3",
      outputId: "output-audio-1",
      mediaId: "media-audio-1",
      durationMs: 9000,
      audioSourceMode: "music",
      internalPayload: {
        referenceId: "output-audio-1",
        outputId: "output-audio-1",
        mediaId: "media-audio-1",
        mediaKind: "audio",
        referenceUrl: "https://cdn.shortpulse.test/audio.mp3",
        referenceRenderUrl: "https://cdn.shortpulse.test/audio.mp3",
        sourceSurface: "all-refs",
        sessionBacked: true,
      },
    });
  });
});
