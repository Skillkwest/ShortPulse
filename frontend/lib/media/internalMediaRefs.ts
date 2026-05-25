/**
 * Canonical internal media reference helpers.
 * Keeps app-owned media identity stable across workspace persistence, replay, and submit seams.
 */

export const INTERNAL_MEDIA_REF_BUCKET = "media_library";

export type InternalMediaRefV1 = {
  version: 1;
  kind: "storage_object";
  bucket: string;
  storagePath: string;
};

export type InternalMediaRef = InternalMediaRefV1;

type JwtPayload = Record<string, unknown>;

const decodeBase64Url = (value: string): string => {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  if (typeof globalThis.atob === "function") {
    return globalThis.atob(padded);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(padded, "base64").toString("utf8");
  }
  throw new Error("No base64 decoder available");
};

const decodeJwtPayload = (token: string): JwtPayload | null => {
  const segments = token.split(".");
  if (segments.length < 2) return null;
  try {
    const rawPayload = decodeBase64Url(segments[1] ?? "");
    const parsed = JSON.parse(rawPayload);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as JwtPayload;
  } catch {
    return null;
  }
};

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const createInternalMediaRef = ({
  bucket = INTERNAL_MEDIA_REF_BUCKET,
  storagePath,
}: {
  bucket?: string | null;
  storagePath: string;
}): InternalMediaRef | null => {
  const normalizedBucket = normalizeNonEmptyString(bucket) ?? INTERNAL_MEDIA_REF_BUCKET;
  const normalizedStoragePath = normalizeNonEmptyString(storagePath);
  if (!normalizedStoragePath) return null;
  return {
    version: 1,
    kind: "storage_object",
    bucket: normalizedBucket,
    storagePath: normalizedStoragePath,
  };
};

export const normalizeInternalMediaRef = (value: unknown): InternalMediaRef | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (row.version !== 1 || row.kind !== "storage_object") return null;
  return createInternalMediaRef({
    bucket: normalizeNonEmptyString(row.bucket),
    storagePath: normalizeNonEmptyString(row.storagePath) ?? "",
  });
};

export const normalizeInternalMediaRefList = (
  value: unknown,
  limit = 8
): Array<InternalMediaRef | null> => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).map((item) => normalizeInternalMediaRef(item));
};

export const dedupeInternalMediaRefs = (
  refs: Array<InternalMediaRef | null | undefined>,
  limit = 8
): Array<InternalMediaRef | null> => {
  const deduped: Array<InternalMediaRef | null> = [];
  const seen = new Set<string>();
  normalizeInternalMediaRefList(refs, limit).forEach((ref) => {
    if (!ref) {
      deduped.push(null);
      return;
    }
    const key = `${ref.bucket}:${ref.storagePath}`;
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(ref);
  });
  return deduped.slice(0, limit);
};

export const parseInternalMediaRefFromSupabaseSignedUrl = (
  url: string
): InternalMediaRef | null => {
  try {
    const parsedUrl = new URL(url);
    const match = parsedUrl.pathname.match(/^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/i);
    if (!match) return null;
    const bucket = decodeURIComponent(match[1] ?? "").trim();
    const pathFromPathname = decodeURIComponent(match[2] ?? "").trim();
    if (!bucket || !pathFromPathname) return null;

    const token = parsedUrl.searchParams.get("token");
    const payload = token ? decodeJwtPayload(token) : null;
    const payloadUrl = normalizeNonEmptyString(payload?.url);
    let storagePath = pathFromPathname;
    if (payloadUrl) {
      const normalizedPayloadPath = payloadUrl.replace(/^\/+/, "");
      if (normalizedPayloadPath.startsWith(`${bucket}/`)) {
        storagePath = normalizedPayloadPath.slice(bucket.length + 1);
      }
    }
    return createInternalMediaRef({ bucket, storagePath });
  } catch {
    return null;
  }
};

export const resolveInternalMediaRefStoragePath = (ref: InternalMediaRef | null): string | null =>
  ref?.kind === "storage_object" ? ref.storagePath : null;
