import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStudioReferenceIngestionActions } from "../useAiStudioReferenceIngestionActions";
import type { StudioOutput } from "../../types";

const associateMediaFilesWithProjectMock = vi.hoisted(() => vi.fn());
const prepareLibraryMediaIngestionPayloadMock = vi.hoisted(() => vi.fn(async (payload) => payload));
const uploadImageAssetToStorageMock = vi.hoisted(() => vi.fn());
const uploadVideoAssetToStorageMock = vi.hoisted(() => vi.fn());
const uploadAudioAssetToStorageMock = vi.hoisted(() => vi.fn());

vi.mock("../../logic/mediaLibraryPersistence", () => ({
  associateMediaFilesWithProject: associateMediaFilesWithProjectMock,
}));

vi.mock("../../reference-ingestion/prepareLibraryMediaIngestionPayload", () => ({
  prepareLibraryMediaIngestionPayload: prepareLibraryMediaIngestionPayloadMock,
}));

vi.mock("../../utils/imageUpload", () => ({
  uploadImageAssetToStorage: (...args: unknown[]) => uploadImageAssetToStorageMock(...args),
}));

vi.mock("../../utils/videoUpload", () => ({
  uploadVideoAssetToStorage: (...args: unknown[]) => uploadVideoAssetToStorageMock(...args),
}));

vi.mock("../../utils/audioUpload", () => ({
  uploadAudioAssetToStorage: (...args: unknown[]) => uploadAudioAssetToStorageMock(...args),
}));

const makeOutput = (overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id: "out-1",
  prompt: "A portrait reference",
  mode: "image",
  aspect: "1:1",
  model: "fal-ai/flux/dev",
  status: "ready",
  timestamp: "now",
  taskState: "success",
  previewUrl: "https://cdn.test/out-1.png",
  ...overrides,
});

const createParams = (
  overrides: Partial<Parameters<typeof useAiStudioReferenceIngestionActions>[0]> = {}
): Parameters<typeof useAiStudioReferenceIngestionActions>[0] => ({
  activeOutput: makeOutput(),
  mode: "image",
  aspect: "1:1",
  model: "fal-ai/flux/dev",
  setOutputs: vi.fn(),
  updateOutputById: vi.fn(),
  setUiError: vi.fn(),
  ...overrides,
});

describe("useAiStudioReferenceIngestionActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prepareLibraryMediaIngestionPayloadMock.mockImplementation(async (payload) => payload);
    uploadImageAssetToStorageMock.mockResolvedValue({
      url: "https://signed.test/reference.png",
      path: "user-1/reference.png",
      size: 123,
    });
    uploadVideoAssetToStorageMock.mockResolvedValue({
      url: "https://signed.test/reference.mp4",
      path: "user-1/reference.mp4",
      size: 456,
    });
    uploadAudioAssetToStorageMock.mockResolvedValue({
      url: "https://signed.test/reference.mp3",
      path: "user-1/reference.mp3",
      size: 789,
    });
  });

  it("does not use the active output as default agent image context", () => {
    const { result } = renderHook(() => useAiStudioReferenceIngestionActions(createParams()));

    expect(
      result.current.getAgentContext({
        lastAssistantMessage: "Upload your image to get the process started :)",
        selectedOverride: undefined,
        modeHint: "chat",
      })
    ).toEqual(
      expect.objectContaining({
        focusedSource: "agent-output",
        focusedReferenceId: null,
        selectedReferenceIds: [],
        media: [],
      })
    );
  });

  it("allows callers to opt into active output image context", () => {
    const { result } = renderHook(() => useAiStudioReferenceIngestionActions(createParams()));

    expect(
      result.current.getAgentContext({
        lastAssistantMessage: "Upload your image to get the process started :)",
        includeActiveOutput: true,
        modeHint: "chat",
      })
    ).toEqual(
      expect.objectContaining({
        focusedSource: "image",
        focusedReferenceId: "out-1",
        selectedReferenceIds: ["out-1"],
        media: [
          expect.objectContaining({
            id: "out-1",
            kind: "image",
            url: "https://cdn.test/out-1.png",
          }),
        ],
      })
    );
  });

  it("allows callers to explicitly clear selected image context", () => {
    const { result } = renderHook(() => useAiStudioReferenceIngestionActions(createParams()));

    expect(
      result.current.getAgentContext({
        lastAssistantMessage: "Previous assistant turn",
        selectedOverride: null,
      })
    ).toEqual(
      expect.objectContaining({
        focusedSource: "agent-output",
        focusedReferenceId: null,
        media: [],
        selectedReferenceIds: [],
        activePrompt: "Previous assistant turn",
      })
    );
  });

  it("associates saved library media with the active project on ingest", async () => {
    const setOutputs = vi.fn();
    const { result } = renderHook(() =>
      useAiStudioReferenceIngestionActions(
        createParams({
          projectId: "project-1",
          setOutputs,
        })
      )
    );

    await act(async () => {
      await result.current.addLibraryMediaReferenceToQuickSlot({
        id: "media-1",
        url: "https://cdn.test/media-1.png",
        fileType: "image",
        filename: "Reference 1",
      });
    });

    expect(associateMediaFilesWithProjectMock).toHaveBeenCalledWith({
      projectId: "project-1",
      mediaFileIds: ["media-1"],
    });
    expect(setOutputs).toHaveBeenCalled();
  });

  it("still refreshes the optimistic card when project association fails", async () => {
    const setOutputs = vi.fn();
    const updateOutputById = vi.fn();
    associateMediaFilesWithProjectMock.mockRejectedValueOnce(new Error("association failed"));
    prepareLibraryMediaIngestionPayloadMock.mockResolvedValueOnce({
      id: "media-1",
      url: "https://cdn.test/media-1-refreshed.png",
      fileType: "image",
      filename: "Reference 1",
    });
    const { result } = renderHook(() =>
      useAiStudioReferenceIngestionActions(
        createParams({
          projectId: "project-1",
          setOutputs,
          updateOutputById,
        })
      )
    );

    await act(async () => {
      await result.current.addLibraryMediaReferenceToQuickSlot({
        id: "media-1",
        url: "https://cdn.test/media-1.png",
        fileType: "image",
        filename: "Reference 1",
      });
    });

    expect(associateMediaFilesWithProjectMock).toHaveBeenCalledTimes(1);
    expect(prepareLibraryMediaIngestionPayloadMock).toHaveBeenCalledTimes(1);
    expect(updateOutputById).toHaveBeenCalledTimes(1);
  });

  it("inserts pasted local project media immediately and lets background durability handle uploads", async () => {
    let nextOutputs: StudioOutput[] = [];
    const setOutputs = vi.fn(
      (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => {
        nextOutputs = typeof updater === "function" ? updater(nextOutputs) : updater;
      }
    );
    const { result } = renderHook(() =>
      useAiStudioReferenceIngestionActions(
        createParams({
          projectId: "project-1",
          setOutputs,
        })
      )
    );

    await act(async () => {
      await result.current.addPastedMediaReference({
        url: "data:image/png;base64,abc",
        mimeType: "image/png",
      });
    });

    expect(nextOutputs[0]).toEqual(
      expect.objectContaining({
        previewUrl: "data:image/png;base64,abc",
        previewStoragePath: null,
        fullStoragePath: null,
      })
    );
    expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
  });

  it("inserts project-route file refs immediately and lets background durability handle uploads", async () => {
    let nextOutputs: StudioOutput[] = [];
    const setOutputs = vi.fn(
      (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => {
        nextOutputs = typeof updater === "function" ? updater(nextOutputs) : updater;
      }
    );
    const file = new File(["hello"], "reference.png", { type: "image/png" });
    const files = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
      [Symbol.iterator]: function* () {
        yield file;
      },
    } as unknown as FileList;
    const objectUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:reference-image-1");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    try {
      const { result } = renderHook(() =>
        useAiStudioReferenceIngestionActions(
          createParams({
            projectId: "project-1",
            setOutputs,
          })
        )
      );

      await act(async () => {
        await result.current.addOutputsFromFiles(files, "filePicker");
      });

      expect(nextOutputs[0]).toEqual(
        expect.objectContaining({
          previewUrl: expect.stringMatching(/^data:image\/png;base64,/),
          localObjectUrl: "blob:reference-image-1",
        })
      );
      expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
      expect(revokeSpy).not.toHaveBeenCalled();
    } finally {
      objectUrlSpy.mockRestore();
      revokeSpy.mockRestore();
    }
  });

  it("inserts multiple dropped project-route image refs without blocking on batch durability", async () => {
    let nextOutputs: StudioOutput[] = [];
    const setOutputs = vi.fn(
      (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => {
        nextOutputs = typeof updater === "function" ? updater(nextOutputs) : updater;
      }
    );
    const first = new File(["one"], "reference-1.png", { type: "image/png" });
    const second = new File(["two"], "reference-2.png", { type: "image/png" });
    const files = {
      0: first,
      1: second,
      length: 2,
      item: (index: number) => [first, second][index] ?? null,
      [Symbol.iterator]: function* () {
        yield first;
        yield second;
      },
    } as unknown as FileList;
    const objectUrlSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:reference-image-1")
      .mockReturnValueOnce("blob:reference-image-2");

    try {
      const { result } = renderHook(() =>
        useAiStudioReferenceIngestionActions(
          createParams({
            projectId: "project-1",
            setOutputs,
          })
        )
      );

      await act(async () => {
        await result.current.addOutputsFromFiles(files, "drop");
      });

      expect(nextOutputs).toHaveLength(2);
      expect(nextOutputs.map((output) => output.prompt)).toEqual([
        "reference-1.png",
        "reference-2.png",
      ]);
      expect(nextOutputs.every((output) => output.timestamp === "Dropped")).toBe(true);
      expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
    } finally {
      objectUrlSpy.mockRestore();
    }
  });

  it("keeps successful file refs when one dropped image fails to read", async () => {
    const originalFileReader = FileReader;
    let nextOutputs: StudioOutput[] = [];
    const setOutputs = vi.fn(
      (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => {
        nextOutputs = typeof updater === "function" ? updater(nextOutputs) : updater;
      }
    );
    const setUiError = vi.fn();
    const goodFile = new File(["good"], "good.png", { type: "image/png" });
    const brokenFile = new File(["broken"], "broken.png", { type: "image/png" });
    const files = {
      0: goodFile,
      1: brokenFile,
      length: 2,
      item: (index: number) => [goodFile, brokenFile][index] ?? null,
      [Symbol.iterator]: function* () {
        yield goodFile;
        yield brokenFile;
      },
    } as unknown as FileList;
    const objectUrlSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValueOnce("blob:good-image")
      .mockReturnValueOnce("blob:broken-image");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      value: class MockFileReader {
        result: string | null = null;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        readAsDataURL(file: File) {
          if (file.name === "broken.png") {
            this.onerror?.();
            return;
          }
          this.result = `data:${file.type};base64,good-file`;
          this.onload?.();
        }
      },
    });

    try {
      const { result } = renderHook(() =>
        useAiStudioReferenceIngestionActions(
          createParams({
            projectId: "project-1",
            setOutputs,
            setUiError,
          })
        )
      );

      await act(async () => {
        await result.current.addOutputsFromFiles(files, "drop");
      });

      expect(nextOutputs).toHaveLength(1);
      expect(nextOutputs[0]?.prompt).toBe("good.png");
      expect(setUiError).toHaveBeenCalledWith(
        "Some files could not be added. The rest were added."
      );
      expect(revokeSpy).toHaveBeenCalledWith("blob:broken-image");
    } finally {
      objectUrlSpy.mockRestore();
      revokeSpy.mockRestore();
      Object.defineProperty(globalThis, "FileReader", {
        configurable: true,
        value: originalFileReader,
      });
    }
  });

  it("surfaces a full drop error when every image in the batch fails to read", async () => {
    const originalFileReader = FileReader;
    const setOutputs = vi.fn();
    const setUiError = vi.fn();
    const brokenFile = new File(["broken"], "broken.png", { type: "image/png" });
    const files = {
      0: brokenFile,
      length: 1,
      item: (index: number) => (index === 0 ? brokenFile : null),
      [Symbol.iterator]: function* () {
        yield brokenFile;
      },
    } as unknown as FileList;
    const objectUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:broken-image");
    Object.defineProperty(globalThis, "FileReader", {
      configurable: true,
      value: class MockFileReader {
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;

        readAsDataURL() {
          this.onerror?.();
        }
      },
    });

    try {
      const { result } = renderHook(() =>
        useAiStudioReferenceIngestionActions(
          createParams({
            projectId: "project-1",
            setOutputs,
            setUiError,
          })
        )
      );

      await act(async () => {
        await result.current.addOutputsFromFiles(files, "drop");
      });

      expect(setOutputs).not.toHaveBeenCalled();
      expect(setUiError).toHaveBeenCalledWith(
        "Unable to add those files right now. Please try again."
      );
    } finally {
      objectUrlSpy.mockRestore();
      Object.defineProperty(globalThis, "FileReader", {
        configurable: true,
        value: originalFileReader,
      });
    }
  });
});
