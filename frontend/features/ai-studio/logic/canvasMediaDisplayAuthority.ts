import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { getSignedMediaUrl } from "../../../lib/mediaSignedUrlCache";
import {
  resolvePreferredMediaSigningStoragePath,
  resolveVideoPosterStoragePath,
} from "../../../lib/mediaPreviewPath";
import {
  resolveStudioOutputMediaDisplayAuthority,
  type StudioOutputMediaDisplayAuthority,
} from "./referenceGridMedia";
import type { ReferenceIngestionInput } from "../reference-ingestion/types";
import type { StudioOutput } from "../types";

const CANVAS_MEDIA_LIBRARY_BUCKET = "media_library";

export type CanvasLibraryMediaPayload = Extract<
  ReferenceIngestionInput,
  { kind: "libraryMedia" }
>["payload"];

type CanvasMediaDisplaySigner = (storagePath: string) => Promise<string | null>;

export type CanvasLibraryMediaDisplayAuthority = {
  mediaUrl: string | null;
  posterUrl: string | null;
};

const normalizeCanvasDisplayUrl = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const signCanvasMediaStoragePath: CanvasMediaDisplaySigner = (storagePath) =>
  getSignedMediaUrl({
    bucket: CANVAS_MEDIA_LIBRARY_BUCKET,
    storagePath,
  });

const signCanvasStudioOutputStoragePath = async (
  value: string | null | undefined,
  signStoragePath: CanvasMediaDisplaySigner
): Promise<string | null> => {
  const storagePath = asCanonicalStoragePath(value);
  return storagePath ? signStoragePath(storagePath) : null;
};

export const resolveCanvasStudioOutputMediaDisplayAuthority = async (
  output: StudioOutput,
  signStoragePath: CanvasMediaDisplaySigner = signCanvasMediaStoragePath
): Promise<StudioOutputMediaDisplayAuthority> => {
  const [signedPreviewUrl, signedPosterUrl, signedFullUrl] = await Promise.all([
    signCanvasStudioOutputStoragePath(output.previewStoragePath, signStoragePath),
    signCanvasStudioOutputStoragePath(output.previewPosterStoragePath, signStoragePath),
    signCanvasStudioOutputStoragePath(output.fullStoragePath, signStoragePath),
  ]);

  return resolveStudioOutputMediaDisplayAuthority(
    {
      ...output,
      previewStoragePath: signedPreviewUrl ?? output.previewStoragePath,
      previewPosterUrl: signedPosterUrl ?? output.previewPosterUrl,
      fullStoragePath: signedFullUrl ?? output.fullStoragePath,
      resultUrls: signedFullUrl
        ? [signedFullUrl, ...(output.resultUrls ?? []).filter((url) => url !== signedFullUrl)]
        : output.resultUrls,
    },
    {
      strictPreviewLadder: true,
      adaptivePreviewQuality: false,
      surface: "detail-modal",
    }
  );
};

export const resolveCanvasLibraryMediaDisplayAuthority = async (
  payload: CanvasLibraryMediaPayload,
  signStoragePath: CanvasMediaDisplaySigner = signCanvasMediaStoragePath
): Promise<CanvasLibraryMediaDisplayAuthority> => {
  const previewStoragePath = normalizeCanvasDisplayUrl(payload.previewStoragePath);
  const fullStoragePath = normalizeCanvasDisplayUrl(payload.fullStoragePath);
  const posterStoragePath = normalizeCanvasDisplayUrl(payload.previewPosterStoragePath);
  const row = {
    storage_path: fullStoragePath ?? previewStoragePath,
    file_type: payload.fileType,
    thumb_variant_path: payload.fileType === "image" ? previewStoragePath : null,
    preview_variant_path: payload.fileType === "video" ? previewStoragePath : null,
    poster_variant_path: posterStoragePath,
    metadata: null,
  };
  const previewSigningPath = resolvePreferredMediaSigningStoragePath(row);
  const posterSigningPath =
    payload.fileType === "video" ? (resolveVideoPosterStoragePath(row) ?? posterStoragePath) : null;

  const [signedPreviewUrl, signedPosterUrl] = await Promise.all([
    previewSigningPath ? signStoragePath(previewSigningPath) : Promise.resolve(null),
    posterSigningPath ? signStoragePath(posterSigningPath) : Promise.resolve(null),
  ]);

  return {
    mediaUrl:
      signedPreviewUrl ??
      normalizeCanvasDisplayUrl(payload.previewUrl) ??
      normalizeCanvasDisplayUrl(payload.url) ??
      normalizeCanvasDisplayUrl(payload.fullUrl),
    posterUrl: signedPosterUrl ?? normalizeCanvasDisplayUrl(payload.previewPosterUrl),
  };
};
