import { describe, expect, it, vi } from "vitest";
import {
  getMediaLibraryDragTypes,
  hasMediaLibraryDragTypeHints,
  readMediaLibraryDragPayload,
  writeMediaLibraryDragPayload,
} from "../mediaLibraryDragPayload";

describe("mediaLibraryDragPayload", () => {
  it("serializes and parses library media payloads", () => {
    const setData = vi.fn();
    const transfer = {
      setData,
      getData: vi.fn((type: string) => {
        if (type === "application/x-shortpulse-media-library-item") {
          return JSON.stringify({
            kind: "libraryMedia",
            source: "mediaLibrary",
            payload: {
              id: "media-1",
              url: "https://example.com/a.png",
              fileType: "image",
            },
          });
        }
        return "";
      }),
    } as unknown as DataTransfer;

    writeMediaLibraryDragPayload(transfer, {
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-1",
        url: "https://example.com/a.png",
        fileType: "image",
      },
    });

    expect(setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-marker",
      "shortpulse-media-library-v1"
    );
    expect(setData).toHaveBeenCalledWith("text/shortpulse-media-library-kind", "libraryMedia");
    expect(setData).toHaveBeenCalledWith("text/shortpulse-media-library-id", "media-1");
    expect(setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-url",
      "https://example.com/a.png"
    );
    expect(readMediaLibraryDragPayload(transfer)).toEqual({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-1",
        url: "https://example.com/a.png",
        fileType: "image",
      },
    });
  });

  it("returns null for malformed payloads", () => {
    const transfer = {
      getData: vi.fn(() => "not-json"),
    } as unknown as DataTransfer;
    expect(readMediaLibraryDragPayload(transfer)).toBeNull();
  });

  it("reconstructs library media payloads from text/* fallback marker data", () => {
    const transfer = {
      getData: vi.fn((type: string) => {
        if (type === "application/x-shortpulse-media-library-item") return "";
        if (type === "text/x-shortpulse-media-library-item") return "";
        if (type === "text/shortpulse-media-library-marker") return "shortpulse-media-library-v1";
        if (type === "text/shortpulse-media-library-kind") return "libraryMedia";
        if (type === "text/shortpulse-media-library-id") return "media-fallback";
        if (type === "text/shortpulse-media-library-file-type") return "image";
        if (type === "text/reference-url") return "https://example.com/fallback.png";
        if (type === "text/prompt") return "fallback prompt";
        return "";
      }),
    } as unknown as DataTransfer;

    expect(readMediaLibraryDragPayload(transfer)).toEqual({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-fallback",
        url: "https://example.com/fallback.png",
        fileType: "image",
        originFolderId: null,
        filename: null,
        promptText: "fallback prompt",
        source: null,
        previewStoragePath: null,
        fullStoragePath: null,
        previewUrl: null,
        fullUrl: null,
      },
    });
  });

  it("infers audio file type from fallback URL markers", () => {
    const transfer = {
      getData: vi.fn((type: string) => {
        if (type === "application/x-shortpulse-media-library-item") return "";
        if (type === "text/x-shortpulse-media-library-item") return "";
        if (type === "text/shortpulse-media-library-marker") return "shortpulse-media-library-v1";
        if (type === "text/shortpulse-media-library-kind") return "libraryMedia";
        if (type === "text/shortpulse-media-library-id") return "media-audio-fallback";
        if (type === "text/reference-url") return "https://example.com/fallback-audio.mp3";
        return "";
      }),
    } as unknown as DataTransfer;

    expect(readMediaLibraryDragPayload(transfer)).toEqual({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-audio-fallback",
        url: "https://example.com/fallback-audio.mp3",
        fileType: "audio",
        originFolderId: null,
        filename: null,
        promptText: null,
        source: null,
        previewStoragePath: null,
        fullStoragePath: null,
        previewUrl: null,
        fullUrl: null,
      },
    });
  });

  it("exposes both drag transfer types", () => {
    expect(getMediaLibraryDragTypes()).toContain("application/x-shortpulse-media-library-item");
    expect(getMediaLibraryDragTypes()).toContain("text/x-shortpulse-media-library-item");
    expect(getMediaLibraryDragTypes()).toContain("text/shortpulse-media-library-marker");
  });

  it("detects media-library drag hints without reading payload data", () => {
    const getData = vi.fn(() => {
      throw new Error("payload read should not be required");
    });
    const transfer = {
      types: ["text/shortpulse-media-library-marker", "text/shortpulse-media-library-kind"],
      getData,
    } as unknown as DataTransfer;

    expect(hasMediaLibraryDragTypeHints(transfer)).toBe(true);
    expect(getData).not.toHaveBeenCalled();
  });

  it("keeps writing fallback payload fields when custom MIME transfer writes fail", () => {
    const setData = vi.fn((type: string) => {
      if (
        type === "application/x-shortpulse-media-library-item" ||
        type === "text/x-shortpulse-media-library-item"
      ) {
        throw new Error("unsupported transfer type");
      }
    });
    const transfer = {
      setData,
      getData: vi.fn(() => ""),
    } as unknown as DataTransfer;

    expect(() =>
      writeMediaLibraryDragPayload(transfer, {
        kind: "libraryMedia",
        source: "mediaLibrary",
        payload: {
          id: "media-safe-write",
          url: "https://example.com/safe-write.png",
          fileType: "image",
        },
      })
    ).not.toThrow();

    expect(setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-marker",
      "shortpulse-media-library-v1"
    );
    expect(setData).toHaveBeenCalledWith("text/shortpulse-media-library-kind", "libraryMedia");
    expect(setData).toHaveBeenCalledWith("text/shortpulse-media-library-id", "media-safe-write");
    expect(setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-url",
      "https://example.com/safe-write.png"
    );
  });
});
