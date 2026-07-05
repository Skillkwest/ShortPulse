/**
 * AI Studio autosave serialization helpers.
 * Prepares session snapshots for size checks, semantic dedupe, and optional transport reuse.
 */
import type { AiStudioSessionSnapshot } from "./sessionSnapshot";

export type PreparedAiStudioSessionAutosaveSnapshot = {
  hash: string | null;
  bytes: number;
  title: string | null;
  serializedJson?: string;
};

export const utf8ByteLength = (value: string): number => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  return value.length;
};

const computeAutosaveSemanticHash = (value: string): string => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const normalized = (hash >>> 0).toString(16).padStart(8, "0");
  return `fnv1a32:${normalized}`;
};

const stripVolatileSnapshotFields = (
  snapshot: AiStudioSessionSnapshot
): Record<string, unknown> => {
  const normalizedSnapshot = { ...snapshot } as Record<string, unknown>;
  delete normalizedSnapshot.updatedAt;

  const metaValue = normalizedSnapshot.meta;
  if (metaValue && typeof metaValue === "object" && !Array.isArray(metaValue)) {
    const normalizedMeta = { ...(metaValue as Record<string, unknown>) };
    delete normalizedMeta.generatedAt;
    delete normalizedMeta.checksum;
    if (Object.keys(normalizedMeta).length > 0) {
      normalizedSnapshot.meta = normalizedMeta;
    } else {
      delete normalizedSnapshot.meta;
    }
  }

  return normalizedSnapshot;
};

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const isTopLevelSerializedPropertyAt = (serializedJson: string, startIndex: number): boolean => {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < startIndex; index += 1) {
    const char = serializedJson[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }
    if (char === '"') {
      inString = true;
    } else if (char === "{" || char === "[") {
      depth += 1;
    } else if (char === "}" || char === "]") {
      depth -= 1;
    }
  }
  const previousChar = serializedJson[startIndex - 1];
  return depth === 1 && (previousChar === "{" || previousChar === ",");
};

const removeTopLevelSerializedProperty = (
  serializedJson: string,
  key: string,
  value: unknown
): string | null => {
  const serializedValue = JSON.stringify(value);
  if (typeof serializedValue !== "string") return serializedJson;
  const propertyJson = `${JSON.stringify(key)}:${serializedValue}`;
  let searchIndex = 0;
  while (searchIndex < serializedJson.length) {
    const propertyStart = serializedJson.indexOf(propertyJson, searchIndex);
    if (propertyStart === -1) return null;
    if (!isTopLevelSerializedPropertyAt(serializedJson, propertyStart)) {
      searchIndex = propertyStart + propertyJson.length;
      continue;
    }
    const propertyEnd = propertyStart + propertyJson.length;
    if (serializedJson[propertyEnd] === ",") {
      return `${serializedJson.slice(0, propertyStart)}${serializedJson.slice(propertyEnd + 1)}`;
    }
    if (serializedJson[propertyStart - 1] === ",") {
      return `${serializedJson.slice(0, propertyStart - 1)}${serializedJson.slice(propertyEnd)}`;
    }
    return `${serializedJson.slice(0, propertyStart)}${serializedJson.slice(propertyEnd)}`;
  }
  return null;
};

const createSemanticJsonFromSerializedSnapshot = (
  snapshot: AiStudioSessionSnapshot,
  serializedJson: string
): string | null => {
  const snapshotRecord = snapshot as unknown as Record<string, unknown>;
  let semanticJson = serializedJson;

  if (Object.prototype.hasOwnProperty.call(snapshotRecord, "updatedAt")) {
    const withoutUpdatedAt = removeTopLevelSerializedProperty(
      semanticJson,
      "updatedAt",
      snapshotRecord.updatedAt
    );
    if (withoutUpdatedAt == null) return null;
    semanticJson = withoutUpdatedAt;
  }

  const metaValue = snapshotRecord.meta;
  if (isPlainRecord(metaValue)) {
    const hasOnlyVolatileMeta = Object.keys(metaValue).every(
      (key) => key === "generatedAt" || key === "checksum"
    );
    if (!hasOnlyVolatileMeta) return null;
    const withoutMeta = removeTopLevelSerializedProperty(semanticJson, "meta", metaValue);
    if (withoutMeta == null) return null;
    semanticJson = withoutMeta;
  }

  return semanticJson;
};

export const prepareAiStudioSessionAutosaveSnapshot = (
  snapshot: AiStudioSessionSnapshot,
  options?: {
    serializedJson?: string;
    includeSerializedJson?: boolean;
    title?: string | null;
  }
): PreparedAiStudioSessionAutosaveSnapshot => {
  try {
    const json = options?.serializedJson ?? JSON.stringify(snapshot);
    const semanticJson =
      createSemanticJsonFromSerializedSnapshot(snapshot, json) ??
      JSON.stringify(stripVolatileSnapshotFields(snapshot));
    return {
      hash: computeAutosaveSemanticHash(semanticJson),
      bytes: utf8ByteLength(json),
      title: options?.title ?? null,
      ...(options?.includeSerializedJson === true ? { serializedJson: json } : {}),
    };
  } catch {
    return {
      hash: null,
      bytes: Number.POSITIVE_INFINITY,
      title: options?.title ?? null,
    };
  }
};
