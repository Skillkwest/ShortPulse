import { describe, expect, it } from "vitest";
import { createCanvasDetailModalItem } from "../canvasDetailModal";

describe("canvasDetailModal", () => {
  it("enables download for fallback canvas image detail while keeping other preview-only limits", () => {
    const detailItem = createCanvasDetailModalItem({
      item: {
        id: "canvas-image-1",
        kind: "image",
        x: 24,
        y: 48,
        z: 2,
        selected: false,
        outputId: "missing-output-1",
        sourceSurface: "curated",
        mediaId: "saved-media-1",
        src: "https://cdn.shortpulse.test/canvas-image.png",
        alt: "Canvas image",
        width: 512,
        height: 512,
      },
      instanceId: "rail",
    });

    expect(detailItem).toEqual(
      expect.objectContaining({
        surface: "right-rail-canvas",
        selectionTarget: {
          kind: "canvas-item",
          itemId: "canvas-image-1",
          surface: "right-rail-canvas",
          instanceId: "rail",
        },
        capabilities: {
          canSaveToLibrary: false,
          canDownload: true,
          canDelete: false,
          canEditPrompt: false,
          canSavePrompt: false,
          canShowCharacterContext: false,
          canShowStyleContext: false,
        },
        media: expect.objectContaining({
          kind: "image",
          url: "https://cdn.shortpulse.test/canvas-image.png",
          previewUrl: "https://cdn.shortpulse.test/canvas-image.png",
          fullUrl: "https://cdn.shortpulse.test/canvas-image.png",
        }),
        presentation: expect.objectContaining({
          title: "Canvas image",
          topBarItems: expect.arrayContaining([
            expect.objectContaining({
              label: "Image",
            }),
          ]),
        }),
      })
    );
    expect(detailItem?.media).not.toHaveProperty("promptText");
  });

  it("returns null for text canvas items", () => {
    const detailItem = createCanvasDetailModalItem({
      item: {
        id: "canvas-text-1",
        kind: "text",
        x: 0,
        y: 0,
        z: 1,
        selected: false,
        outputId: null,
        sourceSurface: null,
        text: "Note",
        width: 240,
        height: 160,
      },
      instanceId: "main",
    });

    expect(detailItem).toBeNull();
  });

  it("preserves canvas audio companion art for shared detail rendering", () => {
    const detailItem = createCanvasDetailModalItem({
      item: {
        id: "canvas-audio-1",
        kind: "audio",
        x: 20,
        y: 32,
        z: 3,
        selected: false,
        outputId: "audio-output-1",
        sourceSurface: "all-refs",
        mediaId: "saved-audio-1",
        audioUrl: "https://cdn.shortpulse.test/canvas-audio.mp3",
        title: "Canvas audio",
        companionArtUrl: "https://cdn.shortpulse.test/canvas-audio-cover.webp",
        companionArtStoragePath: "user-1/generations/audio/audio-output-1/companion-art/cover.webp",
        width: 320,
        height: 96,
      },
      instanceId: "rail",
    });

    expect(detailItem?.media.kind).toBe("audio");
    expect(detailItem?.media.url).toBe("https://cdn.shortpulse.test/canvas-audio.mp3");
    expect(detailItem?.media.companionArtUrl).toBe(
      "https://cdn.shortpulse.test/canvas-audio-cover.webp"
    );
    expect(detailItem?.media.companionArtStoragePath).toBe(
      "user-1/generations/audio/audio-output-1/companion-art/cover.webp"
    );
  });
});
