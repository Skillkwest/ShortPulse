import { describe, expect, it, vi } from "vitest";
import {
  getMediaLibraryDragTypes,
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

    expect(setData).toHaveBeenCalledTimes(2);
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

  it("exposes both drag transfer types", () => {
    expect(getMediaLibraryDragTypes()).toEqual([
      "application/x-shortpulse-media-library-item",
      "text/x-shortpulse-media-library-item",
    ]);
  });
});
