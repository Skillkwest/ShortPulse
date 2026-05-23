/**
 * Character panel responsive layout metrics.
 * Maps the live embedded workspace size to bounded spacing and sizing values so
 * the Character panel breathes vertically without depending on shared CSS presets.
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

/**
 * Resolves bounded layout metrics for the embedded Character panel workspace.
 */
export const resolveCharacterPanelResponsiveLayout = ({
  panelWidthPx,
  panelHeightPx,
  isEmbeddedMediaLibraryMaximized,
}: CharacterPanelResponsiveLayoutInput): CharacterPanelResponsiveLayoutMetrics => {
  const safeWidth = clamp(panelWidthPx || 0, 320, 960);
  const safeHeight = clamp(panelHeightPx || 0, 220, 640);
  const widthProgress = normalize(safeWidth, 360, 820);
  const heightProgress = normalize(safeHeight, 240, 560);
  const balancedProgress = clamp(widthProgress * 0.38 + heightProgress * 0.62, 0, 1);
  const referenceGrowthBoost = isEmbeddedMediaLibraryMaximized ? 0.1 : 0;
  const referenceProgress = clamp(
    heightProgress * 0.68 + widthProgress * 0.32 + referenceGrowthBoost,
    0,
    1
  );

  return {
    isCompactWidth: safeWidth < 520,
    actionButtonMinWidthPx: round(interpolate(148, 172, widthProgress)),
    actionButtonMinHeightPx: round(interpolate(44, 52, balancedProgress)),
    actionButtonHorizontalPaddingPx: round(interpolate(18, 22, widthProgress)),
    contentGapPx: round(interpolate(8, 14, heightProgress)),
    contentPaddingTopPx: round(interpolate(12, 18, heightProgress)),
    contentPaddingXpx: round(interpolate(14, 20, widthProgress)),
    contentPaddingBottomPx: round(interpolate(4, 10, heightProgress)),
    editorWrapperGapPx: round(interpolate(2, 8, balancedProgress)),
    editorWrapperPaddingTopPx: round(interpolate(12, 16, heightProgress)),
    editorWrapperPaddingXpx: round(interpolate(8, 12, widthProgress)),
    editorWrapperPaddingBottomPx: round(interpolate(6, 10, heightProgress)),
    topFieldsColumnGapPx: round(interpolate(18, 34, widthProgress * 0.6 + heightProgress * 0.4)),
    topFieldsRowGapPx: round(interpolate(10, 14, heightProgress)),
    topFieldGroupGapPx: round(interpolate(6, 10, balancedProgress)),
    nameInputHeightPx: round(interpolate(36, 44, balancedProgress)),
    looksViewportMinHeightPx: round(interpolate(36, 42, balancedProgress)),
    looksViewportPaddingXpx: round(interpolate(4, 6, widthProgress)),
    looksRailMinHeightPx: round(interpolate(36, 42, balancedProgress)),
    looksTabMinWidthPx: round(interpolate(68, 78, widthProgress)),
    looksTabHeightPx: round(interpolate(26, 30, balancedProgress)),
    looksDeleteButtonTopPx: round(interpolate(5, 6, balancedProgress)),
    looksDeleteButtonRightPx: round(interpolate(6, 7, widthProgress)),
    presetContentColumnGapPx: round(
      interpolate(20, 34, widthProgress * 0.55 + heightProgress * 0.45)
    ),
    presetContentRowGapPx: round(interpolate(12, 18, heightProgress)),
    descriptionCardGapPx: round(interpolate(6, 10, balancedProgress)),
    descriptionHeightPx: round(interpolate(118, 196, heightProgress)),
    descriptionFooterMinHeightPx: round(interpolate(12, 16, balancedProgress)),
    descriptionContainerPaddingTopPx: round(interpolate(12, 16, heightProgress)),
    descriptionContainerPaddingXpx: round(interpolate(14, 18, widthProgress)),
    descriptionContainerPaddingBottomPx: round(interpolate(26, 32, heightProgress)),
    descriptionTextareaPaddingYpx: round(interpolate(4, 6, balancedProgress)),
    referenceColumnGapPx: round(interpolate(8, 14, balancedProgress)),
    referenceGridGapPx: round(interpolate(10, 16, balancedProgress)),
    referenceCardMaxWidthPx: round(interpolate(96, 150, referenceProgress)),
    referenceActionInsetPx: round(interpolate(7, 10, balancedProgress)),
    referenceDeleteButtonSizePx: round(interpolate(18, 20, balancedProgress)),
    referenceMediaPaddingTopPx: round(interpolate(12, 16, heightProgress)),
    referenceMediaPaddingXpx: round(interpolate(8, 12, widthProgress)),
    referenceMediaPaddingBottomPx: round(interpolate(8, 10, heightProgress)),
    referenceDropCopyGapPx: round(interpolate(4, 6, balancedProgress)),
    referenceDropIconSizePx: round(interpolate(14, 16, balancedProgress)),
    referenceHintMinHeightPx: round(interpolate(22, 28, heightProgress)),
  };
};
