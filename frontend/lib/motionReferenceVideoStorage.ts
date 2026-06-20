import {
  INTERNAL_MEDIA_REF_BUCKET,
  parseInternalMediaRefFromSupabaseSignedUrl,
} from "./media/internalMediaRefs";

export const MOTION_REFERENCE_VIDEO_STORAGE_FOLDER = "videos/motion-control";
export const MOTION_REFERENCE_VIDEO_STORAGE_SEGMENT = `/${MOTION_REFERENCE_VIDEO_STORAGE_FOLDER}/`;

export const isMotionReferenceVideoStoragePath = (
  storagePath: string | null | undefined
): storagePath is string => {
  if (typeof storagePath !== "string") return false;
  const normalized = storagePath.trim();
  if (!normalized || normalized.startsWith("/") || normalized.includes("\\")) return false;
  const segments = normalized.split("/");
  return (
    segments.length >= 4 &&
    Boolean(segments[0]) &&
    segments[1] === "videos" &&
    segments[2] === "motion-control" &&
    Boolean(segments[3]) &&
    !segments.includes("..")
  );
};

export const resolveMotionReferenceVideoStoragePathFromUrl = (
  url: string | null | undefined
): string | null => {
  if (typeof url !== "string") return null;
  const normalizedUrl = url.trim();
  if (!normalizedUrl) return null;
  const ref = parseInternalMediaRefFromSupabaseSignedUrl(normalizedUrl);
  if (!ref || ref.bucket !== INTERNAL_MEDIA_REF_BUCKET) return null;
  return isMotionReferenceVideoStoragePath(ref.storagePath) ? ref.storagePath : null;
};

export const buildMotionReferenceAssetShortpulseContext = ({
  motionReferenceVideoUrl,
}: {
  motionReferenceVideoUrl: string | null;
}): Record<string, unknown> | null => {
  const storagePath = resolveMotionReferenceVideoStoragePathFromUrl(motionReferenceVideoUrl);
  if (!storagePath) return null;
  return {
    bucket: INTERNAL_MEDIA_REF_BUCKET,
    storage_path: storagePath,
    source: "motion_control_upload",
  };
};
