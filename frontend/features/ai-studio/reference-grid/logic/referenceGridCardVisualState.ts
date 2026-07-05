/**
 * Reference-grid card visual-state policy.
 * Separates generation lifecycle loading from media hydration loading.
 */
import type { StudioOutput } from "../../types";
import { hasOutputStoragePaths, hasStorageAuthority } from "../../logic/referenceOutputAuthority";
import {
  isReferenceOutputFailing,
  isReferenceOutputLoadingTaskState,
} from "./referenceGridLoadingState";

export type ReferenceGridCardVisualInput = {
  item: StudioOutput;
  cardPreviewUrl: string | null;
  isLoaded: boolean;
  decodeBudgetEnabled: boolean;
  isImagePreview: boolean;
  isPriorityHydration: boolean;
  imageSrc?: string;
  isStorageSigningPending?: boolean;
};

export type ReferenceGridCardLoadingVisual = "none" | "spinner" | "hydrating";

export type ReferenceGridCardVisualState = {
  isFailing: boolean;
  isGenerationLoading: boolean;
  isLocalVideoPersistenceLoading: boolean;
  isMediaHydrating: boolean;
  isLoading: boolean;
  loadingVisual: ReferenceGridCardLoadingVisual;
};

const LOCAL_VIDEO_URL_PATTERN = /^(?:blob:|data:video\/)/i;

export const isLocalVideoReferencePendingPersistence = (
  item: Pick<
    StudioOutput,
    "mode" | "previewUrl" | "previewStoragePath" | "fullStoragePath" | "saveState" | "savedMediaIds"
  >
): boolean => {
  if (item.mode !== "video") return false;
  if (item.saveState === "failed" || item.saveState === "blocked_storage") return false;
  const previewUrl = item.previewUrl?.trim() ?? "";
  if (!LOCAL_VIDEO_URL_PATTERN.test(previewUrl)) return false;
  return !hasStorageAuthority(item);
};

/**
 * Resolves loading visual state for one card without coupling task state to decode timing.
 */
export const classifyReferenceGridCardVisualState = ({
  item,
  cardPreviewUrl,
  isLoaded,
  decodeBudgetEnabled,
  isImagePreview,
  isPriorityHydration,
  imageSrc,
  isStorageSigningPending = false,
}: ReferenceGridCardVisualInput): ReferenceGridCardVisualState => {
  const isFailing = isReferenceOutputFailing(item);
  const hasRenderablePreview = Boolean(cardPreviewUrl);
  const hasDurableMediaAuthority = hasStorageAuthority(item);
  const hasDurableStoragePathAuthority = hasOutputStoragePaths(item);
  const hasRenderableCardMedia = hasRenderablePreview && (!isImagePreview || Boolean(imageSrc));
  const isLiveProviderTask = item.submissionMode === "provider-task";
  const hasTerminalGeneratedPreview =
    item.mediaSource === "generated" &&
    hasRenderableCardMedia &&
    (item.taskState === "success" || !isLiveProviderTask);
  const hasRenderableGeneratedMedia =
    (item.mediaSource === "generated" && hasRenderableCardMedia && hasDurableMediaAuthority) ||
    hasTerminalGeneratedPreview;
  const hasLoadedGeneratedMedia = hasRenderableGeneratedMedia;
  const isGenerationLoading =
    !isFailing &&
    !hasDurableMediaAuthority &&
    !hasLoadedGeneratedMedia &&
    isReferenceOutputLoadingTaskState({
      taskState: item.taskState,
    });
  const isLocalVideoPersistenceLoading =
    !isFailing && !isGenerationLoading && isLocalVideoReferencePendingPersistence(item);

  const hasPromptOnlyPreview = Boolean(item.previewText);
  const isDecodeBudgetHydrationPending =
    isImagePreview && decodeBudgetEnabled && !imageSrc && isPriorityHydration;
  const isDecodeBudgetAwaitingTurn =
    isImagePreview && decodeBudgetEnabled && !imageSrc && !isPriorityHydration;
  const hasActiveStorageResolveWork = hasDurableStoragePathAuthority && isStorageSigningPending;
  const isMediaHydrating =
    !isFailing &&
    !isGenerationLoading &&
    !isLocalVideoPersistenceLoading &&
    !isDecodeBudgetAwaitingTurn &&
    !hasRenderableGeneratedMedia &&
    (hasRenderablePreview || hasActiveStorageResolveWork) &&
    !hasPromptOnlyPreview &&
    (!isLoaded || isDecodeBudgetHydrationPending);

  const loadingVisual: ReferenceGridCardLoadingVisual =
    isGenerationLoading || isLocalVideoPersistenceLoading
      ? "spinner"
      : isMediaHydrating
        ? "hydrating"
        : "none";

  return {
    isFailing,
    isGenerationLoading,
    isLocalVideoPersistenceLoading,
    isMediaHydrating,
    isLoading: loadingVisual !== "none",
    loadingVisual,
  };
};
