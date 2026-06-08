/**
 * Reference Grid storage signing controller.
 * Converts canonical storage paths into temporary render URLs for visible rail media.
 */
import { useEffect, useMemo, useState } from "react";
import { asCanonicalStoragePath } from "../../../../lib/adaptive-media";
import { getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";
import {
  resolveSessionRestoreSignedMediaAuthorityByMediaId,
  type SessionSignedMediaRestoreAuthority,
} from "../../logic/sessionRestoreMediaSigning";
import type { ReferenceGridMediaOutput } from "../logic/referenceGridMediaOutput";

const REFERENCE_GRID_MEDIA_BUCKET = "media_library";

export type ReferenceGridStorageSigningMode = "card-preview" | "full-authority";

const collectOutputStoragePaths = (
  output: ReferenceGridMediaOutput,
  signingMode: ReferenceGridStorageSigningMode
): string[] => {
  const paths: string[] = [];
  const pushPath = (value: string | null | undefined) => {
    const path = asCanonicalStoragePath(value);
    if (path) paths.push(path);
    return path;
  };

  pushPath(output.previewStoragePath);
  pushPath(output.previewPosterStoragePath);

  if (signingMode === "full-authority") {
    pushPath(output.fullStoragePath);
    output.resultUrls?.forEach(pushPath);
    return paths;
  }

  if (paths.length === 0) {
    pushPath(output.fullStoragePath);
    output.resultUrls?.forEach(pushPath);
  }

  return paths;
};

const areSignedUrlMapsEqual = (
  left: ReadonlyMap<string, string>,
  right: ReadonlyMap<string, string>
) => {
  if (left === right) return true;
  if (left.size !== right.size) return false;
  for (const [path, url] of left.entries()) {
    if (right.get(path) !== url) return false;
  }
  return true;
};

const areStringSetsEqual = (left: ReadonlySet<string>, right: ReadonlySet<string>) => {
  if (left === right) return true;
  if (left.size !== right.size) return false;
  for (const value of left) {
    if (!right.has(value)) return false;
  }
  return true;
};

const areSignedMediaAuthorityMapsEqual = (
  left: ReadonlyMap<string, SessionSignedMediaRestoreAuthority>,
  right: ReadonlyMap<string, SessionSignedMediaRestoreAuthority>
) => {
  if (left === right) return true;
  if (left.size !== right.size) return false;
  for (const [mediaId, authority] of left.entries()) {
    const nextAuthority = right.get(mediaId);
    if (
      !nextAuthority ||
      nextAuthority.signedPreviewUrl !== authority.signedPreviewUrl ||
      nextAuthority.signedFullUrl !== authority.signedFullUrl ||
      nextAuthority.signedPreviewPosterUrl !== authority.signedPreviewPosterUrl ||
      nextAuthority.previewStoragePath !== authority.previewStoragePath ||
      nextAuthority.fullStoragePath !== authority.fullStoragePath ||
      nextAuthority.previewPosterStoragePath !== authority.previewPosterStoragePath
    ) {
      return false;
    }
  }
  return true;
};

const resolveSavedMediaId = (output: ReferenceGridMediaOutput): string | null =>
  output.savedMediaIds?.find((value) => typeof value === "string" && value.trim().length > 0) ??
  null;

const needsSavedMediaAuthorityRecovery = (output: ReferenceGridMediaOutput): boolean =>
  Boolean(resolveSavedMediaId(output)) &&
  !asCanonicalStoragePath(output.previewStoragePath) &&
  !asCanonicalStoragePath(output.previewPosterStoragePath) &&
  !asCanonicalStoragePath(output.fullStoragePath);

export const collectReferenceGridStoragePaths = (
  outputs: readonly (ReferenceGridMediaOutput | null | undefined)[],
  {
    signingMode = "card-preview",
  }: {
    signingMode?: ReferenceGridStorageSigningMode;
  } = {}
): string[] => {
  const seen = new Set<string>();
  const paths: string[] = [];
  outputs.forEach((output) => {
    if (!output) return;
    collectOutputStoragePaths(output, signingMode).forEach((path) => {
      if (seen.has(path)) return;
      seen.add(path);
      paths.push(path);
    });
  });
  return paths;
};

export const collectReferenceGridSavedMediaIdsForSigning = (
  outputs: readonly (ReferenceGridMediaOutput | null | undefined)[]
): string[] => {
  const seen = new Set<string>();
  const mediaIds: string[] = [];
  outputs.forEach((output) => {
    if (!output || !needsSavedMediaAuthorityRecovery(output)) return;
    const mediaId = resolveSavedMediaId(output);
    if (!mediaId || seen.has(mediaId)) return;
    seen.add(mediaId);
    mediaIds.push(mediaId);
  });
  return mediaIds;
};

export const applySignedStorageUrlsToReferenceGridMediaOutput = (
  output: ReferenceGridMediaOutput,
  signedStorageUrlByPath: ReadonlyMap<string, string>
): ReferenceGridMediaOutput => {
  const signedUrlFor = (value: string | null | undefined): string | null => {
    const path = asCanonicalStoragePath(value);
    return path ? (signedStorageUrlByPath.get(path) ?? null) : null;
  };
  const signedPreviewUrl =
    signedUrlFor(output.previewStoragePath) ?? signedUrlFor(output.previewPosterStoragePath);
  const signedPosterUrl = signedUrlFor(output.previewPosterStoragePath);
  let hasSignedResultUrl = false;
  let firstSignedResultUrl: string | null = null;
  const signedResultUrls =
    output.resultUrls
      ?.map((value) => {
        const path = asCanonicalStoragePath(value);
        const signedUrl = path ? (signedStorageUrlByPath.get(path) ?? null) : null;
        if (signedUrl) {
          hasSignedResultUrl = true;
          firstSignedResultUrl = firstSignedResultUrl ?? signedUrl;
          return signedUrl;
        }
        return value;
      })
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0) ??
    [];
  const signedFullUrl = signedUrlFor(output.fullStoragePath) ?? firstSignedResultUrl;
  const nextResultUrls = signedFullUrl
    ? [signedFullUrl, ...signedResultUrls.filter((value) => value !== signedFullUrl)]
    : signedResultUrls;

  if (!signedPreviewUrl && !signedFullUrl && !hasSignedResultUrl) {
    return output;
  }

  return {
    ...output,
    previewUrl: signedPreviewUrl ?? output.previewUrl,
    previewPosterUrl: signedPosterUrl ?? output.previewPosterUrl,
    resultUrls: nextResultUrls.length > 0 ? nextResultUrls : output.resultUrls,
  };
};

export const applySignedMediaAuthorityToReferenceGridMediaOutput = (
  output: ReferenceGridMediaOutput,
  signedMediaAuthorityByMediaId: ReadonlyMap<string, SessionSignedMediaRestoreAuthority>
): ReferenceGridMediaOutput => {
  if (!needsSavedMediaAuthorityRecovery(output)) return output;
  const mediaId = resolveSavedMediaId(output);
  const authority = mediaId ? signedMediaAuthorityByMediaId.get(mediaId) : null;
  if (!authority) return output;

  const signedPreviewUrl = authority.signedPreviewUrl ?? authority.signedFullUrl;
  const signedFullUrl = authority.signedFullUrl ?? authority.signedPreviewUrl;
  const signedPosterUrl = authority.signedPreviewPosterUrl;

  if (!signedPreviewUrl && !signedFullUrl && !signedPosterUrl) return output;

  return {
    ...output,
    previewStoragePath: authority.previewStoragePath ?? output.previewStoragePath,
    fullStoragePath: authority.fullStoragePath ?? output.fullStoragePath,
    previewPosterStoragePath: authority.previewPosterStoragePath ?? output.previewPosterStoragePath,
    previewUrl: signedPreviewUrl ?? output.previewUrl,
    previewPosterUrl: signedPosterUrl ?? output.previewPosterUrl,
    resultUrls: signedFullUrl ? [signedFullUrl] : output.resultUrls,
  };
};

export const useReferenceGridSignedStorageUrlController = ({
  outputs,
  signingMode = "card-preview",
}: {
  outputs: readonly (ReferenceGridMediaOutput | null | undefined)[];
  signingMode?: ReferenceGridStorageSigningMode;
}) => {
  const storagePaths = useMemo(
    () => collectReferenceGridStoragePaths(outputs, { signingMode }),
    [outputs, signingMode]
  );
  const storagePathKey = useMemo(() => storagePaths.join("\n"), [storagePaths]);
  const savedMediaIds = useMemo(
    () => collectReferenceGridSavedMediaIdsForSigning(outputs),
    [outputs]
  );
  const savedMediaIdKey = useMemo(() => savedMediaIds.join("\n"), [savedMediaIds]);
  const [signedStorageUrlByPath, setSignedStorageUrlByPath] = useState<Map<string, string>>(
    () => new Map()
  );
  const [signingPendingStoragePathSet, setSigningPendingStoragePathSet] = useState<Set<string>>(
    () => new Set()
  );
  const [signedMediaAuthorityByMediaId, setSignedMediaAuthorityByMediaId] = useState<
    Map<string, SessionSignedMediaRestoreAuthority>
  >(() => new Map());

  useEffect(() => {
    const pathsForRequest = storagePathKey ? storagePathKey.split("\n") : [];

    if (!pathsForRequest.length) {
      setSigningPendingStoragePathSet((previous) =>
        previous.size === 0 ? previous : new Set<string>()
      );
      return;
    }

    let cancelled = false;
    setSigningPendingStoragePathSet((previous) => {
      const next = new Set(pathsForRequest);
      return areStringSetsEqual(previous, next) ? previous : next;
    });
    void getSignedMediaUrlsBatch({
      bucket: REFERENCE_GRID_MEDIA_BUCKET,
      storagePaths: pathsForRequest,
      surface: "reference-grid",
      queryMode: "default",
    })
      .then((resolvedUrls) => {
        if (cancelled) return;
        setSignedStorageUrlByPath((previous) => {
          const next = new Map<string, string>();
          pathsForRequest.forEach((path) => {
            const signedUrl = resolvedUrls.get(path) ?? previous.get(path) ?? null;
            if (signedUrl) next.set(path, signedUrl);
          });
          return areSignedUrlMapsEqual(previous, next) ? previous : next;
        });
        setSigningPendingStoragePathSet((previous) => {
          const next = new Set(previous);
          pathsForRequest.forEach((path) => {
            next.delete(path);
          });
          return areStringSetsEqual(previous, next) ? previous : next;
        });
      })
      .catch(() => {
        if (cancelled) return;
        setSigningPendingStoragePathSet((previous) => {
          const next = new Set(previous);
          pathsForRequest.forEach((path) => {
            next.delete(path);
          });
          return areStringSetsEqual(previous, next) ? previous : next;
        });
      });

    return () => {
      cancelled = true;
    };
  }, [storagePathKey]);

  useEffect(() => {
    const mediaIdsForRequest = savedMediaIdKey ? savedMediaIdKey.split("\n") : [];

    if (!mediaIdsForRequest.length) return;

    let cancelled = false;
    void resolveSessionRestoreSignedMediaAuthorityByMediaId(mediaIdsForRequest).then(
      (resolvedAuthority) => {
        if (cancelled) return;
        setSignedMediaAuthorityByMediaId((previous) =>
          areSignedMediaAuthorityMapsEqual(previous, resolvedAuthority)
            ? previous
            : new Map(resolvedAuthority)
        );
      }
    );

    return () => {
      cancelled = true;
    };
  }, [savedMediaIdKey]);

  return {
    signedStorageUrlByPath,
    signedMediaAuthorityByMediaId,
    signingPendingStoragePathSet,
  };
};
