import React from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExpertEditPrimaryIngress } from "../useExpertEditPrimaryIngress";
import type { ExpertEditLayer } from "../expertEditLayerSessionUtils";
import {
  forgetObjectUrlBlob,
  readRememberedObjectUrlBlob,
  rememberObjectUrlBlob,
} from "../../../utils/objectUrlBlobRegistry";
import { INTERNAL_REFERENCE_DRAG_ORIGIN, prepareReferenceDrag } from "../../../utils/dragDrop";

const emptyFileList = { length: 0, item: () => null } as unknown as FileList;

const createLayerFixture = (id: string, imageUrl: string | null = null): ExpertEditLayer => {
  const autoLayerNumber = /^layer-(\d+)$/.exec(id)?.[1] ?? null;
  return {
    id,
    name: autoLayerNumber ? `layer ${autoLayerNumber}` : id,
    imageUrl,
    opacity: 1,
    isAutoNamed: true,
    ownsImageUrl: false,
    transform: {
      translateXRatio: 0,
      translateYRatio: 0,
      scale: 1,
      rotationDeg: 0,
    },
  };
};

const makeInternalVideoDropEvent = () =>
  ({
    preventDefault: vi.fn(),
    dataTransfer: {
      files: emptyFileList,
      types: [
        "text/reference-origin",
        "text/reference-id",
        "text/reference-output-id",
        "text/reference-media-kind",
        "text/reference-url",
        "image/url",
      ],
      getData: vi.fn((type: string) => {
        if (type === "text/reference-origin") return "ai-studio-reference-grid";
        if (type === "text/reference-id" || type === "text/reference-output-id")
          return "out-video-1";
        if (type === "text/reference-media-kind") return "video";
        if (type === "text/reference-url") return "https://example.com/out-video-1.mp4";
        if (type === "image/url") return "https://example.com/out-video-1-poster.jpg";
        return "";
      }),
    },
  }) as unknown as Parameters<
    ReturnType<typeof useExpertEditPrimaryIngress>["handlePrimaryDrop"]
  >[0];

const makeInternalImageDropEvent = () =>
  ({
    preventDefault: vi.fn(),
    dataTransfer: {
      files: emptyFileList,
      types: [
        "text/reference-origin",
        "text/reference-id",
        "text/reference-output-id",
        "text/reference-media-kind",
        "text/reference-url",
        "image/url",
      ],
      getData: vi.fn((type: string) => {
        if (type === "text/reference-origin") return "ai-studio-reference-grid";
        if (type === "text/reference-id" || type === "text/reference-output-id")
          return "out-image-1";
        if (type === "text/reference-media-kind") return "image";
        if (type === "text/reference-url") return "blob:weak-reference-render";
        if (type === "image/url") return "blob:weak-reference-render";
        return "";
      }),
    },
  }) as unknown as Parameters<
    ReturnType<typeof useExpertEditPrimaryIngress>["handlePrimaryDrop"]
  >[0];

const makeImageDropEvent = (imageUrl: string) =>
  ({
    preventDefault: vi.fn(),
    dataTransfer: {
      files: emptyFileList,
      types: ["image/url"],
      getData: vi.fn((type: string) => {
        if (type === "image/url") return imageUrl;
        return "";
      }),
    },
  }) as unknown as Parameters<
    ReturnType<typeof useExpertEditPrimaryIngress>["handlePrimaryDrop"]
  >[0];

const makeCanvasTearOutImagePayload = () => ({
  kind: "image" as const,
  internalPayload: {
    version: 1,
    origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
    referenceId: "out-image-1",
    outputId: "out-image-1",
    imageIndex: 0,
    mediaId: "media-1",
    mediaKind: "image" as const,
    referenceUrl: "blob:weak-reference-render",
    referenceRenderUrl: "https://cdn.shortpulse.test/canvas-export.png",
    sourceSurface: "all-refs" as const,
    width: 640,
    height: 480,
    sessionBacked: true,
  },
  composerImagePayload: {
    version: 1,
    origin: INTERNAL_REFERENCE_DRAG_ORIGIN,
    referenceId: "out-image-1",
    outputId: "out-image-1",
    mediaId: "media-1",
    displayArtifactUrl: "https://cdn.shortpulse.test/canvas-export.png",
    displayArtifactKind: "url" as const,
    sourceSurface: "all-refs" as const,
    width: 640,
    height: 480,
  },
});

const makePreparedInternalImageDropEvent = () => {
  const transferData = new Map<string, string>();
  const currentTarget = document.createElement("article");
  const image = document.createElement("img");
  image.className = "reference-card-image";
  image.setAttribute("src", "https://cdn.shortpulse.test/canvas-export.png");
  currentTarget.appendChild(image);
  const dataTransfer = {
    files: emptyFileList,
    get types() {
      return Array.from(transferData.keys());
    },
    getData: (type: string) => transferData.get(type) ?? "",
    setData: (type: string, value: string) => {
      transferData.set(type, value);
    },
    setDragImage: vi.fn(),
    effectAllowed: "all",
  } as unknown as DataTransfer;

  prepareReferenceDrag(
    {
      currentTarget,
      dataTransfer,
    } as unknown as React.DragEvent<HTMLElement>,
    {
      id: "out-image-1",
      prompt: "Canvas export image",
      previewText: "Canvas export image",
      mode: "image",
      aspect: "16:9",
      model: "Test model",
      status: "ready",
      timestamp: "now",
      taskState: "success",
      mediaSource: "generated",
      previewUrl: "https://cdn.shortpulse.test/canvas-export.png",
      resultUrls: ["https://cdn.shortpulse.test/canvas-export.png"],
      savedMediaIds: ["media-1"],
    } as never,
    {
      dragImage: currentTarget,
      sourceSurface: "all-refs",
    }
  );

  return {
    preventDefault: vi.fn(),
    currentTarget,
    dataTransfer,
  } as unknown as Parameters<
    ReturnType<typeof useExpertEditPrimaryIngress>["handlePrimaryDrop"]
  >[0];
};

const makeFlattenedComposerImageDropEvent = () => {
  const transferData = new Map<string, string>();
  const currentTarget = document.createElement("article");
  const image = document.createElement("img");
  image.className = "reference-card-image";
  image.setAttribute("src", "blob:weak-reference-render");
  currentTarget.appendChild(image);
  const dataTransfer = {
    files: emptyFileList,
    get types() {
      return Array.from(transferData.keys());
    },
    getData: (type: string) => transferData.get(type) ?? "",
    setData: (type: string, value: string) => {
      transferData.set(type, value);
    },
    setDragImage: vi.fn(),
    effectAllowed: "all",
  } as unknown as DataTransfer;

  prepareReferenceDrag(
    {
      currentTarget,
      dataTransfer,
    } as unknown as React.DragEvent<HTMLElement>,
    {
      id: "flattened-output-1",
      prompt: "Flattened image",
      previewText: "Flattened image",
      mode: "image",
      aspect: "16:9",
      model: "Test model",
      status: "ready",
      timestamp: "now",
      taskState: "success",
      mediaSource: "generated",
      previewUrl: "blob:weak-reference-render",
      resultUrls: ["blob:weak-reference-render"],
      saveState: "failed",
    } as never,
    {
      dragImage: currentTarget,
      sourceSurface: "all-refs",
      composerImageArtifact: {
        displayArtifactUrl: "blob:weak-reference-render",
        displayArtifactKind: "blob",
        promptText: "Flattened image",
        width: 960,
        height: 540,
        mimeType: "image/png",
      },
    }
  );

  return {
    preventDefault: vi.fn(),
    currentTarget,
    dataTransfer,
  } as unknown as Parameters<
    ReturnType<typeof useExpertEditPrimaryIngress>["handlePrimaryDrop"]
  >[0];
};

describe("useExpertEditPrimaryIngress", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("inserts a new layer when adding an image to a single-image edit session", async () => {
    const createLayer = vi.fn((args: { indexOneBased: number; imageUrl?: string | null }) =>
      createLayerFixture(`layer-${args.indexOneBased}`, args.imageUrl ?? null)
    );
    const objectUrl = "blob:https://example.com/replaced";
    const createObjectUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue(objectUrl);

    try {
      const { result } = renderHook(() => {
        const [layers, setLayers] = React.useState<ExpertEditLayer[]>([
          createLayerFixture("layer-1", "https://example.com/original.png"),
        ]);
        const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(0);
        const [, setEditingLayerIndex] = React.useState<number | null>(null);
        const [, setEditingLayerValue] = React.useState("");

        const ingress = useExpertEditPrimaryIngress({
          layers,
          selectedLayerIndex,
          foundationLayerId: "layer-1",
          isMorePresetsSurfaceOpen: false,
          createLayer,
          queuePanelHistoryBaselineFromCurrent: vi.fn(),
          setLayers,
          setFoundationLayerId: vi.fn(),
          setSelectedLayerIndex,
          setEditingLayerIndex,
          setEditingLayerValue,
          revokeObjectUrlSafe: vi.fn(),
        });

        return {
          ingress,
          layers,
          selectedLayerIndex,
        };
      });

      const file = new File(["img"], "replacement.png", { type: "image/png" });

      await act(async () => {
        result.current.ingress.handlePrimaryFileSelection({
          target: {
            files: [file],
            value: "replacement.png",
          },
        } as unknown as React.ChangeEvent<HTMLInputElement>);
      });

      expect(result.current.layers).toHaveLength(2);
      expect(result.current.layers[0]?.id).toBe("layer-2");
      expect(result.current.layers[0]?.imageUrl).toBe(objectUrl);
      expect(result.current.layers[0]?.transform.scale).toBe(1);
      expect(result.current.layers[1]?.id).toBe("layer-1");
      expect(result.current.layers[1]?.imageUrl).toBe("https://example.com/original.png");
      expect(result.current.selectedLayerIndex).toBe(0);
      expect(createLayer).toHaveBeenCalledTimes(1);
    } finally {
      createObjectUrlSpy.mockRestore();
    }
  });

  it("rejects internal video references for expert edit image layers", async () => {
    const setLayers = vi.fn();
    const createLayer = vi.fn((args: { indexOneBased: number; imageUrl?: string | null }) =>
      createLayerFixture(`layer-${args.indexOneBased}`, args.imageUrl ?? null)
    );
    const resolvePreviewUrlById = vi.fn(() => "https://example.com/out-video-1.mp4");
    const event = makeInternalVideoDropEvent();

    const { result } = renderHook(() =>
      useExpertEditPrimaryIngress({
        layers: [createLayerFixture("layer-1")],
        selectedLayerIndex: 0,
        foundationLayerId: "layer-1",
        isMorePresetsSurfaceOpen: false,
        createLayer,
        queuePanelHistoryBaselineFromCurrent: vi.fn(),
        setLayers,
        setFoundationLayerId: vi.fn(),
        setSelectedLayerIndex: vi.fn(),
        setEditingLayerIndex: vi.fn(),
        setEditingLayerValue: vi.fn(),
        revokeObjectUrlSafe: vi.fn(),
        resolvePreviewUrlById,
      })
    );

    await act(async () => {
      result.current.handlePrimaryDrop(event);
      await Promise.resolve();
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(resolvePreviewUrlById).not.toHaveBeenCalled();
    expect(createLayer).not.toHaveBeenCalled();
    expect(setLayers).not.toHaveBeenCalled();
  });

  it("prefers durable internal drop authority over weak preview fallbacks", async () => {
    const createLayer = vi.fn((args: { indexOneBased: number; imageUrl?: string | null }) =>
      createLayerFixture(`layer-${args.indexOneBased}`, args.imageUrl ?? null)
    );
    const resolvePreviewUrlById = vi.fn(() => "https://example.com/weak-preview.png");
    const resolveInternalReferenceImageDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "media-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-image-1",
        mediaId: "media-1",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "out-image-1",
      mediaId: "media-1",
      mediaSource: "generated" as const,
      preview: { url: "https://example.com/durable-preview.png" },
      previewStoragePath: "user/images/durable-preview.png",
      fullStoragePath: "user/images/durable-full.png",
      promptText: null,
      preparedImageUrl: "https://example.com/durable-signed.png",
      loadBlob: async () => new Blob(["durable"], { type: "image/png" }),
    }));
    const event = makeInternalImageDropEvent();

    const { result } = renderHook(() => {
      const [layers, setHookLayers] = React.useState<ExpertEditLayer[]>([
        createLayerFixture("layer-1"),
      ]);

      const ingress = useExpertEditPrimaryIngress({
        layers,
        selectedLayerIndex: 0,
        foundationLayerId: "layer-1",
        isMorePresetsSurfaceOpen: false,
        createLayer,
        queuePanelHistoryBaselineFromCurrent: vi.fn(),
        setLayers: setHookLayers,
        setFoundationLayerId: vi.fn(),
        setSelectedLayerIndex: vi.fn(),
        setEditingLayerIndex: vi.fn(),
        setEditingLayerValue: vi.fn(),
        revokeObjectUrlSafe: vi.fn(),
        resolvePreviewUrlById,
        resolveInternalReferenceImageDropSource,
      });

      return {
        ingress,
        layers,
      };
    });

    await act(async () => {
      result.current.ingress.handlePrimaryDrop(event);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolveInternalReferenceImageDropSource).toHaveBeenCalledTimes(1);
    expect(resolvePreviewUrlById).not.toHaveBeenCalled();
    expect(createLayer).not.toHaveBeenCalled();
    expect(result.current.layers[0]?.imageUrl).toBe("https://example.com/durable-signed.png");
    expect(result.current.layers[0]?.ownsImageUrl).toBe(false);
  });

  it("accepts canvas-exported internal reference drags through the real transfer payload shape", async () => {
    const createLayer = vi.fn((args: { indexOneBased: number; imageUrl?: string | null }) =>
      createLayerFixture(`layer-${args.indexOneBased}`, args.imageUrl ?? null)
    );
    const resolveInternalReferenceImageDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "media-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-image-1",
        mediaId: "media-1",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "out-image-1",
      mediaId: "media-1",
      mediaSource: "generated" as const,
      preview: { url: "https://cdn.shortpulse.test/canvas-export.png" },
      previewStoragePath: "user/images/canvas-export-preview.png",
      fullStoragePath: "user/images/canvas-export-full.png",
      promptText: "Canvas export image",
      preparedImageUrl: "https://cdn.shortpulse.test/canvas-export-durable.png",
      loadBlob: async () => new Blob(["durable"], { type: "image/png" }),
    }));
    const event = makePreparedInternalImageDropEvent();

    const { result } = renderHook(() => {
      const [layers, setHookLayers] = React.useState<ExpertEditLayer[]>([
        createLayerFixture("layer-1"),
      ]);

      const ingress = useExpertEditPrimaryIngress({
        layers,
        selectedLayerIndex: 0,
        foundationLayerId: "layer-1",
        isMorePresetsSurfaceOpen: false,
        createLayer,
        queuePanelHistoryBaselineFromCurrent: vi.fn(),
        setLayers: setHookLayers,
        setFoundationLayerId: vi.fn(),
        setSelectedLayerIndex: vi.fn(),
        setEditingLayerIndex: vi.fn(),
        setEditingLayerValue: vi.fn(),
        revokeObjectUrlSafe: vi.fn(),
        resolvePreviewUrlById: vi.fn(() => "https://example.com/weak-preview.png"),
        resolveInternalReferenceImageDropSource,
      });

      return {
        ingress,
        layers,
      };
    });

    await act(async () => {
      result.current.ingress.handlePrimaryDrop(event);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(resolveInternalReferenceImageDropSource).toHaveBeenCalledTimes(1);
    expect(createLayer).not.toHaveBeenCalled();
    expect(result.current.layers[0]?.imageUrl).toBe(
      "https://cdn.shortpulse.test/canvas-export-durable.png"
    );
    expect(result.current.layers[0]?.ownsImageUrl).toBe(false);
  });

  it("accepts canvas tear-out image payloads into the primary stage", async () => {
    const createLayer = vi.fn((args: { indexOneBased: number; imageUrl?: string | null }) =>
      createLayerFixture(`layer-${args.indexOneBased}`, args.imageUrl ?? null)
    );
    const resolveInternalReferenceImageDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "media-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-image-1",
        mediaId: "media-1",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "out-image-1",
      mediaId: "media-1",
      mediaSource: "generated" as const,
      preview: { url: "https://cdn.shortpulse.test/canvas-export.png" },
      previewStoragePath: "user/images/canvas-export-preview.png",
      fullStoragePath: "user/images/canvas-export-full.png",
      promptText: "Canvas export image",
      preparedImageUrl: "https://cdn.shortpulse.test/canvas-export-durable.png",
      loadBlob: async () => new Blob(["durable"], { type: "image/png" }),
    }));

    const { result } = renderHook(() => {
      const [layers, setHookLayers] = React.useState<ExpertEditLayer[]>([
        createLayerFixture("layer-1"),
      ]);

      const ingress = useExpertEditPrimaryIngress({
        layers,
        selectedLayerIndex: 0,
        foundationLayerId: "layer-1",
        isMorePresetsSurfaceOpen: false,
        createLayer,
        queuePanelHistoryBaselineFromCurrent: vi.fn(),
        setLayers: setHookLayers,
        setFoundationLayerId: vi.fn(),
        setSelectedLayerIndex: vi.fn(),
        setEditingLayerIndex: vi.fn(),
        setEditingLayerValue: vi.fn(),
        revokeObjectUrlSafe: vi.fn(),
        resolvePreviewUrlById: vi.fn(() => "https://example.com/weak-preview.png"),
        resolveInternalReferenceImageDropSource,
      });

      return {
        ingress,
        layers,
      };
    });

    await act(async () => {
      result.current.ingress.acceptPrimaryCanvasTearOutPayload(makeCanvasTearOutImagePayload());
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolveInternalReferenceImageDropSource).toHaveBeenCalledTimes(1);
    expect(createLayer).not.toHaveBeenCalled();
    expect(result.current.layers[0]?.imageUrl).toBe(
      "https://cdn.shortpulse.test/canvas-export-durable.png"
    );
    expect(result.current.layers[0]?.ownsImageUrl).toBe(false);
  });

  it("fails closed when internal drop resolution succeeds without a usable durable url", async () => {
    const createLayer = vi.fn((args: { indexOneBased: number; imageUrl?: string | null }) =>
      createLayerFixture(`layer-${args.indexOneBased}`, args.imageUrl ?? null)
    );
    const resolvePreviewUrlById = vi.fn(() => "https://example.com/weak-preview.png");
    const resolveInternalReferenceImageDropSource = vi.fn(async () => ({
      kind: "internal" as const,
      sourceKind: "generated_output" as const,
      sourceId: "media-1",
      provenance: {
        origin: "ai-studio-reference-grid",
        outputId: "out-image-1",
        mediaId: "media-1",
        imageIndex: 0,
        sourceSurface: "all-refs",
        resolutionReason: "output_storage_path" as const,
      },
      outputId: "out-image-1",
      mediaId: "media-1",
      mediaSource: "generated" as const,
      preview: { url: "" },
      previewStoragePath: "user/images/durable-preview.png",
      fullStoragePath: "user/images/durable-full.png",
      promptText: null,
      preparedImageUrl: null,
      loadBlob: async () => new Blob(["durable"], { type: "image/png" }),
    }));
    const event = makeInternalImageDropEvent();

    const { result } = renderHook(() => {
      const [layers, setHookLayers] = React.useState<ExpertEditLayer[]>([
        createLayerFixture("layer-1"),
      ]);

      const ingress = useExpertEditPrimaryIngress({
        layers,
        selectedLayerIndex: 0,
        foundationLayerId: "layer-1",
        isMorePresetsSurfaceOpen: false,
        createLayer,
        queuePanelHistoryBaselineFromCurrent: vi.fn(),
        setLayers: setHookLayers,
        setFoundationLayerId: vi.fn(),
        setSelectedLayerIndex: vi.fn(),
        setEditingLayerIndex: vi.fn(),
        setEditingLayerValue: vi.fn(),
        revokeObjectUrlSafe: vi.fn(),
        resolvePreviewUrlById,
        resolveInternalReferenceImageDropSource,
      });

      return {
        ingress,
        layers,
      };
    });

    await act(async () => {
      result.current.ingress.handlePrimaryDrop(event);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolveInternalReferenceImageDropSource).toHaveBeenCalledTimes(1);
    expect(resolvePreviewUrlById).not.toHaveBeenCalled();
    expect(createLayer).not.toHaveBeenCalled();
    expect(result.current.layers[0]?.imageUrl).toBeNull();
  });

  it("creates a new layer when an image is dropped onto a populated stage", async () => {
    const createLayer = vi.fn((args: { indexOneBased: number; imageUrl?: string | null }) =>
      createLayerFixture(`layer-${args.indexOneBased}`, args.imageUrl ?? null)
    );
    const event = makeImageDropEvent("https://example.com/added.png");

    const { result } = renderHook(() => {
      const [layers, setLayers] = React.useState<ExpertEditLayer[]>([
        createLayerFixture("layer-1", "https://example.com/original.png"),
      ]);
      const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(0);
      const [, setEditingLayerIndex] = React.useState<number | null>(null);
      const [, setEditingLayerValue] = React.useState("");

      const ingress = useExpertEditPrimaryIngress({
        layers,
        selectedLayerIndex,
        foundationLayerId: "layer-1",
        isMorePresetsSurfaceOpen: false,
        createLayer,
        queuePanelHistoryBaselineFromCurrent: vi.fn(),
        setLayers,
        setFoundationLayerId: vi.fn(),
        setSelectedLayerIndex,
        setEditingLayerIndex,
        setEditingLayerValue,
        revokeObjectUrlSafe: vi.fn(),
      });

      return {
        ingress,
        layers,
        selectedLayerIndex,
      };
    });

    await act(async () => {
      result.current.ingress.handlePrimaryDrop(event);
      await Promise.resolve();
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.layers).toHaveLength(2);
    expect(result.current.layers[0]?.id).toBe("layer-2");
    expect(result.current.layers[0]?.imageUrl).toBe("https://example.com/added.png");
    expect(result.current.layers[1]?.id).toBe("layer-1");
    expect(result.current.layers[1]?.imageUrl).toBe("https://example.com/original.png");
    expect(result.current.selectedLayerIndex).toBe(0);
    expect(createLayer).toHaveBeenCalledTimes(1);
  });

  it("creates layer 1 when the first image is dropped onto an empty canvas", async () => {
    const createLayer = vi.fn((args: { indexOneBased: number; imageUrl?: string | null }) =>
      createLayerFixture(`layer-${args.indexOneBased}`, args.imageUrl ?? null)
    );
    const event = makeImageDropEvent("https://example.com/first.png");

    const { result } = renderHook(() => {
      const [layers, setLayers] = React.useState<ExpertEditLayer[]>([]);
      const [foundationLayerId, setFoundationLayerId] = React.useState<string | null>(null);
      const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(null);

      const ingress = useExpertEditPrimaryIngress({
        layers,
        selectedLayerIndex,
        foundationLayerId,
        isMorePresetsSurfaceOpen: false,
        createLayer,
        queuePanelHistoryBaselineFromCurrent: vi.fn(),
        setLayers,
        setFoundationLayerId,
        setSelectedLayerIndex,
        setEditingLayerIndex: vi.fn(),
        setEditingLayerValue: vi.fn(),
        revokeObjectUrlSafe: vi.fn(),
      });

      return {
        foundationLayerId,
        ingress,
        layers,
        selectedLayerIndex,
      };
    });

    await act(async () => {
      result.current.ingress.handlePrimaryDrop(event);
      await Promise.resolve();
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(result.current.layers).toHaveLength(1);
    expect(result.current.layers[0]?.id).toBe("layer-1");
    expect(result.current.layers[0]?.imageUrl).toBe("https://example.com/first.png");
    expect(result.current.foundationLayerId).toBe("layer-1");
    expect(result.current.selectedLayerIndex).toBe(0);
    expect(createLayer).toHaveBeenCalledTimes(1);
  });

  it("does not persist stale blob-backed primary drops when cloning fails", async () => {
    const createLayer = vi.fn((args: { indexOneBased: number; imageUrl?: string | null }) =>
      createLayerFixture(`layer-${args.indexOneBased}`, args.imageUrl ?? null)
    );
    const event = makeImageDropEvent("blob:stale-primary");
    global.fetch = vi.fn().mockRejectedValue(new Error("stale blob")) as typeof fetch;

    const { result } = renderHook(() => {
      const [layers, setLayers] = React.useState<ExpertEditLayer[]>([
        createLayerFixture("layer-1", "https://example.com/original.png"),
      ]);
      const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(0);

      const ingress = useExpertEditPrimaryIngress({
        layers,
        selectedLayerIndex,
        foundationLayerId: "layer-1",
        isMorePresetsSurfaceOpen: false,
        createLayer,
        queuePanelHistoryBaselineFromCurrent: vi.fn(),
        setLayers,
        setFoundationLayerId: vi.fn(),
        setSelectedLayerIndex,
        setEditingLayerIndex: vi.fn(),
        setEditingLayerValue: vi.fn(),
        revokeObjectUrlSafe: vi.fn(),
      });

      return {
        ingress,
        layers,
      };
    });

    await act(async () => {
      result.current.ingress.handlePrimaryDrop(event);
      await Promise.resolve();
    });

    expect(result.current.layers).toHaveLength(1);
    expect(result.current.layers[0]?.imageUrl).toBe("https://example.com/original.png");
    expect(createLayer).not.toHaveBeenCalled();
    expect(readRememberedObjectUrlBlob("blob:stale-primary")).toBeNull();
  });

  it("uses a local flattened render artifact when durable internal save resolution fails", async () => {
    const createLayer = vi.fn((args: { indexOneBased: number; imageUrl?: string | null }) =>
      createLayerFixture(`layer-${args.indexOneBased}`, args.imageUrl ?? null)
    );
    const event = makeFlattenedComposerImageDropEvent();
    const flattenedBlob = new Blob(["flattened image"], { type: "image/png" });
    const preparedUrl = "blob:prepared-flattened-drop";
    const createObjectUrlSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue(preparedUrl);
    rememberObjectUrlBlob("blob:weak-reference-render", flattenedBlob);
    const resolveInternalReferenceImageDropSource = vi.fn().mockResolvedValue(null);

    try {
      const { result } = renderHook(() => {
        const [layers, setLayers] = React.useState<ExpertEditLayer[]>([
          createLayerFixture("layer-1", "https://example.com/original.png"),
        ]);
        const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(0);

        const ingress = useExpertEditPrimaryIngress({
          layers,
          selectedLayerIndex,
          foundationLayerId: "layer-1",
          isMorePresetsSurfaceOpen: false,
          createLayer,
          queuePanelHistoryBaselineFromCurrent: vi.fn(),
          setLayers,
          setFoundationLayerId: vi.fn(),
          setSelectedLayerIndex,
          setEditingLayerIndex: vi.fn(),
          setEditingLayerValue: vi.fn(),
          revokeObjectUrlSafe: vi.fn(),
          resolveInternalReferenceImageDropSource,
        });

        return {
          ingress,
          layers,
          selectedLayerIndex,
        };
      });

      await act(async () => {
        result.current.ingress.handlePrimaryDrop(event);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(resolveInternalReferenceImageDropSource).not.toHaveBeenCalled();
      expect(result.current.layers).toHaveLength(2);
      expect(result.current.layers[0]?.imageUrl).toBe(preparedUrl);
      expect(result.current.layers[1]?.imageUrl).toBe("https://example.com/original.png");
      expect(result.current.selectedLayerIndex).toBe(0);
      expect(createLayer).toHaveBeenCalledTimes(1);
      expect(readRememberedObjectUrlBlob(preparedUrl)).toBe(flattenedBlob);
    } finally {
      forgetObjectUrlBlob("blob:weak-reference-render");
      forgetObjectUrlBlob(preparedUrl);
      createObjectUrlSpy.mockRestore();
    }
  });
});
