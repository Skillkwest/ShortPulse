/**
 * Server-side internal media reference resolution.
 * Resolves caller-owned storage descriptors into fresh provider-fetchable signed URLs at submit time.
 */
import {
  dedupeInternalMediaRefs,
  normalizeInternalMediaRef,
  normalizeInternalMediaRefList,
  parseInternalMediaRefFromSupabaseSignedUrl,
  resolveInternalMediaRefStoragePath,
  type InternalMediaRef,
} from "../../media/internalMediaRefs";
import { getSupabaseAdmin } from "./supabaseAdmin";

const MEDIA_BUCKET = "media_library";

const isUserScopedStoragePath = (storagePath: string, userId: string): boolean =>
  storagePath.trim().startsWith(`${userId}/`);

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const buildInternalMediaRefKey = (ref: InternalMediaRef | null): string | null => {
  if (!ref) return null;
  const storagePath = resolveInternalMediaRefStoragePath(ref);
  if (!storagePath) return null;
  return `${ref.bucket}:${storagePath}`;
};

const buildInternalMediaRefKeySet = (
  refs: Array<InternalMediaRef | null | undefined>
): Set<string> => {
  const keys = new Set<string>();
  dedupeInternalMediaRefs(refs, 8).forEach((ref) => {
    const key = buildInternalMediaRefKey(ref ?? null);
    if (key) keys.add(key);
  });
  return keys;
};

export type InternalEditMediaRefs = {
  baseImageRef: InternalMediaRef | null;
  maskRef: InternalMediaRef | null;
  referenceImageRef: InternalMediaRef | null;
};

export const readInternalMediaRefsFromPayload = (
  value: unknown,
  limit = 8
): Array<InternalMediaRef | null> =>
  dedupeInternalMediaRefs(normalizeInternalMediaRefList(value, limit), limit);

export const readInternalEditMediaRefsFromPayload = (value: unknown): InternalEditMediaRefs => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {
      baseImageRef: null,
      maskRef: null,
      referenceImageRef: null,
    };
  }
  const row = value as Record<string, unknown>;
  return {
    baseImageRef: normalizeInternalMediaRef(row.base_image),
    maskRef: normalizeInternalMediaRef(row.mask_image),
    referenceImageRef: normalizeInternalMediaRef(row.reference_image),
  };
};

export const filterExternalUrlsFromInternalRefs = (
  urls: Array<string | null | undefined>,
  refs: Array<InternalMediaRef | null | undefined>
): string[] => {
  const refKeys = buildInternalMediaRefKeySet(refs);
  if (!refKeys.size) {
    return urls
      .map((url) => normalizeNonEmptyString(url))
      .filter((url): url is string => Boolean(url));
  }
  return urls
    .map((url) => normalizeNonEmptyString(url))
    .filter((url): url is string => Boolean(url))
    .filter((url) => {
      const parsedRef = parseInternalMediaRefFromSupabaseSignedUrl(url);
      const parsedKey = buildInternalMediaRefKey(parsedRef);
      return !parsedKey || !refKeys.has(parsedKey);
    });
};

export const resolveSignedUrlsForInternalMediaRefs = async ({
  refs,
  userId,
  expiresInSeconds = 3600,
}: {
  refs: Array<InternalMediaRef | null | undefined>;
  userId: string;
  expiresInSeconds?: number;
}): Promise<string[]> => {
  const normalizedRefs = dedupeInternalMediaRefs(refs, 8).filter((ref): ref is InternalMediaRef =>
    Boolean(ref)
  );
  if (!normalizedRefs.length) return [];
  const storagePaths = normalizedRefs
    .map((ref) => resolveInternalMediaRefStoragePath(ref))
    .filter((value): value is string => Boolean(value))
    .filter((storagePath) => isUserScopedStoragePath(storagePath, userId));
  if (!storagePaths.length) return [];

  const supabaseAdmin = getSupabaseAdmin();
  const storage = supabaseAdmin.storage.from(MEDIA_BUCKET);
  const { data, error } = await storage.createSignedUrls(storagePaths, expiresInSeconds);
  if (error) {
    throw new Error(`Unable to sign internal media refs: ${error.message}`);
  }

  const urlsByPath = new Map<string, string>();
  (data ?? []).forEach((row) => {
    const path = typeof row.path === "string" ? row.path.trim() : "";
    const signedUrl = typeof row.signedUrl === "string" ? row.signedUrl.trim() : "";
    if (!path || !signedUrl) return;
    urlsByPath.set(path, signedUrl);
  });

  return storagePaths
    .map((storagePath) => urlsByPath.get(storagePath) ?? null)
    .filter((url): url is string => Boolean(url));
};

export const resolveSignedUrlsForInternalEditMediaRefs = async ({
  refs,
  userId,
  expiresInSeconds = 3600,
}: {
  refs: InternalEditMediaRefs;
  userId: string;
  expiresInSeconds?: number;
}): Promise<{
  baseImageUrl: string | null;
  maskUrl: string | null;
  referenceImageUrl: string | null;
}> => {
  const resolveSingleUrl = async (ref: InternalMediaRef | null): Promise<string | null> => {
    if (!ref) return null;
    const [signedUrl] = await resolveSignedUrlsForInternalMediaRefs({
      refs: [ref],
      userId,
      expiresInSeconds,
    });
    return signedUrl ?? null;
  };
  return {
    baseImageUrl: await resolveSingleUrl(refs.baseImageRef),
    maskUrl: await resolveSingleUrl(refs.maskRef),
    referenceImageUrl: await resolveSingleUrl(refs.referenceImageRef),
  };
};
