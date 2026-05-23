/**
 * Character panel responsive layout metrics.
 * Maps the live embedded workspace width to bounded spacing and sizing values so
 * the Character panel keeps horizontal responsiveness without height-driven stretch.
 */

export type CharacterPanelResponsiveLayoutInput = {
  panelWidthPx: number;
  panelHeightPx: number;
  isEmbeddedMediaLibraryMaximized: boolean;
};

export type CharacterPanelResponsiveLayoutMetrics = {
  isCompactWidth: boolean;
  actionButtonMinWidthPx: number;
  actionButtonMinHeightPx: number;
  actionButtonHorizontalPaddingPx: number;
  contentGapPx: number;
  contentPaddingTopPx: number;
  contentPaddingXpx: number;
  contentPaddingBottomPx: number;
  editorWrapperGapPx: number;
  editorWrapperPaddingTopPx: number;
  editorWrapperPaddingXpx: number;
  editorWrapperPaddingBottomPx: number;
  topFieldsColumnGapPx: number;
  topFieldsRowGapPx: number;
  topFieldGroupGapPx: number;
  nameInputHeightPx: number;
  looksViewportMinHeightPx: number;
  looksViewportPaddingXpx: number;
  looksRailMinHeightPx: number;
  looksTabMinWidthPx: number;
  looksTabHeightPx: number;
  looksDeleteButtonTopPx: number;
  looksDeleteButtonRightPx: number;
  presetContentColumnGapPx: number;
  presetContentRowGapPx: number;
  descriptionCardGapPx: number;
  descriptionHeightPx: number;
  descriptionFooterMinHeightPx: number;
  descriptionContainerPaddingTopPx: number;
  descriptionContainerPaddingXpx: number;
  descriptionContainerPaddingBottomPx: number;
  descriptionTextareaPaddingYpx: number;
  referenceColumnGapPx: number;
  referenceGridGapPx: number;
  referenceCardMaxWidthPx: number;
  referenceActionInsetPx: number;
  referenceDeleteButtonSizePx: number;
  referenceMediaPaddingTopPx: number;
  referenceMediaPaddingXpx: number;
  referenceMediaPaddingBottomPx: number;
  referenceDropCopyGapPx: number;
  referenceDropIconSizePx: number;
  referenceHintMinHeightPx: number;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const normalize = (value: number, min: number, max: number): number => {
  if (max <= min) return 0;
  return clamp((value - min) / (max - min), 0, 1);
};

const interpolate = (min: number, max: number, progress: number): number =>
  min + (max - min) * clamp(progress, 0, 1);

const round = (value: number): number => Math.round(value);

const resolveReferenceCardHeightPx = (referenceCardMaxWidthPx: number): number =>
  round(referenceCardMaxWidthPx * (5 / 4));

/**
 * Resolves bounded layout metrics for the embedded Character panel workspace.
 */
export const resolveCharacterPanelResponsiveLayout = ({
  panelWidthPx,
  isEmbeddedMediaLibraryMaximized,
}: CharacterPanelResponsiveLayoutInput): CharacterPanelResponsiveLayoutMetrics => {
  const safeWidth = clamp(panelWidthPx || 0, 320, 960);
  const widthProgress = normalize(safeWidth, 360, 820);
  const balancedProgress = widthProgress;
  const referenceGrowthBoost = isEmbeddedMediaLibraryMaximized ? 0.1 : 0;
  const referenceProgress = clamp(widthProgress + referenceGrowthBoost, 0, 1);
  const referenceCardMaxWidthPx = round(interpolate(96, 150, referenceProgress));
  const referenceCardHeightPx = resolveReferenceCardHeightPx(referenceCardMaxWidthPx);

  return {
    isCompactWidth: safeWidth < 520,
    actionButtonMinWidthPx: round(interpolate(144, 164, widthProgress)),
    actionButtonMinHeightPx: round(interpolate(42, 48, balancedProgress)),
    actionButtonHorizontalPaddingPx: round(interpolate(16, 20, widthProgress)),
    contentGapPx: round(interpolate(6, 10, widthProgress)),
    contentPaddingTopPx: round(interpolate(10, 14, widthProgress)),
    contentPaddingXpx: round(interpolate(12, 16, widthProgress)),
    contentPaddingBottomPx: round(interpolate(2, 6, widthProgress)),
    editorWrapperGapPx: round(interpolate(0, 2, balancedProgress)),
    editorWrapperPaddingTopPx: round(interpolate(10, 14, widthProgress)),
    editorWrapperPaddingXpx: round(interpolate(6, 10, widthProgress)),
    editorWrapperPaddingBottomPx: round(interpolate(4, 8, widthProgress)),
    topFieldsColumnGapPx: round(interpolate(14, 26, widthProgress)),
    topFieldsRowGapPx: round(interpolate(8, 10, widthProgress)),
    topFieldGroupGapPx: round(interpolate(4, 8, balancedProgress)),
    nameInputHeightPx: round(interpolate(34, 40, balancedProgress)),
    looksViewportMinHeightPx: round(interpolate(34, 38, balancedProgress)),
    looksViewportPaddingXpx: round(interpolate(4, 6, widthProgress)),
    looksRailMinHeightPx: round(interpolate(34, 38, balancedProgress)),
    looksTabMinWidthPx: round(interpolate(64, 72, widthProgress)),
    looksTabHeightPx: round(interpolate(24, 28, balancedProgress)),
    looksDeleteButtonTopPx: round(interpolate(4, 5, balancedProgress)),
    looksDeleteButtonRightPx: round(interpolate(6, 7, widthProgress)),
    presetContentColumnGapPx: round(interpolate(16, 26, widthProgress)),
    presetContentRowGapPx: round(interpolate(10, 14, widthProgress)),
    descriptionCardGapPx: round(interpolate(4, 8, balancedProgress)),
    descriptionHeightPx: referenceCardHeightPx,
    descriptionFooterMinHeightPx: round(interpolate(10, 14, balancedProgress)),
    descriptionContainerPaddingTopPx: round(interpolate(10, 14, widthProgress)),
    descriptionContainerPaddingXpx: round(interpolate(12, 16, widthProgress)),
    descriptionContainerPaddingBottomPx: round(interpolate(22, 28, widthProgress)),
    descriptionTextareaPaddingYpx: round(interpolate(3, 5, balancedProgress)),
    referenceColumnGapPx: round(interpolate(6, 10, balancedProgress)),
    referenceGridGapPx: round(interpolate(8, 12, balancedProgress)),
    referenceCardMaxWidthPx,
    referenceActionInsetPx: round(interpolate(7, 10, balancedProgress)),
    referenceDeleteButtonSizePx: round(interpolate(18, 20, balancedProgress)),
    referenceMediaPaddingTopPx: round(interpolate(10, 14, widthProgress)),
    referenceMediaPaddingXpx: round(interpolate(6, 10, widthProgress)),
    referenceMediaPaddingBottomPx: round(interpolate(6, 8, widthProgress)),
    referenceDropCopyGapPx: round(interpolate(4, 6, balancedProgress)),
    referenceDropIconSizePx: round(interpolate(14, 16, balancedProgress)),
    referenceHintMinHeightPx: round(interpolate(28, 36, widthProgress)),
  };
};
