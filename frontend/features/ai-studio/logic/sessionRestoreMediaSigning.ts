/**
 * Session restore media signing helpers.
 * Resolves signed preview URLs for storage-backed outputs and patches rows safely.
 */
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import type { StudioOutput } from "../types";

export type SessionOutputSigningFingerprint = {
  previewUrl: string | null;
  previewPosterUrl: string | null;
  previewPosterStoragePath: string | null;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
};

export type SessionOutputSigningFingerprintById = Record<string, SessionOutputSigningFingerprint>;

type ApplySessionRestoreSignedUrlsOptions = {
  baselineById?: SessionOutputSigningFingerprintById;
};

const toNormalizedNullableString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const toCanonicalStoragePath = (value: string | null | undefined): string | null =>
  asCanonicalStoragePath(value ?? null);

const resolveFingerprintForOutput = (output: StudioOutput): SessionOutputSigningFingerprint => ({
  previewUrl: toNormalizedNullableString(output.previewUrl),
  previewPosterUrl: toNormalizedNullableString(output.previewPosterUrl),
  previewPosterStoragePath: toCanonicalStoragePath(output.previewPosterStoragePath),
  previewStoragePath: toCanonicalStoragePath(output.previewStoragePath),
  fullStoragePath: toCanonicalStoragePath(output.fullStoragePath),
});

const isFingerprintEqual = (
  left: SessionOutputSigningFingerprint | null | undefined,
  right: SessionOutputSigningFingerprint
): boolean => {
  if (!left) return false;
  return (
    left.previewUrl === right.previewUrl &&
    left.previewPosterUrl === right.previewPosterUrl &&
    left.previewPosterStoragePath === right.previewPosterStoragePath &&
    left.previewStoragePath === right.previewStoragePath &&
    left.fullStoragePath === right.fullStoragePath
  );
};

/**
 * Builds a signing fingerprint map keyed by output id for stale-apply guards.
 */
export const buildSessionOutputSigningFingerprintById = (
  outputs: StudioOutput[]
): SessionOutputSigningFingerprintById => {
  const byId: SessionOutputSigningFingerprintById = {};
  outputs.forEach((output) => {
    if (!output.id) return;
    byId[output.id] = resolveFingerprintForOutput(output);
  });
  return byId;
};

/**
 * Collects unique canonical storage paths that need signed URL resolution.
 */
export const collectSessionRestoreSigningPaths = (outputs: StudioOutput[]): string[] => {
  const pathSet = new Set<string>();
  outputs.forEach((output) => {
    const previewStoragePath = toCanonicalStoragePath(output.previewStoragePath);
    const previewPosterStoragePath = toCanonicalStoragePath(output.previewPosterStoragePath);
    const fullStoragePath = toCanonicalStoragePath(output.fullStoragePath);
    if (previewStoragePath) {
      pathSet.add(previewStoragePath);
    }
    if (previewPosterStoragePath) {
      pathSet.add(previewPosterStoragePath);
    }
    if (fullStoragePath) {
      pathSet.add(fullStoragePath);
    }
  });
  return [...pathSet];
};

/**
 * Resolves signed URLs for a set of restored outputs.
 */
export const resolveSessionRestoreSignedUrls = async (
  outputs: StudioOutput[]
): Promise<Map<string, string | null>> => {
  const storagePaths = collectSessionRestoreSigningPaths(outputs);
  if (!storagePaths.length) return new Map<string, string | null>();
  return getSignedMediaUrlsBatch({
    bucket: "media_library",
    storagePaths,
    surface: "reference-grid",
    queryMode: "default",
  });
};

/**
 * Applies signed preview URLs to outputs while preserving canonical storage paths.
 */
export const applySessionRestoreSignedUrls = (
  outputs: StudioOutput[],
  signedByPath: Map<string, string | null>,
  options?: ApplySessionRestoreSignedUrlsOptions
): { outputs: StudioOutput[]; changed: boolean } => {
  let changed = false;
  const patched = outputs.map((output) => {
    const currentFingerprint = resolveFingerprintForOutput(output);
    const baselineFingerprint = options?.baselineById?.[output.id];
    if (baselineFingerprint && !isFingerprintEqual(baselineFingerprint, currentFingerprint)) {
      return output;
    }

    const previewStoragePath = currentFingerprint.previewStoragePath;
    const previewPosterStoragePath = currentFingerprint.previewPosterStoragePath;
    const fullStoragePath = currentFingerprint.fullStoragePath;
    const signedPreviewUrl =
      (previewStoragePath ? signedByPath.get(previewStoragePath) : null) ??
      (fullStoragePath ? signedByPath.get(fullStoragePath) : null) ??
      null;
    const signedPreviewPosterUrl =
      output.mode === "video" && previewPosterStoragePath
        ? (signedByPath.get(previewPosterStoragePath) ?? currentFingerprint.previewPosterUrl)
        : output.mode === "video" && previewStoragePath && previewStoragePath !== fullStoragePath
          ? signedPreviewUrl
          : currentFingerprint.previewPosterUrl;
    if (!signedPreviewUrl && !signedPreviewPosterUrl) return output;

    if (
      currentFingerprint.previewUrl === signedPreviewUrl &&
      currentFingerprint.previewPosterUrl === signedPreviewPosterUrl &&
      currentFingerprint.previewPosterStoragePath === previewPosterStoragePath &&
      currentFingerprint.previewStoragePath === previewStoragePath &&
      currentFingerprint.fullStoragePath === fullStoragePath
    ) {
      return output;
    }

    changed = true;
    return {
      ...output,
      previewUrl: signedPreviewUrl ?? output.previewUrl,
      previewPosterUrl: signedPreviewPosterUrl,
      previewPosterStoragePath,
      previewStoragePath,
      fullStoragePath,
    };
  });
  return { outputs: patched, changed };
};
