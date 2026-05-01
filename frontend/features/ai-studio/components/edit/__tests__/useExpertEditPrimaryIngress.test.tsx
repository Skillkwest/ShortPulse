import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useExpertEditPrimaryIngress } from "../useExpertEditPrimaryIngress";
import type { ExpertEditLayer } from "../expertEditLayerSessionUtils";

const emptyFileList = { length: 0, item: () => null } as unknown as FileList;

const createLayerFixture = (id: string, imageUrl: string | null = null): ExpertEditLayer => ({
  id,
  name: id,
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
});

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

describe("useExpertEditPrimaryIngress", () => {
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
});
