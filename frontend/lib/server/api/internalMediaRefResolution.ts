/**
 * Server-side internal media reference resolution.
 * Resolves caller-owned storage descriptors into transient provider-safe inputs at submit time.
 */
import path from "path";
import {
  dedupeInternalMediaRefs,
  normalizeInternalMediaRef,
  normalizeInternalMediaRefList,
  parseInternalMediaRefFromSupabaseSignedUrl,
  resolveInternalMediaRefStoragePath,
  type InternalMediaRef,
} from "../../media/internalMediaRefs";
import { assertUserScopedMediaStoragePath } from "../../mediaStoragePath";
import { resolveProductUseImageReferenceForMediaFile } from "../admittedReferenceImageVariant";
import { getSupabaseAdmin } from "./supabaseAdmin";

const MEDIA_BUCKET = "media_library";
const MAX_IMAGE_INTERNAL_MEDIA_REFS = 16;
const MAX_OPENAI_EDIT_INPUT_BYTES = 50 * 1024 * 1024;
const OPENAI_EDIT_ALLOWED_IMAGE_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const resolveSafeUserScopedStoragePath = ({
  storagePath,
  userId,
  label,
}: {
  storagePath: string | null;
  userId: string;
  label: string;
}): string | null => {
  if (!storagePath) return null;
  try {
    return assertUserScopedMediaStoragePath({
      path: storagePath,
      userId,
      label,
    });
  } catch {
    return null;
  }
};

const inferImageContentTypeFromStoragePath = (storagePath: string): string | null => {
  const extension = path.extname(storagePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  return null;
};

const toBufferFromDownload = async (data: unknown): Promise<Buffer> => {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === "string") return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) {
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  }
  if (typeof (data as { arrayBuffer?: unknown }).arrayBuffer === "function") {
    const raw = await (data as { arrayBuffer: () => Promise<ArrayBuffer> }).arrayBuffer();
    return Buffer.from(raw);
  }
  throw new Error("Unable to read internal media ref download.");
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
  dedupeInternalMediaRefs(refs, MAX_IMAGE_INTERNAL_MEDIA_REFS).forEach((ref) => {
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

export type ResolvedInternalMediaFile = {
  buffer: Buffer;
  contentType: string;
  filename: string;
  byteLength: number;
  storagePath: string;
};

export const readInternalMediaRefsFromPayload = (
  value: unknown,
  limit = MAX_IMAGE_INTERNAL_MEDIA_REFS
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
  const normalizedRefs = dedupeInternalMediaRefs(refs, MAX_IMAGE_INTERNAL_MEDIA_REFS).filter(
    (ref): ref is InternalMediaRef => Boolean(ref)
  );
  if (!normalizedRefs.length) return [];

  const resolvedEntries: Array<
    | { kind: "signed"; signedUrl: string }
    | { kind: "storage"; storagePath: string }
    | { kind: "empty" }
  > = [];
  const storagePathsToSign: string[] = [];

  for (const ref of normalizedRefs) {
    if (ref.mediaFileId) {
      const resolved = await resolveProductUseImageReferenceForMediaFile({
        userId,
        mediaFileId: ref.mediaFileId,
        sign: true,
        expiresInSeconds,
      });
      if (resolved.signedUrl) {
        resolvedEntries.push({ kind: "signed", signedUrl: resolved.signedUrl });
      } else {
        resolvedEntries.push({ kind: "empty" });
      }
      continue;
    }

    const storagePath = resolveSafeUserScopedStoragePath({
      storagePath: resolveInternalMediaRefStoragePath(ref),
      userId,
      label: "Internal media ref storage path",
    });
    if (!storagePath) {
      resolvedEntries.push({ kind: "empty" });
      continue;
    }
    storagePathsToSign.push(storagePath);
    resolvedEntries.push({ kind: "storage", storagePath });
  }

  if (!storagePathsToSign.length) {
    return resolvedEntries
      .map((entry) => (entry.kind === "signed" ? entry.signedUrl : null))
      .filter((url): url is string => Boolean(url));
  }

  const supabaseAdmin = getSupabaseAdmin();
  const storage = supabaseAdmin.storage.from(MEDIA_BUCKET);
  const { data, error } = await storage.createSignedUrls(storagePathsToSign, expiresInSeconds);
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

  return resolvedEntries
    .map((entry) => {
      if (entry.kind === "signed") return entry.signedUrl;
      if (entry.kind === "storage") return urlsByPath.get(entry.storagePath) ?? null;
      return null;
    })
    .filter((url): url is string => Boolean(url));
};

export const resolveOpenAiImageFilesForInternalMediaRefs = async ({
  refs,
  userId,
  maxBytes = MAX_OPENAI_EDIT_INPUT_BYTES,
}: {
  refs: Array<InternalMediaRef | null | undefined>;
  userId: string;
  maxBytes?: number;
}): Promise<ResolvedInternalMediaFile[]> => {
  const normalizedRefs = dedupeInternalMediaRefs(refs, MAX_IMAGE_INTERNAL_MEDIA_REFS).filter(
    (ref): ref is InternalMediaRef => Boolean(ref)
  );
  if (!normalizedRefs.length) return [];

  const storagePaths: string[] = [];
  for (const ref of normalizedRefs) {
    if (ref.mediaFileId) {
      const resolved = await resolveProductUseImageReferenceForMediaFile({
        userId,
        mediaFileId: ref.mediaFileId,
        sign: false,
      });
      storagePaths.push(resolved.storagePath);
      continue;
    }
    const storagePath = resolveSafeUserScopedStoragePath({
      storagePath: resolveInternalMediaRefStoragePath(ref),
      userId,
      label: "Internal media ref storage path",
    });
    if (storagePath) {
      storagePaths.push(storagePath);
    }
  }
  if (!storagePaths.length) return [];

  const storage = getSupabaseAdmin().storage.from(MEDIA_BUCKET);
  const files: ResolvedInternalMediaFile[] = [];

  for (const storagePath of storagePaths) {
    const { data, error } = await storage.download(storagePath);
    if (error || !data) {
      throw new Error(`Unable to download internal media ref: ${error?.message ?? storagePath}`);
    }

    const buffer = await toBufferFromDownload(data);
    const byteLength = buffer.byteLength;
    if (!byteLength) {
      throw new Error(`Internal media ref is empty: ${storagePath}`);
    }
    if (byteLength > maxBytes) {
      throw new Error(`Internal media ref exceeds OpenAI edit size limit: ${storagePath}`);
    }

    const contentType =
      normalizeNonEmptyString((data as { type?: unknown }).type) ??
      inferImageContentTypeFromStoragePath(storagePath);
    if (!contentType || !OPENAI_EDIT_ALLOWED_IMAGE_CONTENT_TYPES.has(contentType)) {
      throw new Error(`Internal media ref has unsupported image type: ${storagePath}`);
    }

    files.push({
      buffer,
      contentType,
      filename: path.basename(storagePath) || "reference-image",
      byteLength,
      storagePath,
    });
  }

  return files;
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

export const resolveOpenAiImageFilesForInternalEditMediaRefs = async ({
  refs,
  userId,
  maxBytes = MAX_OPENAI_EDIT_INPUT_BYTES,
}: {
  refs: InternalEditMediaRefs;
  userId: string;
  maxBytes?: number;
}): Promise<{
  baseImageFile: ResolvedInternalMediaFile | null;
  maskFile: ResolvedInternalMediaFile | null;
  referenceImageFile: ResolvedInternalMediaFile | null;
}> => {
  const resolveSingleFile = async (
    ref: InternalMediaRef | null
  ): Promise<ResolvedInternalMediaFile | null> => {
    if (!ref) return null;
    const [file] = await resolveOpenAiImageFilesForInternalMediaRefs({
      refs: [ref],
      userId,
      maxBytes,
    });
    return file ?? null;
  };

  return {
    baseImageFile: await resolveSingleFile(refs.baseImageRef),
    maskFile: await resolveSingleFile(refs.maskRef),
    referenceImageFile: await resolveSingleFile(refs.referenceImageRef),
  };
};
