import type React from "react";
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { readMediaLibraryDragPayload } from "../../logic/mediaLibraryDragPayload";
import type { MediaFileRow } from "../../logic/mediaLibraryModalModel";
import { useMediaLibraryPanelItemInteractions } from "../useMediaLibraryPanelItemInteractions";

const createMutableTransfer = () => {
  const store = new Map<string, string>();
  return {
    get types() {
      return Array.from(store.keys());
    },
    getData: (type: string) => store.get(type) ?? "",
    setData: (type: string, value: string) => {
      store.set(type, value);
    },
    setDragImage: vi.fn(),
    effectAllowed: "all",
  } as unknown as DataTransfer;
};

describe("useMediaLibraryPanelItemInteractions", () => {
  it("starts media drags from durable storage identity when signedUrl is not ready", () => {
    const file: MediaFileRow = {
      id: "media-1",
      filename: "stored-frame.png",
      storage_path: "user-1/media/stored-frame.png",
      preview_storage_path: "user-1/media/thumbs/stored-frame.webp",
      file_type: "image/png",
      metadata: { prompt: "Stored frame" },
      signedUrl: null,
    };
    const currentTarget = document.createElement("button");
    const dataTransfer = createMutableTransfer();
    const preventDefault = vi.fn();
    const { result } = renderHook(() =>
      useMediaLibraryPanelItemInteractions({
        activeFolderId: "all_items",
      })
    );

    result.current.handleMediaCardDragStart(
      {
        currentTarget,
        dataTransfer,
        preventDefault,
      } as unknown as React.DragEvent<HTMLElement>,
      file
    );

    const payload = readMediaLibraryDragPayload(dataTransfer);
    expect(preventDefault).not.toHaveBeenCalled();
    expect(dataTransfer.effectAllowed).toBe("copy");
    expect(currentTarget).toHaveClass("is-dragging");
    expect(payload).toMatchObject({
      kind: "libraryMedia",
      payload: {
        id: "media-1",
        url: "user-1/media/stored-frame.png",
        previewStoragePath: "user-1/media/thumbs/stored-frame.webp",
        fullStoragePath: "user-1/media/stored-frame.png",
      },
    });
  });
});
