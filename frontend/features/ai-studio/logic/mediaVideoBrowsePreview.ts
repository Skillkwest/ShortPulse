import { resolveVideoBrowseSigningCandidates } from "../../../lib/mediaPreviewPath";
import { isVideoUrl } from "./stateParsers";
import { isVideoFile, type MediaFileRow } from "./mediaLibraryModalModel";

const RENDERABLE_IMAGE_URL_PATTERN = /^(?:https?:\/\/|blob:|data:image\/|\/)/i;
const RENDERABLE_VIDEO_URL_PATTERN = /^(?:https?:\/\/|blob:|data:video\/|\/)/i;

export const asRenderableImageUrl = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || isVideoUrl(trimmed)) return null;
  return RENDERABLE_IMAGE_URL_PATTERN.test(trimmed) ? trimmed : null;
};

export const asRenderableVideoUrl = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed || !isVideoUrl(trimmed)) return null;
  return RENDERABLE_VIDEO_URL_PATTERN.test(trimmed) ? trimmed : null;
};

export const resolveVideoPosterSourceUrl = (
  file: MediaFileRow,
  signedPosterUrl: string | null,
  hoverVideoUrl: string | null,
  signedPreviewUrl?: string | null
): string | null => {
  if (!isVideoFile(file.file_type)) return null;
  return (
    asRenderableImageUrl(signedPosterUrl) ??
    asRenderableImageUrl(signedPreviewUrl) ??
    asRenderableImageUrl(file.poster_variant_path) ??
    asRenderableImageUrl(file.thumb_variant_path) ??
    (hoverVideoUrl && !isVideoUrl(hoverVideoUrl) ? hoverVideoUrl : null)
  );
};

export const resolveHoverVideoSigningPath = (
  file: MediaFileRow,
  currentUserId?: string | null
): string | null => {
  if (!isVideoFile(file.file_type)) return null;
  if (asRenderableVideoUrl(file.signedUrl)) return null;
  return resolveVideoBrowseSigningCandidates(file, currentUserId).hoverVideoPath;
};

export const collectVideoBrowseSigningRequests = (
  mediaRows: MediaFileRow[],
  currentUserId?: string | null
): {
  hoverVideoPathByRowId: Map<string, string>;
  posterPathByRowId: Map<string, string[]>;
  storagePaths: Set<string>;
} => {
  const hoverVideoPathByRowId = new Map<string, string>();
  const posterPathByRowId = new Map<string, string[]>();
  const storagePaths = new Set<string>();

  for (const row of mediaRows) {
    const hoverPath = resolveHoverVideoSigningPath(row, currentUserId);
    if (hoverPath) {
      hoverVideoPathByRowId.set(row.id, hoverPath);
      storagePaths.add(hoverPath);
    }

    if (!isVideoFile(row.file_type)) continue;
    if (resolveVideoPosterSourceUrl(row, null, null, row.signedUrl ?? null)) continue;

    const posterCandidates = resolveVideoBrowseSigningCandidates(row, currentUserId).posterPaths;
    if (posterCandidates.length === 0) continue;
    posterPathByRowId.set(row.id, posterCandidates);
    for (const candidate of posterCandidates) {
      storagePaths.add(candidate);
    }
  }

  return {
    hoverVideoPathByRowId,
    posterPathByRowId,
    storagePaths,
  };
};
