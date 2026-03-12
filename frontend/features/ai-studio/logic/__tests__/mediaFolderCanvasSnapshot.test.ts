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

  it("seeds media and prompt membership items", () => {
    const seeded = buildSeedItemsForFolderCanvas({
      mediaRows: [
        {
          id: "file-1",
          filename: "Image One",
          storage_path: "user/upload/images/file-1.png",
          file_type: "image",
          file_size: 100,
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
          updated_at: "2026-03-11T00:00:00.000Z",
        },
      ],
    });

    expect(seeded.some((item) => item.id === "media:file-1")).toBe(true);
    expect(seeded.some((item) => item.id === "prompt:prompt-1")).toBe(true);
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
          file_size: 100,
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
});
