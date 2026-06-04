/**
 * Reference Grid storage signing controller.
 * Converts canonical storage paths into temporary render URLs for visible rail media.
 */
import { useEffect, useMemo, useState } from "react";
import { asCanonicalStoragePath } from "../../../../lib/adaptive-media";
import { getSignedMediaUrlsBatch } from "../../../../lib/mediaSignedUrlCache";
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
    previewStoragePath: signedPreviewUrl ?? output.previewStoragePath,
    fullStoragePath: signedFullUrl ?? output.fullStoragePath,
    previewUrl: signedPreviewUrl ?? output.previewUrl,
    previewPosterUrl: signedPosterUrl ?? output.previewPosterUrl,
    resultUrls: nextResultUrls.length > 0 ? nextResultUrls : output.resultUrls,
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
  const [signedStorageUrlByPath, setSignedStorageUrlByPath] = useState<Map<string, string>>(
    () => new Map()
  );

  useEffect(() => {
    const pathsForRequest = storagePathKey ? storagePathKey.split("\n") : [];

    if (!pathsForRequest.length) {
      return;
    }

    let cancelled = false;
    void getSignedMediaUrlsBatch({
      bucket: REFERENCE_GRID_MEDIA_BUCKET,
      storagePaths: pathsForRequest,
      surface: "reference-grid",
      queryMode: "default",
    }).then((resolvedUrls) => {
      if (cancelled) return;
      setSignedStorageUrlByPath((previous) => {
        const next = new Map<string, string>();
        pathsForRequest.forEach((path) => {
          const signedUrl = resolvedUrls.get(path) ?? previous.get(path) ?? null;
          if (signedUrl) next.set(path, signedUrl);
        });
        return areSignedUrlMapsEqual(previous, next) ? previous : next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [storagePathKey]);

  return {
    signedStorageUrlByPath,
  };
};
