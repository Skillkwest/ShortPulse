/**
 * Session restore media signing helpers.
 * Resolves signed preview URLs for storage-backed outputs and patches rows safely.
 */
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import type { StudioOutput } from "../types";
import {
  normalizeVideoPosterStoragePathCandidate,
  resolveVideoPosterStoragePath,
} from "./videoPosterStoragePaths";

export type SessionOutputSigningFingerprint = {
  previewUrl: string | null;
  previewPosterUrl: string | null;
  previewPosterStoragePath: string | null;
  companionArtUrl: string | null;
  companionArtStoragePath: string | null;
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
  previewPosterStoragePath: normalizeVideoPosterStoragePathCandidate(
    output.previewPosterStoragePath
  ),
  companionArtUrl: toNormalizedNullableString(output.companionArtUrl),
  companionArtStoragePath: toCanonicalStoragePath(output.companionArtStoragePath),
  previewStoragePath: toCanonicalStoragePath(output.previewStoragePath),
  fullStoragePath: toCanonicalStoragePath(output.fullStoragePath),
});

const resolveSessionVideoPrimaryStoragePath = ({
  mode,
  previewStoragePath,
  fullStoragePath,
}: {
  mode: StudioOutput["mode"];
  previewStoragePath: string | null;
  fullStoragePath: string | null;
}): string | null => {
  if (mode !== "video") return previewStoragePath;
  if (previewStoragePath && /\.(?:m4v|mov|mp4|ogg|ogv|webm)(?:$|[?#])/i.test(previewStoragePath)) {
    return fullStoragePath ?? previewStoragePath;
  }
  if (fullStoragePath) return fullStoragePath;
  return previewStoragePath;
};

const isFingerprintEqual = (
  left: SessionOutputSigningFingerprint | null | undefined,
  right: SessionOutputSigningFingerprint
): boolean => {
  if (!left) return false;
  return (
    left.previewUrl === right.previewUrl &&
    left.previewPosterUrl === right.previewPosterUrl &&
    left.previewPosterStoragePath === right.previewPosterStoragePath &&
    left.companionArtUrl === right.companionArtUrl &&
    left.companionArtStoragePath === right.companionArtStoragePath &&
    left.previewStoragePath === right.previewStoragePath &&
    left.fullStoragePath === right.fullStoragePath
  );
};

const areStringArraysEqual = (
  left: readonly string[] | null | undefined,
  right: readonly string[] | null | undefined
): boolean => {
  if (left === right) return true;
  if (!left || !right) return !left && !right;
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
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
    const previewPosterStoragePath = normalizeVideoPosterStoragePathCandidate(
      output.previewPosterStoragePath
    );
    const companionArtStoragePath = toCanonicalStoragePath(output.companionArtStoragePath);
    const fullStoragePath = toCanonicalStoragePath(output.fullStoragePath);
    if (previewStoragePath) {
      pathSet.add(previewStoragePath);
    }
    if (previewPosterStoragePath) {
      pathSet.add(previewPosterStoragePath);
    }
    if (companionArtStoragePath) {
      pathSet.add(companionArtStoragePath);
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

    const previewPosterStoragePath =
      output.mode === "video"
        ? resolveVideoPosterStoragePath({
            previewPosterStoragePath: currentFingerprint.previewPosterStoragePath,
            previewStoragePath: currentFingerprint.previewStoragePath,
            fullStoragePath: currentFingerprint.fullStoragePath,
          })
        : null;
    const previewStoragePath = resolveSessionVideoPrimaryStoragePath({
      mode: output.mode,
      previewStoragePath: currentFingerprint.previewStoragePath,
      fullStoragePath: currentFingerprint.fullStoragePath,
    });
    const companionArtStoragePath = currentFingerprint.companionArtStoragePath;
    const fullStoragePath = currentFingerprint.fullStoragePath;
    const signedPreviewUrl =
      (previewStoragePath ? signedByPath.get(previewStoragePath) : null) ??
      (fullStoragePath ? signedByPath.get(fullStoragePath) : null) ??
      null;
    const signedFullUrl = fullStoragePath ? (signedByPath.get(fullStoragePath) ?? null) : null;
    const signedPreviewPosterUrl =
      output.mode === "video" && previewPosterStoragePath
        ? (signedByPath.get(previewPosterStoragePath) ?? currentFingerprint.previewPosterUrl)
        : currentFingerprint.previewPosterUrl;
    const signedCompanionArtUrl = companionArtStoragePath
      ? (signedByPath.get(companionArtStoragePath) ?? currentFingerprint.companionArtUrl)
      : currentFingerprint.companionArtUrl;
    const primarySignedResultUrl =
      output.mode === "video" ? signedFullUrl : (signedFullUrl ?? signedPreviewUrl);
    const nextResultUrls = primarySignedResultUrl
      ? [
          primarySignedResultUrl,
          ...(output.resultUrls ?? []).filter((url) => url !== primarySignedResultUrl),
        ]
      : output.resultUrls;
    if (!signedPreviewUrl && !signedPreviewPosterUrl && !primarySignedResultUrl) return output;

    if (
      currentFingerprint.previewUrl === signedPreviewUrl &&
      currentFingerprint.previewPosterUrl === signedPreviewPosterUrl &&
      currentFingerprint.previewPosterStoragePath === previewPosterStoragePath &&
      currentFingerprint.companionArtUrl === signedCompanionArtUrl &&
      currentFingerprint.companionArtStoragePath === companionArtStoragePath &&
      currentFingerprint.previewStoragePath === previewStoragePath &&
      currentFingerprint.fullStoragePath === fullStoragePath &&
      areStringArraysEqual(output.resultUrls, nextResultUrls)
    ) {
      return output;
    }

    changed = true;
    return {
      ...output,
      previewUrl: signedPreviewUrl ?? output.previewUrl,
      previewPosterUrl: signedPreviewPosterUrl,
      previewPosterStoragePath,
      companionArtUrl: signedCompanionArtUrl,
      companionArtStoragePath,
      previewStoragePath,
      fullStoragePath,
      resultUrls: nextResultUrls,
    };
  });
  return { outputs: patched, changed };
};
