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
  isMediaHydrating: boolean;
  isLoading: boolean;
  loadingVisual: ReferenceGridCardLoadingVisual;
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
  const isGenerationLoading =
    !isFailing &&
    isReferenceOutputLoadingTaskState({
      taskState: item.taskState,
      previewText: item.previewText,
      cardPreviewUrl,
    });

  const hasRenderablePreview = Boolean(cardPreviewUrl);
  const hasPromptOnlyPreview = Boolean(item.previewText);
  const isDecodeBudgetHydrationPending =
    isImagePreview && decodeBudgetEnabled && !imageSrc && isPriorityHydration;
  const isMediaHydrating =
    !isFailing &&
    !isGenerationLoading &&
    hasRenderablePreview &&
    !hasPromptOnlyPreview &&
    (!isLoaded || isDecodeBudgetHydrationPending);

  const loadingVisual: ReferenceGridCardLoadingVisual = isGenerationLoading
    ? "spinner"
    : isMediaHydrating
      ? "hydrating"
      : "none";

  return {
    isFailing,
    isGenerationLoading,
    isMediaHydrating,
    isLoading: loadingVisual !== "none",
    loadingVisual,
  };
};
