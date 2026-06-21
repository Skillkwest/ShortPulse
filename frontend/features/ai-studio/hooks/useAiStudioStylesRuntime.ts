/**
 * Shared AI Studio styles runtime authority.
 * Centralizes catalog assembly, shared ordering/deletion behavior, and selected-style derivation.
 */
import React from "react";
import type { Dispatch, SetStateAction } from "react";
import { useStylesLibraryDeletedStyleIdsPreference } from "./useStylesLibraryDeletedStyleIdsPreference";
import { useStylesLibraryPanelIdsPreference } from "./useStylesLibraryPanelIdsPreference";
import { useStylesLibraryStyleDetailsPreference } from "./useStylesLibraryStyleDetailsPreference";
import {
  buildBuiltInStyleTiles,
  type ExpertEditStyleTile,
} from "../components/edit/expertEditStyles";
import { useBuiltInStyleCatalog } from "./useBuiltInStyleCatalog";
import {
  reorderStylesLibraryOrderedIds,
  resolveOrderedStylesCatalog,
  type StylesLibraryReorderPlacement,
} from "../logic/stylesLibraryCatalog";
import type { StudioOutput } from "../types";

type UseAiStudioStylesRuntimeParams = {
  enabled?: boolean;
  selectedStyleId: string | null;
  setSelectedStyleId: Dispatch<SetStateAction<string | null>>;
  onSelectedStylePromptChange?: (stylePrompt: string | null) => void;
  onSelectedStyleContextChange?: (styleContext: StudioOutput["styleContext"] | null) => void;
};

const resolveStyleCatalogName = (style: {
  style?: string;
  title?: string;
  referenceImageName?: string;
}): string =>
  style.style?.trim() || style.title?.trim() || style.referenceImageName?.trim() || "Custom Style";

export const buildStylesCatalogWithDetails = (
  builtInStyles: readonly ExpertEditStyleTile[],
  styleDetailsById: Record<
    string,
    {
      style: string;
      title: string;
      referenceImageName: string;
      stylePrompt: string;
      previewImageUrl: string;
    }
  >
): ExpertEditStyleTile[] => {
  const builtInStyleIds = new Set(builtInStyles.map((style) => style.id));
  const overrideEntries = Object.entries(styleDetailsById);

  const customStyleTiles: ExpertEditStyleTile[] = overrideEntries
    .filter(([styleId]) => !builtInStyleIds.has(styleId))
    .map(([styleId, styleDetails]) => {
      const resolvedStyleName = resolveStyleCatalogName(styleDetails);
      return {
        id: styleId,
        style: resolvedStyleName,
        title: resolvedStyleName,
        referenceImageName: styleDetails.referenceImageName.trim() || resolvedStyleName,
        stylePrompt: styleDetails.stylePrompt.trim(),
        previewUrl: styleDetails.previewImageUrl.trim() || null,
        placeholder: false,
        source: "custom",
      };
    });

  return [...builtInStyles, ...customStyleTiles];
};

export const useAiStudioStylesRuntime = ({
  enabled = true,
  selectedStyleId,
  setSelectedStyleId,
  onSelectedStylePromptChange,
  onSelectedStyleContextChange,
}: UseAiStudioStylesRuntimeParams) => {
  const {
    styleDetailsById,
    error: styleDetailsSaveError,
    upsertStyleDetails,
    deleteStyleDetails,
  } = useStylesLibraryStyleDetailsPreference();
  const {
    deletedStyleIds,
    error: stylesDeleteError,
    deleteStyleId,
    restoreDeletedStyleIds,
  } = useStylesLibraryDeletedStyleIdsPreference();
  const { setStylePanelIds, removeStylePanelId, stylePanelIds } =
    useStylesLibraryPanelIdsPreference();
  const builtInStyleCatalog = useBuiltInStyleCatalog({ enabled });

  const builtInStyles = React.useMemo(
    () => buildBuiltInStyleTiles(builtInStyleCatalog.styleDefinitions),
    [builtInStyleCatalog.styleDefinitions]
  );

  const seededStyleIds = React.useMemo(
    () => new Set(builtInStyles.map((style) => style.id)),
    [builtInStyles]
  );

  const stylesCatalogWithOverrides = React.useMemo(
    () => buildStylesCatalogWithDetails(builtInStyles, styleDetailsById),
    [builtInStyles, styleDetailsById]
  );

  const visibleStylesCatalog = React.useMemo(() => {
    const deletedIdSet = deletedStyleIds.length > 0 ? new Set(deletedStyleIds) : null;
    const filteredStyles =
      deletedIdSet == null
        ? stylesCatalogWithOverrides
        : stylesCatalogWithOverrides.filter((style) => !deletedIdSet.has(style.id));
    return resolveOrderedStylesCatalog(filteredStyles, stylePanelIds);
  }, [deletedStyleIds, stylePanelIds, stylesCatalogWithOverrides]);

  const handleDeleteStyle = React.useCallback(
    async (styleId: string): Promise<boolean> => {
      const normalizedStyleId = styleId.trim();
      if (!normalizedStyleId) return false;
      if (seededStyleIds.has(normalizedStyleId)) {
        return deleteStyleId(normalizedStyleId);
      }
      const deleted = await deleteStyleDetails(normalizedStyleId);
      if (!deleted) return false;
      void removeStylePanelId(normalizedStyleId);
      return true;
    },
    [deleteStyleDetails, deleteStyleId, removeStylePanelId, seededStyleIds]
  );

  const handleReorderStyle = React.useCallback(
    (sourceStyleId: string, targetStyleId: string, placement?: StylesLibraryReorderPlacement) => {
      const nextOrder = reorderStylesLibraryOrderedIds(
        visibleStylesCatalog.map((style) => style.id),
        sourceStyleId,
        targetStyleId,
        placement
      );
      void setStylePanelIds(nextOrder);
    },
    [setStylePanelIds, visibleStylesCatalog]
  );

  const handleRestoreBuiltInStyles = React.useCallback(
    async (): Promise<boolean> => restoreDeletedStyleIds(),
    [restoreDeletedStyleIds]
  );

  React.useEffect(() => {
    if (!selectedStyleId) return;
    const styleStillVisible = visibleStylesCatalog.some((style) => style.id === selectedStyleId);
    if (!styleStillVisible) {
      setSelectedStyleId(null);
    }
  }, [selectedStyleId, setSelectedStyleId, visibleStylesCatalog]);

  const selectedStylePrompt = React.useMemo(() => {
    if (!selectedStyleId) return null;
    const selectedStyle = visibleStylesCatalog.find((style) => style.id === selectedStyleId);
    const normalizedPrompt = selectedStyle?.stylePrompt?.trim() ?? "";
    return normalizedPrompt.length ? normalizedPrompt : null;
  }, [selectedStyleId, visibleStylesCatalog]);

  const selectedStyleContext = React.useMemo<StudioOutput["styleContext"] | null>(() => {
    if (!selectedStyleId) return null;
    const selectedStyle = visibleStylesCatalog.find((style) => style.id === selectedStyleId);
    if (!selectedStyle || selectedStyle.placeholder) return null;
    const styleName =
      selectedStyle.style?.trim() ||
      selectedStyle.title?.trim() ||
      selectedStyle.referenceImageName?.trim() ||
      null;
    const stylePrompt = selectedStyle.stylePrompt?.trim() || null;
    const stylePreviewImageUrl = selectedStyle.previewUrl?.trim() || null;
    if (!styleName && !stylePrompt) return null;
    return {
      applied: true,
      styleId: selectedStyle.id,
      styleName,
      stylePrompt,
      ...(stylePreviewImageUrl ? { stylePreviewImageUrl } : {}),
    };
  }, [selectedStyleId, visibleStylesCatalog]);

  React.useEffect(() => {
    onSelectedStylePromptChange?.(selectedStylePrompt);
  }, [onSelectedStylePromptChange, selectedStylePrompt]);

  React.useEffect(() => {
    onSelectedStyleContextChange?.(selectedStyleContext);
  }, [onSelectedStyleContextChange, selectedStyleContext]);

  return {
    handleDeleteStyle,
    handleReorderStyle,
    handleRestoreBuiltInStyles,
    styleDetailsSaveError,
    stylesCatalogLoadError: builtInStyleCatalog.error,
    stylesDeleteError,
    upsertStyleDetails,
    visibleStylesCatalog,
  };
};
