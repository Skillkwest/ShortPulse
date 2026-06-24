/**
 * Reference Grid storage signing controller.
 * Converts canonical storage paths into temporary render URLs for visible rail media.
 */
import { useEffect, useMemo, useRef, useState } from "react";
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

  const previewPath = pushPath(output.previewStoragePath);
  const posterPath = pushPath(output.previewPosterStoragePath);
  const companionArtPath = pushPath(output.companionArtStoragePath);

  if (signingMode === "full-authority") {
    pushPath(output.fullStoragePath);
    output.resultUrls?.forEach(pushPath);
    return paths;
  }

  const needsFullFallback =
    !previewPath &&
    (!posterPath || output.mode === "video") &&
    (!companionArtPath || output.mode === "audio");
  if (needsFullFallback) {
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

const shouldResolveSavedMediaAuthority = (output: ReferenceGridMediaOutput): boolean =>
  Boolean(resolveSavedMediaId(output));

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
    if (!output || !shouldResolveSavedMediaAuthority(output)) return;
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
  const signedCompanionArtUrl = signedUrlFor(output.companionArtStoragePath);
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

  if (!signedPreviewUrl && !signedFullUrl && !signedCompanionArtUrl && !hasSignedResultUrl) {
    return output;
  }

  return {
    ...output,
    previewUrl: signedPreviewUrl ?? output.previewUrl,
    previewPosterUrl: signedPosterUrl ?? output.previewPosterUrl,
    companionArtUrl: signedCompanionArtUrl ?? output.companionArtUrl,
    resultUrls: nextResultUrls.length > 0 ? nextResultUrls : output.resultUrls,
  };
};

export const applySignedMediaAuthorityToReferenceGridMediaOutput = (
  output: ReferenceGridMediaOutput,
  signedMediaAuthorityByMediaId: ReadonlyMap<string, SessionSignedMediaRestoreAuthority>
): ReferenceGridMediaOutput => {
  if (!shouldResolveSavedMediaAuthority(output)) return output;
  const mediaId = resolveSavedMediaId(output);
  const authority = mediaId ? signedMediaAuthorityByMediaId.get(mediaId) : null;
  if (!authority) return output;

  const signedPreviewUrl = authority.signedPreviewUrl ?? output.previewUrl;
  const signedFullUrl = authority.signedFullUrl ?? output.resultUrls?.[0] ?? output.previewUrl;
  const signedPosterUrl = authority.signedPreviewPosterUrl ?? output.previewPosterUrl;

  const nextPreviewStoragePath = authority.previewStoragePath ?? output.previewStoragePath;
  const nextFullStoragePath = authority.fullStoragePath ?? output.fullStoragePath;
  const nextPreviewPosterStoragePath =
    authority.previewPosterStoragePath ?? output.previewPosterStoragePath;
  const nextResultUrls = signedFullUrl
    ? [signedFullUrl, ...(output.resultUrls ?? []).filter((value) => value !== signedFullUrl)]
    : output.resultUrls;

  if (
    nextPreviewStoragePath === output.previewStoragePath &&
    nextFullStoragePath === output.fullStoragePath &&
    nextPreviewPosterStoragePath === output.previewPosterStoragePath &&
    signedPreviewUrl === output.previewUrl &&
    signedPosterUrl === output.previewPosterUrl &&
    nextResultUrls === output.resultUrls
  ) {
    return output;
  }

  return {
    ...output,
    previewStoragePath: nextPreviewStoragePath,
    fullStoragePath: nextFullStoragePath,
    previewPosterStoragePath: nextPreviewPosterStoragePath,
    previewUrl: signedPreviewUrl,
    previewPosterUrl: signedPosterUrl,
    resultUrls: nextResultUrls,
  };
};

export const useReferenceGridSignedStorageUrlController = ({
  outputs,
  signingMode = "card-preview",
  suspendSigningRequests = false,
}: {
  outputs: readonly (ReferenceGridMediaOutput | null | undefined)[];
  signingMode?: ReferenceGridStorageSigningMode;
  suspendSigningRequests?: boolean;
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
  const signedStorageUrlByPathRef = useRef(signedStorageUrlByPath);

  useEffect(() => {
    signedStorageUrlByPathRef.current = signedStorageUrlByPath;
  }, [signedStorageUrlByPath]);

  useEffect(() => {
    const pathsForRequest = storagePathKey ? storagePathKey.split("\n") : [];
    let cancelled = false;

    if (suspendSigningRequests) return;

    if (!pathsForRequest.length) {
      queueMicrotask(() => {
        if (cancelled) return;
        setSigningPendingStoragePathSet((previous) =>
          previous.size === 0 ? previous : new Set<string>()
        );
      });
      return;
    }

    queueMicrotask(() => {
      if (cancelled) return;
      setSigningPendingStoragePathSet((previous) => {
        const next = new Set(
          pathsForRequest.filter((path) => !signedStorageUrlByPathRef.current.has(path))
        );
        return areStringSetsEqual(previous, next) ? previous : next;
      });
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
  }, [storagePathKey, suspendSigningRequests]);

  useEffect(() => {
    const mediaIdsForRequest = savedMediaIdKey ? savedMediaIdKey.split("\n") : [];

    if (suspendSigningRequests || !mediaIdsForRequest.length) return;

    let cancelled = false;
    void resolveSessionRestoreSignedMediaAuthorityByMediaId(mediaIdsForRequest)
      .then((resolvedAuthority) => {
        if (cancelled) return;
        setSignedMediaAuthorityByMediaId((previous) =>
          areSignedMediaAuthorityMapsEqual(previous, resolvedAuthority)
            ? previous
            : new Map(resolvedAuthority)
        );
      })
      .catch(() => {
        // Saved-media authority recovery is best-effort; keep any previously resolved authority.
      });

    return () => {
      cancelled = true;
    };
  }, [savedMediaIdKey, suspendSigningRequests]);

  return {
    signedStorageUrlByPath,
    signedMediaAuthorityByMediaId,
    signingPendingStoragePathSet,
  };
};
