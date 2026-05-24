import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCharacterManagerDroppedReferenceController } from "../useCharacterManagerDroppedReferenceController";
import { reportAppError } from "../../../../lib/appErrorReporter";

vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: vi.fn(),
}));

describe("useCharacterManagerDroppedReferenceController", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("uploads a locally dropped file directly into the requested character-sheet zone", async () => {
    const setCharacterSheetPresetFile = vi.fn().mockResolvedValue(true);
    const file = new File(["image-bytes"], "portrait.png", { type: "image/png" });
    const transfer = {
      files: [file],
      items: [],
      types: ["Files"],
      getData: () => "",
    } as unknown as DataTransfer;

    const { result } = renderHook(() =>
      useCharacterManagerDroppedReferenceController({
        pageBusy: false,
        quickSwapMutating: false,
        clearAllMessages: vi.fn(),
        appendQuickSwapFiles: vi.fn(async () => false),
        setCharacterSheetPresetFile,
        hasQuickSwapMediaFileId: () => false,
      })
    );

    await act(async () => {
      await result.current.handleCharacterSheetReferenceDrop("portrait", transfer);
    });

    expect(setCharacterSheetPresetFile).toHaveBeenCalledWith("portrait", file);
    expect(vi.mocked(reportAppError)).not.toHaveBeenCalled();
    expect(result.current.pendingDropTarget).toBeNull();
  });

  it("prefers a media-library image payload over a browser synthetic file", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
    } as Response);
    const setCharacterSheetPresetFile = vi.fn().mockResolvedValue(true);
    const syntheticFile = new File(["ghost"], "ghost.txt", { type: "text/plain" });
    const payload = {
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-1",
        url: "data:image/png;base64,preview",
        fileType: "image",
        originFolderId: null,
        filename: "portrait.png",
        promptText: null,
        source: "upload",
        previewStoragePath: null,
        fullStoragePath: null,
        previewUrl: "data:image/png;base64,preview",
        previewPosterUrl: null,
        previewPosterStoragePath: null,
        fullUrl: "data:image/png;base64,full",
        width: 1024,
        height: 1024,
      },
    };
    const data = new Map<string, string>([
      ["text/x-shortpulse-media-library-item", JSON.stringify(payload)],
    ]);
    const transfer = {
      files: [syntheticFile],
      items: [],
      types: Array.from(data.keys()),
      getData: (type: string) => data.get(type) ?? "",
    } as unknown as DataTransfer;

    const { result } = renderHook(() =>
      useCharacterManagerDroppedReferenceController({
        pageBusy: false,
        quickSwapMutating: false,
        clearAllMessages: vi.fn(),
        appendQuickSwapFiles: vi.fn(async () => false),
        setCharacterSheetPresetFile,
        hasQuickSwapMediaFileId: () => false,
      })
    );

    await act(async () => {
      await result.current.handleCharacterSheetReferenceDrop("portrait", transfer);
    });

    expect(setCharacterSheetPresetFile).toHaveBeenCalledTimes(1);
    const uploadedFile = setCharacterSheetPresetFile.mock.calls[0]?.[1] as File;
    expect(setCharacterSheetPresetFile.mock.calls[0]?.[0]).toBe("portrait");
    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile.type).toBe("image/png");
    expect(uploadedFile).not.toBe(syntheticFile);
    expect(vi.mocked(reportAppError)).not.toHaveBeenCalled();
  });
});
