/**
 * Layer/session-state normalization helpers for Expert Edit initialization and layer stack hygiene.
 */
import { isAudioUrl, isVideoUrl } from "../../logic/stateParsers";
import type { MarkupStroke } from "./markupStrokeController";
import {
  clampLayerOpacity,
  cloneLayerTransform,
  defaultLayerTransform,
  type LayerTransform,
} from "./expertEditLayerTransformUtils";
import {
  cloneInpaintMaskSnapshot,
  cloneMarkupStrokesSnapshot,
  type ExpertEditInpaintHistoryState,
  type ExpertEditLayerSessionLayer,
  type ExpertEditLayerSessionState,
  type ExpertEditMarkupHistoryState,
  type ExpertEditSessionState,
} from "./expertEditSessionState";

export const LAYER_OPACITY_DEFAULT = 1;
export const LAYER_REORDER_DRAG_MIME = "application/x-shortpulse-layer-index";

export const formatLayerName = (indexOneBased: number) => `layer ${indexOneBased}`;

const autoLayerNamePattern = /^layer\s*'?(\d+)'?$/i;

export const isAutoLayerName = (value: string) => autoLayerNamePattern.test(value.trim());

const resolveAutoLayerNameNumber = (value: string) => {
  const match = autoLayerNamePattern.exec(value.trim());
  if (!match) return null;
  const candidate = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isInteger(candidate) || candidate <= 0) return null;
  return candidate;
};

export type ExpertEditLayer = {
  id: string;
  name: string;
  imageUrl: string | null;
  opacity: number;
  isAutoNamed: boolean;
  ownsImageUrl: boolean;
  transform: LayerTransform;
};

export const resolveLayerIdCounterFromLayers = (layers: ExpertEditLayer[]) => {
  let highestLayerNumber = 1;
  layers.forEach((layer) => {
    const match = /^layer-(\d+)$/.exec(layer.id.trim());
    if (!match) return;
    const parsed = Number.parseInt(match[1] ?? "", 10);
    if (!Number.isFinite(parsed)) return;
    highestLayerNumber = Math.max(highestLayerNumber, parsed);
  });
  return Math.max(2, highestLayerNumber + 1);
};

export const cloneLayerForSessionState = (layer: ExpertEditLayer): ExpertEditLayerSessionLayer => ({
  id: layer.id,
  name: layer.name,
  imageUrl: layer.imageUrl,
  opacity: layer.opacity,
  isAutoNamed: layer.isAutoNamed,
  ownsImageUrl: layer.ownsImageUrl,
  transform: cloneLayerTransform(layer.transform),
});

const coerceLayerTransformFromSessionState = (
  value: ExpertEditLayerSessionLayer["transform"] | null | undefined
): LayerTransform => {
  if (!value) return defaultLayerTransform();
  const translateXRatio = Number(value.translateXRatio);
  const translateYRatio = Number(value.translateYRatio);
  const scale = Number(value.scale);
  const rotationDeg = Number(value.rotationDeg);
  return {
    translateXRatio: Number.isFinite(translateXRatio) ? translateXRatio : 0,
    translateYRatio: Number.isFinite(translateYRatio) ? translateYRatio : 0,
    scale: Number.isFinite(scale) ? scale : 1,
    rotationDeg: Number.isFinite(rotationDeg) ? rotationDeg : 0,
  };
};

export const layerHasImage = (layer: ExpertEditLayer) => isExpertEditImageUrl(layer.imageUrl);

export const isExpertEditImageUrl = (value: string | null | undefined) => {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return !isVideoUrl(trimmed) && !isAudioUrl(trimmed);
};

export const isLayerIndexInBounds = ({
  index,
  layerCount,
}: {
  index: number | null | undefined;
  layerCount: number;
}) => index != null && index >= 0 && index < layerCount;

export const resolveLayerIndexOrFallback = ({
  selectedLayerIndex,
  layerCount,
  fallbackIndex = 0,
}: {
  selectedLayerIndex: number | null | undefined;
  layerCount: number;
  fallbackIndex?: number;
}): number => {
  if (selectedLayerIndex != null && selectedLayerIndex >= 0 && selectedLayerIndex < layerCount) {
    return selectedLayerIndex;
  }
  return fallbackIndex;
};

export const resolveLayerIndexOrNull = ({
  selectedLayerIndex,
  layerCount,
}: {
  selectedLayerIndex: number | null | undefined;
  layerCount: number;
}): number | null =>
  layerCount > 0 ? resolveLayerIndexOrFallback({ selectedLayerIndex, layerCount }) : null;

export const collectOwnedLayerImageUrls = (layers: ExpertEditLayer[]) => {
  const urls = new Set<string>();
  layers.forEach((layer) => {
    if (!layer.ownsImageUrl || typeof layer.imageUrl !== "string") return;
    urls.add(layer.imageUrl);
  });
  return urls;
};

export const resolveStaleOwnedLayerImageUrls = ({
  previousLayers,
  activeLayers,
}: {
  previousLayers: ExpertEditLayer[];
  activeLayers: ExpertEditLayer[];
}) => {
  const activeOwnedUrls = collectOwnedLayerImageUrls(activeLayers);
  const staleUrls: string[] = [];
  previousLayers.forEach((layer) => {
    if (!layer.ownsImageUrl || !layer.imageUrl) return;
    if (activeOwnedUrls.has(layer.imageUrl)) return;
    staleUrls.push(layer.imageUrl);
  });
  return staleUrls;
};

export const enforceLayerStackInvariants = ({
  layers,
  foundationLayerId,
}: {
  layers: ExpertEditLayer[];
  foundationLayerId: string | null;
}) => {
  const resolvedFoundationId = foundationLayerId ?? layers[0]?.id ?? null;
  if (!resolvedFoundationId) return layers;
  const foundationLayer =
    layers.find((layer) => layer.id === resolvedFoundationId) ?? layers[0] ?? null;
  if (!foundationLayer) return layers;
  const nextLayers = layers.filter(
    (layer) => layer.id === resolvedFoundationId || layerHasImage(layer)
  );
  const populatedNonFoundationLayers = nextLayers.filter(
    (layer) => layer.id !== resolvedFoundationId
  );
  if (!layerHasImage(foundationLayer) && populatedNonFoundationLayers.length === 1) {
    const promotedLayer = populatedNonFoundationLayers[0];
    if (!promotedLayer) return nextLayers;
    return [
      promotedLayer.isAutoNamed
        ? {
            ...promotedLayer,
            name: formatLayerName(1),
          }
        : promotedLayer,
    ];
  }
  if (nextLayers.some((layer) => layer.id === resolvedFoundationId)) {
    return nextLayers;
  }
  return [foundationLayer, ...nextLayers];
};

export const resolveLowestUnusedAutoLayerNumber = ({
  layers,
  excludeLayerId,
}: {
  layers: ExpertEditLayer[];
  excludeLayerId?: string | null;
}) => {
  const usedNumbers = new Set<number>();
  layers.forEach((layer) => {
    if (excludeLayerId && layer.id === excludeLayerId) return;
    const resolvedNumber = resolveAutoLayerNameNumber(layer.name);
    if (resolvedNumber != null) {
      usedNumbers.add(resolvedNumber);
    }
  });
  let candidate = 1;
  while (usedNumbers.has(candidate)) {
    candidate += 1;
  }
  return candidate;
};

export const resolveReorderedLayerState = ({
  layers,
  fromIndex,
  toIndex,
  resolvedSelectedLayerIndex,
  editingLayerIndex,
}: {
  layers: ExpertEditLayer[];
  fromIndex: number;
  toIndex: number;
  resolvedSelectedLayerIndex: number;
  editingLayerIndex: number | null;
}) => {
  if (fromIndex === toIndex) return null;
  const movingLayer = layers[fromIndex];
  if (!movingLayer) return null;
  const selectedLayerId = layers[resolvedSelectedLayerIndex]?.id ?? null;
  const editingLayerId = editingLayerIndex != null ? (layers[editingLayerIndex]?.id ?? null) : null;

  const nextLayers = [...layers];
  const [movedLayer] = nextLayers.splice(fromIndex, 1);
  if (!movedLayer) return null;
  nextLayers.splice(toIndex, 0, movedLayer);

  return {
    nextLayers,
    nextSelectedLayerIndex:
      selectedLayerId == null
        ? undefined
        : Math.max(
            0,
            nextLayers.findIndex((layer) => layer.id === selectedLayerId)
          ),
    nextEditingLayerIndex:
      editingLayerId == null
        ? undefined
        : (() => {
            const nextIndex = nextLayers.findIndex((layer) => layer.id === editingLayerId);
            return nextIndex >= 0 ? nextIndex : null;
          })(),
  };
};

export const isLayerReorderDrag = ({
  draggingLayerIndex,
  dataTransferTypes,
}: {
  draggingLayerIndex: number | null;
  dataTransferTypes: readonly string[];
}) => draggingLayerIndex != null || dataTransferTypes.includes(LAYER_REORDER_DRAG_MIME);

export const resolveLayerReorderFromIndex = ({
  transferIndexRaw,
  draggingLayerIndexRef,
  draggingLayerIndex,
}: {
  transferIndexRaw: string;
  draggingLayerIndexRef: number | null;
  draggingLayerIndex: number | null;
}) => {
  const transferIndex = Number.parseInt(transferIndexRaw, 10);
  if (Number.isFinite(transferIndex)) return transferIndex;
  return draggingLayerIndexRef ?? draggingLayerIndex;
};

export const resolveLayerStateAfterDelete = ({
  layers,
  index,
  foundationLayerId,
  resolvedSelectedLayerIndex,
  editingLayerIndex,
}: {
  layers: ExpertEditLayer[];
  index: number;
  foundationLayerId: string | null;
  resolvedSelectedLayerIndex: number;
  editingLayerIndex: number | null;
}) => {
  const targetLayer = layers[index];
  if (!targetLayer) return null;

  const isFoundationLayer = targetLayer.id === foundationLayerId;
  const selectedLayerId = layers[resolvedSelectedLayerIndex]?.id ?? null;
  const editingLayerId = editingLayerIndex != null ? (layers[editingLayerIndex]?.id ?? null) : null;

  const nextLayers = isFoundationLayer
    ? layers.map((layer) =>
        layer.id === targetLayer.id
          ? {
              ...layer,
              name: layer.isAutoNamed ? formatLayerName(1) : layer.name,
              imageUrl: null,
              opacity: LAYER_OPACITY_DEFAULT,
              ownsImageUrl: false,
              transform: defaultLayerTransform(),
            }
          : layer
      )
    : layers.filter((_, layerIndex) => layerIndex !== index);

  const normalizedLayers = enforceLayerStackInvariants({
    layers: nextLayers,
    foundationLayerId,
  });

  const nextEditingLayerIndex =
    editingLayerId == null
      ? null
      : (() => {
          const nextIndex = normalizedLayers.findIndex((layer) => layer.id === editingLayerId);
          return nextIndex >= 0 ? nextIndex : null;
        })();

  if (isFoundationLayer) {
    const foundationIndex = normalizedLayers.findIndex((layer) => layer.id === targetLayer.id);
    return {
      normalizedLayers,
      nextEditingLayerIndex,
      nextSelectedLayerIndex: foundationIndex >= 0 ? foundationIndex : 0,
    };
  }

  if (selectedLayerId) {
    const selectedIndex = normalizedLayers.findIndex((layer) => layer.id === selectedLayerId);
    if (selectedIndex >= 0) {
      return {
        normalizedLayers,
        nextEditingLayerIndex,
        nextSelectedLayerIndex: selectedIndex,
      };
    }
  }

  return {
    normalizedLayers,
    nextEditingLayerIndex,
    nextSelectedLayerIndex: Math.max(0, Math.min(index - 1, normalizedLayers.length - 1)),
  };
};

export const resolveLayersAfterContextMenuRemoveImage = ({
  layers,
  selectedLayerId,
  foundationLayerId,
}: {
  layers: ExpertEditLayer[];
  selectedLayerId: string;
  foundationLayerId: string | null;
}) =>
  layers.map((layer) =>
    layer.id === selectedLayerId
      ? {
          ...layer,
          name:
            layer.id === foundationLayerId && layer.isAutoNamed ? formatLayerName(1) : layer.name,
          imageUrl: null,
          ownsImageUrl: false,
          opacity: LAYER_OPACITY_DEFAULT,
          transform: defaultLayerTransform(),
        }
      : layer
  );

export const resolveInitialLayerSessionState = ({
  referenceImageUrl,
  layerState,
}: {
  referenceImageUrl: string | null;
  layerState: ExpertEditLayerSessionState | null | undefined;
}) => {
  const hasReferenceImageAuthority = isExpertEditImageUrl(referenceImageUrl);
  const fallbackLayers: ExpertEditLayer[] = [
    {
      id: "layer-1",
      name: formatLayerName(1),
      imageUrl: hasReferenceImageAuthority ? referenceImageUrl.trim() : null,
      opacity: LAYER_OPACITY_DEFAULT,
      isAutoNamed: true,
      ownsImageUrl: false,
      transform: defaultLayerTransform(),
    },
  ];
  if (!hasReferenceImageAuthority || !layerState?.layers?.length) {
    return {
      layers: fallbackLayers,
      foundationLayerId: "layer-1",
      selectedLayerIndex: 0,
      layerIdCounter: 2,
    };
  }
  const hydratedLayers: ExpertEditLayer[] = layerState.layers
    .filter((layer): layer is ExpertEditLayerSessionLayer => Boolean(layer?.id))
    .map((layer, index) => ({
      id: layer.id,
      name: layer.name?.trim() ? layer.name : formatLayerName(index + 1),
      imageUrl: isExpertEditImageUrl(layer.imageUrl) ? layer.imageUrl.trim() : null,
      opacity: clampLayerOpacity(layer.opacity),
      isAutoNamed: layer.isAutoNamed !== false,
      ownsImageUrl: layer.ownsImageUrl === true,
      transform: coerceLayerTransformFromSessionState(layer.transform),
    }));
  if (!hydratedLayers.length) {
    return {
      layers: fallbackLayers,
      foundationLayerId: "layer-1",
      selectedLayerIndex: 0,
      layerIdCounter: 2,
    };
  }
  const normalizedLayers = enforceLayerStackInvariants({
    layers: hydratedLayers,
    foundationLayerId: layerState.foundationLayerId,
  });
  const normalizedFoundationLayerId =
    normalizedLayers.find((layer) => layer.id === layerState.foundationLayerId)?.id ??
    normalizedLayers[0]?.id ??
    null;
  const sessionSelectedLayerIndex = layerState.selectedLayerIndex;
  const normalizedSelectedLayerIndex =
    sessionSelectedLayerIndex == null ||
    sessionSelectedLayerIndex < 0 ||
    sessionSelectedLayerIndex >= normalizedLayers.length
      ? normalizedLayers.length > 0
        ? 0
        : null
      : sessionSelectedLayerIndex;
  const sessionLayerIdCounter = Number(layerState.layerIdCounter);
  const normalizedLayerIdCounter = Math.max(
    resolveLayerIdCounterFromLayers(normalizedLayers),
    Number.isFinite(sessionLayerIdCounter) ? Math.floor(sessionLayerIdCounter) : 2,
    2
  );
  return {
    layers: normalizedLayers,
    foundationLayerId: normalizedFoundationLayerId,
    selectedLayerIndex: normalizedSelectedLayerIndex,
    layerIdCounter: normalizedLayerIdCounter,
  };
};

export const resolveMarkupStrokeIdCounterFromStrokes = (strokes: MarkupStroke[]) => {
  let highestStrokeNumber = 0;
  strokes.forEach((stroke) => {
    const match = /^markup-stroke-(\d+)$/.exec(stroke.id.trim());
    if (!match) return;
    const parsed = Number.parseInt(match[1] ?? "", 10);
    if (!Number.isFinite(parsed)) return;
    highestStrokeNumber = Math.max(highestStrokeNumber, parsed);
  });
  return highestStrokeNumber + 1;
};

const createEmptyMarkupHistoryState = (): ExpertEditMarkupHistoryState => ({
  past: [],
  present: [],
  future: [],
});

const createEmptyInpaintHistoryState = (): ExpertEditInpaintHistoryState => ({
  past: [],
  present: { layers: [] },
  future: [],
});

export const resolveInitialExpertEditSessionState = ({
  referenceImageUrl,
  sessionState,
}: {
  referenceImageUrl: string | null;
  sessionState: ExpertEditSessionState | null | undefined;
}) => {
  const layerState = resolveInitialLayerSessionState({
    referenceImageUrl,
    layerState: sessionState?.layers,
  });
  const markupStrokes =
    sessionState?.markup?.strokes && sessionState.markup.strokes.length > 0
      ? cloneMarkupStrokesSnapshot(sessionState.markup.strokes)
      : sessionState?.markup?.history
        ? cloneMarkupStrokesSnapshot(sessionState.markup.history.present)
        : [];
  const markupHistory = createEmptyMarkupHistoryState();
  markupHistory.present = cloneMarkupStrokesSnapshot(markupStrokes);
  const inpaintSnapshot = sessionState?.inpaint?.snapshot
    ? cloneInpaintMaskSnapshot(sessionState.inpaint.snapshot)
    : sessionState?.inpaint?.history
      ? cloneInpaintMaskSnapshot(sessionState.inpaint.history.present)
      : createEmptyInpaintHistoryState().present;
  const inpaintHistory = createEmptyInpaintHistoryState();
  inpaintHistory.present = cloneInpaintMaskSnapshot(inpaintSnapshot);
  return {
    layerState,
    markupStrokes,
    markupHistory,
    inpaintHistory,
  };
};
