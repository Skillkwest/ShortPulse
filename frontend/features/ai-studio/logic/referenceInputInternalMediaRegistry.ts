/**
 * Reference-input internal media registry.
 * Tracks canonical app-owned media identity for image/edit inputs without forking UI state.
 */
import {
  createInternalMediaRef,
  normalizeInternalMediaRef,
  parseInternalMediaRefFromSupabaseSignedUrl,
  type InternalMediaRef,
} from "../../../lib/media/internalMediaRefs";
import type { ResolvedInternalReferenceSource } from "./referenceSource/internalReferenceSource";

const internalMediaRefByUrl = new Map<string, InternalMediaRef>();

const normalizeUrl = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const registerInternalMediaRefForUrl = (
  url: string | null | undefined,
  ref: InternalMediaRef | null | undefined
): void => {
  const normalizedUrl = normalizeUrl(url);
  const normalizedRef = normalizeInternalMediaRef(ref);
  if (!normalizedUrl || !normalizedRef) return;
  internalMediaRefByUrl.set(normalizedUrl, normalizedRef);
};

export const registerInternalMediaRefsForUrls = (
  urls: Array<string | null | undefined>,
  refs: Array<InternalMediaRef | null | undefined>
): void => {
  urls.forEach((url, index) => {
    registerInternalMediaRefForUrl(url, refs[index] ?? null);
  });
};

export const resolveInternalMediaRefForUrl = (
  url: string | null | undefined
): InternalMediaRef | null => {
  const normalizedUrl = normalizeUrl(url);
  if (!normalizedUrl) return null;
  const remembered = internalMediaRefByUrl.get(normalizedUrl);
  if (remembered) return remembered;
  return parseInternalMediaRefFromSupabaseSignedUrl(normalizedUrl);
};

export const resolveInternalMediaRefsForUrls = (
  urls: Array<string | null | undefined>,
  limit = 8
): Array<InternalMediaRef | null> =>
  urls.slice(0, limit).map((url) => resolveInternalMediaRefForUrl(url));

export const createInternalMediaRefFromResolvedSource = (
  source: Pick<
    ResolvedInternalReferenceSource,
    "fullStoragePath" | "mediaId" | "previewStoragePath"
  >
): InternalMediaRef | null =>
  createInternalMediaRef({
    storagePath: source.fullStoragePath?.trim() || source.previewStoragePath?.trim() || "",
    mediaFileId: source.mediaId,
  });
