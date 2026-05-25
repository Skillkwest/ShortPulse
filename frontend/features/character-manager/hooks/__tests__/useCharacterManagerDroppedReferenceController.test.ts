import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useCharacterManagerDroppedReferenceController } from "../useCharacterManagerDroppedReferenceController";
import { reportAppError } from "../../../../lib/appErrorReporter";

vi.mock("../../../../lib/appErrorReporter", () => ({
  reportAppError: vi.fn(),
}));

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
};

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
        setCharacterSheetPresetFile,
      })
    );

    await act(async () => {
      await result.current.handleCharacterSheetReferenceDrop("portrait", transfer);
    });

    expect(setCharacterSheetPresetFile).toHaveBeenCalledWith("portrait", file);
    expect(vi.mocked(reportAppError)).not.toHaveBeenCalled();
    expect(result.current.pendingDropTarget).toBeNull();
  });

  it("shows the target character-sheet card as pending while a media-library image is loading", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
    } as Response);
    const saveDeferred = createDeferred<boolean>();
    const setCharacterSheetPresetFile = vi.fn().mockReturnValue(saveDeferred.promise);
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
        setCharacterSheetPresetFile,
      })
    );

    let dropPromise!: Promise<void>;
    act(() => {
      dropPromise = result.current.handleCharacterSheetReferenceDrop("portrait", transfer);
    });

    await waitFor(() => {
      expect(setCharacterSheetPresetFile).toHaveBeenCalledTimes(1);
    });
    expect(result.current.pendingDropTarget).toEqual({
      target: "character_sheet",
      zoneKey: "portrait",
    });

    const uploadedFile = setCharacterSheetPresetFile.mock.calls[0]?.[1] as File;
    expect(setCharacterSheetPresetFile.mock.calls[0]?.[0]).toBe("portrait");
    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile.type).toBe("image/png");
    expect(uploadedFile).not.toBe(syntheticFile);

    await act(async () => {
      saveDeferred.resolve(true);
      await dropPromise;
    });

    expect(result.current.pendingDropTarget).toBeNull();
    expect(vi.mocked(reportAppError)).not.toHaveBeenCalled();
  });

  it("ingests trusted internal character drops from preview urls without requiring a media id", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
    } as Response);
    const setCharacterSheetPresetFile = vi.fn().mockResolvedValue(true);
    const resolveCharacterDropReference = vi.fn().mockResolvedValue({
      mediaId: "",
      previewUrl: "https://cdn.example.com/internal-preview.png",
      outputId: "out-1",
      imageIndex: 0,
      sourceSurface: "all-refs",
    });
    const data = new Map<string, string>([
      ["text/reference-origin", "ai-studio-reference-grid"],
      ["text/reference-output-id", "out-1"],
      ["text/reference-image-index", "0"],
      ["text/reference-source-surface", "all-refs"],
      ["text/reference-url", "https://cdn.example.com/internal-preview.png"],
    ]);
    const transfer = {
      files: [],
      items: [],
      types: Array.from(data.keys()),
      getData: (type: string) => data.get(type) ?? "",
    } as unknown as DataTransfer;

    const { result } = renderHook(() =>
      useCharacterManagerDroppedReferenceController({
        setCharacterSheetPresetFile,
        resolveCharacterDropReference,
      })
    );

    await act(async () => {
      await result.current.handleCharacterSheetReferenceDrop("portrait", transfer);
    });

    expect(resolveCharacterDropReference).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: null,
        referenceUrl: "https://cdn.example.com/internal-preview.png",
      })
    );
    expect(setCharacterSheetPresetFile).toHaveBeenCalledTimes(1);
    const uploadedFile = setCharacterSheetPresetFile.mock.calls[0]?.[1] as File;
    expect(setCharacterSheetPresetFile.mock.calls[0]?.[0]).toBe("portrait");
    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile.type).toBe("image/png");
    expect(vi.mocked(reportAppError)).not.toHaveBeenCalled();
  });

  it("prefers degraded internal reference hints over synthetic browser files", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
    } as Response);
    const setCharacterSheetPresetFile = vi.fn().mockResolvedValue(true);
    const syntheticFile = new File(["ghost"], "ghost.txt", { type: "text/plain" });
    const data = new Map<string, string>([
      ["text/reference-origin", "ai-studio-reference-grid"],
      ["image/url", "data:image/png;base64,aW1hZ2UtYnl0ZXM="],
    ]);
    const transfer = {
      files: [syntheticFile],
      items: [],
      types: ["Files", ...Array.from(data.keys())],
      getData: (type: string) => data.get(type) ?? "",
    } as unknown as DataTransfer;

    const { result } = renderHook(() =>
      useCharacterManagerDroppedReferenceController({
        setCharacterSheetPresetFile,
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

  it("fails closed for degraded internal drags instead of uploading synthetic files", async () => {
    const setCharacterSheetPresetFile = vi.fn().mockResolvedValue(true);
    const syntheticFile = new File(["ghost"], "ghost.txt", { type: "text/plain" });
    const data = new Map<string, string>([["text/reference-origin", "ai-studio-reference-grid"]]);
    const transfer = {
      files: [syntheticFile],
      items: [],
      types: ["Files", ...Array.from(data.keys())],
      getData: (type: string) => data.get(type) ?? "",
    } as unknown as DataTransfer;

    const { result } = renderHook(() =>
      useCharacterManagerDroppedReferenceController({
        setCharacterSheetPresetFile,
      })
    );

    await act(async () => {
      await result.current.handleCharacterSheetReferenceDrop("portrait", transfer);
    });

    expect(setCharacterSheetPresetFile).not.toHaveBeenCalled();
    expect(vi.mocked(reportAppError)).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "character_sheet_drop_reference_blocked_by_trust_policy",
        metadata: expect.objectContaining({
          target: "character_sheet",
          drop_zone_key: "portrait",
          internal_hint_present: true,
        }),
      })
    );
  });
});
