import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStudioReferenceIngestionActions } from "../useAiStudioReferenceIngestionActions";
import type { StudioOutput } from "../../types";

const associateMediaFilesWithProjectMock = vi.hoisted(() => vi.fn());
const useResolvedProtectedSessionStateMock = vi.hoisted(() => vi.fn());
const prepareLibraryMediaIngestionPayloadMock = vi.hoisted(() => vi.fn(async (payload) => payload));
const uploadMediaFileMock = vi.hoisted(() => vi.fn());
const uploadImageAssetToStorageMock = vi.hoisted(() => vi.fn());
const uploadVideoAssetToStorageMock = vi.hoisted(() => vi.fn());
const uploadAudioAssetToStorageMock = vi.hoisted(() => vi.fn());

vi.mock("../../logic/mediaLibraryPanelApi", () => ({
  uploadMediaFile: (...args: unknown[]) => uploadMediaFileMock(...args),
}));

vi.mock("../../logic/mediaLibraryPersistence", () => ({
  associateMediaFilesWithProject: associateMediaFilesWithProjectMock,
}));

vi.mock("../../../../lib/protectedRouteSessionContext", () => ({
  useResolvedProtectedSessionState: (...args: unknown[]) =>
    useResolvedProtectedSessionStateMock(...args),
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
  outputs: [],
  setOutputs: vi.fn(),
  setUiError: vi.fn(),
  ...overrides,
});

const makeUploadRow = (overrides: Record<string, unknown> = {}) => ({
  id: "media-reference",
  filename: "reference.png",
  storage_path: "user-1/uploads/images/reference.png",
  preview_storage_path: "user-1/uploads/images/reference.png",
  file_type: "image",
  file_size: 123,
  source: "upload",
  created_at: "2026-05-25T00:00:00.000Z",
  signedUrl: "https://signed.test/reference.png",
  ...overrides,
});

const CURRENT_USER_ID = "user-1";

describe("useAiStudioReferenceIngestionActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useResolvedProtectedSessionStateMock.mockReturnValue({
      initialized: true,
      session: { user: { id: CURRENT_USER_ID } } as never,
      user: { id: CURRENT_USER_ID } as never,
    });
    prepareLibraryMediaIngestionPayloadMock.mockImplementation(async (payload) => payload);
    uploadMediaFileMock.mockImplementation(async ({ file }: { file: File }) =>
      makeUploadRow({
        id: `media-${file.name}`,
        filename: file.name,
        storage_path: `user-1/uploads/images/${file.name}`,
        preview_storage_path: `user-1/uploads/images/${file.name}`,
        signedUrl: `https://signed.test/${file.name}`,
      })
    );
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
      userId: CURRENT_USER_ID,
    });
    expect(setOutputs).toHaveBeenCalled();
  });

  it("inserts quick-slot library media before prepared URL hydration finishes", async () => {
    let nextOutputs: StudioOutput[] = [];
    const setOutputs = vi.fn(
      (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => {
        nextOutputs = typeof updater === "function" ? updater(nextOutputs) : updater;
      }
    );
    associateMediaFilesWithProjectMock.mockReturnValueOnce(new Promise(() => undefined));
    let resolvePreparedPayload: (payload: {
      id: string;
      url: string;
      previewUrl: string;
      fullUrl: string;
      fileType: "image";
      filename: string;
      previewStoragePath: string;
      fullStoragePath: string;
    }) => void = () => undefined;
    prepareLibraryMediaIngestionPayloadMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolvePreparedPayload = resolve;
      })
    );
    const preparedPayload = {
      id: "media-1",
      url: "https://cdn.test/media-1-prepared.png",
      previewUrl: "https://cdn.test/media-1-preview-prepared.png",
      fullUrl: "https://cdn.test/media-1-full-prepared.png",
      fileType: "image",
      filename: "Reference 1",
      previewStoragePath: "user-1/library/media-1-preview.png",
      fullStoragePath: "user-1/library/media-1-full.png",
    } as const;
    const { result } = renderHook(() =>
      useAiStudioReferenceIngestionActions(
        createParams({
          projectId: "project-1",
          setOutputs,
        })
      )
    );

    let insertedId: string | null | undefined;
    await act(async () => {
      insertedId = await result.current.addLibraryMediaReferenceToQuickSlot({
        id: "media-1",
        url: "https://cdn.test/media-1.png",
        fileType: "image",
        filename: "Reference 1",
      });
    });

    expect(insertedId).toEqual(expect.stringMatching(/^library-/));
    expect(setOutputs).toHaveBeenCalledTimes(1);
    expect(nextOutputs[0]).toEqual(
      expect.objectContaining({
        previewUrl: "https://cdn.test/media-1.png",
        resultUrls: ["https://cdn.test/media-1.png"],
        savedMediaIds: ["media-1"],
      })
    );
    expect(associateMediaFilesWithProjectMock).toHaveBeenCalledWith({
      projectId: "project-1",
      mediaFileIds: ["media-1"],
      userId: CURRENT_USER_ID,
    });
    expect(prepareLibraryMediaIngestionPayloadMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePreparedPayload(preparedPayload);
    });

    await waitFor(() =>
      expect(nextOutputs[0]).toEqual(
        expect.objectContaining({
          previewUrl: "https://cdn.test/media-1-preview-prepared.png",
          resultUrls: ["https://cdn.test/media-1-full-prepared.png"],
          previewStoragePath: "user-1/library/media-1-preview.png",
          fullStoragePath: "user-1/library/media-1-full.png",
          savedMediaIds: ["media-1"],
        })
      )
    );
  });

  it("does not block quick-slot insertion when media-library preparation never resolves", async () => {
    let nextOutputs: StudioOutput[] = [];
    const setOutputs = vi.fn(
      (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => {
        nextOutputs = typeof updater === "function" ? updater(nextOutputs) : updater;
      }
    );
    prepareLibraryMediaIngestionPayloadMock.mockReturnValueOnce(new Promise(() => undefined));
    const { result } = renderHook(() =>
      useAiStudioReferenceIngestionActions(
        createParams({
          projectId: "project-1",
          setOutputs,
        })
      )
    );

    let insertedId: string | null | undefined;
    await act(async () => {
      insertedId = await result.current.addLibraryMediaReferenceToQuickSlot({
        id: "media-1",
        url: "https://cdn.test/media-1.png",
        fileType: "image",
        filename: "Reference 1",
      });
    });

    expect(insertedId).toEqual(expect.stringMatching(/^library-/));
    expect(setOutputs).toHaveBeenCalledTimes(1);
    expect(nextOutputs[0]).toEqual(
      expect.objectContaining({
        previewUrl: "https://cdn.test/media-1.png",
        resultUrls: ["https://cdn.test/media-1.png"],
        savedMediaIds: ["media-1"],
      })
    );
  });

  it("still refreshes the optimistic card when project association fails", async () => {
    let nextOutputs: StudioOutput[] = [];
    const setOutputs = vi.fn(
      (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => {
        nextOutputs = typeof updater === "function" ? updater(nextOutputs) : updater;
      }
    );
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
        })
      )
    );

    await act(async () => {
      result.current.addLibraryMediaReference({
        id: "media-1",
        url: "https://cdn.test/media-1.png",
        fileType: "image",
        filename: "Reference 1",
      });
      await Promise.resolve();
    });

    expect(associateMediaFilesWithProjectMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(prepareLibraryMediaIngestionPayloadMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(nextOutputs[0]).toEqual(
        expect.objectContaining({
          previewUrl: "https://cdn.test/media-1-refreshed.png",
          resultUrls: ["https://cdn.test/media-1-refreshed.png"],
          savedMediaIds: ["media-1"],
        })
      )
    );
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

  it("imports project-route file refs through the Media Library upload path", async () => {
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

    expect(uploadMediaFileMock).toHaveBeenCalledWith({
      file,
      destinationTab: "uploaded_images",
    });
    expect(associateMediaFilesWithProjectMock).toHaveBeenCalledWith({
      projectId: "project-1",
      mediaFileIds: ["media-reference.png"],
      userId: CURRENT_USER_ID,
    });
    expect(nextOutputs[0]).toEqual(
      expect.objectContaining({
        prompt: "reference.png",
        previewUrl: "https://signed.test/reference.png",
        previewStoragePath: "user-1/uploads/images/reference.png",
        fullStoragePath: "user-1/uploads/images/reference.png",
        mediaSource: "library",
        savedMediaIds: ["media-reference.png"],
        saveState: "saved",
      })
    );
    expect(nextOutputs[0]?.localObjectUrl).toBeUndefined();
    expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
  });

  it("imports direct audio file refs through the canonical Media Library upload path", async () => {
    let nextOutputs: StudioOutput[] = [];
    const setOutputs = vi.fn(
      (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => {
        nextOutputs = typeof updater === "function" ? updater(nextOutputs) : updater;
      }
    );
    const file = new File(["audio"], "reference.mp3", { type: "audio/mpeg" });
    const files = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
      [Symbol.iterator]: function* () {
        yield file;
      },
    } as unknown as FileList;
    uploadMediaFileMock.mockResolvedValueOnce(
      makeUploadRow({
        id: "media-reference-audio",
        filename: "reference.mp3",
        storage_path: "user-1/uploads/audio/reference.mp3",
        preview_storage_path: "user-1/uploads/audio/reference.mp3",
        file_type: "audio",
        signedUrl: "https://signed.test/reference.mp3",
      })
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
      await result.current.addOutputsFromFiles(files, "drop");
    });

    expect(uploadMediaFileMock).toHaveBeenCalledWith({
      file,
      destinationTab: "uploaded_images",
    });
    expect(nextOutputs[0]).toEqual(
      expect.objectContaining({
        mode: "audio",
        prompt: "reference.mp3",
        previewUrl: "https://signed.test/reference.mp3",
        resultUrls: ["https://signed.test/reference.mp3"],
        previewStoragePath: "user-1/uploads/audio/reference.mp3",
        fullStoragePath: "user-1/uploads/audio/reference.mp3",
        mediaSource: "library",
        savedMediaIds: ["media-reference-audio"],
        saveState: "saved",
      })
    );
    expect(uploadAudioAssetToStorageMock).not.toHaveBeenCalled();
  });

  it("does not upload file refs when the visible Reference Grid is full", async () => {
    const setOutputs = vi.fn();
    const setUiError = vi.fn();
    const file = new File(["hello"], "reference.png", { type: "image/png" });
    const files = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
      [Symbol.iterator]: function* () {
        yield file;
      },
    } as unknown as FileList;

    const { result } = renderHook(() =>
      useAiStudioReferenceIngestionActions(
        createParams({
          projectId: "project-1",
          outputs: Array.from({ length: 250 }, (_, index) => makeOutput({ id: `out-${index}` })),
          setOutputs,
          setUiError,
        })
      )
    );

    await act(async () => {
      await result.current.addOutputsFromFiles(files, "filePicker");
    });

    expect(uploadMediaFileMock).not.toHaveBeenCalled();
    expect(setOutputs).not.toHaveBeenCalled();
    expect(setUiError).toHaveBeenCalledWith(expect.stringContaining("250 items"));
  });

  it("uses Reference Grid insertion time for local file uploads instead of the media row created_at", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-25T15:30:00.000Z"));

    try {
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

      expect(nextOutputs[0]?.createdAt).toBe("2026-05-25T15:30:00.000Z");
      expect(nextOutputs[0]?.createdAt).not.toBe("2026-05-25T00:00:00.000Z");
    } finally {
      vi.useRealTimers();
    }
  });

  it("normalizes Finder image drops with missing MIME types before upload", async () => {
    let nextOutputs: StudioOutput[] = [];
    const setOutputs = vi.fn(
      (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => {
        nextOutputs = typeof updater === "function" ? updater(nextOutputs) : updater;
      }
    );
    const file = new File(["hello"], "finder-reference.png", { type: "" });
    const files = {
      0: file,
      length: 1,
      item: (index: number) => (index === 0 ? file : null),
      [Symbol.iterator]: function* () {
        yield file;
      },
    } as unknown as FileList;

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

    const uploadedFile = uploadMediaFileMock.mock.calls[0]?.[0]?.file as File;
    expect(uploadedFile.name).toBe("finder-reference.png");
    expect(uploadedFile.type).toBe("image/png");
    expect(uploadMediaFileMock).toHaveBeenCalledWith({
      file: uploadedFile,
      destinationTab: "uploaded_images",
    });
    expect(nextOutputs[0]?.prompt).toBe("finder-reference.png");
  });

  it("imports multiple dropped project-route image refs in the original order", async () => {
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

    expect(uploadMediaFileMock).toHaveBeenCalledTimes(2);
    expect(nextOutputs).toHaveLength(2);
    expect(nextOutputs.map((output) => output.prompt)).toEqual([
      "reference-1.png",
      "reference-2.png",
    ]);
    expect(nextOutputs.every((output) => output.timestamp === "Library")).toBe(true);
    expect(nextOutputs.every((output) => output.mediaSource === "library")).toBe(true);
    expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
  });

  it("returns inserted file refs in the original drop order for downstream placement", async () => {
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

    const { result } = renderHook(() =>
      useAiStudioReferenceIngestionActions(
        createParams({
          projectId: "project-1",
        })
      )
    );

    let insertedResults: Awaited<ReturnType<typeof result.current.ingestReferenceFiles>> = [];
    await act(async () => {
      insertedResults = await result.current.ingestReferenceFiles(files, "drop");
    });

    expect(insertedResults.map((entry) => entry.file.name)).toEqual([
      "reference-1.png",
      "reference-2.png",
    ]);
    expect(insertedResults.map((entry) => entry.payload.filename)).toEqual([
      "reference-1.png",
      "reference-2.png",
    ]);
  });

  it("keeps successful file refs when one canonical upload fails", async () => {
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
    uploadMediaFileMock.mockImplementation(async ({ file }: { file: File }) => {
      if (file.name === "broken.png") {
        throw new Error("Upload failed");
      }
      return makeUploadRow({
        id: "media-good",
        filename: "good.png",
        storage_path: "user-1/uploads/images/good.png",
        preview_storage_path: "user-1/uploads/images/good.png",
        signedUrl: "https://signed.test/good.png",
      });
    });

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
    expect(setUiError).toHaveBeenCalledWith("Some files could not be added. The rest were added.");
  });

  it("keeps valid refs from mixed supported and unsupported desktop drops", async () => {
    let nextOutputs: StudioOutput[] = [];
    const setOutputs = vi.fn(
      (updater: StudioOutput[] | ((prev: StudioOutput[]) => StudioOutput[])) => {
        nextOutputs = typeof updater === "function" ? updater(nextOutputs) : updater;
      }
    );
    const setUiError = vi.fn();
    const goodFile = new File(["good"], "good.png", { type: "image/png" });
    const unsupportedFile = new File(["notes"], "notes.txt", { type: "text/plain" });
    const files = {
      0: goodFile,
      1: unsupportedFile,
      length: 2,
      item: (index: number) => [goodFile, unsupportedFile][index] ?? null,
      [Symbol.iterator]: function* () {
        yield goodFile;
        yield unsupportedFile;
      },
    } as unknown as FileList;

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

    expect(uploadMediaFileMock).toHaveBeenCalledTimes(1);
    expect(nextOutputs).toHaveLength(1);
    expect(nextOutputs[0]?.prompt).toBe("good.png");
    expect(setUiError).toHaveBeenCalledWith("Some files could not be added. The rest were added.");
    expect(setUiError.mock.calls.flat().join(" ")).not.toContain("open reference slot");
  });

  it("surfaces a full drop error when every upload fails", async () => {
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
    uploadMediaFileMock.mockRejectedValue(new Error("Upload failed"));

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
    expect(setUiError).toHaveBeenCalledWith("Upload failed");
  });
});
