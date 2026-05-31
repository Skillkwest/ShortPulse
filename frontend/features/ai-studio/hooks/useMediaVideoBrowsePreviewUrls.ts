import React from "react";
import { getSignedMediaUrlsBatch } from "../../../lib/mediaSignedUrlCache";
import { BUCKET, type MediaFileRow } from "../logic/mediaLibraryModalModel";
import {
  asRenderableVideoUrl,
  collectVideoBrowseSigningRequests,
} from "../logic/mediaVideoBrowsePreview";

type UseMediaVideoBrowsePreviewUrlsArgs = {
  mediaRows: MediaFileRow[];
  currentUserId?: string | null;
  surface?:
    | "media-library-panel"
    | "elements-media-panel"
    | "character-media-panel"
    | "media-library-modal";
  visibleMediaIdsRef?: React.MutableRefObject<Set<string>>;
  visibleMediaVersion?: number;
};

type SignedUrlMap = Record<string, string>;
const VISIBLE_SCOPED_VIDEO_SURFACES = new Set([
  "media-library-panel",
  "elements-media-panel",
  "character-media-panel",
]);

const areSignedUrlMapsEqual = (left: SignedUrlMap, right: SignedUrlMap): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  return leftKeys.length === rightKeys.length && rightKeys.every((key) => left[key] === right[key]);
};

export const useMediaVideoBrowsePreviewUrls = ({
  mediaRows,
  currentUserId = null,
  surface = "media-library-panel",
  visibleMediaIdsRef,
  visibleMediaVersion = 0,
}: UseMediaVideoBrowsePreviewUrlsArgs): {
  signedPosterUrlById: SignedUrlMap;
  signedVideoUrlById: SignedUrlMap;
} => {
  const [signedPosterUrlById, setSignedPosterUrlById] = React.useState<SignedUrlMap>({});
  const [signedVideoUrlById, setSignedVideoUrlById] = React.useState<SignedUrlMap>({});

  React.useEffect(() => {
    const scopedMediaRows =
      VISIBLE_SCOPED_VIDEO_SURFACES.has(surface) && visibleMediaIdsRef
        ? mediaRows.filter((row) => visibleMediaIdsRef.current.has(row.id))
        : mediaRows;
    const directVideoUrlById: SignedUrlMap = {};
    for (const row of scopedMediaRows) {
      const previewVariantUrl = asRenderableVideoUrl(row.preview_variant_path);
      if (previewVariantUrl) directVideoUrlById[row.id] = previewVariantUrl;
    }
    const {
      hoverVideoPathByRowId: collectedHoverVideoPathByRowId,
      posterPathByRowId,
      storagePaths: collectedStoragePaths,
    } = collectVideoBrowseSigningRequests(scopedMediaRows, currentUserId);
    const hoverVideoPathByRowId = new Map<string, string>();
    const storagePaths = new Set<string>();

    for (const [rowId, storagePath] of collectedHoverVideoPathByRowId.entries()) {
      if (directVideoUrlById[rowId]) continue;
      hoverVideoPathByRowId.set(rowId, storagePath);
      storagePaths.add(storagePath);
    }
    for (const [, candidates] of posterPathByRowId.entries()) {
      for (const candidate of candidates) {
        if (!collectedStoragePaths.has(candidate)) continue;
        storagePaths.add(candidate);
      }
    }

    if (storagePaths.size === 0) {
      setSignedVideoUrlById((prev) =>
        areSignedUrlMapsEqual(prev, directVideoUrlById) ? prev : directVideoUrlById
      );
      setSignedPosterUrlById((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      return;
    }

    let cancelled = false;
    void getSignedMediaUrlsBatch({
      bucket: BUCKET,
      storagePaths: Array.from(storagePaths),
      surface,
    })
      .then((signedByPath) => {
        if (cancelled) return;
        const nextSignedVideoUrlById: SignedUrlMap = {};
        for (const [rowId, directVideoUrl] of Object.entries(directVideoUrlById)) {
          nextSignedVideoUrlById[rowId] = directVideoUrl;
        }
        for (const [rowId, storagePath] of hoverVideoPathByRowId.entries()) {
          const signedUrl = signedByPath.get(storagePath) ?? null;
          if (signedUrl) {
            nextSignedVideoUrlById[rowId] = signedUrl;
          }
        }
        setSignedVideoUrlById((prev) =>
          areSignedUrlMapsEqual(prev, nextSignedVideoUrlById) ? prev : nextSignedVideoUrlById
        );

        const nextSignedPosterUrlById: SignedUrlMap = {};
        for (const [rowId, candidates] of posterPathByRowId.entries()) {
          const signedUrl = candidates
            .map((candidate) => signedByPath.get(candidate) ?? null)
            .find((candidate): candidate is string => Boolean(candidate));
          if (signedUrl) {
            nextSignedPosterUrlById[rowId] = signedUrl;
          }
        }
        setSignedPosterUrlById((prev) =>
          areSignedUrlMapsEqual(prev, nextSignedPosterUrlById) ? prev : nextSignedPosterUrlById
        );
      })
      .catch(() => {
        if (cancelled) return;
        setSignedVideoUrlById((prev) =>
          areSignedUrlMapsEqual(prev, directVideoUrlById) ? prev : directVideoUrlById
        );
        setSignedPosterUrlById((prev) => (Object.keys(prev).length > 0 ? {} : prev));
      });

    return () => {
      cancelled = true;
    };
  }, [currentUserId, mediaRows, surface, visibleMediaIdsRef, visibleMediaVersion]);

  return {
    signedPosterUrlById,
    signedVideoUrlById,
  };
};
