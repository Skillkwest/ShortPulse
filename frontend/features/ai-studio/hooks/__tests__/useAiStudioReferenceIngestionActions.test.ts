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

  it("uploads pasted local project media before inserting it into outputs", async () => {
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

    expect(uploadImageAssetToStorageMock).toHaveBeenCalledWith("data:image/png;base64,abc");
    expect(nextOutputs[0]).toEqual(
      expect.objectContaining({
        previewUrl: "https://signed.test/reference.png",
        previewStoragePath: "user-1/reference.png",
        fullStoragePath: "user-1/reference.png",
        localObjectUrl: undefined,
      })
    );
  });

  it("uploads project-route file refs before inserting them into outputs", async () => {
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

      expect(uploadImageAssetToStorageMock).toHaveBeenCalledWith(
        expect.stringMatching(/^data:image\/png|^blob:/)
      );
      expect(nextOutputs[0]).toEqual(
        expect.objectContaining({
          previewUrl: "https://signed.test/reference.png",
          previewStoragePath: "user-1/reference.png",
          fullStoragePath: "user-1/reference.png",
          localObjectUrl: undefined,
        })
      );
      expect(revokeSpy).toHaveBeenCalledWith("blob:reference-image-1");
    } finally {
      objectUrlSpy.mockRestore();
      revokeSpy.mockRestore();
    }
  });
});
