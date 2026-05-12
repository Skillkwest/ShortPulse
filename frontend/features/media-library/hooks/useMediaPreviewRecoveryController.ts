/**
 * Shared preview recovery controller.
 * Handles signed-url refresh, retry caps, and hydrate fallback after preview errors.
 */
import { useCallback, type MutableRefObject } from "react";
import type { MediaPreviewTransformProfile } from "../../../lib/mediaPreviewTransformProfile";
import { canRetryMediaPreviewSignedUrl } from "../../../lib/mediaPreviewRuntimePolicy";
import { resolveMediaPreviewCandidates } from "../../../lib/mediaPreviewPath";
import type { MediaDataTab } from "../logic/mediaLibraryPageHelpers";
import { resolveSignedSelectionUrl } from "../logic/mediaPreviewResolver";

type PreviewRecoveryRowBase = {
  id: string;
  storage_path: string;
  file_type: "image" | "video" | string;
  source?: "upload" | "ai_studio" | string | null;
  metadata?: Record<string, unknown> | null;
  thumb_variant_path?: string | null;
  poster_variant_path?: string | null;
  preview_variant_path?: string | null;
  signedUrl?: string | null;
};

type UseMediaPreviewRecoveryControllerArgs<TRow extends PreviewRecoveryRowBase> = {
  applySignedUrlsToTab: (tab: MediaDataTab, signedById: Map<string, string>) => void;
  currentUserIdRef: MutableRefObject<string | null>;
  resolveSignedUrlsByMediaIds: (tab: MediaDataTab, rows: TRow[]) => Promise<Set<string>>;
  hydrateViaStorageDownload: (row: TRow) => Promise<string | null>;
  signStoragePath: (
    storagePath: string,
    options?: { forceRefresh?: boolean; previewProfile?: MediaPreviewTransformProfile }
  ) => Promise<string | null>;
  signedUrlRetryRef: MutableRefObject<Record<string, number>>;
  objectUrlByMediaIdRef: MutableRefObject<Record<string, string>>;
  resolveTabForRow: (row: TRow) => MediaDataTab;
  beforeRetry?: (params: { row: TRow; failedUrl?: string | null }) => void;
  previewProfile?: MediaPreviewTransformProfile;
};

type UseMediaPreviewRecoveryControllerResult<TRow extends PreviewRecoveryRowBase> = {
  refreshSignedUrl: (row: TRow) => Promise<string | null>;
  handleMediaPreviewError: (row: TRow, failedUrl?: string | null) => void;
};

/**
 * Returns shared media-preview recovery callbacks used by modal and route surfaces.
 */
export const useMediaPreviewRecoveryController = <TRow extends PreviewRecoveryRowBase>({
  applySignedUrlsToTab,
  currentUserIdRef,
  resolveSignedUrlsByMediaIds,
  hydrateViaStorageDownload,
  signStoragePath,
  signedUrlRetryRef,
  objectUrlByMediaIdRef,
  resolveTabForRow,
  beforeRetry,
  previewProfile = "none",
}: UseMediaPreviewRecoveryControllerArgs<TRow>): UseMediaPreviewRecoveryControllerResult<TRow> => {
  const refreshSignedUrl = useCallback(
    async (row: TRow): Promise<string | null> => {
      const tab = resolveTabForRow(row);
      try {
        const nextSignedUrl = await resolveSignedSelectionUrl({
          row,
          currentUserId: currentUserIdRef.current,
          signStoragePath: (storagePath, options) =>
            signStoragePath(storagePath, {
              ...options,
              previewProfile,
            }),
        });
        if (!nextSignedUrl) return null;
        const previousObjectUrl = objectUrlByMediaIdRef.current[row.id];
        if (previousObjectUrl) {
          URL.revokeObjectURL(previousObjectUrl);
          delete objectUrlByMediaIdRef.current[row.id];
        }
        applySignedUrlsToTab(tab, new Map([[row.id, nextSignedUrl]]));
        return nextSignedUrl;
      } catch {
        return null;
      }
    },
    [
      applySignedUrlsToTab,
      currentUserIdRef,
      objectUrlByMediaIdRef,
      resolveTabForRow,
      signStoragePath,
      previewProfile,
    ]
  );

  const handleMediaPreviewError = useCallback(
    (row: TRow, failedUrl?: string | null) => {
      beforeRetry?.({ row, failedUrl });
      const directPreviewUrl = resolveMediaPreviewCandidates(
        row,
        currentUserIdRef.current
      ).directUrl;
      const currentSignedUrl = typeof row.signedUrl === "string" ? row.signedUrl.trim() : "";
      const normalizedFailedUrl = typeof failedUrl === "string" ? failedUrl.trim() : "";
      if (
        directPreviewUrl &&
        directPreviewUrl !== currentSignedUrl &&
        directPreviewUrl !== normalizedFailedUrl
      ) {
        const tab = resolveTabForRow(row);
        const previousObjectUrl = objectUrlByMediaIdRef.current[row.id];
        if (previousObjectUrl) {
          URL.revokeObjectURL(previousObjectUrl);
          delete objectUrlByMediaIdRef.current[row.id];
        }
        applySignedUrlsToTab(tab, new Map([[row.id, directPreviewUrl]]));
        return;
      }
      const attempts = signedUrlRetryRef.current[row.id] ?? 0;
      if (!canRetryMediaPreviewSignedUrl(attempts)) return;
      signedUrlRetryRef.current[row.id] = attempts + 1;
      void refreshSignedUrl(row).then(async (nextUrl) => {
        const returnedSameUrl = Boolean(nextUrl && row.signedUrl && nextUrl === row.signedUrl);
        if (nextUrl && !returnedSameUrl) return;
        const tab = resolveTabForRow(row);
        const stillUnresolved = await resolveSignedUrlsByMediaIds(tab, [row]);
        if (!stillUnresolved.has(row.id)) return;
        void hydrateViaStorageDownload(row);
      });
    },
    [
      beforeRetry,
      applySignedUrlsToTab,
      hydrateViaStorageDownload,
      currentUserIdRef,
      objectUrlByMediaIdRef,
      refreshSignedUrl,
      resolveSignedUrlsByMediaIds,
      resolveTabForRow,
      signedUrlRetryRef,
    ]
  );

  return {
    refreshSignedUrl,
    handleMediaPreviewError,
  };
};
