import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiStudioReferenceIngestionActions } from "../useAiStudioReferenceIngestionActions";
import type { StudioOutput } from "../../types";

const associateMediaFilesWithProjectMock = vi.hoisted(() => vi.fn());
const prepareLibraryMediaIngestionPayloadMock = vi.hoisted(() => vi.fn(async (payload) => payload));

vi.mock("../../logic/mediaLibraryPersistence", () => ({
  associateMediaFilesWithProject: associateMediaFilesWithProjectMock,
}));

vi.mock("../../reference-ingestion/prepareLibraryMediaIngestionPayload", () => ({
  prepareLibraryMediaIngestionPayload: prepareLibraryMediaIngestionPayloadMock,
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
});
