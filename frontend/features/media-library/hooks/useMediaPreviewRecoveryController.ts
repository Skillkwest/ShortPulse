/**
 * Shared preview recovery controller.
 * Handles signed-url refresh, retry caps, and hydrate fallback after preview errors.
 */
import { useCallback, type MutableRefObject } from "react";
import { canRetryMediaPreviewSignedUrl } from "../../../lib/mediaPreviewRuntimePolicy";
import {
  resolveMediaDirectPreviewUrls,
  resolveMediaSigningStoragePaths,
} from "../../../lib/mediaPreviewPath";
import type { MediaDataTab } from "../logic/mediaLibraryPageHelpers";

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
    options?: { forceRefresh?: boolean }
  ) => Promise<string | null>;
  signedUrlRetryRef: MutableRefObject<Record<string, number>>;
  objectUrlByMediaIdRef: MutableRefObject<Record<string, string>>;
  resolveTabForRow: (row: TRow) => MediaDataTab;
  beforeRetry?: (params: { row: TRow; failedUrl?: string | null }) => void;
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
}: UseMediaPreviewRecoveryControllerArgs<TRow>): UseMediaPreviewRecoveryControllerResult<TRow> => {
  const refreshSignedUrl = useCallback(
    async (row: TRow): Promise<string | null> => {
      const signingCandidates = resolveMediaSigningStoragePaths(row, currentUserIdRef.current);
      if (!signingCandidates.length) return null;
      const tab = resolveTabForRow(row);
      try {
        for (const storagePath of signingCandidates) {
          const nextSignedUrl = await signStoragePath(storagePath, { forceRefresh: true });
          if (!nextSignedUrl) continue;
          const previousObjectUrl = objectUrlByMediaIdRef.current[row.id];
          if (previousObjectUrl) {
            URL.revokeObjectURL(previousObjectUrl);
            delete objectUrlByMediaIdRef.current[row.id];
          }
          applySignedUrlsToTab(tab, new Map([[row.id, nextSignedUrl]]));
          return nextSignedUrl;
        }
        const directUrl = resolveMediaDirectPreviewUrls(row, currentUserIdRef.current)[0] ?? null;
        if (directUrl) {
          const previousObjectUrl = objectUrlByMediaIdRef.current[row.id];
          if (previousObjectUrl) {
            URL.revokeObjectURL(previousObjectUrl);
            delete objectUrlByMediaIdRef.current[row.id];
          }
          applySignedUrlsToTab(tab, new Map([[row.id, directUrl]]));
          return directUrl;
        }
        return null;
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
    ]
  );

  const handleMediaPreviewError = useCallback(
    (row: TRow, failedUrl?: string | null) => {
      beforeRetry?.({ row, failedUrl });
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
      hydrateViaStorageDownload,
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
