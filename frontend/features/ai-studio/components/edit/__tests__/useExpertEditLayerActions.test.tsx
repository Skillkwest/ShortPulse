import React from "react";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { BRIA_BACKGROUND_REMOVE_MODEL_ID } from "../../../logic/editPromptPolicy";
import { defaultLayerTransform } from "../expertEditLayerTransformUtils";
import type { ExpertEditLayer } from "../expertEditLayerSessionUtils";
import { useExpertEditLayerActions } from "../useExpertEditLayerActions";

const composePrimaryStageLayersToBlobMock = vi.fn();
const rememberObjectUrlBlobMock = vi.fn();

vi.mock("../../../logic/expertEditStageFlatten", () => ({
  composePrimaryStageLayersToBlob: (...args: unknown[]) =>
    composePrimaryStageLayersToBlobMock(...args),
}));

vi.mock("../../../utils/objectUrlBlobRegistry", () => ({
  rememberObjectUrlBlob: (...args: unknown[]) => rememberObjectUrlBlobMock(...args),
}));

const createLayer = (
  id: string,
  {
    imageUrl = null,
    ownsImageUrl = false,
  }: {
    imageUrl?: string | null;
    ownsImageUrl?: boolean;
  } = {}
): ExpertEditLayer => ({
  id,
  name: id,
  imageUrl,
  opacity: 1,
  isAutoNamed: true,
  ownsImageUrl,
  transform: defaultLayerTransform(),
});

const renderLayerActions = (initialLayers: ExpertEditLayer[]) => {
  const onRegenerateWithReferenceInputs = vi.fn(async () => undefined);
  const showStatusToast = vi.fn();
  const onAddFlattenedReferenceImage = vi.fn();

  const hook = renderHook(() => {
    const [layers, setLayers] = React.useState<ExpertEditLayer[]>(initialLayers);
    const [selectedLayerIndex, setSelectedLayerIndex] = React.useState<number | null>(0);
    const selectedLayer = selectedLayerIndex == null ? null : (layers[selectedLayerIndex] ?? null);
    const selectedLayerImageUrl = selectedLayer?.imageUrl ?? null;
    const populatedLayerCount = layers.filter((layer) => layer.imageUrl).length;

    const actions = useExpertEditLayerActions({
      layers,
      foundationLayerId: layers[0]?.id ?? null,
      selectedLayer,
      selectedLayerImageUrl,
      populatedLayerCount,
      createLayer: ({ indexOneBased }) => createLayer(`layer-${indexOneBased}`),
      layerIdCounterRef: { current: layers.length + 1 },
      setLayers,
      setSelectedLayerIndex,
      clearLayerEditing: vi.fn(),
      queuePanelHistoryBaselineFromCurrent: vi.fn(),
      onAddFlattenedReferenceImage,
      onRegenerateWithReferenceInputs,
      showStatusToast,
      suppressNextPrimaryPublishUrlRef: { current: null },
      resolveStageFlattenSnapshot: vi.fn(() => ({ outputAspectRatio: 1, camera: null })),
    });

    return { actions, layers };
  });

  return {
    ...hook,
    onRegenerateWithReferenceInputs,
    onAddFlattenedReferenceImage,
    showStatusToast,
  };
};

describe("useExpertEditLayerActions", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    let objectUrlCounter = 0;
    vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
      objectUrlCounter += 1;
      return `blob:flattened-${objectUrlCounter}`;
    });
    composePrimaryStageLayersToBlobMock.mockResolvedValue(
      new Blob(["flattened"], { type: "image/png" })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("queues rapid remove-background after an in-flight flatten", async () => {
    const { result, onRegenerateWithReferenceInputs } = renderLayerActions([
      createLayer("layer-1", { imageUrl: "https://cdn.test/base.png" }),
      createLayer("layer-2", { imageUrl: "https://cdn.test/top.png" }),
    ]);

    await act(async () => {
      const flattenPromise = result.current.actions.handleManualFlatten();
      result.current.actions.handleRemoveBackground();
      await flattenPromise;
    });

    expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalledTimes(1);
    expect(result.current.layers).toHaveLength(1);
    expect(result.current.layers[0]?.imageUrl).toBe("blob:flattened-1");
    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledWith(["blob:flattened-1"], {
      modelIdOverride: BRIA_BACKGROUND_REMOVE_MODEL_ID,
      referenceInputsMode: "replace",
    });
  });

  it("coalesces rapid remove-background then flatten into flatten then remove-background", async () => {
    const { result, onRegenerateWithReferenceInputs } = renderLayerActions([
      createLayer("layer-1", { imageUrl: "https://cdn.test/base.png" }),
      createLayer("layer-2", { imageUrl: "https://cdn.test/top.png" }),
    ]);

    await act(async () => {
      result.current.actions.handleRemoveBackground();
      result.current.actions.handleManualFlatten();
      await Promise.resolve();
      vi.runOnlyPendingTimers();
    });

    expect(composePrimaryStageLayersToBlobMock).toHaveBeenCalledTimes(1);
    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledTimes(1);
    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledWith(["blob:flattened-1"], {
      modelIdOverride: BRIA_BACKGROUND_REMOVE_MODEL_ID,
      referenceInputsMode: "replace",
    });
    expect(onRegenerateWithReferenceInputs).not.toHaveBeenCalledWith(
      ["https://cdn.test/base.png"],
      expect.anything()
    );
  });

  it("keeps single remove-background scoped to the selected layer", async () => {
    const { result, onRegenerateWithReferenceInputs } = renderLayerActions([
      createLayer("layer-1", { imageUrl: "https://cdn.test/base.png" }),
      createLayer("layer-2", { imageUrl: "https://cdn.test/top.png" }),
    ]);

    await act(async () => {
      result.current.actions.handleRemoveBackground();
      vi.runOnlyPendingTimers();
      await Promise.resolve();
    });

    expect(composePrimaryStageLayersToBlobMock).not.toHaveBeenCalled();
    expect(onRegenerateWithReferenceInputs).toHaveBeenCalledWith(["https://cdn.test/base.png"], {
      modelIdOverride: BRIA_BACKGROUND_REMOVE_MODEL_ID,
      referenceInputsMode: "replace",
    });
  });
});
