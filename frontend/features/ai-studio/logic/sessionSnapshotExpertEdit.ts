/**
 * Expert Edit session snapshot contracts and serializers.
 * Encodes the durable edit document state that the canonical page snapshot can restore.
 */
import {
  EXPERT_EDIT_SESSION_STATE_VERSION,
  cloneLayerSessionTransform,
  cloneMarkupStrokesSnapshot,
  type ExpertEditLayerSessionLayer,
  type ExpertEditSessionState,
} from "../components/edit/expertEditSessionState";

const EXPERT_EDIT_INPAINT_ALPHA_RAW_ENCODING = "raw-base64-v1" as const;
const EXPERT_EDIT_INPAINT_ALPHA_RLE_ENCODING = "rle-base64-v1" as const;

type AiStudioSessionInpaintMaskAlphaEncoding =
  | typeof EXPERT_EDIT_INPAINT_ALPHA_RAW_ENCODING
  | typeof EXPERT_EDIT_INPAINT_ALPHA_RLE_ENCODING;

type AiStudioSessionSerializedInpaintMaskBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type AiStudioSessionSerializedInpaintMaskAlpha = {
  encoding: AiStudioSessionInpaintMaskAlphaEncoding;
  data: string;
};

type AiStudioSessionSerializedInpaintMaskLayerSnapshot = {
  layerId: string;
  width: number;
  height: number;
  bounds?: AiStudioSessionSerializedInpaintMaskBounds | null;
  alpha:
    | AiStudioSessionSerializedInpaintMaskAlpha
    | number[]
    | Uint8ClampedArray
    | Record<string, unknown>;
};

type AiStudioSessionSerializedExpertEditState = Omit<ExpertEditSessionState, "inpaint"> & {
  inpaint: {
    snapshot: {
      layers: AiStudioSessionSerializedInpaintMaskLayerSnapshot[];
    };
  };
};

export type AiStudioSessionExpertEditSnapshot = {
  schemaVersion: 1 | 2;
  state: AiStudioSessionSerializedExpertEditState;
};

export type AiStudioSessionExpertEditSnapshotV1 = AiStudioSessionExpertEditSnapshot;

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

const clampInteger = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, Math.trunc(value)));

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

const encodeBase64Bytes = (bytes: Uint8Array): string => {
  if (bytes.length === 0) return "";
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  if (typeof globalThis.btoa === "function") {
    let binary = "";
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.subarray(index, index + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return globalThis.btoa(binary);
  }
  throw new Error("No base64 encoder available");
};

const decodeBase64Bytes = (value: string): Uint8Array | null => {
  if (!value) return new Uint8Array();
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }
  if (typeof globalThis.atob === "function") {
    const binary = globalThis.atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }
  return null;
};

const pushVarUint = (target: number[], value: number) => {
  let remaining = Math.max(0, Math.trunc(value));
  do {
    let nextByte = remaining & 0x7f;
    remaining >>>= 7;
    if (remaining > 0) {
      nextByte |= 0x80;
    }
    target.push(nextByte);
  } while (remaining > 0);
};

const readVarUint = (
  bytes: Uint8Array,
  offset: number
): { value: number; nextOffset: number } | null => {
  let value = 0;
  let shift = 0;
  let nextOffset = offset;
  while (nextOffset < bytes.length) {
    const byte = bytes[nextOffset] ?? 0;
    nextOffset += 1;
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      return { value, nextOffset };
    }
    shift += 7;
    if (shift > 28) return null;
  }
  return null;
};

const encodeAlphaRle = (alpha: Uint8Array): Uint8Array => {
  if (alpha.length === 0) return new Uint8Array();
  const encoded: number[] = [];
  let runValue = alpha[0] ?? 0;
  let runLength = 1;
  for (let index = 1; index < alpha.length; index += 1) {
    const cell = alpha[index] ?? 0;
    if (cell === runValue) {
      runLength += 1;
      continue;
    }
    encoded.push(runValue);
    pushVarUint(encoded, runLength);
    runValue = cell;
    runLength = 1;
  }
  encoded.push(runValue);
  pushVarUint(encoded, runLength);
  return Uint8Array.from(encoded);
};

const decodeAlphaRle = (encoded: Uint8Array, expectedLength: number): Uint8ClampedArray | null => {
  const alpha = new Uint8ClampedArray(expectedLength);
  let encodedOffset = 0;
  let alphaOffset = 0;
  while (encodedOffset < encoded.length && alphaOffset < expectedLength) {
    const value = encoded[encodedOffset] ?? 0;
    encodedOffset += 1;
    const decodedRun = readVarUint(encoded, encodedOffset);
    if (!decodedRun || decodedRun.value <= 0 || alphaOffset + decodedRun.value > expectedLength) {
      return null;
    }
    alpha.fill(value, alphaOffset, alphaOffset + decodedRun.value);
    alphaOffset += decodedRun.value;
    encodedOffset = decodedRun.nextOffset;
  }
  if (encodedOffset !== encoded.length || alphaOffset !== expectedLength) {
    return null;
  }
  return alpha;
};

const resolveMaskBounds = (
  alpha: Uint8ClampedArray,
  width: number,
  height: number
): AiStudioSessionSerializedInpaintMaskBounds | null => {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if ((alpha[y * width + x] ?? 0) <= 0) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return {
    x: minX,
    y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
};

const cropMaskAlphaToBounds = ({
  alpha,
  width,
  bounds,
}: {
  alpha: Uint8ClampedArray;
  width: number;
  bounds: AiStudioSessionSerializedInpaintMaskBounds;
}) => {
  const cropped = new Uint8ClampedArray(bounds.width * bounds.height);
  for (let row = 0; row < bounds.height; row += 1) {
    const sourceOffset = (bounds.y + row) * width + bounds.x;
    const targetOffset = row * bounds.width;
    cropped.set(alpha.subarray(sourceOffset, sourceOffset + bounds.width), targetOffset);
  }
  return cropped;
};

const insertAlphaCrop = ({
  target,
  width,
  bounds,
  cropped,
}: {
  target: Uint8ClampedArray;
  width: number;
  bounds: AiStudioSessionSerializedInpaintMaskBounds;
  cropped: Uint8ClampedArray;
}) => {
  for (let row = 0; row < bounds.height; row += 1) {
    const sourceOffset = row * bounds.width;
    const targetOffset = (bounds.y + row) * width + bounds.x;
    target.set(cropped.subarray(sourceOffset, sourceOffset + bounds.width), targetOffset);
  }
};

const parseMaskBounds = (
  value: unknown,
  width: number,
  height: number
): AiStudioSessionSerializedInpaintMaskBounds | null => {
  const row = asRecord(value);
  if (!row) return null;
  const x = clampInteger(asFiniteNumber(row.x, 0), 0, Math.max(0, width - 1));
  const y = clampInteger(asFiniteNumber(row.y, 0), 0, Math.max(0, height - 1));
  const maxWidth = Math.max(0, width - x);
  const maxHeight = Math.max(0, height - y);
  const parsedWidth = clampInteger(asFiniteNumber(row.width, 0), 0, maxWidth);
  const parsedHeight = clampInteger(asFiniteNumber(row.height, 0), 0, maxHeight);
  if (parsedWidth <= 0 || parsedHeight <= 0) return null;
  return {
    x,
    y,
    width: parsedWidth,
    height: parsedHeight,
  };
};

const parseLegacyAlphaRecord = (value: Record<string, unknown>): Uint8ClampedArray | null => {
  const numericKeys = Object.keys(value)
    .filter((key) => /^\d+$/.test(key))
    .sort((left, right) => Number(left) - Number(right));
  if (numericKeys.length === 0) return null;
  const alpha = new Uint8ClampedArray(numericKeys.length);
  numericKeys.forEach((key, index) => {
    alpha[index] = clampInteger(asFiniteNumber(value[key], 0), 0, 255);
  });
  return alpha;
};

const normalizeAlphaLength = (alpha: Uint8ClampedArray, expectedLength: number) => {
  if (alpha.length === expectedLength) return alpha;
  const normalized = new Uint8ClampedArray(expectedLength);
  normalized.set(alpha.subarray(0, expectedLength));
  return normalized;
};

const parseSerializedAlpha = ({
  value,
  width,
  height,
  boundsValue,
}: {
  value: unknown;
  width: number;
  height: number;
  boundsValue?: unknown;
}): Uint8ClampedArray => {
  const expectedLength = Math.max(0, width * height);
  if (expectedLength === 0) return new Uint8ClampedArray();
  if (value instanceof Uint8ClampedArray) {
    return normalizeAlphaLength(new Uint8ClampedArray(value), expectedLength);
  }
  if (Array.isArray(value)) {
    return normalizeAlphaLength(
      new Uint8ClampedArray(value.map((cell) => clampInteger(asFiniteNumber(cell, 0), 0, 255))),
      expectedLength
    );
  }
  const row = asRecord(value);
  if (!row) return new Uint8ClampedArray();
  const encoding = asString(row.encoding, "");
  if (
    encoding === EXPERT_EDIT_INPAINT_ALPHA_RAW_ENCODING ||
    encoding === EXPERT_EDIT_INPAINT_ALPHA_RLE_ENCODING
  ) {
    const bounds = parseMaskBounds(boundsValue, width, height) ??
      parseMaskBounds(row.bounds, width, height) ?? {
        x: 0,
        y: 0,
        width,
        height,
      };
    const encodedBytes = decodeBase64Bytes(asString(row.data, ""));
    if (!encodedBytes) return new Uint8ClampedArray();
    const cropLength = bounds.width * bounds.height;
    const croppedAlpha =
      encoding === EXPERT_EDIT_INPAINT_ALPHA_RLE_ENCODING
        ? decodeAlphaRle(encodedBytes, cropLength)
        : encodedBytes.length === cropLength
          ? new Uint8ClampedArray(encodedBytes)
          : null;
    if (!croppedAlpha) return new Uint8ClampedArray();
    const alpha = new Uint8ClampedArray(expectedLength);
    insertAlphaCrop({
      target: alpha,
      width,
      bounds,
      cropped: croppedAlpha,
    });
    return normalizeAlphaLength(alpha, expectedLength);
  }
  return normalizeAlphaLength(
    parseLegacyAlphaRecord(row) ?? new Uint8ClampedArray(),
    expectedLength
  );
};

const serializeInpaintSnapshot = (
  snapshot: ExpertEditSessionState["inpaint"]["snapshot"]
): AiStudioSessionSerializedExpertEditState["inpaint"]["snapshot"] => {
  const layers: AiStudioSessionSerializedExpertEditState["inpaint"]["snapshot"]["layers"] = [];
  snapshot.layers.forEach((layer) => {
    const width = Math.max(0, Math.trunc(layer.width));
    const height = Math.max(0, Math.trunc(layer.height));
    if (!layer.layerId || width <= 0 || height <= 0 || layer.alpha.length === 0) {
      return;
    }
    const bounds = resolveMaskBounds(layer.alpha, width, height);
    if (!bounds) return;
    const croppedAlpha = cropMaskAlphaToBounds({
      alpha: layer.alpha,
      width,
      bounds,
    });
    const rawBytes = Uint8Array.from(croppedAlpha);
    const rleBytes = encodeAlphaRle(rawBytes);
    const useRle = rleBytes.length < rawBytes.length;
    layers.push({
      layerId: layer.layerId,
      width,
      height,
      bounds,
      alpha: {
        encoding: useRle
          ? EXPERT_EDIT_INPAINT_ALPHA_RLE_ENCODING
          : EXPERT_EDIT_INPAINT_ALPHA_RAW_ENCODING,
        data: encodeBase64Bytes(useRle ? rleBytes : rawBytes),
      },
    });
  });
  return { layers };
};

export const serializeAiStudioSessionExpertEditState = (
  state: ExpertEditSessionState
): AiStudioSessionExpertEditSnapshot => ({
  schemaVersion: 2,
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
      snapshot: serializeInpaintSnapshot(state.inpaint.snapshot),
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
        const width = Math.max(0, Math.trunc(asFiniteNumber(layerRow.width, 0)));
        const height = Math.max(0, Math.trunc(asFiniteNumber(layerRow.height, 0)));
        const alpha = parseSerializedAlpha({
          value: layerRow.alpha,
          width,
          height,
          boundsValue: layerRow.bounds,
        });
        return {
          layerId: asString(layerRow.layerId, ""),
          width,
          height,
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
