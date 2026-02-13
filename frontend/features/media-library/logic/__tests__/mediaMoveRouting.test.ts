/**
 * Validates Media Library move routing rules and destination path/source mapping.
 */
import { describe, expect, it } from "vitest";
import {
  buildMoveTabOptions,
  buildMovedStoragePath,
  getMediaDataTabForRow,
  resolveSourceForDataTab,
  validateMoveDestination,
} from "../mediaMoveRouting";

describe("mediaMoveRouting", () => {
  it("classifies private media by source and path", () => {
    expect(
      getMediaDataTabForRow({
        source: "private_upload",
        storage_path: "user-1/private/images/file.jpg",
        file_type: "image",
      })
    ).toBe("private");

    expect(
      getMediaDataTabForRow({
        source: "upload",
        storage_path: "user-1/private/images/file.jpg",
        file_type: "image",
      })
    ).toBe("private");
  });

  it("enforces image/video/private destination rules", () => {
    const imageRow = {
      source: "upload",
      storage_path: "user-1/images/file.jpg",
      file_type: "image",
    };
    const videoRow = {
      source: "upload",
      storage_path: "user-1/videos/file.mp4",
      file_type: "video/mp4",
    };

    expect(validateMoveDestination(imageRow, "private").allowed).toBe(true);
    expect(validateMoveDestination(imageRow, "uploaded_videos").allowed).toBe(false);
    expect(validateMoveDestination(videoRow, "private").allowed).toBe(false);
    expect(validateMoveDestination(videoRow, "uploaded_images").allowed).toBe(false);
    expect(validateMoveDestination(videoRow, "ai_generations").allowed).toBe(true);
  });

  it("includes saved prompts as disabled in move options", () => {
    const options = buildMoveTabOptions({
      source: "upload",
      storage_path: "user-1/images/file.jpg",
      file_type: "image",
    });

    const savedPrompts = options.find((option) => option.tab === "saved_prompts");
    expect(savedPrompts).toBeTruthy();
    expect(savedPrompts?.disabled).toBe(true);
  });

  it("maps data tabs to expected source values", () => {
    expect(resolveSourceForDataTab("uploaded_images")).toBe("upload");
    expect(resolveSourceForDataTab("uploaded_videos")).toBe("upload");
    expect(resolveSourceForDataTab("private")).toBe("private_upload");
    expect(resolveSourceForDataTab("ai_generations")).toBe("ai_studio");
  });

  it("builds destination paths under destination-specific prefixes", () => {
    const userId = "user-1";
    const imagePath = buildMovedStoragePath(
      userId,
      {
        source: "upload",
        storage_path: "user-1/images/original-file.jpg",
        file_type: "image",
      },
      "private"
    );

    const videoPath = buildMovedStoragePath(
      userId,
      {
        source: "upload",
        storage_path: "user-1/videos/original-file.mp4",
        file_type: "video/mp4",
      },
      "ai_generations"
    );

    expect(imagePath.startsWith("user-1/private/images/")).toBe(true);
    expect(imagePath.includes("original-file.jpg")).toBe(true);

    expect(videoPath.startsWith("user-1/generations/videos/")).toBe(true);
    expect(videoPath.includes("original-file.mp4")).toBe(true);
  });
});
