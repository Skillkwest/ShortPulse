/**
 * Session restore media signing helpers.
 * Resolves signed preview URLs for storage-backed outputs and patches rows safely.
 */
import { asCanonicalStoragePath } from "../../../lib/adaptive-media";
import {
  normalizeInternalMediaRefList,
  resolveInternalMediaRefStoragePath,
  type InternalMediaRef,
} from "../../../lib/media/internalMediaRefs";
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import { ensureSupabaseQueryClient } from "../../../lib/supabaseClient";
import type { StudioOutput } from "../types";
import { resolveReferenceDownloadTarget } from "./referenceDownload";
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
export type SessionRecoveredStorageAuthority = {
  previewPosterStoragePath: string | null;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
};
export type SessionRecoveredStorageAuthorityByOutputId = Record<
  string,
  SessionRecoveredStorageAuthority
>;

type ApplySessionRestoreSignedUrlsOptions = {
  baselineById?: SessionOutputSigningFingerprintById;
  recoveredAuthorityById?: SessionRecoveredStorageAuthorityByOutputId;
};

type CollectSessionRestoreSigningPathsOptions = {
  includeDetailFullQuality?: boolean;
};

type MediaStoragePathRow = {
  id?: unknown;
  storage_path?: unknown;
  file_type?: unknown;
  poster_variant_path?: unknown;
  thumb_variant_path?: unknown;
  preview_variant_path?: unknown;
};

const toNormalizedNullableString = (value: string | null | undefined): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
};

const toCanonicalStoragePath = (value: string | null | undefined): string | null =>
  asCanonicalStoragePath(value ?? null);

const resolveSavedMediaId = (output: Pick<StudioOutput, "savedMediaIds">): string | null => {
  const savedMediaIds = Array.isArray(output.savedMediaIds) ? output.savedMediaIds : [];
  for (const candidate of savedMediaIds) {
    const normalized = toNormalizedNullableString(candidate);
    if (normalized) return normalized;
  }
  return null;
};

const resolveRecoveredStorageAuthorityFromMediaRow = (
  row: MediaStoragePathRow | null | undefined
): SessionRecoveredStorageAuthority => {
  const fileType = typeof row?.file_type === "string" ? row.file_type.toLowerCase() : "";
  const previewPosterStoragePath =
    normalizeVideoPosterStoragePathCandidate(
      typeof row?.poster_variant_path === "string" ? row.poster_variant_path : null
    ) ??
    normalizeVideoPosterStoragePathCandidate(
      typeof row?.thumb_variant_path === "string" ? row.thumb_variant_path : null
    );
  const fullStoragePath = toCanonicalStoragePath(
    typeof row?.storage_path === "string" ? row.storage_path : null
  );
  const previewVariantPath = toCanonicalStoragePath(
    typeof row?.preview_variant_path === "string" ? row.preview_variant_path : null
  );
  const imageThumbStoragePath = toCanonicalStoragePath(
    typeof row?.thumb_variant_path === "string" ? row.thumb_variant_path : null
  );
  const previewStoragePath = fileType.startsWith("video")
    ? (previewVariantPath ?? fullStoragePath)
    : (imageThumbStoragePath ?? fullStoragePath);

  return {
    previewPosterStoragePath,
    previewStoragePath,
    fullStoragePath,
  };
};

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

const resolveSessionRestoreRecoveredStorageAuthority = async (
  outputs: StudioOutput[]
): Promise<SessionRecoveredStorageAuthorityByOutputId> => {
  const recoveredAuthorityByOutputId: SessionRecoveredStorageAuthorityByOutputId = {};
  const generationRecoveryOutputs = outputs.filter((output) => {
    if (
      toCanonicalStoragePath(output.previewStoragePath) ||
      toCanonicalStoragePath(output.fullStoragePath)
    ) {
      return false;
    }
    return Boolean(
      output.mediaSource === "generated" || output.generationId?.trim() || output.taskId?.trim()
    );
  });
  const candidateEntries = outputs
    .map((output) => {
      if (
        toCanonicalStoragePath(output.previewStoragePath) ||
        toCanonicalStoragePath(output.fullStoragePath)
      ) {
        return null;
      }
      const savedMediaId = resolveSavedMediaId(output);
      if (!savedMediaId) return null;
      return {
        outputId: output.id,
        savedMediaId,
      };
    })
    .filter(
      (
        value
      ): value is {
        outputId: string;
        savedMediaId: string;
      } => Boolean(value)
    );
  if (!candidateEntries.length && !generationRecoveryOutputs.length) return {};

  const supabase = ensureSupabaseQueryClient();
  if (candidateEntries.length) {
    const mediaIds = Array.from(new Set(candidateEntries.map((entry) => entry.savedMediaId)));
    let data: MediaStoragePathRow[] | null = null;
    try {
      const response = await supabase
        .from("media_files")
        .select(
          "id, storage_path, file_type, poster_variant_path, thumb_variant_path, preview_variant_path"
        )
        .in("id", mediaIds);
      data = response.error
        ? []
        : Array.isArray(response.data)
          ? (response.data as MediaStoragePathRow[])
          : [];
    } catch {
      data = [];
    }

    const authorityByMediaId = new Map<string, SessionRecoveredStorageAuthority>();
    (data ?? []).forEach((row) => {
      const mediaId = toNormalizedNullableString(typeof row.id === "string" ? row.id : null);
      if (!mediaId) return;
      authorityByMediaId.set(mediaId, resolveRecoveredStorageAuthorityFromMediaRow(row));
    });

    candidateEntries.forEach(({ outputId, savedMediaId }) => {
      const recoveredAuthority = authorityByMediaId.get(savedMediaId);
      if (!recoveredAuthority) return;
      if (
        !recoveredAuthority.previewStoragePath &&
        !recoveredAuthority.fullStoragePath &&
        !recoveredAuthority.previewPosterStoragePath
      ) {
        return;
      }
      recoveredAuthorityByOutputId[outputId] = recoveredAuthority;
    });
  }

  await Promise.all(
    generationRecoveryOutputs.map(async (output) => {
      if (recoveredAuthorityByOutputId[output.id]) return;
      try {
        const resolvedTarget = await resolveReferenceDownloadTarget({
          output,
          supabase,
        });
        const storagePath = toCanonicalStoragePath(resolvedTarget.fileRecord?.storagePath);
        if (!storagePath) return;
        recoveredAuthorityByOutputId[output.id] = {
          previewPosterStoragePath: null,
          previewStoragePath: storagePath,
          fullStoragePath: storagePath,
        };
      } catch {
        // Generation recovery is best-effort; saved-media recovery above remains authoritative.
      }
    })
  );

  return recoveredAuthorityByOutputId;
};

const resolveSessionRestoreSigningOutputs = (
  outputs: StudioOutput[],
  recoveredAuthorityByOutputId: SessionRecoveredStorageAuthorityByOutputId
): StudioOutput[] =>
  outputs.map((output) => {
    const recoveredAuthority = recoveredAuthorityByOutputId[output.id];
    if (!recoveredAuthority) return output;
    return {
      ...output,
      previewPosterStoragePath:
        normalizeVideoPosterStoragePathCandidate(output.previewPosterStoragePath) ??
        recoveredAuthority.previewPosterStoragePath,
      previewStoragePath:
        toCanonicalStoragePath(output.previewStoragePath) ?? recoveredAuthority.previewStoragePath,
      fullStoragePath:
        toCanonicalStoragePath(output.fullStoragePath) ?? recoveredAuthority.fullStoragePath,
    };
  });

export const resolveSessionRestoreReferenceSignedUrls = async (
  refs: Array<InternalMediaRef | null | undefined>
): Promise<Array<string | null>> => {
  const normalizedRefs = normalizeInternalMediaRefList(refs, 8);
  const storagePaths = Array.from(
    new Set(
      normalizedRefs
        .map((ref) => resolveInternalMediaRefStoragePath(ref))
        .filter((value): value is string => Boolean(value))
    )
  );
  if (!storagePaths.length) {
    return normalizedRefs.map(() => null);
  }
  const signedByPath = await getSignedMediaUrlsBatch({
    bucket: "media_library",
    storagePaths,
    surface: "reference-grid",
    queryMode: "default",
  });
  return normalizedRefs.map((ref) => {
    const storagePath = resolveInternalMediaRefStoragePath(ref);
    if (!storagePath) return null;
    return signedByPath.get(storagePath) ?? null;
  });
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

const shouldSignFullStoragePathForRestore = ({
  output,
  previewStoragePath,
  fullStoragePath,
  includeDetailFullQuality,
}: {
  output: StudioOutput;
  previewStoragePath: string | null;
  fullStoragePath: string | null;
  includeDetailFullQuality: boolean;
}): boolean => {
  if (!fullStoragePath) return false;
  if (includeDetailFullQuality) return true;
  if (output.mode === "image") {
    return !previewStoragePath;
  }
  return true;
};

/**
 * Collects unique canonical storage paths that need signed URL resolution.
 * Callers can skip eager image full-quality paths when restore only needs card-preview authority.
 */
export const collectSessionRestoreSigningPaths = (
  outputs: StudioOutput[],
  options: CollectSessionRestoreSigningPathsOptions = {}
): string[] => {
  const includeDetailFullQuality = options.includeDetailFullQuality ?? true;
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
    if (
      fullStoragePath &&
      shouldSignFullStoragePathForRestore({
        output,
        previewStoragePath,
        fullStoragePath,
        includeDetailFullQuality,
      })
    ) {
      pathSet.add(fullStoragePath);
    }
  });
  return [...pathSet];
};

export const resolveSessionRestoreSignedMediaAuthority = async (
  outputs: StudioOutput[]
): Promise<{
  signedByPath: Map<string, string | null>;
  recoveredAuthorityByOutputId: SessionRecoveredStorageAuthorityByOutputId;
}> => {
  const recoveredAuthorityByOutputId =
    await resolveSessionRestoreRecoveredStorageAuthority(outputs);
  const signingOutputs = resolveSessionRestoreSigningOutputs(outputs, recoveredAuthorityByOutputId);
  const signedByPath = await getSignedMediaUrlsBatch({
    bucket: "media_library",
    storagePaths: collectSessionRestoreSigningPaths(signingOutputs, {
      includeDetailFullQuality: false,
    }),
    surface: "reference-grid",
    queryMode: "default",
  });
  return {
    signedByPath,
    recoveredAuthorityByOutputId,
  };
};

/**
 * Resolves signed URLs for a set of restored outputs.
 */
export const resolveSessionRestoreSignedUrls = async (
  outputs: StudioOutput[]
): Promise<Map<string, string | null>> => {
  const { signedByPath } = await resolveSessionRestoreSignedMediaAuthority(outputs);
  return signedByPath;
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

    const recoveredAuthority = options?.recoveredAuthorityById?.[output.id];
    const previewPosterStoragePath =
      output.mode === "video"
        ? resolveVideoPosterStoragePath({
            previewPosterStoragePath:
              currentFingerprint.previewPosterStoragePath ??
              recoveredAuthority?.previewPosterStoragePath ??
              null,
            previewStoragePath:
              currentFingerprint.previewStoragePath ??
              recoveredAuthority?.previewStoragePath ??
              null,
            fullStoragePath:
              currentFingerprint.fullStoragePath ?? recoveredAuthority?.fullStoragePath ?? null,
          })
        : null;
    const previewStoragePath = resolveSessionVideoPrimaryStoragePath({
      mode: output.mode,
      previewStoragePath:
        currentFingerprint.previewStoragePath ?? recoveredAuthority?.previewStoragePath ?? null,
      fullStoragePath:
        currentFingerprint.fullStoragePath ?? recoveredAuthority?.fullStoragePath ?? null,
    });
    const companionArtStoragePath = currentFingerprint.companionArtStoragePath;
    const fullStoragePath =
      currentFingerprint.fullStoragePath ?? recoveredAuthority?.fullStoragePath ?? null;
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
