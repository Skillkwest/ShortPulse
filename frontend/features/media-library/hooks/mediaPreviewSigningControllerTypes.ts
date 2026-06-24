/**
 * Shared type contracts for the Media Library preview-signing controller.
 */
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type {
  MediaDataTab,
  MediaSignBudget,
  MediaTabBooleanState,
} from "../logic/mediaLibraryPageHelpers";
import type { MediaPreviewSigningSurface } from "./mediaPreviewSigningControllerConfig";

export type PreviewSigningRowBase = {
  id: string;
  storage_path: string;
  source?: string | null;
  file_type?: string | null;
  status?: "uploading" | "ready";
  signedUrl?: string | null;
};

export type UseMediaPreviewSigningControllerArgs<
  TRow extends PreviewSigningRowBase,
  TTab extends string,
> = {
  activeMediaTab: MediaDataTab | null;
  activeMediaCacheLoading: boolean;
  activeMediaCachePagesLoaded: number;
  activeMediaQuery: string;
  activeMediaQueryRef: MutableRefObject<string>;
  activeTabRef: MutableRefObject<TTab>;
  applySignedUrlsToTab: (tab: MediaDataTab, signedById: Map<string, string>) => void;
  currentUserIdRef: MutableRefObject<string | null>;
  filteredMedia: TRow[];
  hydrateViaStorageDownload: (row: TRow) => Promise<string | null>;
  isMountedRef: MutableRefObject<boolean>;
  mediaSignInFlightRef: MutableRefObject<MediaTabBooleanState>;
  resolveSignedUrlsByMediaIds: (tab: MediaDataTab, rows: TRow[]) => Promise<Set<string>>;
  setSignPassNonce: Dispatch<SetStateAction<number>>;
  signAttemptRef: MutableRefObject<Record<string, number>>;
  signBudget: MediaSignBudget;
  signPassNonce: number;
  visibleMediaIdsRef: MutableRefObject<Set<string>>;
  visibleMediaVersion: number;
  isSigningPassEnabled?: boolean;
  isSignPrefetchEnabled?: boolean;
  surface?: MediaPreviewSigningSurface;
  unresolvedWarningPrefix?: string;
  isResultStillRelevant?: (params: { tab: MediaDataTab; query: string }) => boolean;
  maxSignAttemptsPerItem?: number;
  maxSignCandidatesPerRow?: number;
  backgroundHydrateFallbackEnabled?: boolean;
};
