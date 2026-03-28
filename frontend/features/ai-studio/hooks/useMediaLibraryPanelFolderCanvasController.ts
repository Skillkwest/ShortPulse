/**
 * Media Library panel folder-canvas controller.
 * Keeps folder-canvas full-url hydration and row shaping outside the shared browse runtime.
 */
import { useEffect, useMemo, useState, type MutableRefObject } from "react";
import { type MediaPreviewTransformProfile } from "../../../lib/mediaPreviewTransformProfile";
import { resolveSignedSelectionUrl } from "../../media-library/logic/mediaPreviewResolver";
import { isVideoFile, type MediaFileRow } from "../logic/mediaLibraryModalModel";

const SUPABASE_RENDER_IMAGE_PATH = "/storage/v1/render/image/";

const isTransformedImagePreviewUrl = (value: string | null | undefined): boolean => {
  const normalized = (value ?? "").trim();
  if (!normalized) return false;
  if (normalized.startsWith("/_next/image")) return true;
  return normalized.includes(SUPABASE_RENDER_IMAGE_PATH);
};

const areSignedUrlMapsEqual = (
  left: Record<string, string>,
  right: Record<string, string>
): boolean => {
  const leftKeys = Object.keys(left);
  const rightKeys = Object.keys(right);
  if (leftKeys.length !== rightKeys.length) return false;
  for (const key of leftKeys) {
    if (left[key] !== right[key]) return false;
  }
  return true;
};

type UseMediaLibraryPanelFolderCanvasControllerArgs = {
  currentUserIdRef: MutableRefObject<string | null>;
  mediaRows: MediaFileRow[];
  mediaScopeResolved: boolean;
  promptScopeResolved: boolean;
  showFolderCanvas: boolean;
  signStoragePath: (
    storagePath: string,
    options?: { forceRefresh?: boolean; previewProfile?: MediaPreviewTransformProfile }
  ) => Promise<string | null>;
};

type UseMediaLibraryPanelFolderCanvasControllerResult = {
  folderCanvasDataReady: boolean;
  folderCanvasMediaRows: MediaFileRow[];
};

/**
 * Hydrates full-quality folder-canvas URLs separately from browse-surface preview state.
 */
export const useMediaLibraryPanelFolderCanvasController = ({
  currentUserIdRef,
  mediaRows,
  mediaScopeResolved,
  promptScopeResolved,
  showFolderCanvas,
  signStoragePath,
}: UseMediaLibraryPanelFolderCanvasControllerArgs): UseMediaLibraryPanelFolderCanvasControllerResult => {
  const [folderCanvasFullSignedById, setFolderCanvasFullSignedById] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (!showFolderCanvas) return;
    let cancelled = false;

    const hydrateFolderCanvasFullUrls = async () => {
      const nextById: Record<string, string> = {};
      await Promise.all(
        mediaRows.map(async (row) => {
          const resolvedUrl = await resolveSignedSelectionUrl({
            row,
            currentUserId: currentUserIdRef.current,
            signStoragePath,
          }).catch(() => null);
          const normalized = (resolvedUrl ?? "").trim();
          if (!normalized) return;
          nextById[row.id] = normalized;
        })
      );
      if (cancelled) return;
      setFolderCanvasFullSignedById((previous) =>
        areSignedUrlMapsEqual(previous, nextById) ? previous : nextById
      );
    };

    void hydrateFolderCanvasFullUrls();
    return () => {
      cancelled = true;
    };
  }, [currentUserIdRef, mediaRows, showFolderCanvas, signStoragePath]);

  const folderCanvasMediaRows = useMemo(
    () =>
      showFolderCanvas
        ? mediaRows.map((row) => ({
            ...row,
            signedUrl: (() => {
              const fullSignedUrl = folderCanvasFullSignedById[row.id] ?? null;
              if (fullSignedUrl) return fullSignedUrl;
              if (isVideoFile(row.file_type)) return row.signedUrl ?? null;
              return isTransformedImagePreviewUrl(row.signedUrl) ? null : (row.signedUrl ?? null);
            })(),
          }))
        : mediaRows,
    [folderCanvasFullSignedById, mediaRows, showFolderCanvas]
  );

  return {
    folderCanvasDataReady: showFolderCanvas && mediaScopeResolved && promptScopeResolved,
    folderCanvasMediaRows,
  };
};
