import type React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractInternalReferenceDragPayload,
  type InternalReferenceDragPayload,
} from "../../utils/dragDrop";
import type { StudioOutput } from "../../types";
import type { AiStudioOutputStoreSnapshot } from "../aiStudioOutputStore";
import type { AiStudioSessionCanvasState } from "../../logic/sessionSnapshotCanvas";
import type { CanvasPropertiesPanelProps } from "../../components/canvas/canvasWorkspaceContracts";
import {
  CANVAS_VIDEO_POSTER_REPAIR_BATCH_SIZE,
  useAiStudioPageMediaReferenceRuntime,
} from "../useAiStudioPageMediaReferenceRuntime";

const restoreSigningMocks = vi.hoisted(() => ({
  resolveSessionRestoreSignedMediaAuthorityByMediaId: vi.fn(),
}));
const mediaSigningMocks = vi.hoisted(() => ({
  getSignedMediaUrl: vi.fn(),
  getSignedMediaUrlsBatch: vi.fn(),
}));

type MockDualCanvasArgs = {
  resolveCanvasDropReference?: (payload: InternalReferenceDragPayload) => unknown;
  prepareResolvedInternalCanvasDrop?: (
    payload: InternalReferenceDragPayload,
    resolved: unknown
  ) => Promise<unknown> | unknown;
  prepareCanvasMediaLibraryDrop?: (payload: unknown) => Promise<unknown> | unknown;
  resolveCanvasDroppedMediaReference?: (payload: {
    url: string;
    mimeType?: string | null;
  }) => Promise<unknown> | unknown;
  resolveCanvasDropFiles?: (files: FileList) => Promise<unknown> | unknown;
  onOpenMediaDetail?: (item: unknown, instanceId: "main" | "rail") => void;
};

vi.mock("../../../lib/clientBreadcrumbs", () => ({
  addBreadcrumb: vi.fn(),
}));

vi.mock("../../../../lib/mediaSignedUrlCache", () => ({
  getSignedMediaUrl: (...args: unknown[]) => mediaSigningMocks.getSignedMediaUrl(...args),
  getSignedMediaUrlsBatch: (...args: unknown[]) =>
    mediaSigningMocks.getSignedMediaUrlsBatch(...args),
}));

vi.mock("../../logic/sessionRestoreMediaSigning", () => ({
  resolveSessionRestoreSignedMediaAuthorityByMediaId: (...args: unknown[]) =>
    restoreSigningMocks.resolveSessionRestoreSignedMediaAuthorityByMediaId(...args),
}));

let latestDualCanvasArgs: MockDualCanvasArgs | null = null;
let mockedRailCanvasProps: Partial<CanvasPropertiesPanelProps> = {};
let mockedCanvasSessionState: AiStudioSessionCanvasState = {
  items: [],
  draftTextEntry: null,
  textEditSession: null,
  draftOwnerInstanceId: null,
  textEditOwnerInstanceId: null,
  mainCamera: { x: 0, y: 0, zoom: 1 },
  railCamera: { x: 0, y: 0, zoom: 1 },
};
const hydrateCanvasSessionStateMock = vi.fn();

vi.mock("../../components/canvas/useAiStudioCanvasWorkspaceState", () => ({
  useAiStudioDualCanvasWorkspaceState: (args: MockDualCanvasArgs) => {
    latestDualCanvasArgs = args;
    return {
      railCanvasProps: mockedRailCanvasProps,
      sessionState: mockedCanvasSessionState,
      hydrateSessionState: hydrateCanvasSessionStateMock,
    };
  },
}));

const makeOutput = (overrides: Partial<StudioOutput>): StudioOutput =>
  ({
    id: "output-1",
    prompt: "Reference clip",
    mode: "video",
    aspect: "16:9",
    model: "Test model",
    status: "ready",
    timestamp: "now",
    taskState: "success",
    mediaSource: "generated",
    resultUrls: [],
    savedMediaIds: [],
    ...overrides,
  }) as StudioOutput;

const makePayload = (
  overrides: Partial<InternalReferenceDragPayload> = {}
): InternalReferenceDragPayload => ({
  version: 1,
  origin: "ai-studio-reference-grid",
  referenceId: "output-1",
  outputId: "output-1",
  mediaId: null,
  imageIndex: 0,
  mediaKind: "video",
  referenceUrl: "https://signed.shortpulse.test/reference.mp4",
  referenceRenderUrl: "https://signed.shortpulse.test/reference.mp4",
  sourceSurface: "curated",
  ...overrides,
});

const makeFileList = (files: File[]): FileList =>
  ({
    ...files,
    length: files.length,
    item: (index: number) => files[index] ?? null,
    [Symbol.iterator]: function* () {
      yield* files;
    },
  }) as unknown as FileList;

const createMutableTransfer = () => {
  const store = new Map<string, string>();
  return {
    files: { length: 0, item: () => null },
    get types() {
      return Array.from(store.keys());
    },
    getData: (type: string) => store.get(type) ?? "",
    setData: (type: string, value: string) => {
      store.set(type, value);
    },
    setDragImage: vi.fn(),
    effectAllowed: "all",
  } as unknown as DataTransfer;
};

const createOutputSnapshot = (
  activeOutputs: StudioOutput[] = [],
  archivedOutputs: StudioOutput[] = []
): AiStudioOutputStoreSnapshot => ({
  outputOrder: activeOutputs.map((output) => output.id),
  outputById: Object.fromEntries(activeOutputs.map((output) => [output.id, output])),
  archivedOutputOrder: archivedOutputs.map((output) => output.id),
  archivedOutputById: Object.fromEntries(archivedOutputs.map((output) => [output.id, output])),
  indexes: {
    inFlightIds: new Set<string>(),
    failedIds: new Set<string>(),
    activeCount: activeOutputs.length,
    archivedCount: archivedOutputs.length,
  },
});

describe("useAiStudioPageMediaReferenceRuntime", () => {
  const defaultParams = {
    addCuratedReference: vi.fn(),
    addLibraryMediaReferenceToQuickSlot: vi.fn(async () => null),
    addLibraryMediaReferencesToQuickSlot: vi.fn(async () => []),
    addLibraryPromptReferenceToQuickSlot: vi.fn(() => null),
    addPastedPromptReference: vi.fn(),
    insertPastedMediaReference: vi.fn(() => []),
    getOutputById: () => null,
    getOutputSnapshot: () => createOutputSnapshot(),
    ingestReferenceFiles: vi.fn(async () => []),
    reorderCuratedReference: vi.fn(),
    setActiveOutputId: vi.fn(),
    setDetailSelectionTarget: vi.fn(),
    setUiError: vi.fn(),
  };

  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    restoreSigningMocks.resolveSessionRestoreSignedMediaAuthorityByMediaId.mockResolvedValue(
      new Map()
    );
    mediaSigningMocks.getSignedMediaUrl.mockImplementation(
      async ({ storagePath }: { storagePath: string }) =>
        `https://signed.shortpulse.test/${storagePath}`
    );
    mediaSigningMocks.getSignedMediaUrlsBatch.mockImplementation(
      async ({ storagePaths }: { storagePaths: string[] }) =>
        new Map(
          storagePaths.map((storagePath) => [
            storagePath,
            `https://signed.shortpulse.test/${storagePath}`,
          ])
        )
    );
    latestDualCanvasArgs = null;
    mockedRailCanvasProps = {};
    mockedCanvasSessionState = {
      items: [],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    document.body.innerHTML = "";
  });

  it("removes canvas items linked to a deleted Reference Grid output only", () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-output-image",
          kind: "image" as const,
          x: 10,
          y: 20,
          z: 1,
          selected: true,
          outputId: "output-1",
          sourceSurface: "curated" as const,
          mediaId: "media-1",
          src: "https://signed.shortpulse.test/output.png",
          alt: "Grid output",
          width: 320,
          height: 180,
        },
        {
          id: "canvas-library-image",
          kind: "image" as const,
          x: 40,
          y: 50,
          z: 2,
          selected: false,
          outputId: null,
          mediaId: "media-1",
          src: "https://signed.shortpulse.test/library.png",
          alt: "Library item",
          width: 320,
          height: 180,
        },
        {
          id: "canvas-other-output",
          kind: "text" as const,
          x: 60,
          y: 70,
          z: 3,
          selected: false,
          outputId: "output-2",
          text: "Keep me",
          width: 220,
        },
      ],
      draftTextEntry: null,
      textEditSession: {
        itemId: "canvas-output-image",
        value: "Editing removed item",
      },
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: "rail",
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
      })
    );

    act(() => {
      expect(result.current.removeCanvasItemsForOutput("output-1")).toBe(true);
    });

    expect(hydrateCanvasSessionStateMock).toHaveBeenCalledWith({
      ...mockedCanvasSessionState,
      items: [
        expect.objectContaining({
          id: "canvas-library-image",
          outputId: null,
          mediaId: "media-1",
        }),
        expect.objectContaining({
          id: "canvas-other-output",
          outputId: "output-2",
        }),
      ],
      textEditSession: null,
    });
  });

  it("removes one canvas item by item id while preserving other items for the same output", () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-output-image-a",
          kind: "image" as const,
          x: 10,
          y: 20,
          z: 1,
          selected: true,
          outputId: "output-1",
          sourceSurface: "curated" as const,
          mediaId: "media-1",
          src: "https://signed.shortpulse.test/output-a.png",
          alt: "Grid output A",
          width: 320,
          height: 180,
        },
        {
          id: "canvas-output-image-b",
          kind: "image" as const,
          x: 40,
          y: 50,
          z: 2,
          selected: false,
          outputId: "output-1",
          sourceSurface: "curated" as const,
          mediaId: "media-1",
          src: "https://signed.shortpulse.test/output-b.png",
          alt: "Grid output B",
          width: 320,
          height: 180,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
      })
    );

    act(() => {
      expect(result.current.removeCanvasItemById("canvas-output-image-a")).toBe(true);
    });

    expect(hydrateCanvasSessionStateMock).toHaveBeenCalledWith({
      ...mockedCanvasSessionState,
      items: [
        expect.objectContaining({
          id: "canvas-output-image-b",
          outputId: "output-1",
        }),
      ],
    });
  });

  it("resolves a storage-backed reference-grid video for the voice changer pipeline", async () => {
    const output = makeOutput({
      id: "output-video-1",
      prompt: "Launch cut",
      durationMs: 12_500,
      mimeType: "video/mp4",
      fullStoragePath: "user-1/generations/video/output-video-1/full.mp4",
      resultUrls: ["https://signed.shortpulse.test/reference-video.mp4"],
      savedMediaIds: ["media-video-1"],
    });

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
      })
    );

    const resolved = await result.current.resolveVoiceChangerInternalReferenceSource(
      makePayload({
        outputId: output.id,
        referenceId: output.id,
        referenceUrl: "https://signed.shortpulse.test/reference-video.mp4",
      })
    );

    expect(resolved).toMatchObject({
      kind: "video",
      origin: "reference-grid",
      name: "Launch cut",
      mimeType: "video/mp4",
      sourceUrl: "https://signed.shortpulse.test/reference-video.mp4",
      previewUrl: "https://signed.shortpulse.test/reference-video.mp4",
      storagePath: "user-1/generations/video/output-video-1/full.mp4",
      durationMs: 12_500,
      referenceOutputId: "output-video-1",
      referenceMediaId: "media-video-1",
    });
    expect(resolved?.file).toBeNull();
  });

  it("falls back to a browser file when a reference-grid video only has a local blob URL", async () => {
    const output = makeOutput({
      id: "output-local-video-1",
      prompt: "Local clip",
      durationMs: 8_000,
      mimeType: "video/mp4",
      localObjectUrl: "blob:https://shortpulse.test/local-video-1",
      previewUrl: "blob:https://shortpulse.test/local-video-1",
      savedMediaIds: ["media-local-video-1"],
    });

    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toBe("blob:https://shortpulse.test/local-video-1");
      return {
        ok: true,
        blob: async () => new Blob(["video"], { type: "video/mp4" }),
      } as Response;
    }) as typeof fetch;

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
      })
    );

    const resolved = await result.current.resolveVoiceChangerInternalReferenceSource(
      makePayload({
        outputId: output.id,
        referenceId: output.id,
        referenceUrl: output.localObjectUrl,
        referenceRenderUrl: output.localObjectUrl,
      })
    );

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(resolved).toMatchObject({
      kind: "video",
      origin: "reference-grid",
      referenceOutputId: "output-local-video-1",
      referenceMediaId: "media-local-video-1",
      durationMs: 8_000,
      storagePath: null,
    });
    expect(resolved?.file).toBeInstanceOf(File);
    expect(resolved?.file?.name).toBe("Local clip.mp4");
    expect(resolved?.file?.type).toBe("video/mp4");
  });

  it("marks the right-rail canvas draggable and exports text notes as prompt drags on Shift drag", () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-text-export-1",
          kind: "text" as const,
          x: 24,
          y: 48,
          z: 1,
          selected: false,
          outputId: null,
          sourceSurface: null,
          text: "Dragged canvas prompt",
          width: 260,
          height: 88,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
      })
    );

    expect(result.current.railCanvasProps.isItemDraggable).toBe(true);
    expect(result.current.railCanvasProps.onItemDragStart).toBeTypeOf("function");
    expect(result.current.railCanvasProps.onItemDragEnd).toBeTypeOf("function");

    const currentTarget = document.createElement("article");
    document.body.appendChild(currentTarget);
    const dataTransfer = createMutableTransfer();

    result.current.railCanvasProps.onItemDragStart?.("canvas-text-export-1", {
      shiftKey: true,
      currentTarget,
      dataTransfer,
    } as unknown as React.DragEvent<HTMLElement>);

    expect(dataTransfer.getData("text/prompt")).toBe("Dragged canvas prompt");
    expect(dataTransfer.getData("text/plain")).toBe("Dragged canvas prompt");
    expect(dataTransfer.effectAllowed).toBe("copy");
    expect(currentTarget.classList.contains("is-dragging")).toBe(true);

    result.current.railCanvasProps.onItemDragEnd?.("canvas-text-export-1", {
      currentTarget,
      dataTransfer,
    } as unknown as React.DragEvent<HTMLElement>);

    expect(currentTarget.classList.contains("is-dragging")).toBe(false);
  });

  it("keeps the rail canvas prop identity stable while publishing fresh live props", async () => {
    mockedRailCanvasProps = {
      camera: { x: 0, y: 0, zoom: 1 },
    };
    const { result, rerender } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
      })
    );
    const firstRailCanvasProps = result.current.railCanvasProps;

    mockedRailCanvasProps = {
      camera: { x: 24, y: 36, zoom: 1.5 },
    };
    rerender();

    expect(result.current.railCanvasProps).toBe(firstRailCanvasProps);
    await waitFor(() => {
      expect(result.current.railCanvasProps.livePropsStore?.getSnapshot().camera).toEqual({
        x: 24,
        y: 36,
        zoom: 1.5,
      });
    });
  });

  it("exports right-rail canvas media as internal reference drags on Shift drag with copy semantics", () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-image-export-1",
          kind: "image" as const,
          x: 10,
          y: 20,
          z: 1,
          selected: false,
          outputId: "output-image-export-1",
          sourceSurface: "curated" as const,
          mediaId: "saved-media-image-export-1",
          src: "https://cdn.shortpulse.test/canvas-export.png",
          alt: "Canvas export image",
          width: 320,
          height: 180,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };
    const output = makeOutput({
      id: "output-image-export-1",
      mode: "image",
      prompt: "Canvas export image",
      previewUrl: "https://cdn.shortpulse.test/canvas-export.png",
      resultUrls: ["https://cdn.shortpulse.test/canvas-export.png"],
      savedMediaIds: ["saved-media-image-export-1"],
    });

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
      })
    );

    const currentTarget = document.createElement("article");
    document.body.appendChild(currentTarget);
    const dataTransfer = createMutableTransfer();

    result.current.railCanvasProps.onItemDragStart?.("canvas-image-export-1", {
      shiftKey: true,
      currentTarget,
      dataTransfer,
    } as unknown as React.DragEvent<HTMLElement>);

    const payload = extractInternalReferenceDragPayload(dataTransfer);
    expect(payload).toMatchObject({
      outputId: "output-image-export-1",
      referenceId: "output-image-export-1",
      mediaId: "saved-media-image-export-1",
      mediaKind: "image",
      sourceSurface: "all-refs",
    });
    expect(dataTransfer.effectAllowed).toBe("copy");

    result.current.railCanvasProps.onItemDragEnd?.("canvas-image-export-1", {
      currentTarget,
      dataTransfer,
    } as unknown as React.DragEvent<HTMLElement>);
  });

  it("rejects right-rail canvas drag export when Shift is not held", () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-text-export-blocked-1",
          kind: "text" as const,
          x: 0,
          y: 0,
          z: 1,
          selected: false,
          outputId: null,
          sourceSurface: null,
          text: "Blocked",
          width: 260,
          height: 88,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
      })
    );

    const currentTarget = document.createElement("article");
    const dataTransfer = createMutableTransfer();
    const preventDefault = vi.fn();

    result.current.railCanvasProps.onItemDragStart?.("canvas-text-export-blocked-1", {
      shiftKey: false,
      currentTarget,
      dataTransfer,
      preventDefault,
    } as unknown as React.DragEvent<HTMLElement>);

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(dataTransfer.getData("text/prompt")).toBe("");
  });

  it("projects direct dropped images into quick slot in target order", async () => {
    const addCuratedReference = vi.fn();
    const reorderCuratedReference = vi.fn();
    const setActiveOutputId = vi.fn();
    const fileA = new File(["a"], "a.png", { type: "image/png" });
    const fileB = new File(["b"], "b.png", { type: "image/png" });
    const ingestReferenceFiles = vi.fn(async () => [
      {
        outputId: "output-a",
        payload: {
          id: "media-a",
          url: "https://cdn.shortpulse.test/a.png",
          fileType: "image" as const,
          filename: "a.png",
          promptText: "A",
        },
        output: makeOutput({
          id: "output-a",
          mode: "image",
          previewUrl: "https://cdn.shortpulse.test/a.png",
        }),
        file: fileA,
      },
      {
        outputId: "output-b",
        payload: {
          id: "media-b",
          url: "https://cdn.shortpulse.test/b.png",
          fileType: "image" as const,
          filename: "b.png",
          promptText: "B",
        },
        output: makeOutput({
          id: "output-b",
          mode: "image",
          previewUrl: "https://cdn.shortpulse.test/b.png",
        }),
        file: fileB,
      },
    ]);

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        addCuratedReference,
        getOutputById: () => null,
        ingestReferenceFiles,
        reorderCuratedReference,
        setActiveOutputId,
      })
    );

    const files = makeFileList([fileA, fileB]);

    const insertedIds = await result.current.handleQuickSlotDroppedFiles(files, {
      targetId: "target-1",
      placement: "before",
    });

    expect(ingestReferenceFiles).toHaveBeenCalledWith([fileA, fileB], "drop");
    expect(addCuratedReference).toHaveBeenCalledTimes(2);
    expect(addCuratedReference).toHaveBeenNthCalledWith(1, "output-b");
    expect(addCuratedReference).toHaveBeenNthCalledWith(2, "output-a");
    expect(reorderCuratedReference).toHaveBeenNthCalledWith(1, "output-b", "target-1", "before");
    expect(reorderCuratedReference).toHaveBeenNthCalledWith(2, "output-a", "output-b", "before");
    expect(setActiveOutputId).toHaveBeenCalledWith("output-b");
    expect(insertedIds).toEqual(["output-a", "output-b"]);
  });

  it("projects bulk library media into quick slot in target order", async () => {
    const addCuratedReference = vi.fn();
    const reorderCuratedReference = vi.fn();
    const setActiveOutputId = vi.fn();
    const addLibraryMediaReferencesToQuickSlot = vi.fn(async () => ["output-a", "output-b"]);

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        addCuratedReference,
        addLibraryMediaReferencesToQuickSlot,
        getOutputById: () => null,
        reorderCuratedReference,
        setActiveOutputId,
      })
    );

    const insertedIds = await result.current.handleQuickSlotLibraryMediaBulkDrop(
      [
        {
          id: "media-a",
          url: "https://cdn.shortpulse.test/a.png",
          fileType: "image",
          filename: "a.png",
          promptText: "A",
        },
        {
          id: "media-b",
          url: "https://cdn.shortpulse.test/b.png",
          fileType: "image",
          filename: "b.png",
          promptText: "B",
        },
      ],
      {
        targetId: "target-1",
        placement: "before",
      }
    );

    expect(addLibraryMediaReferencesToQuickSlot).toHaveBeenCalledWith([
      expect.objectContaining({ id: "media-a" }),
      expect.objectContaining({ id: "media-b" }),
    ]);
    expect(addCuratedReference).toHaveBeenCalledTimes(2);
    expect(addCuratedReference).toHaveBeenNthCalledWith(1, "output-b");
    expect(addCuratedReference).toHaveBeenNthCalledWith(2, "output-a");
    expect(reorderCuratedReference).toHaveBeenNthCalledWith(1, "output-b", "target-1", "before");
    expect(reorderCuratedReference).toHaveBeenNthCalledWith(2, "output-a", "output-b", "before");
    expect(setActiveOutputId).toHaveBeenCalledWith("output-b");
    expect(insertedIds).toEqual(["output-a", "output-b"]);
  });

  it("surfaces partial-rejection feedback for mixed quick-slot file drops", async () => {
    const imageFile = new File(["img"], "mixed.png", { type: "image/png" });
    const textFile = new File(["text"], "notes.txt", { type: "text/plain" });
    const ingestReferenceFiles = vi.fn(async () => [
      {
        outputId: "output-mixed-1",
        payload: {
          id: "media-mixed-1",
          url: "https://cdn.shortpulse.test/mixed.png",
          fileType: "image" as const,
          filename: "mixed.png",
          promptText: "Mixed",
        },
        output: makeOutput({
          id: "output-mixed-1",
          mode: "image",
          previewUrl: "https://cdn.shortpulse.test/mixed.png",
        }),
        file: imageFile,
      },
    ]);
    const setUiError = vi.fn();

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        ingestReferenceFiles,
        setUiError,
      })
    );

    const insertedIds = await result.current.handleQuickSlotDroppedFiles(
      makeFileList([imageFile, textFile])
    );

    expect(ingestReferenceFiles).toHaveBeenCalledWith([imageFile], "drop");
    expect(setUiError).toHaveBeenCalledWith("Some files could not be added. The rest were added.");
    expect(insertedIds).toEqual(["output-mixed-1"]);
  });

  it("accepts direct dropped video files into quick slot", async () => {
    const videoFile = new File(["video"], "clip.mp4", { type: "video/mp4" });
    const ingestReferenceFiles = vi.fn(async () => [
      {
        outputId: "output-video-1",
        payload: {
          id: "media-video-1",
          url: "https://cdn.shortpulse.test/clip.mp4",
          fileType: "video" as const,
          filename: "clip.mp4",
          promptText: "Clip",
        },
        output: makeOutput({
          id: "output-video-1",
          mode: "video",
          prompt: "Clip",
          previewUrl: "https://cdn.shortpulse.test/clip.mp4",
          resultUrls: ["https://cdn.shortpulse.test/clip.mp4"],
        }),
        file: videoFile,
      },
    ]);

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        ingestReferenceFiles,
      })
    );

    const insertedIds = await result.current.handleQuickSlotDroppedFiles(makeFileList([videoFile]));

    expect(ingestReferenceFiles).toHaveBeenCalledWith([videoFile], "drop");
    expect(insertedIds).toEqual(["output-video-1"]);
  });

  it("projects dropped external media references into quick slot in target order", () => {
    const addCuratedReference = vi.fn();
    const reorderCuratedReference = vi.fn();
    const setActiveOutputId = vi.fn();
    const insertedOutput = makeOutput({
      id: "output-media-1",
      mode: "image",
      prompt: "External media",
      previewUrl: "https://cdn.shortpulse.test/external-media.png",
      resultUrls: ["https://cdn.shortpulse.test/external-media.png"],
      savedMediaIds: ["saved-media-1"],
    });
    const insertPastedMediaReference = vi.fn(() => [insertedOutput]);

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        addCuratedReference,
        getOutputById: () => null,
        insertPastedMediaReference,
        reorderCuratedReference,
        setActiveOutputId,
      })
    );

    const insertedId = result.current.handleQuickSlotDroppedMediaReference(
      {
        url: "https://cdn.shortpulse.test/external-media.png",
        mimeType: "image/png",
      },
      {
        targetId: "target-1",
        placement: "after",
      }
    );

    expect(insertPastedMediaReference).toHaveBeenCalledWith({
      url: "https://cdn.shortpulse.test/external-media.png",
      mimeType: "image/png",
    });
    expect(addCuratedReference).toHaveBeenCalledWith("output-media-1");
    expect(reorderCuratedReference).toHaveBeenCalledWith("output-media-1", "target-1", "after");
    expect(setActiveOutputId).toHaveBeenCalledWith("output-media-1");
    expect(insertedId).toBe("output-media-1");
  });

  it("exposes a canvas file resolver that uploads dropped media through reference ingestion", async () => {
    const file = new File(["img"], "image-1.png", { type: "image/png" });
    const ingestReferenceFiles = vi.fn(async () => [
      {
        outputId: "output-image-1",
        payload: {
          id: "media-image-1",
          url: "https://cdn.shortpulse.test/image-1.png",
          fileType: "image" as const,
          filename: "image-1.png",
          promptText: "Reference image",
        },
        output: makeOutput({
          id: "output-image-1",
          mode: "image",
          prompt: "Dropped image",
          previewUrl: "https://cdn.shortpulse.test/image-1.png",
          resultUrls: ["https://cdn.shortpulse.test/image-1.png"],
          savedMediaIds: ["saved-media-image-1"],
        }),
        file,
      },
    ]);

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        ingestReferenceFiles,
      })
    );

    const files = makeFileList([file]);

    const resolvedItems = await latestDualCanvasArgs?.resolveCanvasDropFiles?.(files);

    expect(ingestReferenceFiles).toHaveBeenCalledWith([file], "drop");
    expect(resolvedItems).toEqual([
      {
        kind: "image",
        outputId: "output-image-1",
        mediaId: "saved-media-image-1",
        src: "https://cdn.shortpulse.test/image-1.png",
        alt: "Dropped image",
      },
    ]);
  });

  it("falls back to hydrated output dimensions when a canvas reference drag omits dimensions", () => {
    const output = makeOutput({
      id: "output-image-dimensions",
      mode: "image",
      prompt: "Exact output",
      previewUrl: "https://cdn.shortpulse.test/exact-output.png",
      resultUrls: ["https://cdn.shortpulse.test/exact-output.png"],
      savedMediaIds: ["saved-media-image-1"],
      width: 1536,
      height: 1024,
    });

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
      })
    );

    const resolvedItem = latestDualCanvasArgs?.resolveCanvasDropReference?.(
      makePayload({
        outputId: output.id,
        referenceId: output.id,
        mediaKind: "image",
        referenceUrl: "https://cdn.shortpulse.test/exact-output.png",
        width: undefined,
        height: undefined,
      })
    );

    expect(resolvedItem).toEqual({
      kind: "image",
      outputId: "output-image-dimensions",
      mediaId: "saved-media-image-1",
      src: "https://cdn.shortpulse.test/exact-output.png",
      alt: "Exact output",
      width: 1536,
      height: 1024,
      sourceSurface: "curated",
    });
  });

  it("uses the active card preview authority for image canvas drops before result urls", () => {
    const output = makeOutput({
      id: "output-image-card-preview-authority",
      mode: "image",
      prompt: "Preview authority",
      previewUrl: "https://provider.shortpulse.test/stale-preview.png",
      resultUrls: ["https://provider.shortpulse.test/full-result.png"],
      previewStoragePath: "user-1/variants/images/output-image-card-preview-authority.webp",
      fullStoragePath: "user-1/generations/images/output-image-card-preview-authority.png",
      savedMediaIds: ["saved-media-image-preview-authority"],
    });

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
      })
    );

    const resolvedItem = latestDualCanvasArgs?.resolveCanvasDropReference?.(
      makePayload({
        outputId: output.id,
        referenceId: output.id,
        mediaKind: "image",
        referenceUrl: "https://signed.shortpulse.test/card-preview.webp",
      })
    );

    expect(resolvedItem).toMatchObject({
      kind: "image",
      outputId: "output-image-card-preview-authority",
      mediaId: "saved-media-image-preview-authority",
      src: "https://signed.shortpulse.test/card-preview.webp",
      alt: "Preview authority",
      sourceSurface: "curated",
    });
  });

  it("uses internal render authority for image canvas drops when transfer URL is absent", () => {
    const output = makeOutput({
      id: "output-image-render-hint",
      mode: "image",
      prompt: "Render hint",
      previewStoragePath: "user-1/variants/images/render-hint.webp",
      fullStoragePath: "user-1/generations/images/render-hint.png",
      savedMediaIds: ["saved-media-render-hint"],
    });

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
      })
    );

    const resolvedItem = latestDualCanvasArgs?.resolveCanvasDropReference?.(
      makePayload({
        outputId: output.id,
        referenceId: output.id,
        mediaKind: "image",
        referenceUrl: null,
        referenceRenderUrl: "https://signed.shortpulse.test/render-hint.webp",
      })
    );

    expect(resolvedItem).toMatchObject({
      kind: "image",
      outputId: "output-image-render-hint",
      mediaId: "saved-media-render-hint",
      src: "https://signed.shortpulse.test/render-hint.webp",
      alt: "Render hint",
      sourceSurface: "curated",
    });
  });

  it("prepares internal canvas video drops by signing durable playable and poster authority", async () => {
    const output = makeOutput({
      id: "output-video-durable-drop",
      mode: "video",
      prompt: "Durable video",
      previewStoragePath: "user-1/variants/videos/output-video-durable-drop/preview-loop.mp4",
      previewPosterStoragePath: "user-1/variants/videos/output-video-durable-drop/poster.webp",
      fullStoragePath: "user-1/generations/videos/output-video-durable-drop/full.mp4",
      previewUrl: undefined,
      previewPosterUrl: undefined,
      resultUrls: [],
      savedMediaIds: ["saved-media-video-durable-drop"],
    });

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
      })
    );

    const payload = makePayload({
      outputId: output.id,
      referenceId: output.id,
      mediaKind: "video",
      referenceUrl: null,
      referenceRenderUrl: null,
    });
    const syncResolved = latestDualCanvasArgs?.resolveCanvasDropReference?.(payload);
    const prepared = await latestDualCanvasArgs?.prepareResolvedInternalCanvasDrop?.(
      payload,
      syncResolved ?? null
    );

    expect(syncResolved).toBeNull();
    expect(mediaSigningMocks.getSignedMediaUrl).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/generations/videos/output-video-durable-drop/full.mp4",
    });
    expect(prepared).toMatchObject({
      kind: "video",
      outputId: "output-video-durable-drop",
      mediaId: "saved-media-video-durable-drop",
      videoUrl:
        "https://signed.shortpulse.test/user-1/generations/videos/output-video-durable-drop/full.mp4",
      posterUrl:
        "https://signed.shortpulse.test/user-1/variants/videos/output-video-durable-drop/poster.webp",
      title: "Durable video",
      sourceSurface: "curated",
    });
  });

  it("prepares internal canvas video drops with poster inferred from image preview storage", async () => {
    const output = makeOutput({
      id: "output-video-inferred-poster-drop",
      mode: "video",
      prompt: "Inferred poster drop",
      previewStoragePath: "user-1/variants/videos/output-video-inferred-poster-drop/poster.webp",
      previewPosterStoragePath: null,
      fullStoragePath: "user-1/generations/videos/output-video-inferred-poster-drop/full.mp4",
      previewUrl: undefined,
      previewPosterUrl: undefined,
      resultUrls: [],
      savedMediaIds: ["saved-media-video-inferred-poster-drop"],
    });

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
      })
    );

    const payload = makePayload({
      outputId: output.id,
      referenceId: output.id,
      mediaKind: "video",
      referenceUrl: null,
      referenceRenderUrl: null,
    });
    const syncResolved = latestDualCanvasArgs?.resolveCanvasDropReference?.(payload);
    const prepared = await latestDualCanvasArgs?.prepareResolvedInternalCanvasDrop?.(
      payload,
      syncResolved ?? null
    );

    expect(syncResolved).toBeNull();
    expect(prepared).toMatchObject({
      kind: "video",
      outputId: "output-video-inferred-poster-drop",
      mediaId: "saved-media-video-inferred-poster-drop",
      videoUrl:
        "https://signed.shortpulse.test/user-1/generations/videos/output-video-inferred-poster-drop/full.mp4",
      posterUrl:
        "https://signed.shortpulse.test/user-1/variants/videos/output-video-inferred-poster-drop/poster.webp",
      title: "Inferred poster drop",
      sourceSurface: "curated",
    });
    expect(mediaSigningMocks.getSignedMediaUrl).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/variants/videos/output-video-inferred-poster-drop/poster.webp",
    });
  });

  it("vetoes stale internal canvas drops when durable storage signing fails", async () => {
    const output = makeOutput({
      id: "output-image-signing-failure",
      mode: "image",
      prompt: "Signing failure",
      previewStoragePath: "user-1/variants/images/signing-failure.webp",
      fullStoragePath: "user-1/generations/images/signing-failure.png",
      previewUrl: undefined,
      resultUrls: [],
      savedMediaIds: ["saved-media-signing-failure"],
    });
    mediaSigningMocks.getSignedMediaUrl.mockRejectedValueOnce(new Error("signing failed"));

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
      })
    );

    const payload = makePayload({
      outputId: output.id,
      referenceId: output.id,
      mediaKind: "image",
      referenceUrl: "https://expired.shortpulse.test/stale-transfer.png",
      referenceRenderUrl: "https://expired.shortpulse.test/stale-transfer.png",
    });
    const syncResolved = latestDualCanvasArgs?.resolveCanvasDropReference?.(payload);
    const prepared = await latestDualCanvasArgs?.prepareResolvedInternalCanvasDrop?.(
      payload,
      syncResolved ?? null
    );

    expect(syncResolved).toMatchObject({
      kind: "image",
      src: "https://expired.shortpulse.test/stale-transfer.png",
      srcStoragePath: "user-1/generations/images/signing-failure.png",
    });
    expect(prepared).toBeNull();
  });

  it("preserves storage authority for media-library canvas drops", async () => {
    const addLibraryMediaReferenceToQuickSlot = vi.fn(async () => "library-output-1");

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        addLibraryMediaReferenceToQuickSlot,
      })
    );

    const prepared = await latestDualCanvasArgs?.prepareCanvasMediaLibraryDrop?.({
      kind: "libraryMedia",
      source: "mediaLibrary",
      payload: {
        id: "media-library-image-1",
        url: "https://cdn.shortpulse.test/library-image.png",
        fileType: "image",
        filename: "library-image.png",
        previewStoragePath: "user-1/library/library-image-preview.webp",
        fullStoragePath: "user-1/library/library-image-full.png",
        previewUrl: "https://expired.shortpulse.test/library-image-preview.webp",
        fullUrl: "https://expired.shortpulse.test/library-image-full.png",
        width: 640,
        height: 480,
      },
    });

    expect(prepared).toMatchObject({
      kind: "image",
      outputId: "library-output-1",
      mediaId: "media-library-image-1",
      src: "https://signed.shortpulse.test/user-1/library/library-image-preview.webp",
      srcStoragePath: "user-1/library/library-image-full.png",
      alt: "library-image.png",
    });
  });

  it("resolves dropped video files into canvas video items", async () => {
    const file = new File(["video"], "clip-1.mp4", { type: "video/mp4" });
    const ingestReferenceFiles = vi.fn(async () => [
      {
        outputId: "output-video-1",
        payload: {
          id: "media-video-1",
          url: "https://cdn.shortpulse.test/clip-1.mp4",
          fileType: "video" as const,
          filename: "clip-1.mp4",
          promptText: "Dropped video",
        },
        output: makeOutput({
          id: "output-video-1",
          mode: "video",
          prompt: "Dropped video",
          previewUrl: "https://cdn.shortpulse.test/clip-1.mp4",
          previewPosterUrl: "https://cdn.shortpulse.test/clip-1-poster.webp",
          resultUrls: ["https://cdn.shortpulse.test/clip-1.mp4"],
          savedMediaIds: ["saved-media-video-1"],
        }),
        file,
      },
    ]);

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        ingestReferenceFiles,
      })
    );

    const resolvedItems = await latestDualCanvasArgs?.resolveCanvasDropFiles?.(
      makeFileList([file])
    );

    expect(resolvedItems).toEqual([
      {
        kind: "video",
        outputId: "output-video-1",
        mediaId: "saved-media-video-1",
        videoUrl: "https://cdn.shortpulse.test/clip-1.mp4",
        posterUrl: "https://cdn.shortpulse.test/clip-1-poster.webp",
        title: "Dropped video",
        durationMs: null,
      },
    ]);
  });

  it("surfaces partial-rejection feedback for mixed canvas file drops", async () => {
    const imageFile = new File(["img"], "canvas-mixed.png", { type: "image/png" });
    const textFile = new File(["text"], "canvas-notes.txt", { type: "text/plain" });
    const ingestReferenceFiles = vi.fn(async () => [
      {
        outputId: "output-canvas-mixed-1",
        payload: {
          id: "media-canvas-mixed-1",
          url: "https://cdn.shortpulse.test/canvas-mixed.png",
          fileType: "image" as const,
          filename: "canvas-mixed.png",
          promptText: "Canvas mixed",
        },
        output: makeOutput({
          id: "output-canvas-mixed-1",
          mode: "image",
          previewUrl: "https://cdn.shortpulse.test/canvas-mixed.png",
          resultUrls: ["https://cdn.shortpulse.test/canvas-mixed.png"],
          savedMediaIds: ["saved-media-canvas-mixed-1"],
        }),
        file: imageFile,
      },
    ]);
    const setUiError = vi.fn();

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        ingestReferenceFiles,
        setUiError,
      })
    );

    const resolvedItems = await latestDualCanvasArgs?.resolveCanvasDropFiles?.(
      makeFileList([imageFile, textFile])
    );

    expect(ingestReferenceFiles).toHaveBeenCalledWith([imageFile], "drop");
    expect(setUiError).toHaveBeenCalledWith("Some files could not be added. The rest were added.");
    expect(resolvedItems).toEqual([
      {
        kind: "image",
        outputId: "output-canvas-mixed-1",
        mediaId: "saved-media-canvas-mixed-1",
        src: "https://cdn.shortpulse.test/canvas-mixed.png",
        alt: "Reference clip",
      },
    ]);
  });

  it("exposes a canvas dropped-media resolver that inserts into reference state first", async () => {
    const insertedOutput = makeOutput({
      id: "output-audio-1",
      mode: "audio",
      title: "Dropped Signal",
      prompt: "Dropped audio",
      previewUrl: "https://cdn.shortpulse.test/dropped-audio.mp3",
      resultUrls: ["https://cdn.shortpulse.test/dropped-audio.mp3"],
      savedMediaIds: ["saved-audio-1"],
      companionArtUrl: "https://cdn.shortpulse.test/dropped-audio.webp",
      companionArtStoragePath: "user-1/audio/dropped-audio.webp",
      durationMs: 8_500,
      waveformPeaks: [5, 10, 15],
    });
    const insertPastedMediaReference = vi.fn(() => [insertedOutput]);

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        insertPastedMediaReference,
      })
    );

    const resolvedItem = await latestDualCanvasArgs?.resolveCanvasDroppedMediaReference?.({
      url: "https://cdn.shortpulse.test/dropped-audio.mp3",
      mimeType: "audio/mpeg",
    });

    expect(insertPastedMediaReference).toHaveBeenCalledWith({
      url: "https://cdn.shortpulse.test/dropped-audio.mp3",
      mimeType: "audio/mpeg",
    });
    expect(resolvedItem).toEqual({
      kind: "audio",
      outputId: "output-audio-1",
      mediaId: "saved-audio-1",
      audioUrl: "https://cdn.shortpulse.test/dropped-audio.mp3",
      title: "Dropped Signal",
      companionArtUrl: "https://cdn.shortpulse.test/dropped-audio.webp",
      companionArtStoragePath: "user-1/audio/dropped-audio.webp",
      audioSourceMode: null,
      durationMs: 8_500,
      waveformPeaks: [5, 10, 15],
      width: 200,
      height: 200,
    });
  });

  it("maps dropped external videos into canvas video items", async () => {
    const insertedOutput = makeOutput({
      id: "output-video-2",
      mode: "video",
      prompt: "Dropped video",
      previewUrl: "https://cdn.shortpulse.test/dropped-video.mp4",
      previewPosterUrl: "https://cdn.shortpulse.test/dropped-video-poster.webp",
      resultUrls: ["https://cdn.shortpulse.test/dropped-video.mp4"],
      savedMediaIds: ["saved-video-2"],
    });
    const insertPastedMediaReference = vi.fn(() => [insertedOutput]);

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        insertPastedMediaReference,
      })
    );

    const resolvedItem = await latestDualCanvasArgs?.resolveCanvasDroppedMediaReference?.({
      url: "https://cdn.shortpulse.test/dropped-video.mp4",
      mimeType: "video/mp4",
    });

    expect(resolvedItem).toEqual({
      kind: "video",
      outputId: "output-video-2",
      mediaId: "saved-video-2",
      videoUrl: "https://cdn.shortpulse.test/dropped-video.mp4",
      posterUrl: "https://cdn.shortpulse.test/dropped-video-poster.webp",
      title: "Dropped video",
      durationMs: null,
    });
  });

  it("opens canvas media detail as a studio-output when output authority still resolves", () => {
    const setDetailSelectionTarget = vi.fn();
    const output = makeOutput({
      id: "output-image-detail-1",
      mode: "image",
      prompt: "Canvas detail image",
      previewUrl: "https://cdn.shortpulse.test/canvas-detail.png",
      resultUrls: ["https://cdn.shortpulse.test/canvas-detail.png"],
      savedMediaIds: ["saved-media-detail-1"],
    });

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === output.id ? output : null),
        setDetailSelectionTarget,
      })
    );

    latestDualCanvasArgs?.onOpenMediaDetail?.(
      {
        id: "canvas-image-detail-1",
        kind: "image",
        x: 24,
        y: 48,
        z: 2,
        selected: false,
        outputId: output.id,
        sourceSurface: "curated",
        mediaId: "saved-media-detail-1",
        src: "https://cdn.shortpulse.test/canvas-detail.png",
        alt: "Canvas detail image",
        width: 512,
        height: 512,
      },
      "rail"
    );

    expect(setDetailSelectionTarget).toHaveBeenCalledWith({
      kind: "studio-output",
      outputId: output.id,
      surface: "right-rail-canvas",
    });
  });

  it("falls back to canvas-item detail when output authority is unavailable", () => {
    const setDetailSelectionTarget = vi.fn();

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        setDetailSelectionTarget,
      })
    );

    latestDualCanvasArgs?.onOpenMediaDetail?.(
      {
        id: "canvas-image-fallback-1",
        kind: "image",
        x: 64,
        y: 96,
        z: 1,
        selected: false,
        outputId: "missing-output-1",
        sourceSurface: "curated",
        mediaId: "saved-media-fallback-1",
        src: "https://cdn.shortpulse.test/fallback-image.png",
        alt: "Fallback image",
        width: 320,
        height: 180,
      },
      "main"
    );

    expect(setDetailSelectionTarget).toHaveBeenCalledWith({
      kind: "canvas-item",
      itemId: "canvas-image-fallback-1",
      surface: "right-rail-canvas",
      instanceId: "main",
    });
  });

  it("reconciles restored canvas media items when output authority refreshes after restore", async () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-image-1",
          kind: "image" as const,
          x: 10,
          y: 20,
          z: 1,
          selected: false,
          outputId: "output-image-refresh-1",
          sourceSurface: "curated" as const,
          mediaId: "saved-media-image-refresh-1",
          src: "https://expired.shortpulse.test/image.png",
          alt: "Old alt",
          width: 320,
          height: 180,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };
    const refreshedOutput = makeOutput({
      id: "output-image-refresh-1",
      mode: "image",
      prompt: "Fresh alt",
      previewUrl: "https://signed.shortpulse.test/fresh-image.png",
      resultUrls: ["https://signed.shortpulse.test/fresh-image.png"],
      savedMediaIds: ["saved-media-image-refresh-1"],
    });

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === refreshedOutput.id ? refreshedOutput : null),
      })
    );

    expect(hydrateCanvasSessionStateMock).toHaveBeenCalledWith({
      ...mockedCanvasSessionState,
      items: [
        expect.objectContaining({
          id: "canvas-image-1",
          outputId: "output-image-refresh-1",
          mediaId: "saved-media-image-refresh-1",
          src: "https://signed.shortpulse.test/fresh-image.png",
          alt: "Fresh alt",
          width: 320,
          height: 180,
        }),
      ],
    });
  });

  it("does not rescan output authority for transient canvas state changes", async () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-image-transient-1",
          kind: "image" as const,
          x: 10,
          y: 20,
          z: 1,
          selected: false,
          outputId: "output-image-transient-1",
          sourceSurface: "curated" as const,
          mediaId: null,
          src: "https://signed.shortpulse.test/transient-image.png",
          alt: "Transient image",
          width: 320,
          height: 180,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };
    const getOutputSnapshot = vi.fn(() => createOutputSnapshot());
    const getOutputById = vi.fn(() => null);

    const { rerender } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById,
        getOutputSnapshot,
      })
    );

    await waitFor(() => {
      expect(getOutputSnapshot).toHaveBeenCalled();
    });
    const outputSnapshotCallsAfterMount = getOutputSnapshot.mock.calls.length;

    mockedCanvasSessionState = {
      ...mockedCanvasSessionState,
      items: mockedCanvasSessionState.items.map((item) => ({
        ...item,
        selected: true,
      })),
      draftTextEntry: { x: 100, y: 200, value: "typing" },
      textEditSession: { itemId: "canvas-image-transient-1", value: "editing" },
      draftOwnerInstanceId: "main",
      textEditOwnerInstanceId: "rail",
      mainCamera: { x: 200, y: -100, zoom: 1.5 },
      railCamera: { x: -50, y: 25, zoom: 0.8 },
    };

    rerender();

    expect(getOutputSnapshot).toHaveBeenCalledTimes(outputSnapshotCallsAfterMount);
  });

  it("hydrates restored canvas video posters from output storage authority without a media id", async () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-video-output-poster-1",
          kind: "video" as const,
          x: 10,
          y: 20,
          z: 1,
          selected: false,
          outputId: "output-video-poster-refresh-1",
          sourceSurface: "curated" as const,
          mediaId: null,
          videoUrl: "https://expired.shortpulse.test/video.mp4",
          posterUrl: null,
          title: "Old video",
          durationMs: null,
          width: 320,
          height: 180,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };
    const refreshedOutput = makeOutput({
      id: "output-video-poster-refresh-1",
      mode: "video",
      prompt: "Fresh video",
      previewStoragePath: "user-1/variants/videos/video-poster-refresh/preview.mp4",
      previewPosterStoragePath: "user-1/variants/videos/video-poster-refresh/poster.webp",
      fullStoragePath: "user-1/generations/videos/video-poster-refresh/full.mp4",
      previewUrl: undefined,
      previewPosterUrl: undefined,
      resultUrls: [],
      savedMediaIds: [],
    });

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === refreshedOutput.id ? refreshedOutput : null),
        getOutputSnapshot: () => createOutputSnapshot([refreshedOutput]),
      })
    );

    await waitFor(() => {
      expect(hydrateCanvasSessionStateMock).toHaveBeenCalledWith({
        ...mockedCanvasSessionState,
        items: [
          expect.objectContaining({
            id: "canvas-video-output-poster-1",
            outputId: "output-video-poster-refresh-1",
            mediaId: null,
            videoUrl:
              "https://signed.shortpulse.test/user-1/generations/videos/video-poster-refresh/full.mp4",
            posterUrl:
              "https://signed.shortpulse.test/user-1/variants/videos/video-poster-refresh/poster.webp",
            title: "Fresh video",
          }),
        ],
      });
    });
    expect(mediaSigningMocks.getSignedMediaUrl).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/variants/videos/video-poster-refresh/poster.webp",
    });
  });

  it("hydrates restored canvas video posters inferred from image preview storage", async () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-video-inferred-poster-1",
          kind: "video" as const,
          x: 10,
          y: 20,
          z: 1,
          selected: false,
          outputId: "output-video-inferred-poster-1",
          sourceSurface: "curated" as const,
          mediaId: null,
          videoUrl: "https://expired.shortpulse.test/inferred-video.mp4",
          posterUrl: null,
          title: "Old inferred video",
          durationMs: null,
          width: 320,
          height: 180,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };
    const refreshedOutput = makeOutput({
      id: "output-video-inferred-poster-1",
      mode: "video",
      prompt: "Inferred poster video",
      previewStoragePath: "user-1/variants/videos/video-inferred-poster/poster.webp",
      previewPosterStoragePath: null,
      fullStoragePath: "user-1/generations/videos/video-inferred-poster/full.mp4",
      previewUrl: undefined,
      previewPosterUrl: undefined,
      resultUrls: [],
      savedMediaIds: [],
    });

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === refreshedOutput.id ? refreshedOutput : null),
        getOutputSnapshot: () => createOutputSnapshot([refreshedOutput]),
      })
    );

    await waitFor(() => {
      expect(hydrateCanvasSessionStateMock).toHaveBeenCalledWith({
        ...mockedCanvasSessionState,
        items: [
          expect.objectContaining({
            id: "canvas-video-inferred-poster-1",
            outputId: "output-video-inferred-poster-1",
            mediaId: null,
            videoUrl:
              "https://signed.shortpulse.test/user-1/generations/videos/video-inferred-poster/full.mp4",
            posterUrl:
              "https://signed.shortpulse.test/user-1/variants/videos/video-inferred-poster/poster.webp",
            title: "Inferred poster video",
          }),
        ],
      });
    });
    expect(mediaSigningMocks.getSignedMediaUrl).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/variants/videos/video-inferred-poster/poster.webp",
    });
  });

  it("batches restored canvas video poster repair signing work", async () => {
    const pendingSigners = new Map<string, (value: string | null) => void>();
    mediaSigningMocks.getSignedMediaUrl.mockImplementation(
      ({ storagePath }: { storagePath: string }) =>
        new Promise<string | null>((resolve) => {
          pendingSigners.set(storagePath, resolve);
        })
    );

    const canvasItems = Array.from(
      { length: CANVAS_VIDEO_POSTER_REPAIR_BATCH_SIZE + 1 },
      (_, index) => {
        const itemNumber = index + 1;
        return {
          id: `canvas-video-batch-${itemNumber}`,
          kind: "video" as const,
          x: 10 * itemNumber,
          y: 20,
          z: itemNumber,
          selected: false,
          outputId: `output-video-batch-${itemNumber}`,
          sourceSurface: "curated" as const,
          mediaId: null,
          videoUrl: `https://expired.shortpulse.test/video-${itemNumber}.mp4`,
          posterUrl: null,
          title: `Old video ${itemNumber}`,
          durationMs: null,
          width: 320,
          height: 180,
        };
      }
    );
    mockedCanvasSessionState = {
      items: canvasItems,
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };
    const outputs = canvasItems.map((item, index) => {
      const itemNumber = index + 1;
      return makeOutput({
        id: item.outputId,
        mode: "video",
        prompt: `Fresh video ${itemNumber}`,
        previewStoragePath: `user-1/variants/videos/video-batch-${itemNumber}/preview.mp4`,
        previewPosterStoragePath: `user-1/variants/videos/video-batch-${itemNumber}/poster.webp`,
        fullStoragePath: `user-1/generations/videos/video-batch-${itemNumber}/full.mp4`,
        previewUrl: undefined,
        previewPosterUrl: undefined,
        resultUrls: [],
        savedMediaIds: [],
      });
    });

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => outputs.find((output) => output.id === outputId) ?? null,
        getOutputSnapshot: () => createOutputSnapshot(outputs),
      })
    );

    await waitFor(() => {
      expect(mediaSigningMocks.getSignedMediaUrl).toHaveBeenCalledTimes(
        CANVAS_VIDEO_POSTER_REPAIR_BATCH_SIZE * 3
      );
    });
    expect(
      mediaSigningMocks.getSignedMediaUrl.mock.calls.some(([request]) =>
        String((request as { storagePath?: string }).storagePath).includes("video-batch-5")
      )
    ).toBe(false);

    for (const [storagePath, resolve] of pendingSigners) {
      resolve(`https://signed.shortpulse.test/${storagePath}`);
    }

    await waitFor(() => {
      expect(
        mediaSigningMocks.getSignedMediaUrl.mock.calls.some(([request]) =>
          String((request as { storagePath?: string }).storagePath).includes("video-batch-5")
        )
      ).toBe(true);
    });
  });

  it("preserves storage-backed canvas video render urls when output metadata is stale", async () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-video-storage-stable-1",
          kind: "video" as const,
          x: 10,
          y: 20,
          z: 1,
          selected: false,
          outputId: "output-video-storage-stable-1",
          sourceSurface: "curated" as const,
          mediaId: null,
          videoUrl:
            "https://signed.shortpulse.test/user-1/generations/videos/storage-stable/full.mp4",
          videoStoragePath: "user-1/generations/videos/storage-stable/full.mp4",
          posterUrl:
            "https://signed.shortpulse.test/user-1/variants/videos/storage-stable/poster.webp",
          posterStoragePath: "user-1/variants/videos/storage-stable/poster.webp",
          title: "Storage stable video",
          durationMs: null,
          width: 320,
          height: 180,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };
    const staleOutput = makeOutput({
      id: "output-video-storage-stable-1",
      mode: "video",
      prompt: "Storage stable video",
      previewStoragePath: "user-1/variants/videos/storage-stable/preview.mp4",
      previewPosterStoragePath: "user-1/variants/videos/storage-stable/poster.webp",
      fullStoragePath: "user-1/generations/videos/storage-stable/full.mp4",
      previewUrl: "https://expired.shortpulse.test/storage-stable-preview.mp4",
      previewPosterUrl: "https://expired.shortpulse.test/storage-stable-poster.webp",
      resultUrls: ["https://expired.shortpulse.test/storage-stable-full.mp4"],
      savedMediaIds: [],
    });

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === staleOutput.id ? staleOutput : null),
        getOutputSnapshot: () => createOutputSnapshot([staleOutput]),
      })
    );

    await waitFor(() => {
      expect(mediaSigningMocks.getSignedMediaUrlsBatch).toHaveBeenCalledWith({
        bucket: "media_library",
        storagePaths: [
          "user-1/generations/videos/storage-stable/full.mp4",
          "user-1/variants/videos/storage-stable/poster.webp",
        ],
      });
    });
    expect(hydrateCanvasSessionStateMock).not.toHaveBeenCalled();
  });

  it("reconciles restored canvas output ids through generated-output aliases before refreshing media", async () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-image-legacy-1",
          kind: "image" as const,
          x: 40,
          y: 50,
          z: 2,
          selected: false,
          outputId: "generated:generation-refresh-1",
          sourceSurface: "curated" as const,
          mediaId: "saved-media-image-refresh-2",
          src: "https://expired.shortpulse.test/legacy-image.png",
          alt: "Legacy alt",
          width: 320,
          height: 180,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };
    const refreshedOutput = makeOutput({
      id: "local-image-refresh-1",
      generationId: "generation-refresh-1",
      mode: "image",
      prompt: "Canonical alt",
      previewUrl: "https://signed.shortpulse.test/canonical-image.png",
      resultUrls: ["https://signed.shortpulse.test/canonical-image.png"],
      savedMediaIds: ["saved-media-image-refresh-2"],
    });

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) => (outputId === refreshedOutput.id ? refreshedOutput : null),
        getOutputSnapshot: () => createOutputSnapshot([refreshedOutput]),
      })
    );

    expect(hydrateCanvasSessionStateMock).toHaveBeenCalledWith({
      ...mockedCanvasSessionState,
      items: [
        expect.objectContaining({
          id: "canvas-image-legacy-1",
          outputId: "local-image-refresh-1",
          mediaId: "saved-media-image-refresh-2",
          src: "https://signed.shortpulse.test/canonical-image.png",
          alt: "Canonical alt",
          width: 320,
          height: 180,
        }),
      ],
    });
  });

  it("refreshes restored canvas media from media id when output authority is unavailable", async () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-image-media-id-1",
          kind: "image" as const,
          x: 12,
          y: 24,
          z: 1,
          selected: false,
          outputId: "missing-output-1",
          sourceSurface: "curated" as const,
          mediaId: "saved-media-direct-1",
          src: "https://expired.shortpulse.test/canvas-image.png",
          alt: "Canvas image",
          width: 320,
          height: 180,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };
    restoreSigningMocks.resolveSessionRestoreSignedMediaAuthorityByMediaId.mockResolvedValueOnce(
      new Map([
        [
          "saved-media-direct-1",
          {
            mediaId: "saved-media-direct-1",
            fileType: "image",
            previewStoragePath: "user-1/images/direct-thumb.png",
            fullStoragePath: "user-1/images/direct-full.png",
            previewPosterStoragePath: null,
            signedPreviewUrl: "https://signed.shortpulse.test/direct-thumb.png",
            signedFullUrl: "https://signed.shortpulse.test/direct-full.png",
            signedPreviewPosterUrl: null,
          },
        ],
      ])
    );

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        getOutputSnapshot: () => createOutputSnapshot(),
      })
    );

    await waitFor(() => {
      expect(hydrateCanvasSessionStateMock).toHaveBeenCalledWith({
        ...mockedCanvasSessionState,
        items: [
          expect.objectContaining({
            id: "canvas-image-media-id-1",
            outputId: "missing-output-1",
            mediaId: "saved-media-direct-1",
            src: "https://signed.shortpulse.test/direct-thumb.png",
          }),
        ],
      });
    });
    expect(
      restoreSigningMocks.resolveSessionRestoreSignedMediaAuthorityByMediaId
    ).toHaveBeenCalledWith(["saved-media-direct-1"]);
  });

  it("refreshes restored canvas media from stored paths when output and media ids are unavailable", async () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-image-storage-path-1",
          kind: "image" as const,
          x: 12,
          y: 24,
          z: 1,
          selected: false,
          outputId: null,
          sourceSurface: "curated" as const,
          mediaId: null,
          src: "https://expired.shortpulse.test/canvas-image.png",
          srcStoragePath: "user-1/images/storage-path-refresh.png",
          alt: "Canvas image",
          width: 320,
          height: 180,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        getOutputSnapshot: () => createOutputSnapshot(),
      })
    );

    await waitFor(() => {
      expect(hydrateCanvasSessionStateMock).toHaveBeenCalledWith({
        ...mockedCanvasSessionState,
        items: [
          expect.objectContaining({
            id: "canvas-image-storage-path-1",
            src: "https://signed.shortpulse.test/user-1/images/storage-path-refresh.png",
            srcStoragePath: "user-1/images/storage-path-refresh.png",
          }),
        ],
      });
    });
    expect(mediaSigningMocks.getSignedMediaUrlsBatch).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePaths: ["user-1/images/storage-path-refresh.png"],
    });
  });

  it("batches restored canvas stored-path signing to avoid per-item request fanout", async () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-image-storage-path-batch-1",
          kind: "image" as const,
          x: 12,
          y: 24,
          z: 1,
          selected: false,
          outputId: null,
          sourceSurface: "curated" as const,
          mediaId: null,
          src: "https://expired.shortpulse.test/canvas-image-1.png",
          srcStoragePath: "user-1/images/storage-path-batch-1.png",
          alt: "Canvas image 1",
          width: 320,
          height: 180,
        },
        {
          id: "canvas-video-storage-path-batch-1",
          kind: "video" as const,
          x: 48,
          y: 72,
          z: 2,
          selected: false,
          outputId: null,
          sourceSurface: "curated" as const,
          mediaId: null,
          videoUrl: "https://expired.shortpulse.test/canvas-video.mp4",
          videoStoragePath: "user-1/videos/storage-path-batch-1.mp4",
          posterUrl: "https://expired.shortpulse.test/canvas-video-poster.webp",
          posterStoragePath: "user-1/videos/storage-path-batch-1-poster.webp",
          title: "Canvas video",
          durationMs: null,
          width: 320,
          height: 180,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };

    renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        getOutputSnapshot: () => createOutputSnapshot(),
      })
    );

    await waitFor(() => {
      expect(mediaSigningMocks.getSignedMediaUrlsBatch).toHaveBeenCalledTimes(1);
      expect(mediaSigningMocks.getSignedMediaUrlsBatch).toHaveBeenCalledWith({
        bucket: "media_library",
        storagePaths: [
          "user-1/images/storage-path-batch-1.png",
          "user-1/videos/storage-path-batch-1.mp4",
          "user-1/videos/storage-path-batch-1-poster.webp",
        ],
      });
      expect(hydrateCanvasSessionStateMock).toHaveBeenCalledWith({
        ...mockedCanvasSessionState,
        items: [
          expect.objectContaining({
            id: "canvas-image-storage-path-batch-1",
            src: "https://signed.shortpulse.test/user-1/images/storage-path-batch-1.png",
          }),
          expect.objectContaining({
            id: "canvas-video-storage-path-batch-1",
            videoUrl: "https://signed.shortpulse.test/user-1/videos/storage-path-batch-1.mp4",
            posterUrl:
              "https://signed.shortpulse.test/user-1/videos/storage-path-batch-1-poster.webp",
          }),
        ],
      });
    });
    expect(mediaSigningMocks.getSignedMediaUrl).not.toHaveBeenCalled();
  });

  it("retries failed canvas image renders through fresh output media authority", async () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-image-render-error-1",
          kind: "image" as const,
          x: 12,
          y: 24,
          z: 1,
          selected: false,
          outputId: "output-image-render-error-1",
          sourceSurface: "curated" as const,
          mediaId: null,
          src: "https://expired.shortpulse.test/canvas-image.png",
          alt: "Expired image",
          width: 320,
          height: 180,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };
    const refreshedOutput = makeOutput({
      id: "output-image-render-error-1",
      mode: "image",
      prompt: "Fresh render image",
      previewStoragePath: "user-1/variants/images/render-error/preview.webp",
      fullStoragePath: "user-1/images/render-error/full.png",
      previewUrl: undefined,
      resultUrls: [],
      savedMediaIds: [],
    });
    let outputAvailable = false;

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: (outputId) =>
          outputAvailable && outputId === refreshedOutput.id ? refreshedOutput : null,
        getOutputSnapshot: () => createOutputSnapshot([refreshedOutput]),
      })
    );

    expect(hydrateCanvasSessionStateMock).not.toHaveBeenCalled();
    outputAvailable = true;

    act(() => {
      result.current.railCanvasProps.onCanvasMediaRenderError?.(mockedCanvasSessionState.items[0]);
    });

    await waitFor(() => {
      expect(hydrateCanvasSessionStateMock).toHaveBeenCalledWith({
        ...mockedCanvasSessionState,
        items: [
          expect.objectContaining({
            id: "canvas-image-render-error-1",
            outputId: "output-image-render-error-1",
            src: "https://signed.shortpulse.test/user-1/variants/images/render-error/preview.webp",
            srcStoragePath: "user-1/images/render-error/full.png",
            alt: "Fresh render image",
          }),
        ],
      });
    });
    expect(mediaSigningMocks.getSignedMediaUrl).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/variants/images/render-error/preview.webp",
      forceRefresh: true,
    });
    expect(mediaSigningMocks.getSignedMediaUrl).toHaveBeenCalledWith({
      bucket: "media_library",
      storagePath: "user-1/images/render-error/full.png",
      forceRefresh: true,
    });
  });

  it("retries failed canvas image renders through stored path authority without ids", async () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-image-storage-render-error-1",
          kind: "image" as const,
          x: 12,
          y: 24,
          z: 1,
          selected: false,
          outputId: null,
          sourceSurface: "curated" as const,
          mediaId: null,
          src: "https://expired.shortpulse.test/canvas-image.png",
          srcStoragePath: "user-1/images/storage-render-error.png",
          alt: "Expired image",
          width: 320,
          height: 180,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        getOutputSnapshot: () => createOutputSnapshot(),
      })
    );
    mediaSigningMocks.getSignedMediaUrl.mockClear();

    act(() => {
      result.current.railCanvasProps.onCanvasMediaRenderError?.(mockedCanvasSessionState.items[0]);
    });

    await waitFor(() => {
      expect(mediaSigningMocks.getSignedMediaUrl).toHaveBeenCalledWith({
        bucket: "media_library",
        storagePath: "user-1/images/storage-render-error.png",
        forceRefresh: true,
      });
      expect(hydrateCanvasSessionStateMock).toHaveBeenCalledWith({
        ...mockedCanvasSessionState,
        items: [
          expect.objectContaining({
            id: "canvas-image-storage-render-error-1",
            src: "https://signed.shortpulse.test/user-1/images/storage-render-error.png",
          }),
        ],
      });
    });
  });

  it("retries failed canvas videos through media id authority without clearing existing posters", async () => {
    mockedCanvasSessionState = {
      items: [
        {
          id: "canvas-video-render-error-1",
          kind: "video" as const,
          x: 12,
          y: 24,
          z: 1,
          selected: false,
          outputId: "missing-output-1",
          sourceSurface: "curated" as const,
          mediaId: "saved-media-video-render-error-1",
          videoUrl: "https://expired.shortpulse.test/canvas-video.mp4",
          posterUrl: "https://expired.shortpulse.test/canvas-video-poster.webp",
          title: "Expired video",
          durationMs: null,
          width: 320,
          height: 180,
        },
      ],
      draftTextEntry: null,
      textEditSession: null,
      draftOwnerInstanceId: null,
      textEditOwnerInstanceId: null,
      mainCamera: { x: 0, y: 0, zoom: 1 },
      railCamera: { x: 0, y: 0, zoom: 1 },
    };
    restoreSigningMocks.resolveSessionRestoreSignedMediaAuthorityByMediaId
      .mockResolvedValueOnce(new Map())
      .mockResolvedValueOnce(
        new Map([
          [
            "saved-media-video-render-error-1",
            {
              mediaId: "saved-media-video-render-error-1",
              fileType: "video/mp4",
              previewStoragePath: "user-1/videos/render-error/preview.mp4",
              fullStoragePath: "user-1/videos/render-error/full.mp4",
              previewPosterStoragePath: null,
              signedPreviewUrl: "https://signed.shortpulse.test/video-preview.mp4",
              signedFullUrl: "https://signed.shortpulse.test/video-full.mp4",
              signedPreviewPosterUrl: null,
            },
          ],
        ])
      );

    const { result } = renderHook(() =>
      useAiStudioPageMediaReferenceRuntime({
        ...defaultParams,
        getOutputById: () => null,
        getOutputSnapshot: () => createOutputSnapshot(),
      })
    );

    await waitFor(() => {
      expect(
        restoreSigningMocks.resolveSessionRestoreSignedMediaAuthorityByMediaId
      ).toHaveBeenCalledWith(["saved-media-video-render-error-1"]);
    });

    act(() => {
      result.current.railCanvasProps.onCanvasMediaRenderError?.(mockedCanvasSessionState.items[0]);
    });

    await waitFor(() => {
      expect(
        restoreSigningMocks.resolveSessionRestoreSignedMediaAuthorityByMediaId
      ).toHaveBeenLastCalledWith(["saved-media-video-render-error-1"], { forceRefresh: true });
      expect(hydrateCanvasSessionStateMock).toHaveBeenCalledWith({
        ...mockedCanvasSessionState,
        items: [
          expect.objectContaining({
            id: "canvas-video-render-error-1",
            videoUrl: "https://signed.shortpulse.test/video-full.mp4",
            posterUrl: "https://expired.shortpulse.test/canvas-video-poster.webp",
          }),
        ],
      });
    });
  });
});
