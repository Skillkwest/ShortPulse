import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

const originalCreateObjectURL = URL.createObjectURL;

const makeDragEvent = (data: Record<string, string> = {}, files: File[] = []) =>
  ({
    preventDefault: vi.fn(),
    dataTransfer: {
      types: [],
      files,
      dropEffect: "copy",
      getData: (key: string) => data[key] ?? "",
    },
  }) as unknown as DragEvent<HTMLDivElement>;

describe("useAiStudioAgentComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
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

  it("defaults desktop image-file drops to a single attachment", () => {
    const createObjectURLMock = vi.fn((file: File) => `blob:${file.name}`);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    });
    const files = [
      new File(["one"], "one.png", { type: "image/png" }),
      new File(["two"], "two.png", { type: "image/png" }),
    ];

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent({}, files));
    });

    expect(extractDragDropPayloadMock).not.toHaveBeenCalled();
    expect(result.current.agentAttachments).toEqual([
      expect.objectContaining({
        kind: "image",
        imageUrl: "blob:one.png",
      }),
    ]);
  });

  it("stages up to the configured image-file drop limit", () => {
    const ensureAgentSession = vi.fn();
    const createObjectURLMock = vi.fn((file: File) => `blob:${file.name}`);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURLMock,
    });
    const files = [
      new File(["one"], "one.png", { type: "image/png" }),
      new File(["two"], "two.png", { type: "image/png" }),
      new File(["three"], "three.png", { type: "image/png" }),
      new File(["four"], "four.png", { type: "image/png" }),
    ];

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: false,
        ensureAgentSession,
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
        maxImageAttachmentsPerDrop: 3,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent({}, files));
    });

    expect(ensureAgentSession).toHaveBeenCalledTimes(1);
    expect(extractDragDropPayloadMock).not.toHaveBeenCalled();
    expect(result.current.agentAttachments.map((attachment) => attachment.imageUrl)).toEqual([
      "blob:one.png",
      "blob:two.png",
      "blob:three.png",
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

  it("ignores raw storage keys and uses the draggable image URL for composer previews", () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: "https://signed.example.com/reference-image.png",
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
            previewUrl: "user-1/media-library/reference-image.png",
            fullStoragePath: "user-1/media-library/reference-image-full.png",
          }),
        ]),
        resolveOutputPreviewUrlById: () => "user-1/media-library/reference-image-preview.png",
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      imageUrl: "https://signed.example.com/reference-image.png",
      text: "Reference note",
    });
  });

  it("prefers durable reference URLs before render-only optimizer payloads", () => {
    const optimizerUrl =
      "http://localhost:3000/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fimage.png&w=1200&q=75";
    const durableReferenceUrl =
      "http://localhost:3000/storage/v1/object/sign/media_library/user-1/image.png";
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: durableReferenceUrl,
      promptText: "Reference note",
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
      result.current.handleAgentAttachmentDrop(
        makeDragEvent({
          "text/reference-render-url": optimizerUrl,
        })
      );
    });

    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      imageUrl: durableReferenceUrl,
      imageFallbackUrls: [optimizerUrl],
      text: "Reference note",
    });
  });

  it("keeps drag-provided render snapshots ahead of weaker durable fallbacks for composer previews", () => {
    const dataRenderUrl = "data:image/jpeg;base64,generated-render";
    const signedReferenceUrl = "https://signed.example.com/reference-image.png";
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: dataRenderUrl,
      promptText: "Reference note",
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
      result.current.handleAgentAttachmentDrop(
        makeDragEvent({
          "text/reference-render-url": dataRenderUrl,
          "text/reference-url": signedReferenceUrl,
        })
      );
    });

    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      imageUrl: dataRenderUrl,
      imageFallbackUrls: [signedReferenceUrl],
      text: "Reference note",
    });
  });

  it("keeps drag-provided snapshots ahead of output preview fallbacks", () => {
    const dataRenderUrl = "data:image/jpeg;base64,generated-render";
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: dataRenderUrl,
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
            previewUrl: "https://cdn.example.com/stale-preview.png",
            fullStoragePath: "https://cdn.example.com/stale-full.png",
          }),
        ]),
        resolveOutputPreviewUrlById: () => "https://cdn.example.com/panel-preview.png",
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(
        makeDragEvent({
          "text/reference-render-url": dataRenderUrl,
        })
      );
    });

    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      referenceId: "out-1",
      imageUrl: dataRenderUrl,
      imageFallbackUrls: [
        "https://cdn.example.com/stale-full.png",
        "https://cdn.example.com/panel-preview.png",
      ],
      text: "Reference note",
    });
  });

  it("prefers extracted drag image URLs before output preview fallbacks", () => {
    const renderedDragUrl =
      "http://localhost:3000/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fimage.png&w=1200&q=75";
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: renderedDragUrl,
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
            previewUrl: "user-1/media-library/raw-preview.png",
            fullStoragePath: "user-1/media-library/raw-full.png",
          }),
        ]),
        resolveOutputPreviewUrlById: () => "user-1/media-library/raw-panel-preview.png",
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toEqual([
      expect.objectContaining({
        kind: "image",
        referenceId: "out-1",
        imageUrl: renderedDragUrl,
      }),
    ]);
  });

  it("stages dropped prompt text as a prompt attachment", () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: null,
      promptText: "A cinematic portrait at golden hour",
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
    });

    expect(result.current.agentInput).toBe("");
    expect(result.current.agentAttachments).toEqual([
      expect.objectContaining({
        kind: "prompt",
        referenceId: "out-1",
        text: "A cinematic portrait at golden hour",
        deliveryStatus: "ready",
        deliveryError: null,
      }),
    ]);
    expect(result.current.linkedPromptReferenceIds).toEqual(["out-1"]);
  });

  it("preserves existing composer text when a prompt card is dropped", () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: null,
      promptText: "Dropped prompt should replace existing text",
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
      result.current.handleAgentInputChange("Existing draft text");
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentInput).toBe("Existing draft text");
    expect(result.current.agentAttachments).toEqual([
      expect.objectContaining({
        kind: "prompt",
        referenceId: "out-1",
        text: "Dropped prompt should replace existing text",
      }),
    ]);
  });

  it("preserves input text when composer reset requests preserveInput", () => {
    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentInputChange("Keep this draft message");
    });
    act(() => {
      result.current.resetAgentComposer({ preserveInput: true });
    });

    expect(result.current.agentInput).toBe("Keep this draft message");
    expect(result.current.agentAttachments).toEqual([]);
    expect(result.current.agentAttachmentError).toBeNull();
  });

  it("preserves attachments when composer reset requests preserveAttachments", () => {
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
    });
    act(() => {
      result.current.resetAgentComposer({ preserveInput: true, preserveAttachments: true });
    });

    expect(result.current.agentAttachments).toHaveLength(1);
  });
});
