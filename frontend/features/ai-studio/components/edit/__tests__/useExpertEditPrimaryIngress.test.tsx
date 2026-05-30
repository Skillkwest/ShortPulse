import React from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useExpertEditPrimaryIngress } from "../useExpertEditPrimaryIngress";
import type { ExpertEditLayer } from "../expertEditLayerSessionUtils";
import { readRememberedObjectUrlBlob } from "../../../utils/objectUrlBlobRegistry";

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
});
