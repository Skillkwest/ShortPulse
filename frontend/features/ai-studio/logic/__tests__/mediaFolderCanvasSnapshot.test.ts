import { describe, expect, it } from "vitest";
import type { CanvasSceneItem } from "../../components/canvas/canvasTypes";
import {
  buildMediaFolderCanvasSnapshot,
  buildSeedItemsForFolderCanvas,
  getPromptIdFromCanvasOutputId,
  isFolderCanvasMembershipItemId,
  parseMediaFolderCanvasSnapshot,
  reconcileFolderMembershipCanvasItems,
} from "../mediaFolderCanvasSnapshot";

describe("mediaFolderCanvasSnapshot", () => {
  it("builds and parses V1 snapshots", () => {
    const sourceItems: CanvasSceneItem[] = [
      {
        id: "media:file-1",
        kind: "image",
        x: 10,
        y: 20,
        z: 1,
        selected: false,
        outputId: null,
        sourceSurface: null,
        mediaId: "file-1",
        src: "https://cdn.example.com/1.png",
        alt: "Asset",
        width: 280,
        height: 180,
      },
    ];
    const snapshot = buildMediaFolderCanvasSnapshot({
      camera: { x: 3, y: 4, zoom: 1 },
      items: sourceItems,
    });
    const parsed = parseMediaFolderCanvasSnapshot(snapshot);
    expect(parsed).not.toBeNull();
    expect(parsed?.items[0]?.id).toBe("media:file-1");
    expect(parsed?.camera.zoom).toBe(1);
  });

  it("builds and parses resized text card widths", () => {
    const sourceItems: CanvasSceneItem[] = [
      {
        id: "prompt:prompt-1",
        kind: "text",
        x: 12,
        y: 24,
        z: 2,
        selected: true,
        outputId: "prompt:prompt-1",
        sourceSurface: null,
        text: "Wide prompt",
        width: 436,
        height: 228,
      },
    ];

    const snapshot = buildMediaFolderCanvasSnapshot({
      camera: { x: 0, y: 0, zoom: 1 },
      items: sourceItems,
    });
    const parsed = parseMediaFolderCanvasSnapshot(snapshot);

    expect(parsed?.items[0]).toMatchObject({
      id: "prompt:prompt-1",
      width: 436,
      height: 228,
    });
  });

  it("seeds media and prompt membership items", () => {
    const seeded = buildSeedItemsForFolderCanvas({
      mediaRows: [
        {
          id: "file-1",
          filename: "Image One",
          storage_path: "user/upload/images/file-1.png",
          file_type: "image",
          created_at: "2026-03-11T00:00:00.000Z",
          signedUrl: "https://cdn.example.com/1.png",
        },
      ],
      promptRows: [
        {
          id: "prompt-1",
          title: "Prompt One",
          prompt_text: "cinematic sky",
          mode: "text",
          source: "manual",
          created_at: "2026-03-11T00:00:00.000Z",
        },
      ],
    });

    expect(seeded.some((item) => item.id === "media:file-1")).toBe(true);
    expect(
      seeded.some(
        (item) =>
          item.kind === "text" &&
          item.outputId === "prompt:prompt-1" &&
          item.text === "cinematic sky"
      )
    ).toBe(true);
  });

  it("uses row width/height to preserve landscape sizing in seeded media items", () => {
    const seeded = buildSeedItemsForFolderCanvas({
      mediaRows: [
        {
          id: "landscape-1",
          filename: "Landscape One",
          storage_path: "user/upload/images/landscape-1.jpg",
          file_type: "image/jpeg",
          width: 1920,
          height: 1080,
          created_at: "2026-03-11T00:00:00.000Z",
          signedUrl: "https://cdn.example.com/landscape-1.jpg",
        },
      ],
      promptRows: [],
    });
    const seededLandscape = seeded.find((item) => item.id === "media:landscape-1");
    expect(seededLandscape?.kind).toBe("image");
    if (!seededLandscape || seededLandscape.kind !== "image") return;
    expect(seededLandscape.width).toBe(320);
    expect(seededLandscape.height).toBe(180);
  });

  it("reconciles membership items and removes stale linked entries", () => {
    const reconciled = reconcileFolderMembershipCanvasItems({
      items: [
        {
          id: "media:file-old",
          kind: "image",
          x: 0,
          y: 0,
          z: 1,
          selected: false,
          outputId: null,
          sourceSurface: null,
          mediaId: "file-old",
          src: "https://cdn.example.com/old.png",
          alt: "Old",
          width: 200,
          height: 120,
        },
      ],
      mediaRows: [
        {
          id: "file-new",
          filename: "Image New",
          storage_path: "user/upload/images/file-new.png",
          file_type: "image",
          created_at: "2026-03-11T00:00:00.000Z",
          signedUrl: "https://cdn.example.com/new.png",
        },
      ],
      promptRows: [],
    });

    expect(reconciled.some((item) => item.id === "media:file-old")).toBe(false);
    expect(reconciled.some((item) => item.id === "media:file-new")).toBe(true);
  });

  it("detects prompt membership ids from output ids", () => {
    expect(getPromptIdFromCanvasOutputId("prompt:abc")).toBe("abc");
    expect(getPromptIdFromCanvasOutputId("x:abc")).toBeNull();
    expect(isFolderCanvasMembershipItemId("prompt:abc")).toBe(true);
    expect(isFolderCanvasMembershipItemId("text:abc")).toBe(false);
  });

  it("canonicalizes and dedupes dropped image membership items by media id", () => {
    const reconciled = reconcileFolderMembershipCanvasItems({
      items: [
        {
          id: "canvas-temp-item",
          kind: "image",
          x: 120,
          y: 80,
          z: 8,
          selected: true,
          outputId: null,
          sourceSurface: null,
          mediaId: "file-1",
          src: "https://cdn.example.com/old-drop.png",
          alt: "Old drop",
          width: 220,
          height: 140,
        },
        {
          id: "media:file-1",
          kind: "image",
          x: 0,
          y: 0,
          z: 3,
          selected: false,
          outputId: null,
          sourceSurface: null,
          mediaId: "file-1",
          src: "https://cdn.example.com/older-seed.png",
          alt: "Old seed",
          width: 280,
          height: 350,
        },
      ],
      mediaRows: [
        {
          id: "file-1",
          filename: "Image One",
          storage_path: "user/upload/images/file-1.png",
          file_type: "image",
          created_at: "2026-03-11T00:00:00.000Z",
          signedUrl: "https://cdn.example.com/final.png",
        },
      ],
      promptRows: [],
    });

    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]).toMatchObject({
      id: "media:file-1",
      mediaId: "file-1",
      x: 120,
      y: 80,
      src: "https://cdn.example.com/final.png",
      alt: "Image One",
    });
  });

  it("keeps prompt-backed text items independent while preserving prompt links", () => {
    const reconciled = reconcileFolderMembershipCanvasItems({
      items: [
        {
          id: "canvas-temp-prompt",
          kind: "text",
          x: 100,
          y: 40,
          z: 6,
          selected: true,
          outputId: "prompt:prompt-1",
          sourceSurface: null,
          text: "old prompt text",
          width: 260,
          height: 180,
        },
        {
          id: "prompt:prompt-1",
          kind: "text",
          x: 0,
          y: 0,
          z: 1,
          selected: false,
          outputId: "prompt:prompt-1",
          sourceSurface: null,
          text: "older prompt text",
          width: 260,
          height: 160,
        },
      ],
      mediaRows: [],
      promptRows: [
        {
          id: "prompt-1",
          title: "Prompt One",
          prompt_text: "cinematic sky",
          mode: "text",
          source: "manual",
          created_at: "2026-03-11T00:00:00.000Z",
        },
      ],
    });

    expect(reconciled).toHaveLength(2);
    expect(reconciled[0]).toMatchObject({
      id: "canvas-temp-prompt",
      outputId: "prompt:prompt-1",
      x: 100,
      y: 40,
      text: "old prompt text",
    });
    expect(reconciled[1]).toMatchObject({
      id: "prompt:prompt-1",
      outputId: "prompt:prompt-1",
      x: 0,
      y: 0,
      text: "older prompt text",
    });
  });

  it("does not synthesize an extra prompt item when a prompt-backed text bubble already exists", () => {
    const reconciled = reconcileFolderMembershipCanvasItems({
      items: [
        {
          id: "canvas-temp-prompt",
          kind: "text",
          x: 100,
          y: 40,
          z: 6,
          selected: true,
          outputId: "prompt:prompt-1",
          sourceSurface: null,
          text: "old prompt text",
          width: 260,
          height: 180,
        },
      ],
      mediaRows: [],
      promptRows: [
        {
          id: "prompt-1",
          title: "Prompt One",
          prompt_text: "cinematic sky",
          mode: "text",
          source: "manual",
          created_at: "2026-03-11T00:00:00.000Z",
        },
      ],
      includeMissingMembershipItems: true,
    });

    expect(reconciled).toHaveLength(1);
    expect(reconciled[0]).toMatchObject({
      id: "canvas-temp-prompt",
      outputId: "prompt:prompt-1",
      x: 100,
      y: 40,
      text: "old prompt text",
    });
  });
});
