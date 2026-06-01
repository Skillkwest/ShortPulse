/**
 * Reference-grid card visual-state policy.
 * Separates generation lifecycle loading from media hydration loading.
 */
import type { StudioOutput } from "../../types";
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
  item: Pick<StudioOutput, "mode" | "previewUrl" | "previewStoragePath" | "fullStoragePath">
): boolean => {
  if (item.mode !== "video") return false;
  const previewUrl = item.previewUrl?.trim() ?? "";
  if (!LOCAL_VIDEO_URL_PATTERN.test(previewUrl)) return false;
  const previewStoragePath = item.previewStoragePath?.trim() ?? "";
  const fullStoragePath = item.fullStoragePath?.trim() ?? "";
  return previewStoragePath.length === 0 && fullStoragePath.length === 0;
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
}: ReferenceGridCardVisualInput): ReferenceGridCardVisualState => {
  const isFailing = isReferenceOutputFailing(item);
  const hasRenderablePreview = Boolean(cardPreviewUrl);
  const hasRenderableCardMedia = hasRenderablePreview && (!isImagePreview || Boolean(imageSrc));
  const hasRenderableGeneratedMedia = item.mediaSource === "generated" && hasRenderableCardMedia;
  const hasLoadedGeneratedMedia =
    item.mediaSource === "generated" &&
    hasRenderablePreview &&
    (isLoaded || hasRenderableGeneratedMedia);
  const isGenerationLoading =
    !isFailing &&
    !hasLoadedGeneratedMedia &&
    isReferenceOutputLoadingTaskState({
      taskState: item.taskState,
    });
  const isLocalVideoPersistenceLoading =
    !isFailing && !isGenerationLoading && isLocalVideoReferencePendingPersistence(item);

  const hasPromptOnlyPreview = Boolean(item.previewText);
  const isDecodeBudgetHydrationPending =
    isImagePreview && decodeBudgetEnabled && !imageSrc && isPriorityHydration;
  const isMediaHydrating =
    !isFailing &&
    !isGenerationLoading &&
    !isLocalVideoPersistenceLoading &&
    !hasRenderableGeneratedMedia &&
    hasRenderablePreview &&
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
