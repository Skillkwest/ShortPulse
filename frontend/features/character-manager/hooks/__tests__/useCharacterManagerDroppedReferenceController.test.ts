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
  });

  it("allows separate character-sheet zones to resolve concurrently when the caller permits it", async () => {
    const portraitSave = createDeferred<boolean>();
    const closeUpSave = createDeferred<boolean>();
    const setCharacterSheetPresetFile = vi.fn().mockImplementation((zoneKey: string) => {
      if (zoneKey === "portrait") return portraitSave.promise;
      if (zoneKey === "close_up") return closeUpSave.promise;
      throw new Error(`Unexpected zone: ${zoneKey}`);
    });
    const portraitFile = new File(["portrait"], "portrait.png", { type: "image/png" });
    const closeUpFile = new File(["close-up"], "close-up.png", { type: "image/png" });
    const portraitTransfer = {
      files: [portraitFile],
      items: [],
      types: ["Files"],
      getData: () => "",
    } as unknown as DataTransfer;
    const closeUpTransfer = {
      files: [closeUpFile],
      items: [],
      types: ["Files"],
      getData: () => "",
    } as unknown as DataTransfer;

    const { result } = renderHook(() =>
      useCharacterManagerDroppedReferenceController({
        setCharacterSheetPresetFile,
      })
    );

    let portraitDropPromise!: Promise<void>;
    let closeUpDropPromise!: Promise<void>;
    act(() => {
      portraitDropPromise = result.current.handleCharacterSheetReferenceDrop(
        "portrait",
        portraitTransfer
      );
      closeUpDropPromise = result.current.handleCharacterSheetReferenceDrop(
        "close_up",
        closeUpTransfer
      );
    });

    await waitFor(() => {
      expect(setCharacterSheetPresetFile).toHaveBeenCalledTimes(2);
    });
    expect(setCharacterSheetPresetFile).toHaveBeenNthCalledWith(1, "portrait", portraitFile);
    expect(setCharacterSheetPresetFile).toHaveBeenNthCalledWith(2, "close_up", closeUpFile);

    await act(async () => {
      closeUpSave.resolve(true);
      portraitSave.resolve(true);
      await Promise.all([portraitDropPromise, closeUpDropPromise]);
    });
  });

  it("converts media-library image drops into files before saving", async () => {
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

    const uploadedFile = setCharacterSheetPresetFile.mock.calls[0]?.[1] as File;
    expect(setCharacterSheetPresetFile.mock.calls[0]?.[0]).toBe("portrait");
    expect(uploadedFile).toBeInstanceOf(File);
    expect(uploadedFile.type).toBe("image/png");
    expect(uploadedFile).not.toBe(syntheticFile);

    await act(async () => {
      saveDeferred.resolve(true);
      await dropPromise;
    });

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

  it("copies storage-backed internal character drops without downloading them into browser files", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const setCharacterSheetPresetFile = vi.fn().mockResolvedValue(true);
    const setCharacterSheetPresetStorageReference = vi.fn().mockResolvedValue(true);
    const resolveCharacterDropReference = vi.fn().mockResolvedValue({
      mediaId: "media-1",
      previewUrl: "https://signed.example/internal-preview.png",
      storagePath: "user-1/generations/images/internal.png",
      outputId: "out-1",
      imageIndex: 0,
      sourceSurface: "all-refs",
    });
    const data = new Map<string, string>([
      ["text/reference-origin", "ai-studio-reference-grid"],
      ["text/reference-output-id", "out-1"],
      ["text/reference-image-index", "0"],
      ["text/reference-source-surface", "all-refs"],
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
        setCharacterSheetPresetStorageReference,
        resolveCharacterDropReference,
      })
    );

    await act(async () => {
      await result.current.handleCharacterSheetReferenceDrop("portrait", transfer);
    });

    expect(setCharacterSheetPresetStorageReference).toHaveBeenCalledWith("portrait", {
      storagePath: "user-1/generations/images/internal.png",
      previewUrl: "https://signed.example/internal-preview.png",
      filename: "internal.png",
      mimeType: null,
    });
    expect(setCharacterSheetPresetFile).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(vi.mocked(reportAppError)).not.toHaveBeenCalled();
  });

  it("copies direct internal character drops without requiring a browser DataTransfer", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const setCharacterSheetPresetFile = vi.fn().mockResolvedValue(true);
    const setCharacterSheetPresetStorageReference = vi.fn().mockResolvedValue(true);
    const resolveCharacterDropReference = vi.fn().mockResolvedValue({
      mediaId: "media-canvas-1",
      previewUrl: "https://signed.example/canvas-preview.png",
      storagePath: "user-1/generations/images/canvas.png",
      outputId: "out-canvas-1",
      imageIndex: 0,
      sourceSurface: "all-refs",
    });

    const { result } = renderHook(() =>
      useCharacterManagerDroppedReferenceController({
        setCharacterSheetPresetFile,
        setCharacterSheetPresetStorageReference,
        resolveCharacterDropReference,
      })
    );

    await act(async () => {
      await result.current.handleCharacterSheetInternalReferenceDrop("close_up", {
        version: 1,
        origin: "ai-studio-reference-grid",
        referenceId: "out-canvas-1",
        outputId: "out-canvas-1",
        imageIndex: 0,
        mediaId: "media-canvas-1",
        mediaKind: "image",
        referenceUrl: "https://cdn.example.com/canvas-preview.png",
        sourceSurface: "all-refs",
      });
    });

    expect(resolveCharacterDropReference).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "ai-studio-reference-grid",
        outputId: "out-canvas-1",
        mediaId: "media-canvas-1",
      })
    );
    expect(setCharacterSheetPresetStorageReference).toHaveBeenCalledWith("close_up", {
      storagePath: "user-1/generations/images/canvas.png",
      previewUrl: "https://signed.example/canvas-preview.png",
      filename: "canvas.png",
      mimeType: null,
    });
    expect(setCharacterSheetPresetFile).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(vi.mocked(reportAppError)).not.toHaveBeenCalled();
  });

  it("shows a user-visible error when an internal character drop resolver fails", async () => {
    const setCharacterSheetPresetFile = vi.fn().mockResolvedValue(true);
    const setDropErrorMessage = vi.fn();
    const resolveCharacterDropReference = vi.fn().mockRejectedValue(new Error("resolver failed"));

    const { result } = renderHook(() =>
      useCharacterManagerDroppedReferenceController({
        setCharacterSheetPresetFile,
        setDropErrorMessage,
        resolveCharacterDropReference,
      })
    );

    await act(async () => {
      await result.current.handleCharacterSheetInternalReferenceDrop("close_up", {
        version: 1,
        origin: "ai-studio-reference-grid",
        referenceId: "out-canvas-1",
        outputId: "out-canvas-1",
        imageIndex: 0,
        mediaId: "media-canvas-1",
        mediaKind: "image",
        referenceUrl: "https://cdn.example.com/canvas-preview.png",
        sourceSurface: "all-refs",
      });
    });

    expect(setCharacterSheetPresetFile).not.toHaveBeenCalled();
    expect(setDropErrorMessage).toHaveBeenCalledWith(
      "We couldn't add that Character reference. Try dragging it again from the source."
    );
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
    const setDropErrorMessage = vi.fn();
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
        setDropErrorMessage,
      })
    );

    await act(async () => {
      await result.current.handleCharacterSheetReferenceDrop("portrait", transfer);
    });

    expect(setCharacterSheetPresetFile).not.toHaveBeenCalled();
    expect(setDropErrorMessage).toHaveBeenCalledWith(
      "We couldn't add that Character reference. Try dragging it again from the source."
    );
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
