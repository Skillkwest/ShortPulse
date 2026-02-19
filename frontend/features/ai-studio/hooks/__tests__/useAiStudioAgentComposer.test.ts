import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DragEvent } from "react";
import type { StudioOutput } from "../../types";
import { useAiStudioAgentComposer } from "../useAiStudioAgentComposer";
import { extractDragDropPayload } from "../../utils/dragDrop";

vi.mock("../../utils/dragDrop", async () => {
  const actual =
    await vi.importActual<typeof import("../../utils/dragDrop")>("../../utils/dragDrop");
  return {
    ...actual,
    extractDragDropPayload: vi.fn(),
  };
});

const extractDragDropPayloadMock = vi.mocked(extractDragDropPayload);

const makeOutput = (id: string, overrides: Partial<StudioOutput> = {}): StudioOutput => ({
  id,
  prompt: "Prompt",
  mode: "image",
  aspect: "1:1",
  model: "fal-ai/flux/dev",
  status: "ready",
  timestamp: "now",
  taskState: "success",
  ...overrides,
});

const createFindOutputById = (outputs: StudioOutput[]) => {
  const byId = new Map(outputs.map((output) => [output.id, output]));
  return (id: string) => byId.get(id) ?? null;
};

const makeDragEvent = (data: Record<string, string> = {}) =>
  ({
    preventDefault: vi.fn(),
    dataTransfer: {
      types: [],
      dropEffect: "copy",
      getData: (key: string) => data[key] ?? "",
    },
  }) as unknown as DragEvent<HTMLDivElement>;

describe("useAiStudioAgentComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears attachment error when input changes", () => {
    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.setAgentAttachmentError("attachment failed");
    });
    act(() => {
      result.current.handleAgentInputChange("new prompt");
    });

    expect(result.current.agentInput).toBe("new prompt");
    expect(result.current.agentAttachmentError).toBeNull();
  });

  it("adds an image attachment on drop and enables session when disabled", () => {
    const ensureAgentSession = vi.fn();
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: "https://example.com/image.png",
      promptText: "Reference note",
      referenceId: "out-1",
      fromFile: false,
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: false,
        ensureAgentSession,
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(ensureAgentSession).toHaveBeenCalledTimes(1);
    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      imageUrl: "https://example.com/image.png",
      text: "Reference note",
    });
  });

  it("dedupes repeated dropped attachments by signature", () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: "https://example.com/image.png",
      promptText: null,
      referenceId: "out-1",
      fromFile: false,
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toHaveLength(1);
  });

  it("caps image attachments to the most recent three entries", () => {
    extractDragDropPayloadMock
      .mockReturnValueOnce({
        imageUrl: "https://example.com/1.png",
        promptText: null,
        referenceId: "out-1",
        fromFile: false,
      })
      .mockReturnValueOnce({
        imageUrl: "https://example.com/2.png",
        promptText: null,
        referenceId: "out-2",
        fromFile: false,
      })
      .mockReturnValueOnce({
        imageUrl: "https://example.com/3.png",
        promptText: null,
        referenceId: "out-3",
        fromFile: false,
      })
      .mockReturnValueOnce({
        imageUrl: "https://example.com/4.png",
        promptText: null,
        referenceId: "out-4",
        fromFile: false,
      });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([
          makeOutput("out-1"),
          makeOutput("out-2"),
          makeOutput("out-3"),
          makeOutput("out-4"),
        ]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toHaveLength(3);
    expect(result.current.agentAttachments.map((attachment) => attachment.referenceId)).toEqual([
      "out-2",
      "out-3",
      "out-4",
    ]);
  });

  it("falls back to output storage URLs when drop payload omits imageUrl", () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: null,
      promptText: "Reference note",
      referenceId: "out-1",
      fromFile: false,
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([
          makeOutput("out-1", {
            previewUrl: undefined,
            fullStoragePath: "https://example.com/fallback-image.png",
          }),
        ]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      imageUrl: "https://example.com/fallback-image.png",
      text: "Reference note",
    });
  });
});
