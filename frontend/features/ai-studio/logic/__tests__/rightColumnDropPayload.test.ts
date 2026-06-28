/**
 * Characterization tests for AI Studio right-column drop payload resolution.
 * Guards shell DnD behavior while the parser lives outside the page component.
 */
import type React from "react";
import { describe, expect, it } from "vitest";
import { preparePromptReferenceDrag } from "../../utils/dragDrop";
import {
  resolveRightColumnDropMode,
  resolveRightColumnDropPayload,
} from "../rightColumnDropPayload";

const emptyFileList = { length: 0, item: () => null } as unknown as FileList;

const makeTransfer = (
  data: Record<string, string>,
  files: FileList = emptyFileList
): DataTransfer =>
  ({
    files,
    types: Object.keys(data),
    getData: (type: string) => data[type] ?? "",
  }) as unknown as DataTransfer;

const makeFileList = (files: File[]): FileList => {
  const fileList = files as unknown as FileList;
  Object.defineProperty(fileList, "length", { value: files.length });
  Object.defineProperty(fileList, "item", {
    value: (index: number) => files[index] ?? null,
  });
  return fileList;
};

const makeMutableTransfer = (): DataTransfer => {
  const data = new Map<string, string>();
  return {
    files: emptyFileList,
    get types() {
      return Array.from(data.keys());
    },
    getData: (type: string) => data.get(type) ?? "",
    setData: (type: string, value: string) => {
      data.set(type, value);
    },
    effectAllowed: "all",
    setDragImage: () => undefined,
  } as unknown as DataTransfer;
};

describe("rightColumnDropPayload", () => {
  it("resolves media URL hints as media drops", () => {
    const transfer = makeTransfer({
      "text/uri-list": "https://cdn.example.com/reference.png",
    });

    expect(resolveRightColumnDropMode(transfer)).toBe("media");
    expect(resolveRightColumnDropPayload(transfer)).toEqual({
      kind: "media",
      reference: {
        url: "https://cdn.example.com/reference.png",
        mimeType: "image/*",
      },
    });
  });

  it("resolves plain prompt text without treating the current page URL as media", () => {
    const transfer = makeTransfer({
      "text/uri-list": window.location.href,
      "text/plain": "cinematic lighting prompt",
    });

    expect(resolveRightColumnDropMode(transfer)).toBe("media");
    expect(resolveRightColumnDropPayload(transfer)).toEqual({
      kind: "text",
      text: "cinematic lighting prompt",
    });
  });

  it("resolves file drops as file payloads", () => {
    const files = makeFileList([new File(["avatar"], "avatar.png", { type: "image/png" })]);
    const transfer = makeTransfer({ Files: "" }, files);

    expect(resolveRightColumnDropMode(transfer)).toBe("media");
    const payload = resolveRightColumnDropPayload(transfer);
    expect(payload.kind).toBe("files");
    if (payload.kind === "files") {
      expect(payload.files.length).toBe(1);
      expect((payload.files as unknown as File[])[0]?.name).toBe("avatar.png");
    }
  });

  it("resolves media-library media before generic internal reference hints", () => {
    const transfer = makeTransfer({
      "text/shortpulse-media-library-marker": "shortpulse-media-library-v1",
      "text/shortpulse-media-library-kind": "libraryMedia",
      "text/shortpulse-media-library-id": "media-drop-1",
      "text/shortpulse-media-library-file-type": "image",
      "text/reference-url": "https://cdn.example.com/library-drop-1.png",
      "text/shortpulse-media-library-filename": "library-drop-1.png",
      "text/prompt": "Library media prompt",
    });

    expect(resolveRightColumnDropMode(transfer)).toBe("media");
    expect(resolveRightColumnDropPayload(transfer)).toEqual({
      kind: "libraryMedia",
      payload: expect.objectContaining({
        id: "media-drop-1",
        url: "https://cdn.example.com/library-drop-1.png",
        fileType: "image",
        filename: "library-drop-1.png",
        promptText: "Library media prompt",
      }),
    });
  });

  it("resolves bulk media-library media drags as bulk library media payloads", () => {
    const transfer = makeTransfer({
      "application/x-shortpulse-media-library-items": JSON.stringify({
        kind: "bulkLibraryMedia",
        source: "mediaLibrary",
        payload: {
          items: [
            {
              id: "media-bulk-1",
              url: "https://cdn.example.com/bulk-1.png",
              fileType: "image",
            },
            {
              id: "media-bulk-2",
              url: "https://cdn.example.com/bulk-2.mp4",
              fileType: "video",
            },
          ],
        },
      }),
    });

    expect(resolveRightColumnDropMode(transfer)).toBe("media");
    expect(resolveRightColumnDropPayload(transfer)).toEqual({
      kind: "bulkLibraryMedia",
      payloads: [
        expect.objectContaining({
          id: "media-bulk-1",
          fileType: "image",
        }),
        expect.objectContaining({
          id: "media-bulk-2",
          fileType: "video",
        }),
      ],
    });
  });

  it("resolves session-backed media-library prompt drags as library prompt payloads", () => {
    const transfer = makeMutableTransfer();
    const promptText = `Saved prompt opening. ${"Detailed direction. ".repeat(80)}Saved ending.`;
    transfer.setData("text/shortpulse-media-library-marker", "shortpulse-media-library-v1");
    transfer.setData("text/shortpulse-media-library-kind", "libraryPrompt");
    transfer.setData("text/shortpulse-media-library-id", "prompt-drop-1");
    transfer.setData("text/shortpulse-media-library-title", "Library prompt title");
    transfer.setData("text/shortpulse-media-library-prompt", promptText);
    preparePromptReferenceDrag(
      {
        currentTarget: document.createElement("button"),
        dataTransfer: transfer,
      } as unknown as React.DragEvent<HTMLElement>,
      {
        referenceId: "prompt-drop-1",
        outputId: "prompt-drop-1",
        promptText,
        sourceSurface: null,
      }
    );

    expect(resolveRightColumnDropMode(transfer)).toBe("media");
    expect(resolveRightColumnDropPayload(transfer)).toEqual({
      kind: "libraryPrompt",
      payload: expect.objectContaining({
        id: "prompt-drop-1",
        promptText,
        title: "Library prompt title",
      }),
    });
  });
});
