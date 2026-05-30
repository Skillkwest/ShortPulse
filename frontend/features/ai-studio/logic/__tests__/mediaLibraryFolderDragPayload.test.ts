import { describe, expect, it, vi } from "vitest";
import {
  getMediaLibraryFolderDragTypes,
  readMediaLibraryFolderDragPayload,
  writeMediaLibraryFolderDragPayload,
} from "../mediaLibraryFolderDragPayload";

describe("mediaLibraryFolderDragPayload", () => {
  it("serializes and parses folder drag payloads", () => {
    const transferData = new Map<string, string>();
    const transfer = {
      setData: vi.fn((type: string, value: string) => {
        transferData.set(type, value);
      }),
      getData: vi.fn((type: string) => transferData.get(type) ?? ""),
    } as unknown as DataTransfer;

    writeMediaLibraryFolderDragPayload(transfer, {
      source: "mediaLibraryFolder",
      payload: {
        id: "folder-child",
        name: "Child",
        parentFolderId: "folder-parent",
      },
    });

    expect(transfer.setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-folder-marker",
      "shortpulse-media-library-folder-v1"
    );
    expect(transfer.setData).toHaveBeenCalledWith(
      "text/shortpulse-media-library-folder-id",
      "folder-child"
    );
    expect(readMediaLibraryFolderDragPayload(transfer)).toEqual({
      source: "mediaLibraryFolder",
      payload: {
        id: "folder-child",
        name: "Child",
        parentFolderId: "folder-parent",
      },
    });
  });

  it("reconstructs folder drag payloads from fallback marker data", () => {
    const transfer = {
      getData: vi.fn((type: string) => {
        switch (type) {
          case "application/x-shortpulse-media-library-folder":
          case "text/x-shortpulse-media-library-folder":
            return "";
          case "text/shortpulse-media-library-folder-marker":
            return "shortpulse-media-library-folder-v1";
          case "text/shortpulse-media-library-folder-id":
            return "folder-root";
          case "text/shortpulse-media-library-folder-name":
            return "Root";
          default:
            return "";
        }
      }),
    } as unknown as DataTransfer;

    expect(readMediaLibraryFolderDragPayload(transfer)).toEqual({
      source: "mediaLibraryFolder",
      payload: {
        id: "folder-root",
        name: "Root",
        parentFolderId: null,
      },
    });
  });

  it("exposes the folder drag hint types used during dragover", () => {
    expect(getMediaLibraryFolderDragTypes()).toEqual([
      "application/x-shortpulse-media-library-folder",
      "text/x-shortpulse-media-library-folder",
      "text/shortpulse-media-library-folder-marker",
      "text/shortpulse-media-library-folder-id",
    ]);
  });
});
