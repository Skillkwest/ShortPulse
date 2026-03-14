/**
 * Media Library custom-folder canvas snapshot contracts and adapters.
 */
import { CANVAS_DEFAULT_CAMERA } from "../components/canvas/canvasGeometry";
import type { CanvasCamera, CanvasSceneItem } from "../components/canvas/canvasTypes";
import { resolveMediaCardAspectRatio } from "./mediaLibraryAspectRatio";
import type { MediaFileRow, PromptRow } from "./mediaLibraryModalModel";

export const MEDIA_FOLDER_CANVAS_SCHEMA_VERSION = 1;
const PROMPT_OUTPUT_ID_PREFIX = "prompt:";
const DEFAULT_TEXT_WIDTH = 260;
const DEFAULT_MEDIA_WIDTH = 280;
const MAX_TEXT_LENGTH = 4000;

type FolderCanvasSnapshotItem =
  | {
      id: string;
      kind: "image";
      mediaId: string | null;
      src: string;
      alt: string;
      x: number;
      y: number;
      z: number;
      width: number;
      height: number;
      selected?: boolean;
    }
  | {
      id: string;
      kind: "text";
      promptId: string | null;
      text: string;
      x: number;
      y: number;
      z: number;
      width: number;
      selected?: boolean;
    };

export type MediaFolderCanvasSnapshotV1 = {
  schemaVersion: 1;
  camera: CanvasCamera;
  items: FolderCanvasSnapshotItem[];
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
};

const asString = (value: unknown, fallback = ""): string => {
  if (typeof value !== "string") return fallback;
  return value;
};

const asFinite = (value: unknown, fallback = 0): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return value;
};

const normalizeItemId = (value: unknown): string => {
  const id = asString(value).trim();
  return id || crypto.randomUUID();
};

const normalizePromptText = (value: unknown): string => {
  const text = asString(value).trim();
  if (!text) return "";
  if (text.length <= MAX_TEXT_LENGTH) return text;
  return text.slice(0, MAX_TEXT_LENGTH);
};

const normalizeCamera = (value: unknown): CanvasCamera => {
  const record = asRecord(value);
  if (!record) return CANVAS_DEFAULT_CAMERA;
  return {
    x: Math.round(asFinite(record.x, CANVAS_DEFAULT_CAMERA.x) * 100) / 100,
    y: Math.round(asFinite(record.y, CANVAS_DEFAULT_CAMERA.y) * 100) / 100,
    zoom: Math.round(Math.min(2.5, Math.max(0.2, asFinite(record.zoom, 1))) * 1000) / 1000,
  };
};

const toPromptOutputId = (promptId: string | null | undefined): string | null => {
  const normalized = (promptId ?? "").trim();
  if (!normalized) return null;
  return `${PROMPT_OUTPUT_ID_PREFIX}${normalized}`;
};

export const getPromptIdFromCanvasOutputId = (value: string | null | undefined): string | null => {
  const normalized = (value ?? "").trim();
  if (!normalized.startsWith(PROMPT_OUTPUT_ID_PREFIX)) return null;
  const promptId = normalized.slice(PROMPT_OUTPUT_ID_PREFIX.length).trim();
  return promptId || null;
};

export const isFolderCanvasMembershipItemId = (itemId: string): boolean =>
  itemId.startsWith("media:") || itemId.startsWith("prompt:");

const toCanvasSceneItem = (item: FolderCanvasSnapshotItem): CanvasSceneItem | null => {
  if (item.kind === "image") {
    const src = item.src.trim();
    if (!src) return null;
    return {
      id: normalizeItemId(item.id),
      kind: "image",
      x: item.x,
      y: item.y,
      z: item.z,
      selected: item.selected === true,
      outputId: null,
      sourceSurface: null,
      mediaId: item.mediaId,
      src,
      alt: item.alt,
      width: Math.max(40, asFinite(item.width, DEFAULT_MEDIA_WIDTH)),
      height: Math.max(40, asFinite(item.height, DEFAULT_MEDIA_WIDTH)),
    };
  }
  const text = normalizePromptText(item.text);
  if (!text) return null;
  return {
    id: normalizeItemId(item.id),
    kind: "text",
    x: item.x,
    y: item.y,
    z: item.z,
    selected: item.selected === true,
    outputId: toPromptOutputId(item.promptId),
    sourceSurface: null,
    text,
    width: Math.max(140, asFinite(item.width, DEFAULT_TEXT_WIDTH)),
  };
};

const toSnapshotItem = (item: CanvasSceneItem): FolderCanvasSnapshotItem => {
  if (item.kind === "image") {
    return {
      id: item.id,
      kind: "image",
      mediaId: item.mediaId,
      src: item.src,
      alt: item.alt,
      x: item.x,
      y: item.y,
      z: item.z,
      width: item.width,
      height: item.height,
      selected: item.selected,
    };
  }
  return {
    id: item.id,
    kind: "text",
    promptId: getPromptIdFromCanvasOutputId(item.outputId),
    text: item.text,
    x: item.x,
    y: item.y,
    z: item.z,
    width: item.width,
    selected: item.selected,
  };
};

const normalizeSnapshotItems = (value: unknown): CanvasSceneItem[] => {
  if (!Array.isArray(value)) return [];
  const items: CanvasSceneItem[] = [];
  for (const entry of value) {
    const row = asRecord(entry);
    if (!row) continue;
    const kind = asString(row.kind).trim().toLowerCase();
    if (kind === "image") {
      const item = toCanvasSceneItem({
        id: normalizeItemId(row.id),
        kind: "image",
        mediaId: asString(row.mediaId).trim() || null,
        src: asString(row.src),
        alt: asString(row.alt),
        x: asFinite(row.x),
        y: asFinite(row.y),
        z: Math.trunc(asFinite(row.z)),
        width: asFinite(row.width, DEFAULT_MEDIA_WIDTH),
        height: asFinite(row.height, DEFAULT_MEDIA_WIDTH),
        selected: row.selected === true,
      });
      if (item) items.push(item);
      continue;
    }
    if (kind !== "text") continue;
    const item = toCanvasSceneItem({
      id: normalizeItemId(row.id),
      kind: "text",
      promptId:
        asString(row.promptId).trim() || getPromptIdFromCanvasOutputId(asString(row.outputId)),
      text: asString(row.text),
      x: asFinite(row.x),
      y: asFinite(row.y),
      z: Math.trunc(asFinite(row.z)),
      width: asFinite(row.width, DEFAULT_TEXT_WIDTH),
      selected: row.selected === true,
    });
    if (item) items.push(item);
  }
  return items;
};

export const parseMediaFolderCanvasSnapshot = (
  value: unknown
): { camera: CanvasCamera; items: CanvasSceneItem[] } | null => {
  const row = asRecord(value);
  if (!row) return null;
  const schemaVersion = Number(row.schemaVersion);
  if (
    !Number.isFinite(schemaVersion) ||
    Math.trunc(schemaVersion) !== MEDIA_FOLDER_CANVAS_SCHEMA_VERSION
  ) {
    return null;
  }
  return {
    camera: normalizeCamera(row.camera),
    items: normalizeSnapshotItems(row.items),
  };
};

export const buildMediaFolderCanvasSnapshot = ({
  camera,
  items,
}: {
  camera: CanvasCamera;
  items: CanvasSceneItem[];
}): MediaFolderCanvasSnapshotV1 => ({
  schemaVersion: MEDIA_FOLDER_CANVAS_SCHEMA_VERSION,
  camera: normalizeCamera(camera),
  items: items.map((item) => toSnapshotItem(item)),
});

export const buildSeedItemsForFolderCanvas = ({
  mediaRows,
  promptRows,
}: {
  mediaRows: MediaFileRow[];
  promptRows: PromptRow[];
}): CanvasSceneItem[] => {
  const items: CanvasSceneItem[] = [];
  let z = 1;
  const columns = 4;
  const xGap = 320;
  const yGap = 220;

  mediaRows.forEach((media, index) => {
    const src = (media.signedUrl ?? "").trim();
    if (!src) return;
    const x = (index % columns) * xGap;
    const y = Math.floor(index / columns) * yGap;
    const aspect = resolveMediaCardAspectRatio({
      fileType: media.file_type,
      width: media.width,
      height: media.height,
      metadata: media.metadata,
    });
    const width = DEFAULT_MEDIA_WIDTH;
    const height = Math.max(120, Math.round(width / Math.max(0.2, aspect)));
    items.push({
      id: `media:${media.id}`,
      kind: "image",
      x,
      y,
      z,
      selected: false,
      outputId: null,
      sourceSurface: null,
      mediaId: media.id,
      src,
      alt: (media.filename || "Canvas media").trim(),
      width,
      height,
    });
    z += 1;
  });

  const baseRows = Math.ceil(Math.max(items.length, 1) / columns);
  promptRows.forEach((prompt, index) => {
    const x = (index % columns) * xGap;
    const y = (baseRows + Math.floor(index / columns)) * yGap;
    const text = prompt.prompt_text.trim();
    if (!text) return;
    items.push({
      id: `prompt:${prompt.id}`,
      kind: "text",
      x,
      y,
      z,
      selected: false,
      outputId: toPromptOutputId(prompt.id),
      sourceSurface: null,
      text,
      width: DEFAULT_TEXT_WIDTH,
    });
    z += 1;
  });

  return items;
};

export const reconcileFolderMembershipCanvasItems = ({
  items,
  mediaRows,
  promptRows,
}: {
  items: CanvasSceneItem[];
  mediaRows: MediaFileRow[];
  promptRows: PromptRow[];
}): CanvasSceneItem[] => {
  const mediaById = new Map(mediaRows.map((row) => [row.id, row]));
  const promptById = new Map(promptRows.map((row) => [row.id, row]));
  const normalized = items
    .map((item) => {
      if (item.kind === "image") {
        const mediaId = item.mediaId?.trim() || null;
        if (!mediaId) return item;
        const row = mediaById.get(mediaId);
        if (!row) return null;
        const src = (row.signedUrl ?? "").trim() || item.src;
        return {
          ...item,
          id: `media:${mediaId}`,
          src,
          alt: (row.filename || item.alt).trim(),
        };
      }
      const promptId = getPromptIdFromCanvasOutputId(item.outputId);
      if (!promptId) return item;
      const row = promptById.get(promptId);
      if (!row) return null;
      return {
        ...item,
        id: `prompt:${promptId}`,
        outputId: toPromptOutputId(promptId),
        text: row.prompt_text.trim() || item.text,
      };
    })
    .filter((item): item is CanvasSceneItem => Boolean(item));

  const next: CanvasSceneItem[] = [];
  const membershipIndexById = new Map<string, number>();
  normalized.forEach((item) => {
    if (isFolderCanvasMembershipItemId(item.id)) {
      const existingIndex = membershipIndexById.get(item.id);
      if (typeof existingIndex === "number") {
        const existing = next[existingIndex];
        if (item.z >= existing.z) {
          next[existingIndex] = item;
        }
        return;
      }
      membershipIndexById.set(item.id, next.length);
    }
    next.push(item);
  });

  const existingIds = new Set(next.map((item) => item.id));
  const existingZ = next.reduce((max, item) => Math.max(max, item.z), 0);
  let nextZ = existingZ + 1;

  mediaRows.forEach((row) => {
    const itemId = `media:${row.id}`;
    if (existingIds.has(itemId)) return;
    const src = (row.signedUrl ?? "").trim();
    if (!src) return;
    const aspect = resolveMediaCardAspectRatio({
      fileType: row.file_type,
      width: row.width,
      height: row.height,
      metadata: row.metadata,
    });
    const width = DEFAULT_MEDIA_WIDTH;
    next.push({
      id: itemId,
      kind: "image",
      x: 0,
      y: 0,
      z: nextZ,
      selected: false,
      outputId: null,
      sourceSurface: null,
      mediaId: row.id,
      src,
      alt: (row.filename || "Canvas media").trim(),
      width,
      height: Math.max(120, Math.round(width / Math.max(0.2, aspect))),
    });
    nextZ += 1;
  });

  promptRows.forEach((row) => {
    const itemId = `prompt:${row.id}`;
    if (existingIds.has(itemId)) return;
    const text = row.prompt_text.trim();
    if (!text) return;
    next.push({
      id: itemId,
      kind: "text",
      x: 0,
      y: 0,
      z: nextZ,
      selected: false,
      outputId: toPromptOutputId(row.id),
      sourceSurface: null,
      text,
      width: DEFAULT_TEXT_WIDTH,
    });
    nextZ += 1;
  });

  return next;
};
