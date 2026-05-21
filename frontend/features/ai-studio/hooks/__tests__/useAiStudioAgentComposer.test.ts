import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DragEvent } from "react";
import type { StudioOutput } from "../../types";
import { useAiStudioAgentComposer } from "../useAiStudioAgentComposer";
import { getCreateWorkflowDebugSnapshot } from "../../logic/createWorkflowDebug";
import {
  createEphemeralComposerImageData,
  EPHEMERAL_IMAGE_UNREADABLE_MESSAGE,
} from "../../logic/ephemeralComposerImage";
import { readMediaLibraryDragPayload } from "../../logic/mediaLibraryDragPayload";
import {
  extractComposerImageDropPayload,
  extractDragDropPayload,
  extractInternalReferenceDragPayload,
} from "../../utils/dragDrop";
import { uploadImageAssetToStorage } from "../../utils/imageUpload";
import type { ResolvedInternalReferenceSource } from "../../logic/referenceSource/internalReferenceSource";

vi.mock("../../utils/dragDrop", async () => {
  const actual =
    await vi.importActual<typeof import("../../utils/dragDrop")>("../../utils/dragDrop");
  return {
    ...actual,
    extractComposerImageDropPayload: vi.fn(),
    extractDragDropPayload: vi.fn(),
    extractInternalReferenceDragPayload: vi.fn(),
  };
});

vi.mock("../../logic/mediaLibraryDragPayload", () => ({
  readMediaLibraryDragPayload: vi.fn(),
}));

vi.mock("../../logic/ephemeralComposerImage", () => ({
  createEphemeralComposerImageData: vi.fn(),
  EPHEMERAL_IMAGE_TOO_LARGE_MESSAGE:
    "That image is too large to attach here. Try a smaller image or screenshot.",
  EPHEMERAL_IMAGE_UNREADABLE_MESSAGE:
    "Could not read that image. Try dragging it again or use a different image.",
  isEphemeralLocalImageAttachment: (attachment: { kind: string; source?: string | null }) =>
    attachment.kind === "image" && attachment.source === "ephemeral_local",
}));

vi.mock("../../utils/imageUpload", async () => {
  const actual =
    await vi.importActual<typeof import("../../utils/imageUpload")>("../../utils/imageUpload");
  return {
    ...actual,
    uploadImageAssetToStorage: vi.fn(),
  };
});

const extractDragDropPayloadMock = vi.mocked(extractDragDropPayload);
const extractInternalReferenceDragPayloadMock = vi.mocked(extractInternalReferenceDragPayload);
const extractComposerImageDropPayloadMock = vi.mocked(extractComposerImageDropPayload);
const readMediaLibraryDragPayloadMock = vi.mocked(readMediaLibraryDragPayload);
const createEphemeralComposerImageDataMock = vi.mocked(createEphemeralComposerImageData);
const uploadImageAssetToStorageMock = vi.mocked(uploadImageAssetToStorage);

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
const originalRevokeObjectURL = URL.revokeObjectURL;
const originalFetch = global.fetch;
const CREATE_WORKFLOW_DEBUG_STORAGE_KEY = "shortpulse.create_workflow.debug";

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

const dropAndWaitForAttachments = async (
  result: {
    current: {
      handleAgentAttachmentDrop: (event: DragEvent<HTMLDivElement>) => void;
      agentAttachments: unknown[];
    };
  },
  event: DragEvent<HTMLDivElement> = makeDragEvent(),
  count = 1
) => {
  act(() => {
    result.current.handleAgentAttachmentDrop(event);
  });
  await waitFor(() => {
    expect(result.current.agentAttachments).toHaveLength(count);
  });
};

describe("useAiStudioAgentComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.removeItem(CREATE_WORKFLOW_DEBUG_STORAGE_KEY);
    window.__shortpulseCreateWorkflowDebug?.reset();
    window.__shortpulseCreateWorkflowDebug?.setEnabled(false);
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: null,
      promptText: null,
      referenceId: null,
      fromFile: false,
    });
    extractInternalReferenceDragPayloadMock.mockReturnValue(null);
    extractComposerImageDropPayloadMock.mockReturnValue(null);
    readMediaLibraryDragPayloadMock.mockReturnValue(null);
    let uploadCount = 0;
    uploadImageAssetToStorageMock.mockImplementation(async () => {
      uploadCount += 1;
      return {
        url: `https://uploaded.example.com/reference-${uploadCount}.png`,
        path: `uploads/reference-${uploadCount}.png`,
        size: 1,
      };
    });
    createEphemeralComposerImageDataMock.mockResolvedValue({
      previewDataUrl: "data:image/png;base64,cHJldmlldw==",
      modelDataUrl: "data:image/png;base64,bW9kZWw=",
      width: 512,
      height: 512,
    });
  });

  afterEach(() => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: originalCreateObjectURL,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectURL,
    });
    global.fetch = originalFetch;
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

  it("adds an ephemeral image attachment on drop and enables session when disabled", async () => {
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

    await dropAndWaitForAttachments(result);

    expect(ensureAgentSession).toHaveBeenCalledTimes(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      source: "ephemeral_local",
      referenceId: "out-1",
      imageUrl: "https://example.com/image.png",
      modelDataUrl: "https://example.com/image.png",
      submissionImageUrl: null,
      referenceUrl: null,
      referenceRenderUrl: null,
      text: "Reference note",
      deliveryStatus: "ready",
    });
  });

  it("shows a preparing image attachment while a local drop is still being staged", async () => {
    const ensureAgentSession = vi.fn();
    let resolveImageData:
      | ((value: {
          previewDataUrl: string;
          modelDataUrl: string;
          width: number;
          height: number;
        }) => void)
      | null = null;
    createEphemeralComposerImageDataMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImageData = resolve;
        })
    );

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: false,
        ensureAgentSession,
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(
        makeDragEvent({}, [new File(["preview"], "preview.png", { type: "image/png" })])
      );
    });

    await waitFor(() => {
      expect(result.current.agentAttachments).toHaveLength(1);
      expect(result.current.agentAttachments[0]).toMatchObject({
        kind: "image",
        source: "ephemeral_local",
        imageUrl: null,
        modelDataUrl: null,
        deliveryStatus: "preparing",
      });
    });

    expect(ensureAgentSession).toHaveBeenCalledTimes(1);

    act(() => {
      resolveImageData?.({
        previewDataUrl: "data:image/png;base64,cHJldmlldw==",
        modelDataUrl: "data:image/png;base64,bW9kZWw=",
        width: 512,
        height: 512,
      });
    });

    await waitFor(() => {
      expect(result.current.agentAttachments[0]).toMatchObject({
        kind: "image",
        source: "ephemeral_local",
        imageUrl: "data:image/png;base64,cHJldmlldw==",
        modelDataUrl: "data:image/png;base64,bW9kZWw=",
        deliveryStatus: "ready",
      });
    });
  });

  it("stages composer image payload previews directly without generic drag reconstruction", async () => {
    const ensureAgentSession = vi.fn();
    extractComposerImageDropPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      mediaId: "media-1",
      displayArtifactUrl: "blob:resolved-artifact",
      displayArtifactKind: "blob",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      referenceUrl: "https://signed.example.com/generated.png",
      promptText: "Dragged prompt",
      sourceSurface: "all-refs",
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: false,
        ensureAgentSession,
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => "https://weak.example.com/preview.png",
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    await waitFor(() => {
      expect(ensureAgentSession).toHaveBeenCalledTimes(1);
      expect(result.current.agentAttachments[0]).toMatchObject({
        kind: "image",
        source: "ephemeral_local",
        referenceId: "out-1",
        mediaId: "media-1",
        imageUrl: "blob:resolved-artifact",
        modelDataUrl: "https://signed.example.com/generated.png",
        submissionImageUrl: null,
        imageFallbackUrls: [],
        referenceUrl: null,
        referenceRenderUrl: null,
        text: "Dragged prompt",
        deliveryStatus: "ready",
      });
    });
    expect(extractDragDropPayloadMock).not.toHaveBeenCalled();
    expect(extractInternalReferenceDragPayloadMock).toHaveBeenCalledTimes(1);
  });

  it("stages a remote preview with a signed model URL without durable promotion", async () => {
    const ensureAgentSession = vi.fn();
    const createObjectUrlMock = vi.fn(() => "blob:materialized-composer-preview");
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectUrlMock,
    });
    global.fetch = vi.fn(async () => ({
      ok: true,
      blob: async () => new Blob(["image-bytes"], { type: "image/png" }),
    })) as unknown as typeof fetch;
    extractComposerImageDropPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      mediaId: "media-1",
      displayArtifactUrl: "https://fragile.example.com/preview.png",
      displayArtifactKind: "url",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      referenceUrl: "https://signed.example.com/generated.png",
      promptText: "Dragged prompt",
      sourceSurface: "all-refs",
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: false,
        ensureAgentSession,
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => "https://weak.example.com/preview.png",
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    await waitFor(() => {
      expect(result.current.agentAttachments[0]).toMatchObject({
        kind: "image",
        source: "ephemeral_local",
        referenceId: "out-1",
        mediaId: "media-1",
        imageUrl: "https://fragile.example.com/preview.png",
        modelDataUrl: "https://signed.example.com/generated.png",
        submissionImageUrl: null,
        imageFallbackUrls: [],
        referenceUrl: null,
        referenceRenderUrl: null,
        text: "Dragged prompt",
        deliveryStatus: "ready",
        deliveryError: null,
      });
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
  });

  it("prefers internal image resolution over the direct composer payload when both are present", async () => {
    const ensureAgentSession = vi.fn();
    extractComposerImageDropPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      mediaId: "media-1",
      displayArtifactUrl: "https://fragile.example.com/preview.png",
      displayArtifactKind: "url",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      referenceUrl: "https://signed.example.com/generated.png",
      promptText: "Dragged prompt",
      sourceSurface: "all-refs",
    });
    extractInternalReferenceDragPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      imageIndex: 0,
      mediaId: "media-1",
      mediaKind: "image",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      referenceUrl: "https://signed.example.com/generated.png",
      referenceRenderUrl: "https://fragile.example.com/preview.png",
      sourceSurface: "all-refs",
    });
    const resolveInternalImageDropSource = vi.fn(
      async () =>
        ({
          kind: "internal",
          sourceKind: "generated_output",
          sourceId: "out-1:0",
          provenance: {
            origin: "ai-studio-reference-grid",
            outputId: "out-1",
            mediaId: "media-1",
            imageIndex: 0,
            sourceSurface: "all-refs",
            resolutionReason: "output_storage_path",
          },
          outputId: "out-1",
          mediaId: "media-1",
          mediaSource: "generated",
          preview: {
            url: "blob:composer-owned-preview",
          },
          previewStoragePath: "user-1/generated/preview.png",
          fullStoragePath: "user-1/generated/full.png",
          promptText: "Resolved prompt",
          preparedImageUrl: "blob:composer-owned-preview",
          loadBlob: vi.fn(async () => new Blob(["image-bytes"], { type: "image/png" })),
        }) satisfies ResolvedInternalReferenceSource
    );

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: false,
        ensureAgentSession,
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => "https://weak.example.com/preview.png",
        resolveInternalImageDropSource,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(resolveInternalImageDropSource).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(result.current.agentAttachments[0]).toMatchObject({
        kind: "image",
        source: "ephemeral_local",
        referenceId: "out-1",
        mediaId: "media-1",
        imageUrl: expect.stringMatching(/^(blob:|data:image\/)/),
        modelDataUrl: "data:image/png;base64,bW9kZWw=",
        submissionImageUrl: null,
        imageFallbackUrls: [],
        referenceUrl: null,
        referenceRenderUrl: null,
        text: "Dragged prompt",
        deliveryStatus: "ready",
        deliveryError: null,
      });
    });
    expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
  });

  it("dedupes repeated dropped attachments by signature", async () => {
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

    await dropAndWaitForAttachments(result);
    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    await waitFor(() => {
      expect(result.current.agentAttachments).toHaveLength(1);
    });
  });

  it("refreshes an existing image attachment when the same reference is dragged again", async () => {
    extractDragDropPayloadMock
      .mockReturnValueOnce({
        imageUrl: "https://example.com/image-stale.png",
        promptText: null,
        referenceId: "out-1",
        fromFile: false,
      })
      .mockReturnValueOnce({
        imageUrl: "https://example.com/image-fresh.png",
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

    await dropAndWaitForAttachments(result);
    await dropAndWaitForAttachments(
      result,
      makeDragEvent({
        "text/reference-render-url": "https://example.com/image-fresh-preview.png",
      })
    );

    await waitFor(() => {
      expect(result.current.agentAttachments[0]).toMatchObject({
        kind: "image",
        source: "ephemeral_local",
        referenceId: "out-1",
        imageUrl: "https://example.com/image-fresh-preview.png",
        modelDataUrl: "https://example.com/image-fresh.png",
        submissionImageUrl: null,
        imageFallbackUrls: [],
      });
    });
  });

  it("caps image attachments to the most recent three entries", async () => {
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

    await dropAndWaitForAttachments(result);
    await dropAndWaitForAttachments(result, makeDragEvent(), 2);
    await dropAndWaitForAttachments(result, makeDragEvent(), 3);
    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    await waitFor(() => {
      expect(result.current.agentAttachments).toHaveLength(3);
    });
    expect(result.current.agentAttachments.map((attachment) => attachment.referenceId)).toEqual([
      "out-2",
      "out-3",
      "out-4",
    ]);
  });

  it("defaults desktop image-file drops to a single attachment", async () => {
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
    await waitFor(() => {
      expect(result.current.agentAttachments).toEqual([
        expect.objectContaining({
          kind: "image",
          source: "ephemeral_local",
          imageUrl: "data:image/png;base64,cHJldmlldw==",
          modelDataUrl: "data:image/png;base64,bW9kZWw=",
          submissionImageUrl: null,
          deliveryStatus: "ready",
          deliveryError: null,
        }),
      ]);
    });
    expect(createEphemeralComposerImageDataMock).toHaveBeenCalledTimes(1);
    expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
  });

  it("prefers structured composer image drops over synthetic image files from the browser", async () => {
    const files = [new File(["ghost"], "ghost.png", { type: "image/png" })];
    extractComposerImageDropPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      mediaId: "media-1",
      displayArtifactUrl: "https://fragile.example.com/preview.png",
      displayArtifactKind: "url",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      referenceUrl: "https://signed.example.com/generated.png",
      promptText: "Dragged prompt",
      sourceSurface: "all-refs",
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    await dropAndWaitForAttachments(result, makeDragEvent({}, files));

    expect(result.current.agentAttachmentError).toBeNull();
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      source: "ephemeral_local",
      referenceId: "out-1",
      mediaId: "media-1",
      imageUrl: "https://fragile.example.com/preview.png",
      modelDataUrl: "https://signed.example.com/generated.png",
      submissionImageUrl: null,
      text: "Dragged prompt",
      deliveryStatus: "ready",
    });
    expect(createEphemeralComposerImageDataMock).not.toHaveBeenCalled();
    expect(extractDragDropPayloadMock).not.toHaveBeenCalled();
  });

  it("prefers internal reference drops over synthetic image files from the browser", async () => {
    const files = [new File(["ghost"], "ghost.png", { type: "image/png" })];
    extractInternalReferenceDragPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      imageIndex: 0,
      mediaId: "media-1",
      mediaKind: "image",
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      referenceUrl: "https://signed.example.com/generated.png",
      referenceRenderUrl: "https://fragile.example.com/preview.png",
      sourceSurface: "all-refs",
    });
    const resolveInternalImageDropSource = vi.fn(
      async () =>
        ({
          kind: "internal",
          sourceKind: "generated_output",
          sourceId: "out-1:0",
          provenance: {
            origin: "ai-studio-reference-grid",
            outputId: "out-1",
            mediaId: "media-1",
            imageIndex: 0,
            sourceSurface: "all-refs",
            resolutionReason: "output_storage_path",
          },
          outputId: "out-1",
          mediaId: "media-1",
          mediaSource: "generated",
          preview: {
            url: "blob:composer-owned-preview",
          },
          previewStoragePath: "user-1/generated/preview.png",
          fullStoragePath: "user-1/generated/full.png",
          promptText: "Resolved prompt",
          preparedImageUrl: "blob:composer-owned-preview",
          loadBlob: vi.fn(async () => new Blob(["image-bytes"], { type: "image/png" })),
        }) satisfies ResolvedInternalReferenceSource
    );

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => null,
        resolveInternalImageDropSource,
      })
    );

    await dropAndWaitForAttachments(result, makeDragEvent({}, files));

    expect(resolveInternalImageDropSource).toHaveBeenCalledTimes(1);
    expect(result.current.agentAttachmentError).toBeNull();
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      source: "ephemeral_local",
      referenceId: "out-1",
      mediaId: "media-1",
      imageUrl: expect.stringMatching(/^(blob:|data:image\/)/),
      modelDataUrl: "data:image/png;base64,bW9kZWw=",
      submissionImageUrl: null,
      text: "Resolved prompt",
      deliveryStatus: "ready",
    });
    expect(createEphemeralComposerImageDataMock).toHaveBeenCalledTimes(1);
  });

  it("treats degraded reference-grid drags with image hints as internal references before local files", async () => {
    const files = [new File(["ghost"], "ghost.png", { type: "image/png" })];
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: "https://fragile.example.com/preview.png",
      promptText: "Dragged prompt",
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

    await dropAndWaitForAttachments(
      result,
      makeDragEvent(
        {
          "text/reference-id": "out-1",
          "text/reference-origin": "ai-studio-reference-grid",
          "text/reference-source-surface": "all-refs",
          "text/reference-render-url": "https://fragile.example.com/preview.png",
          "text/reference-url": "https://signed.example.com/generated.png",
          "image/url": "https://fragile.example.com/preview.png",
          "text/plain": "Dragged prompt",
        },
        files
      )
    );

    expect(result.current.agentAttachmentError).toBeNull();
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      source: "ephemeral_local",
      referenceId: "out-1",
      imageUrl: "https://fragile.example.com/preview.png",
      modelDataUrl: "https://signed.example.com/generated.png",
      submissionImageUrl: null,
      text: "Dragged prompt",
      deliveryStatus: "ready",
    });
    expect(createEphemeralComposerImageDataMock).not.toHaveBeenCalled();
  });

  it("prefers media-library image payloads over synthetic image files from the browser", async () => {
    const files = [new File(["ghost"], "ghost.png", { type: "image/png" })];
    readMediaLibraryDragPayloadMock.mockReturnValue({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-1",
        url: "https://cdn.example.com/media-full.png",
        fileType: "image",
        originFolderId: null,
        filename: "media-full.png",
        promptText: "Library prompt",
        source: "upload",
        previewStoragePath: null,
        fullStoragePath: null,
        previewUrl: "https://cdn.example.com/media-preview.png",
        previewPosterUrl: null,
        previewPosterStoragePath: null,
        fullUrl: "https://cdn.example.com/media-full.png",
        width: 1024,
        height: 1024,
      },
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    await dropAndWaitForAttachments(result, makeDragEvent({}, files));

    expect(result.current.agentAttachmentError).toBeNull();
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      source: "ephemeral_local",
      referenceId: null,
      mediaId: "media-1",
      imageUrl: "https://cdn.example.com/media-preview.png",
      modelDataUrl: "https://cdn.example.com/media-full.png",
      submissionImageUrl: null,
      text: "Library prompt",
      deliveryStatus: "ready",
    });
    expect(createEphemeralComposerImageDataMock).not.toHaveBeenCalled();
    expect(extractDragDropPayloadMock).toHaveBeenCalled();
  });

  it("stages up to the configured image-file drop limit", async () => {
    const ensureAgentSession = vi.fn();
    let callCount = 0;
    createEphemeralComposerImageDataMock.mockImplementation(async () => {
      callCount += 1;
      return {
        previewDataUrl: `data:image/png;base64,cHJldmlldy0${callCount}`,
        modelDataUrl: `data:image/png;base64,bW9kZWwt${callCount}`,
        width: 512,
        height: 512,
      };
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

    await waitFor(() => {
      expect(ensureAgentSession).toHaveBeenCalledTimes(1);
      expect(
        result.current.agentAttachments.every((attachment) =>
          /^data:image\/png;base64,cHJldmlldy0/.test(attachment.imageUrl ?? "")
        )
      ).toBe(true);
      expect(
        result.current.agentAttachments.map((attachment) => attachment.submissionImageUrl)
      ).toEqual([null, null, null]);
      expect(
        result.current.agentAttachments.map((attachment) => attachment.deliveryStatus)
      ).toEqual(["ready", "ready", "ready"]);
    });
    expect(createEphemeralComposerImageDataMock).toHaveBeenCalledTimes(3);
    expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
    expect(extractDragDropPayloadMock).not.toHaveBeenCalled();
  });

  it("rejects dropped images when ephemeral preparation is unavailable", async () => {
    createEphemeralComposerImageDataMock.mockRejectedValueOnce(
      new Error(EPHEMERAL_IMAGE_UNREADABLE_MESSAGE)
    );

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(
        makeDragEvent({}, [new File(["one"], "one.png", { type: "image/png" })])
      );
    });

    await waitFor(() => {
      expect(result.current.agentAttachments).toEqual([]);
      expect(result.current.agentAttachmentError).toBe(EPHEMERAL_IMAGE_UNREADABLE_MESSAGE);
    });
    expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
  });

  it("records ephemeral image creation events when create workflow debug is enabled", async () => {
    window.localStorage.setItem(CREATE_WORKFLOW_DEBUG_STORAGE_KEY, "1");

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(
        makeDragEvent({}, [new File(["one"], "one.png", { type: "image/png" })])
      );
    });

    await waitFor(() => {
      expect(result.current.agentAttachments[0]?.deliveryStatus).toBe("ready");
    });

    const snapshot = getCreateWorkflowDebugSnapshot();
    expect(snapshot?.events.some((event) => event.type === "ephemeral_image_created")).toBe(true);
    expect(
      snapshot?.events.some(
        (event) =>
          event.type === "ephemeral_image_created" &&
          event.payload?.width === 512 &&
          event.payload?.height === 512
      )
    ).toBe(true);
  });

  it("does not try to revoke ephemeral data-url attachments on removal", async () => {
    const revokeObjectUrlMock = vi.fn();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectUrlMock,
    });
    const files = [new File(["image-bytes"], "preview.png", { type: "image/png" })];

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

    await waitFor(() => {
      expect(result.current.agentAttachments).toHaveLength(1);
    });

    act(() => {
      result.current.handleRemoveAgentAttachment(result.current.agentAttachments[0]?.id ?? "");
    });

    expect(revokeObjectUrlMock).not.toHaveBeenCalled();
  });

  it("rejects dropped video files before they reach the composer", () => {
    const ensureAgentSession = vi.fn();
    const files = [new File(["video"], "clip.mp4", { type: "video/mp4" })];

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: false,
        ensureAgentSession,
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent({}, files));
    });

    expect(ensureAgentSession).not.toHaveBeenCalled();
    expect(extractDragDropPayloadMock).not.toHaveBeenCalled();
    expect(result.current.agentAttachments).toEqual([]);
    expect(result.current.agentAttachmentError).toBe(
      "This is a video. Try adding an image instead."
    );
  });

  it("rejects internal video references instead of staging them as prompt attachments", () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: null,
      promptText: "Video note",
      referenceId: "out-1",
      fromFile: false,
      mediaKind: "video",
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([
          makeOutput("out-1", {
            mode: "video",
            previewText: "Video note",
          }),
        ]),
        resolveOutputPreviewUrlById: () => "https://example.com/reference-video.mp4",
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toEqual([]);
    expect(result.current.agentAttachmentError).toBe(
      "This is a video. Try adding an image instead."
    );
  });

  it("rejects internal audio references instead of staging them as image attachments", async () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: null,
      promptText: "Audio note",
      referenceId: "out-1",
      fromFile: false,
      mediaKind: "audio",
    });
    extractInternalReferenceDragPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      imageIndex: 0,
      mediaId: "media-1",
      mediaKind: "audio",
      referenceUrl: "https://example.com/reference-audio.mp3",
      referenceRenderUrl: "https://example.com/reference-audio-waveform.png",
      sourceSurface: "curated",
    });
    const resolveInternalImageDropSource = vi.fn(
      async () =>
        ({
          kind: "internal",
          sourceKind: "generated_output",
          sourceId: "out-1",
          provenance: {
            origin: "ai-studio-reference-grid",
            outputId: "out-1",
            mediaId: "media-1",
            imageIndex: 0,
            sourceSurface: "curated",
            resolutionReason: "output_storage_path",
          },
          outputId: "out-1",
          mediaId: "media-1",
          mediaSource: "generated",
          preview: {
            url: "blob:audio-waveform-preview",
          },
          previewStoragePath: "user-1/generated/audio-poster.png",
          fullStoragePath: "user-1/generated/audio.mp3",
          promptText: "Audio note",
          preparedImageUrl: "blob:audio-waveform-preview",
          loadBlob: vi.fn(async () => new Blob(["audio"], { type: "audio/mpeg" })),
        }) satisfies ResolvedInternalReferenceSource
    );

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([
          makeOutput("out-1", {
            mode: "audio",
            previewText: "Audio note",
          }),
        ]),
        resolveOutputPreviewUrlById: () => "https://example.com/reference-audio-waveform.png",
        resolveInternalImageDropSource,
      })
    );

    await act(async () => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      await Promise.resolve();
    });

    expect(resolveInternalImageDropSource).toHaveBeenCalledTimes(1);
    expect(result.current.agentAttachments).toEqual([]);
    expect(result.current.agentAttachmentError).toBe(
      "This reference is not an image. Try adding an image instead."
    );
  });

  it("rejects media-library video drags before prompt fallback can attach them", () => {
    readMediaLibraryDragPayloadMock.mockReturnValue({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-1",
        url: "https://example.com/reference-video.mp4",
        fileType: "video",
        originFolderId: null,
        filename: "reference-video.mp4",
        promptText: "Video note",
        source: "upload",
        previewStoragePath: null,
        fullStoragePath: null,
        previewUrl: null,
        previewPosterUrl: "https://example.com/reference-video-poster.jpg",
        previewPosterStoragePath: null,
        fullUrl: "https://example.com/reference-video.mp4",
        width: 1280,
        height: 720,
      },
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([]),
        resolveOutputPreviewUrlById: () => null,
      })
    );

    act(() => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
    });

    expect(result.current.agentAttachments).toEqual([]);
    expect(result.current.agentAttachmentError).toBe(
      "This is a video. Try adding an image instead."
    );
  });

  it("falls back to output storage URLs when drop payload omits imageUrl", async () => {
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

    await dropAndWaitForAttachments(result);

    await waitFor(() => {
      expect(result.current.agentAttachments[0]).toMatchObject({
        kind: "image",
        source: "ephemeral_local",
        referenceId: "out-1",
        imageUrl: "https://example.com/fallback-image.png",
        modelDataUrl: "https://example.com/fallback-image.png",
        submissionImageUrl: null,
        text: "Reference note",
        deliveryStatus: "ready",
      });
    });
  });

  it("prefers resolved internal image-drop authority over fragile drag and page preview urls", async () => {
    const fragileDragUrl =
      "http://localhost:3000/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fimage.png&w=1200&q=75";
    const resolvedSource: ResolvedInternalReferenceSource = {
      kind: "internal",
      sourceKind: "generated_output",
      sourceId: "out-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-1",
        mediaId: "media-1",
        imageIndex: 0,
        sourceSurface: "curated",
        resolutionReason: "saved_media_lookup",
      },
      outputId: "out-1",
      mediaId: "media-1",
      mediaSource: "generated",
      preview: {
        url: "https://signed.example.com/stable-preview.png",
      },
      previewStoragePath: "user-1/generated/preview.png",
      fullStoragePath: "user-1/generated/full.png",
      promptText: "Resolved prompt",
      preparedImageUrl: "https://signed.example.com/stable-preview.png",
      loadBlob: async () => new Blob(["image"]),
    };
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl: fragileDragUrl,
      promptText: null,
      referenceId: "out-1",
      fromFile: false,
    });
    extractInternalReferenceDragPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      imageIndex: 0,
      mediaId: "media-1",
      mediaKind: "image",
      previewStoragePath: null,
      fullStoragePath: null,
      referenceUrl: null,
      referenceRenderUrl: null,
      sourceSurface: "curated",
    });
    const resolveInternalImageDropSource = vi.fn(async () => resolvedSource);

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById: () => "https://cdn.example.com/weak-panel-preview.png",
        resolveInternalImageDropSource,
      })
    );

    await act(async () => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      await Promise.resolve();
    });

    expect(resolveInternalImageDropSource).toHaveBeenCalledTimes(1);
    expect(result.current.agentAttachments).toHaveLength(1);
    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      source: "ephemeral_local",
      referenceId: "out-1",
      mediaId: "media-1",
      imageUrl: expect.stringMatching(/^(blob:|data:image\/)/),
      modelDataUrl: "data:image/png;base64,bW9kZWw=",
      submissionImageUrl: null,
      referenceUrl: null,
      referenceRenderUrl: null,
      text: "Resolved prompt",
      deliveryStatus: "ready",
      deliveryError: null,
    });
    expect(uploadImageAssetToStorageMock).not.toHaveBeenCalled();
    expect(result.current.agentAttachments[0]?.imageFallbackUrls ?? []).toEqual([]);
    expect(result.current.agentAttachments[0]?.imageFallbackUrls ?? []).not.toContain(
      "https://cdn.example.com/weak-panel-preview.png"
    );
  });

  it("shows an explicit error when internal image resolution fails closed", async () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl:
        "http://localhost:3000/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fgenerated.png&w=1200&q=75",
      promptText: "Reference note",
      referenceId: "out-1",
      fromFile: false,
    });
    extractInternalReferenceDragPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      imageIndex: 0,
      mediaId: "media-1",
      mediaKind: "image",
      referenceUrl: null,
      referenceRenderUrl: null,
      sourceSurface: "curated",
    });
    const resolveOutputPreviewUrlById = vi.fn(
      () => "https://cdn.example.com/weak-panel-preview.png"
    );
    const resolveInternalImageDropSource = vi.fn(async () => null);

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([makeOutput("out-1")]),
        resolveOutputPreviewUrlById,
        resolveInternalImageDropSource,
      })
    );

    await act(async () => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      await Promise.resolve();
    });

    expect(resolveOutputPreviewUrlById).not.toHaveBeenCalled();
    expect(result.current.agentAttachments).toEqual([
      expect.objectContaining({
        kind: "prompt",
        referenceId: "out-1",
        text: "Reference note",
      }),
    ]);
    expect(result.current.agentAttachmentError).toBe(
      "Could not attach that image. Try dragging it again or add it from Media Library."
    );
  });

  it("fails closed instead of staging fragile generated transport previews when internal resolution cannot recover identity", async () => {
    extractDragDropPayloadMock.mockReturnValue({
      imageUrl:
        "http://localhost:3000/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fgenerated.png&w=1200&q=75",
      promptText: "Reference note",
      referenceId: "out-1",
      fromFile: false,
    });
    extractInternalReferenceDragPayloadMock.mockReturnValue({
      version: 1,
      origin: "ai-studio-reference-grid",
      referenceId: "out-1",
      outputId: "out-1",
      imageIndex: 0,
      mediaId: null,
      mediaKind: "image",
      referenceUrl: null,
      referenceRenderUrl: null,
      sourceSurface: "curated",
    });

    const { result } = renderHook(() =>
      useAiStudioAgentComposer({
        agentSessionEnabled: true,
        ensureAgentSession: vi.fn(),
        findOutputById: createFindOutputById([
          makeOutput("out-1", {
            mediaSource: "generated",
            previewUrl: "https://cdn.example.com/weak-panel-preview.png",
          }),
        ]),
        resolveOutputPreviewUrlById: () => "https://cdn.example.com/weak-panel-preview.png",
        resolveInternalImageDropSource: vi.fn(async () => null),
      })
    );

    await act(async () => {
      result.current.handleAgentAttachmentDrop(makeDragEvent());
      await Promise.resolve();
    });

    expect(result.current.agentAttachments).toEqual([
      expect.objectContaining({
        kind: "prompt",
        referenceId: "out-1",
        text: "Reference note",
      }),
    ]);
    expect(result.current.agentAttachmentError).toBe(
      "Could not attach that image. Try dragging it again or add it from Media Library."
    );
  });

  it("ignores raw storage keys and uses the draggable image URL for composer previews", async () => {
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

    await dropAndWaitForAttachments(result);

    await waitFor(() => {
      expect(result.current.agentAttachments[0]).toMatchObject({
        kind: "image",
        source: "ephemeral_local",
        referenceId: "out-1",
        imageUrl: "https://signed.example.com/reference-image.png",
        modelDataUrl: "https://signed.example.com/reference-image.png",
        submissionImageUrl: null,
        text: "Reference note",
        deliveryStatus: "ready",
      });
    });
  });

  it("keeps render-safe drag previews ahead of direct reference URLs", async () => {
    const optimizerUrl =
      "https://shortpulse.test/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fimage.png&w=1200&q=75";
    const durableReferenceUrl =
      "https://shortpulse.test/storage/v1/object/sign/media_library/user-1/image.png";
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

    await dropAndWaitForAttachments(
      result,
      makeDragEvent({
        "text/reference-render-url": optimizerUrl,
      })
    );

    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      source: "ephemeral_local",
      referenceId: "out-1",
      imageUrl: optimizerUrl,
      modelDataUrl: durableReferenceUrl,
      submissionImageUrl: null,
      imageFallbackUrls: [],
      referenceUrl: null,
      referenceRenderUrl: null,
      text: "Reference note",
    });
  });

  it("keeps drag-provided render snapshots ahead of weaker durable fallbacks for composer previews", async () => {
    const dataRenderUrl = "data:image/jpeg;base64,Z2VuZXJhdGVkLXJlbmRlcg==";
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

    await dropAndWaitForAttachments(
      result,
      makeDragEvent({
        "text/reference-render-url": dataRenderUrl,
        "text/reference-url": signedReferenceUrl,
      })
    );

    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      source: "ephemeral_local",
      referenceId: "out-1",
      imageUrl: dataRenderUrl,
      modelDataUrl: signedReferenceUrl,
      imageFallbackUrls: [],
      referenceUrl: null,
      referenceRenderUrl: null,
      text: "Reference note",
    });
  });

  it("keeps drag-provided snapshots ahead of output preview fallbacks", async () => {
    const dataRenderUrl = "data:image/jpeg;base64,Z2VuZXJhdGVkLXJlbmRlcg==";
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

    await dropAndWaitForAttachments(
      result,
      makeDragEvent({
        "text/reference-render-url": dataRenderUrl,
      })
    );

    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      source: "ephemeral_local",
      referenceId: "out-1",
      imageUrl: dataRenderUrl,
      modelDataUrl: "https://cdn.example.com/stale-full.png",
      imageFallbackUrls: [],
      referenceRenderUrl: null,
      text: "Reference note",
    });
  });

  it("keeps extracted drag image URLs ahead of weaker page-resolved output preview fallbacks", async () => {
    const durableReferenceUrl = "https://signed.example.com/reference-image.png";
    const resolvedPanelPreviewUrl = "https://cdn.example.com/panel-preview.png";
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
        resolveOutputPreviewUrlById: () => resolvedPanelPreviewUrl,
      })
    );

    await dropAndWaitForAttachments(result);

    expect(result.current.agentAttachments[0]).toMatchObject({
      kind: "image",
      source: "ephemeral_local",
      referenceId: "out-1",
      imageUrl: durableReferenceUrl,
      modelDataUrl: durableReferenceUrl,
      imageFallbackUrls: [],
      text: "Reference note",
    });
  });

  it("prefers extracted drag image URLs before output preview fallbacks", async () => {
    const renderedDragUrl =
      "https://shortpulse.test/_next/image?url=%2Fstorage%2Fv1%2Fobject%2Fsign%2Fmedia_library%2Fuser-1%2Fimage.png&w=1200&q=75";
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

    await dropAndWaitForAttachments(result);

    expect(result.current.agentAttachments).toEqual([
      expect.objectContaining({
        kind: "image",
        source: "ephemeral_local",
        referenceId: "out-1",
        imageUrl: renderedDragUrl,
        modelDataUrl: renderedDragUrl,
        submissionImageUrl: null,
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

  it("preserves attachments when composer reset requests preserveAttachments", async () => {
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

    await dropAndWaitForAttachments(result);
    act(() => {
      result.current.resetAgentComposer({ preserveInput: true, preserveAttachments: true });
    });

    expect(result.current.agentAttachments).toHaveLength(1);
  });
});
