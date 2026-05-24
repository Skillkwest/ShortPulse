import { asCanonicalStoragePath } from "../../../lib/adaptive-media";

const VIDEO_STORAGE_PATH_PATTERN = /\.(?:m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i;
const AUDIO_STORAGE_PATH_PATTERN = /\.(?:aac|flac|m4a|mp3|oga|ogg|wav)(?:$|[?#])/i;

export const normalizeVideoPosterStoragePathCandidate = (
  value: string | null | undefined
): string | null => {
  const canonical = asCanonicalStoragePath(value);
  if (!canonical) return null;
  if (VIDEO_STORAGE_PATH_PATTERN.test(canonical)) return null;
  if (AUDIO_STORAGE_PATH_PATTERN.test(canonical)) return null;
  return canonical;
};

export const resolveVideoPosterStoragePath = ({
  previewPosterStoragePath,
  previewStoragePath,
  fullStoragePath,
}: {
  previewPosterStoragePath: string | null | undefined;
  previewStoragePath: string | null | undefined;
  fullStoragePath: string | null | undefined;
}): string | null => {
  const explicitPosterStoragePath =
    normalizeVideoPosterStoragePathCandidate(previewPosterStoragePath);
  if (explicitPosterStoragePath) return explicitPosterStoragePath;

  const canonicalPreviewStoragePath = asCanonicalStoragePath(previewStoragePath);
  const canonicalFullStoragePath = asCanonicalStoragePath(fullStoragePath);
  if (!canonicalPreviewStoragePath || canonicalPreviewStoragePath === canonicalFullStoragePath) {
    return null;
  }

  return normalizeVideoPosterStoragePathCandidate(canonicalPreviewStoragePath);
};
