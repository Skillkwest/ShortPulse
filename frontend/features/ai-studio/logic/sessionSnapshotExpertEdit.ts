/**
 * Expert Edit session snapshot contracts and serializers.
 * Encodes the durable edit document state that the canonical page snapshot can restore.
 */
import {
  EXPERT_EDIT_SESSION_STATE_VERSION,
  cloneInpaintMaskSnapshot,
  cloneLayerSessionTransform,
  cloneMarkupStrokesSnapshot,
  type ExpertEditLayerSessionLayer,
  type ExpertEditSessionState,
} from "../components/edit/expertEditSessionState";

export type AiStudioSessionExpertEditSnapshotV1 = {
  schemaVersion: 1;
  state: ExpertEditSessionState;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asFiniteNumber = (value: unknown, fallback = 0): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
};

const asBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value !== "boolean") return fallback;
  return value;
};

const asString = (value: unknown, fallback = ""): string => {
  if (typeof value !== "string") return fallback;
  return value;
};

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const sanitizeDurableMediaUrl = (value: string | null): string | null => {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) return null;
  return normalized;
};

const sanitizeLayer = (layer: ExpertEditLayerSessionLayer): ExpertEditLayerSessionLayer => {
  const imageUrl = sanitizeDurableMediaUrl(layer.imageUrl);
  return {
    id: layer.id,
    name: layer.name,
    imageUrl,
    opacity: layer.opacity,
    isAutoNamed: layer.isAutoNamed,
    ownsImageUrl: imageUrl ? layer.ownsImageUrl : false,
    transform: cloneLayerSessionTransform(layer.transform),
  };
};

export const serializeAiStudioSessionExpertEditState = (
  state: ExpertEditSessionState
): AiStudioSessionExpertEditSnapshotV1 => ({
  schemaVersion: 1,
  state: {
    version: EXPERT_EDIT_SESSION_STATE_VERSION,
    layers: {
      layerIdCounter: state.layers.layerIdCounter,
      foundationLayerId: state.layers.foundationLayerId,
      selectedLayerIndex: state.layers.selectedLayerIndex,
      layers: state.layers.layers.map(sanitizeLayer),
    },
    markup: {
      strokes: cloneMarkupStrokesSnapshot(state.markup.strokes),
    },
    inpaint: {
      snapshot: cloneInpaintMaskSnapshot(state.inpaint.snapshot),
    },
  },
});

const parseMarkupStrokes = (value: unknown): ExpertEditSessionState["markup"]["strokes"] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, strokeIndex) => {
      const row = asRecord(entry);
      if (!row) return null;
      const pointsValue = Array.isArray(row.points) ? row.points : [];
      const points = pointsValue
        .map((point) => {
          const pointRow = asRecord(point);
          if (!pointRow) return null;
          return {
            sceneX: asFiniteNumber(pointRow.sceneX, 0),
            sceneY: asFiniteNumber(pointRow.sceneY, 0),
          };
        })
        .filter(
          (
            point
          ): point is {
            sceneX: number;
            sceneY: number;
          } => Boolean(point)
        );
      return {
        id: asString(row.id, `markup-stroke-${strokeIndex + 1}`),
        color: asString(row.color, "#F43F5E"),
        sizeRatio: asFiniteNumber(row.sizeRatio, 0.01),
        points,
      };
    })
    .filter((entry): entry is ExpertEditSessionState["markup"]["strokes"][number] =>
      Boolean(entry)
    );
};

const parseInpaintSnapshot = (value: unknown): ExpertEditSessionState["inpaint"]["snapshot"] => {
  const row = asRecord(value);
  if (!row) return { layers: [] };
  const layersValue = Array.isArray(row.layers) ? row.layers : [];
  return {
    layers: layersValue
      .map((entry) => {
        const layerRow = asRecord(entry);
        if (!layerRow) return null;
        const alphaValue = layerRow.alpha;
        const alpha =
          alphaValue instanceof Uint8ClampedArray
            ? new Uint8ClampedArray(alphaValue)
            : Array.isArray(alphaValue)
              ? new Uint8ClampedArray(alphaValue.map((cell) => asFiniteNumber(cell, 0)))
              : new Uint8ClampedArray();
        return {
          layerId: asString(layerRow.layerId, ""),
          width: Math.max(0, Math.trunc(asFiniteNumber(layerRow.width, 0))),
          height: Math.max(0, Math.trunc(asFiniteNumber(layerRow.height, 0))),
          alpha,
        };
      })
      .filter((entry): entry is ExpertEditSessionState["inpaint"]["snapshot"]["layers"][number] =>
        Boolean(entry && entry.layerId)
      ),
  };
};

export const parseAiStudioSessionExpertEditState = (
  value: unknown
): ExpertEditSessionState | null => {
  const root = asRecord(value);
  if (!root) return null;
  const payload = asRecord(root.state) ?? root;
  const layersRow = asRecord(payload.layers);
  const markupRow = asRecord(payload.markup);
  const inpaintRow = asRecord(payload.inpaint);
  if (!layersRow || !markupRow || !inpaintRow) return null;
  const layersValue = Array.isArray(layersRow.layers) ? layersRow.layers : [];
  return {
    version:
      asFiniteNumber(payload.version, EXPERT_EDIT_SESSION_STATE_VERSION) >= 2
        ? EXPERT_EDIT_SESSION_STATE_VERSION
        : 1,
    layers: {
      layerIdCounter: Math.max(2, Math.trunc(asFiniteNumber(layersRow.layerIdCounter, 2))),
      foundationLayerId: asNullableString(layersRow.foundationLayerId),
      selectedLayerIndex:
        layersRow.selectedLayerIndex === null
          ? null
          : Math.max(0, Math.trunc(asFiniteNumber(layersRow.selectedLayerIndex, 0))),
      layers: layersValue
        .map((entry, index) => {
          const layerRow = asRecord(entry);
          if (!layerRow) return null;
          const imageUrl = sanitizeDurableMediaUrl(asNullableString(layerRow.imageUrl));
          return {
            id: asString(layerRow.id, `layer-${index + 1}`),
            name: asString(layerRow.name, `layer ${index + 1}`),
            imageUrl,
            opacity: asFiniteNumber(layerRow.opacity, 100),
            isAutoNamed: asBoolean(layerRow.isAutoNamed, true),
            ownsImageUrl: imageUrl ? asBoolean(layerRow.ownsImageUrl) : false,
            transform: cloneLayerSessionTransform({
              translateXRatio: asFiniteNumber(asRecord(layerRow.transform)?.translateXRatio, 0),
              translateYRatio: asFiniteNumber(asRecord(layerRow.transform)?.translateYRatio, 0),
              scale: asFiniteNumber(asRecord(layerRow.transform)?.scale, 1),
              rotationDeg: asFiniteNumber(asRecord(layerRow.transform)?.rotationDeg, 0),
            }),
          };
        })
        .filter((entry): entry is ExpertEditSessionState["layers"]["layers"][number] =>
          Boolean(entry)
        ),
    },
    markup: {
      strokes: parseMarkupStrokes(markupRow.strokes),
      ...(markupRow.history ? { history: undefined } : {}),
    },
    inpaint: {
      snapshot: parseInpaintSnapshot(inpaintRow.snapshot ?? asRecord(inpaintRow.history)?.present),
      ...(inpaintRow.history ? { history: undefined } : {}),
    },
  };
};
