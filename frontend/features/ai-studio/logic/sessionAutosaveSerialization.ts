import type { AiStudioSessionSnapshot } from "./sessionSnapshot";

export type PreparedAiStudioSessionAutosaveSnapshot = {
  hash: string | null;
  bytes: number;
  title: string | null;
};

export const utf8ByteLength = (value: string): number => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).byteLength;
  }
  return value.length;
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

export const prepareAiStudioSessionAutosaveSnapshot = (
  snapshot: AiStudioSessionSnapshot,
  options?: {
    serializedJson?: string;
    title?: string | null;
  }
): PreparedAiStudioSessionAutosaveSnapshot => {
  try {
    const json = options?.serializedJson ?? JSON.stringify(snapshot);
    const semanticJson = JSON.stringify(stripVolatileSnapshotFields(snapshot));
    return {
      hash: semanticJson,
      bytes: utf8ByteLength(json),
      title: options?.title ?? null,
    };
  } catch {
    return {
      hash: null,
      bytes: Number.POSITIVE_INFINITY,
      title: options?.title ?? null,
    };
  }
};
