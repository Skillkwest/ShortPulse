/**
 * AI Studio canvas session snapshot contracts and serializers.
 * Encodes dual-canvas scene + viewport + transient edit state for durable session persistence.
 */
import type { CanvasCamera, CanvasSceneItem } from "../components/canvas/canvasTypes";
import {
  CANVAS_AUDIO_ITEM_HEIGHT,
  CANVAS_AUDIO_ITEM_WIDTH,
  CANVAS_TEXT_ITEM_MIN_HEIGHT,
} from "../components/canvas/canvasGeometry";
import type {
  CanvasDraftTextEntry,
  CanvasTextEditSession,
} from "../components/canvas/canvasSceneState";
import type { CanvasWorkspaceInstanceId } from "../components/canvas/canvasWorkspaceContracts";
import type { ReferenceDragSourceSurface } from "../utils/dragDrop";

export const AI_STUDIO_CANVAS_ITEM_HARD_CAP = 300;
export const AI_STUDIO_SESSION_MAX_SNAPSHOT_BYTES = 900_000;

const CANVAS_MIN_ZOOM = 0.2;
const CANVAS_MAX_ZOOM = 2.5;
const MAX_TEXT_VALUE_LENGTH = 4_000;

const REFERENCE_SOURCE_SURFACES = new Set<ReferenceDragSourceSurface>(["all-refs", "curated"]);

type CanvasSceneItemSnapshotV1 =
  | {
      id: string;
      kind: "image";
      x: number;
      y: number;
      z: number;
      selected: boolean;
      outputId: string | null;
      sourceSurface: ReferenceDragSourceSurface | null;
      mediaId: string | null;
      src: string;
      alt: string;
      width: number;
      height: number;
    }
  | {
      id: string;
      kind: "audio";
      x: number;
      y: number;
      z: number;
      selected: boolean;
      outputId: string | null;
      sourceSurface: ReferenceDragSourceSurface | null;
      mediaId: string | null;
      audioUrl: string;
      title: string | null;
      durationMs: number | null;
      waveformPeaks: number[] | null;
      width: number;
      height: number;
    }
  | {
      id: string;
      kind: "text";
      x: number;
      y: number;
      z: number;
      selected: boolean;
      outputId: string | null;
      sourceSurface: ReferenceDragSourceSurface | null;
      text: string;
      width: number;
      height: number;
    };

export type AiStudioSessionCanvasSnapshotV1 = {
  scene: {
    items: CanvasSceneItemSnapshotV1[];
  };
  viewports: {
    main: CanvasCamera;
    rail: CanvasCamera;
  };
  transient: {
    draftTextEntry: CanvasDraftTextEntry | null;
    textEditSession: CanvasTextEditSession | null;
    draftOwnerInstanceId: CanvasWorkspaceInstanceId | null;
    textEditOwnerInstanceId: CanvasWorkspaceInstanceId | null;
  };
  meta: {
    schemaVersion: 1;
    itemCount: number;
    truncatedItemCount: number;
    skippedNonDurableImageCount: number;
  };
};

export type AiStudioSessionCanvasState = {
  items: CanvasSceneItem[];
  draftTextEntry: CanvasDraftTextEntry | null;
  textEditSession: CanvasTextEditSession | null;
  draftOwnerInstanceId: CanvasWorkspaceInstanceId | null;
  textEditOwnerInstanceId: CanvasWorkspaceInstanceId | null;
  mainCamera: CanvasCamera;
  railCamera: CanvasCamera;
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

const asNullableString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
};

const asNullableFiniteNumber = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
};

const asString = (value: unknown, fallback = ""): string => {
  if (typeof value !== "string") return fallback;
  return value;
};

const clampZoom = (value: number): number =>
  Math.min(CANVAS_MAX_ZOOM, Math.max(CANVAS_MIN_ZOOM, value));

const asCamera = (value: unknown): CanvasCamera => {
  const record = asRecord(value);
  if (!record) {
    return { x: 0, y: 0, zoom: 1 };
  }
  return {
    x: Math.round(asFiniteNumber(record.x, 0) * 100) / 100,
    y: Math.round(asFiniteNumber(record.y, 0) * 100) / 100,
    zoom: Math.round(clampZoom(asFiniteNumber(record.zoom, 1)) * 1000) / 1000,
  };
};

const normalizeSourceSurface = (value: unknown): ReferenceDragSourceSurface | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!REFERENCE_SOURCE_SURFACES.has(normalized as ReferenceDragSourceSurface)) return null;
  return normalized as ReferenceDragSourceSurface;
};

const sanitizeCanvasText = (value: unknown): string => {
  if (typeof value !== "string") return "";
  if (value.length <= MAX_TEXT_VALUE_LENGTH) return value;
  return value.slice(0, MAX_TEXT_VALUE_LENGTH);
};

const sanitizeWaveformPeaks = (value: unknown): number[] | null => {
  if (!Array.isArray(value) || value.length === 0) return null;
  const peaks = value.filter(
    (entry): entry is number => typeof entry === "number" && Number.isFinite(entry)
  );
  return peaks.length > 0 ? peaks : null;
};

const isDurableCanvasMediaSource = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("blob:") || trimmed.startsWith("data:")) return false;
  return true;
};

const sortCanvasItemsForCap = (items: CanvasSceneItem[]): CanvasSceneItem[] =>
  [...items].sort((left, right) => {
    if (left.z !== right.z) return left.z - right.z;
    return left.id.localeCompare(right.id);
  });

/**
 * Applies the hard item cap to canvas scene items using deterministic z-order trimming.
 */
export const clampCanvasSceneItemsToHardCap = (items: CanvasSceneItem[]): CanvasSceneItem[] => {
  if (items.length <= AI_STUDIO_CANVAS_ITEM_HARD_CAP) return items;
  return sortCanvasItemsForCap(items).slice(-AI_STUDIO_CANVAS_ITEM_HARD_CAP);
};

const sanitizeCanvasSceneItem = (
  value: CanvasSceneItem
): { item: CanvasSceneItem | null; skippedNonDurableImage: boolean } => {
  if (value.kind === "image") {
    const src = asString(value.src, "").trim();
    if (!isDurableCanvasMediaSource(src)) {
      return {
        item: null,
        skippedNonDurableImage: true,
      };
    }
    const width = Math.max(1, Math.round(asFiniteNumber(value.width, 1) * 100) / 100);
    const height = Math.max(1, Math.round(asFiniteNumber(value.height, 1) * 100) / 100);
    return {
      item: {
        id: value.id,
        kind: "image",
        x: Math.round(asFiniteNumber(value.x, 0) * 100) / 100,
        y: Math.round(asFiniteNumber(value.y, 0) * 100) / 100,
        z: Math.trunc(asFiniteNumber(value.z, 0)),
        selected: Boolean(value.selected),
        outputId: asNullableString(value.outputId),
        sourceSurface: normalizeSourceSurface(value.sourceSurface),
        mediaId: asNullableString(value.mediaId),
        src,
        alt: asString(value.alt, ""),
        width,
        height,
      },
      skippedNonDurableImage: false,
    };
  }

  if (value.kind === "audio") {
    const audioUrl = asString(value.audioUrl, "").trim();
    if (!isDurableCanvasMediaSource(audioUrl)) {
      return {
        item: null,
        skippedNonDurableImage: true,
      };
    }
    const width = Math.max(
      1,
      Math.round(asFiniteNumber(value.width, CANVAS_AUDIO_ITEM_WIDTH) * 100) / 100
    );
    const height = Math.max(
      1,
      Math.round(asFiniteNumber(value.height, CANVAS_AUDIO_ITEM_HEIGHT) * 100) / 100
    );
    return {
      item: {
        id: value.id,
        kind: "audio",
        x: Math.round(asFiniteNumber(value.x, 0) * 100) / 100,
        y: Math.round(asFiniteNumber(value.y, 0) * 100) / 100,
        z: Math.trunc(asFiniteNumber(value.z, 0)),
        selected: Boolean(value.selected),
        outputId: asNullableString(value.outputId),
        sourceSurface: normalizeSourceSurface(value.sourceSurface),
        mediaId: asNullableString(value.mediaId),
        audioUrl,
        title: asNullableString(value.title),
        durationMs:
          typeof value.durationMs === "number" && Number.isFinite(value.durationMs)
            ? Math.max(0, Math.round(value.durationMs))
            : null,
        waveformPeaks: sanitizeWaveformPeaks(value.waveformPeaks),
        width,
        height,
      },
      skippedNonDurableImage: false,
    };
  }

  return {
    item: {
      id: value.id,
      kind: "text",
      x: Math.round(asFiniteNumber(value.x, 0) * 100) / 100,
      y: Math.round(asFiniteNumber(value.y, 0) * 100) / 100,
      z: Math.trunc(asFiniteNumber(value.z, 0)),
      selected: Boolean(value.selected),
      outputId: asNullableString(value.outputId),
      sourceSurface: normalizeSourceSurface(value.sourceSurface),
      text: sanitizeCanvasText(value.text),
      width: Math.max(1, Math.round(asFiniteNumber(value.width, 260) * 100) / 100),
      height: Math.max(
        1,
        Math.round(asFiniteNumber(value.height, CANVAS_TEXT_ITEM_MIN_HEIGHT) * 100) / 100
      ),
    },
    skippedNonDurableImage: false,
  };
};

const sanitizeCanvasSnapshotItems = (
  items: CanvasSceneItem[]
): {
  items: CanvasSceneItem[];
  truncatedItemCount: number;
  skippedNonDurableImageCount: number;
} => {
  const sanitized: CanvasSceneItem[] = [];
  let skippedNonDurableImageCount = 0;
  items.forEach((item) => {
    if (!item.id) return;
    const result = sanitizeCanvasSceneItem(item);
    if (result.skippedNonDurableImage) {
      skippedNonDurableImageCount += 1;
    }
    if (!result.item) return;
    sanitized.push(result.item);
  });
  const capped = clampCanvasSceneItemsToHardCap(sanitized);
  return {
    items: capped,
    truncatedItemCount: Math.max(0, sanitized.length - capped.length),
    skippedNonDurableImageCount,
  };
};

const toSnapshotSceneItems = (items: CanvasSceneItem[]): CanvasSceneItemSnapshotV1[] =>
  items.map((item) =>
    item.kind === "image"
      ? {
          id: item.id,
          kind: "image",
          x: item.x,
          y: item.y,
          z: item.z,
          selected: item.selected,
          outputId: item.outputId,
          sourceSurface: item.sourceSurface ?? null,
          mediaId: item.mediaId,
          src: item.src,
          alt: item.alt,
          width: item.width,
          height: item.height,
        }
      : item.kind === "audio"
        ? {
            id: item.id,
            kind: "audio",
            x: item.x,
            y: item.y,
            z: item.z,
            selected: item.selected,
            outputId: item.outputId,
            sourceSurface: item.sourceSurface ?? null,
            mediaId: item.mediaId,
            audioUrl: item.audioUrl,
            title: item.title ?? null,
            durationMs: item.durationMs ?? null,
            waveformPeaks: item.waveformPeaks ?? null,
            width: item.width,
            height: item.height,
          }
        : {
            id: item.id,
            kind: "text",
            x: item.x,
            y: item.y,
            z: item.z,
            selected: item.selected,
            outputId: item.outputId,
            sourceSurface: item.sourceSurface ?? null,
            text: item.text,
            width: item.width,
            height: item.height ?? CANVAS_TEXT_ITEM_MIN_HEIGHT,
          }
  );

/**
 * Serializes dual-canvas state into a durable, capped session payload.
 */
export const serializeAiStudioSessionCanvasState = (
  state: AiStudioSessionCanvasState
): AiStudioSessionCanvasSnapshotV1 => {
  const sanitized = sanitizeCanvasSnapshotItems(state.items);
  const itemIdSet = new Set<string>(sanitized.items.map((item) => item.id));
  const sanitizedTextEditSession =
    state.textEditSession && itemIdSet.has(state.textEditSession.itemId)
      ? {
          itemId: state.textEditSession.itemId,
          value: sanitizeCanvasText(state.textEditSession.value),
        }
      : null;
  const sanitizedDraftTextEntry = state.draftTextEntry
    ? {
        x: Math.round(asFiniteNumber(state.draftTextEntry.x, 0) * 100) / 100,
        y: Math.round(asFiniteNumber(state.draftTextEntry.y, 0) * 100) / 100,
        value: sanitizeCanvasText(state.draftTextEntry.value),
      }
    : null;

  return {
    scene: {
      items: toSnapshotSceneItems(sanitized.items),
    },
    viewports: {
      main: asCamera(state.mainCamera),
      rail: asCamera(state.railCamera),
    },
    transient: {
      draftTextEntry: sanitizedDraftTextEntry,
      textEditSession: sanitizedTextEditSession,
      draftOwnerInstanceId: sanitizedDraftTextEntry ? state.draftOwnerInstanceId : null,
      textEditOwnerInstanceId: sanitizedTextEditSession ? state.textEditOwnerInstanceId : null,
    },
    meta: {
      schemaVersion: 1,
      itemCount: sanitized.items.length,
      truncatedItemCount: sanitized.truncatedItemCount,
      skippedNonDurableImageCount: sanitized.skippedNonDurableImageCount,
    },
  };
};

const parseCanvasSceneItems = (value: unknown): CanvasSceneItem[] => {
  if (!Array.isArray(value)) return [];

  const parsed: CanvasSceneItem[] = [];
  value.forEach((entry) => {
    const record = asRecord(entry);
    if (!record) return;
    const id = asNullableString(record.id);
    if (!id) return;
    const kind = record.kind;
    if (kind === "image") {
      const src = asString(record.src, "").trim();
      if (!isDurableCanvasMediaSource(src)) return;
      parsed.push({
        id,
        kind: "image",
        x: Math.round(asFiniteNumber(record.x, 0) * 100) / 100,
        y: Math.round(asFiniteNumber(record.y, 0) * 100) / 100,
        z: Math.trunc(asFiniteNumber(record.z, 0)),
        selected: asBoolean(record.selected),
        outputId: asNullableString(record.outputId),
        sourceSurface: normalizeSourceSurface(record.sourceSurface),
        mediaId: asNullableString(record.mediaId),
        src,
        alt: asString(record.alt, ""),
        width: Math.max(1, Math.round(asFiniteNumber(record.width, 220) * 100) / 100),
        height: Math.max(1, Math.round(asFiniteNumber(record.height, 275) * 100) / 100),
      });
      return;
    }
    if (kind === "audio") {
      const audioUrl = asString(record.audioUrl, "").trim();
      if (!isDurableCanvasMediaSource(audioUrl)) return;
      const durationMs = asNullableFiniteNumber(record.durationMs);
      parsed.push({
        id,
        kind: "audio",
        x: Math.round(asFiniteNumber(record.x, 0) * 100) / 100,
        y: Math.round(asFiniteNumber(record.y, 0) * 100) / 100,
        z: Math.trunc(asFiniteNumber(record.z, 0)),
        selected: asBoolean(record.selected),
        outputId: asNullableString(record.outputId),
        sourceSurface: normalizeSourceSurface(record.sourceSurface),
        mediaId: asNullableString(record.mediaId),
        audioUrl,
        title: asNullableString(record.title),
        durationMs: durationMs === null ? null : Math.max(0, Math.round(durationMs)),
        waveformPeaks: sanitizeWaveformPeaks(record.waveformPeaks),
        width: Math.max(
          1,
          Math.round(asFiniteNumber(record.width, CANVAS_AUDIO_ITEM_WIDTH) * 100) / 100
        ),
        height: Math.max(
          1,
          Math.round(asFiniteNumber(record.height, CANVAS_AUDIO_ITEM_HEIGHT) * 100) / 100
        ),
      });
      return;
    }
    if (kind === "text") {
      parsed.push({
        id,
        kind: "text",
        x: Math.round(asFiniteNumber(record.x, 0) * 100) / 100,
        y: Math.round(asFiniteNumber(record.y, 0) * 100) / 100,
        z: Math.trunc(asFiniteNumber(record.z, 0)),
        selected: asBoolean(record.selected),
        outputId: asNullableString(record.outputId),
        sourceSurface: normalizeSourceSurface(record.sourceSurface),
        text: sanitizeCanvasText(record.text),
        width: Math.max(1, Math.round(asFiniteNumber(record.width, 260) * 100) / 100),
        height: Math.max(
          1,
          Math.round(asFiniteNumber(record.height, CANVAS_TEXT_ITEM_MIN_HEIGHT) * 100) / 100
        ),
      });
    }
  });

  return clampCanvasSceneItemsToHardCap(parsed);
};

const parseOwnerInstanceId = (value: unknown): CanvasWorkspaceInstanceId | null => {
  return value === "main" || value === "rail" ? value : null;
};

/**
 * Parses a persisted canvas payload into normalized dual-canvas state.
 */
export const parseAiStudioSessionCanvasState = (
  value: unknown
): AiStudioSessionCanvasState | null => {
  const root = asRecord(value);
  if (!root) return null;

  const scene = asRecord(root.scene);
  const viewports = asRecord(root.viewports);
  const transient = asRecord(root.transient);

  const items = parseCanvasSceneItems(scene?.items ?? null);
  const itemIdSet = new Set(items.map((item) => item.id));
  const textItemIdSet = new Set(
    items.filter((item) => item.kind === "text").map((item) => item.id)
  );

  const draftRecord = asRecord(transient?.draftTextEntry);
  const draftTextEntry: CanvasDraftTextEntry | null = draftRecord
    ? {
        x: Math.round(asFiniteNumber(draftRecord.x, 0) * 100) / 100,
        y: Math.round(asFiniteNumber(draftRecord.y, 0) * 100) / 100,
        value: sanitizeCanvasText(draftRecord.value),
      }
    : null;

  const editRecord = asRecord(transient?.textEditSession);
  const editItemId = asNullableString(editRecord?.itemId);
  const textEditSession: CanvasTextEditSession | null =
    editRecord && editItemId && textItemIdSet.has(editItemId)
      ? {
          itemId: editItemId,
          value: sanitizeCanvasText(editRecord.value),
        }
      : null;

  const draftOwnerInstanceId = draftTextEntry
    ? parseOwnerInstanceId(transient?.draftOwnerInstanceId)
    : null;
  const textEditOwnerInstanceId = textEditSession
    ? parseOwnerInstanceId(transient?.textEditOwnerInstanceId)
    : null;

  // Defensive dedupe by id so partially corrupt payloads cannot cause duplicate key collisions.
  const dedupedItems = items.filter((item, index) => {
    if (!itemIdSet.has(item.id)) return false;
    const firstIndex = items.findIndex((candidate) => candidate.id === item.id);
    return firstIndex === index;
  });

  return {
    items: dedupedItems,
    draftTextEntry,
    textEditSession,
    draftOwnerInstanceId,
    textEditOwnerInstanceId,
    mainCamera: asCamera(viewports?.main),
    railCamera: asCamera(viewports?.rail),
  };
};
